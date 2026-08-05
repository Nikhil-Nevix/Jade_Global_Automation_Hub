"""Apache Superset integration: guest tokens for embeds + per-customer
authoring workspaces (private cloned dashboards opened in the Superset editor)."""
import hashlib
import hmac
import json
from urllib.parse import quote

import httpx

from app.core.config import settings

MASTER_TITLE = "Vulnerability Dashboard"
PRIVATE_TITLE = "Vulnerability Dashboard — {email}"
GAMMA_ROLE = "Gamma"


class SupersetError(Exception):
    pass


# ─── low-level helpers ───────────────────────────────────────────────────────
async def _login(client: httpx.AsyncClient) -> str:
    resp = await client.post(
        f"{settings.SUPERSET_URL}/api/v1/security/login",
        json={
            "username": settings.SUPERSET_ADMIN_USER,
            "password": settings.SUPERSET_ADMIN_PASSWORD,
            "provider": "db",
            "refresh": True,
        },
    )
    if resp.status_code != 200:
        raise SupersetError(f"Superset login failed: {resp.status_code} {resp.text}")
    return resp.json()["access_token"]


async def _csrf(client: httpx.AsyncClient, access_token: str) -> tuple[str, dict]:
    resp = await client.get(
        f"{settings.SUPERSET_URL}/api/v1/security/csrf_token/",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    if resp.status_code != 200:
        return "", {}
    return resp.json().get("result", ""), dict(resp.cookies)


def _headers(access_token: str, csrf: str = "") -> dict:
    h = {"Authorization": f"Bearer {access_token}"}
    if csrf:
        h["X-CSRFToken"] = csrf
    return h


def _filter_q(col: str, value: str) -> str:
    return quote(f"(filters:!((col:{col},opr:eq,value:'{value}')))", safe="")


def _ns_email(email: str) -> str:
    """Namespaced Superset email so a customer account never collides with an
    existing Superset user (e.g. the service admin sharing the same address)."""
    local, _, domain = email.partition("@")
    return f"{local}+hub@{domain}" if domain else f"{email}+hub"


def _derive_password(email: str) -> str:
    """Deterministic per-user Superset password derived from the app secret.
    Never stored; recomputed when the auth bridge needs it."""
    digest = hmac.new(
        settings.SECRET_KEY.encode(), f"superset:{email}".encode(), hashlib.sha256
    ).hexdigest()
    return "Sx9!" + digest[:28]


# ─── guest token (read-only embed) ───────────────────────────────────────────
async def _embed_uuid_for(client: httpx.AsyncClient, token: str, email: str) -> str:
    """Return the customer's private dashboard embed UUID if it exists, else the
    shared master embed UUID."""
    title = PRIVATE_TITLE.format(email=email)
    resp = await client.get(
        f"{settings.SUPERSET_URL}/api/v1/dashboard/?q={_filter_q('dashboard_title', title)}",
        headers=_headers(token),
    )
    if resp.status_code == 200 and resp.json().get("count"):
        dash_id = resp.json()["result"][0]["id"]
        emb = await client.get(
            f"{settings.SUPERSET_URL}/api/v1/dashboard/{dash_id}/embedded",
            headers=_headers(token),
        )
        if emb.status_code == 200:
            return emb.json()["result"]["uuid"]
    return settings.SUPERSET_DASHBOARD_ID


async def generate_guest_token(username: str, email: str | None = None, run_id: int | None = None) -> tuple[str, str]:
    """Returns (guest_token, embed_uuid). Uses the customer's private dashboard
    when present so their saved customizations show in the read-only embed.
    When run_id is provided, injects an RLS clause so all charts filter to that scan."""
    if not settings.SUPERSET_DASHBOARD_ID:
        raise SupersetError("SUPERSET_DASHBOARD_ID is not configured")

    async with httpx.AsyncClient(timeout=20) as client:
        access_token = await _login(client)
        csrf_token, cookies = await _csrf(client, access_token)
        embed_uuid = await _embed_uuid_for(client, access_token, email) if email else settings.SUPERSET_DASHBOARD_ID

        rls = [{"clause": f"scan_run_id = {run_id}"}] if run_id is not None else []
        payload = {
            "resources": [{"type": "dashboard", "id": embed_uuid}],
            "rls": rls,
            "user": {"username": username},
        }
        resp = await client.post(
            f"{settings.SUPERSET_URL}/api/v1/security/guest_token/",
            json=payload, headers=_headers(access_token, csrf_token), cookies=cookies,
        )
        if resp.status_code != 200:
            raise SupersetError(f"Guest token request failed: {resp.status_code} {resp.text}")
        return resp.json()["token"], embed_uuid


# ─── per-customer authoring workspace ────────────────────────────────────────
async def _role_id(client, token, name) -> int:
    r = await client.get(
        f"{settings.SUPERSET_URL}/api/v1/security/roles/?q={_filter_q('name', name)}",
        headers=_headers(token),
    )
    res = r.json().get("result", [])
    if not res:
        raise SupersetError(f"Superset role {name!r} not found")
    return res[0]["id"]


async def _ensure_user(client, token, csrf, cookies, email, first, last) -> str:
    """Ensure a Gamma Superset user exists for this email; return its password."""
    password = _derive_password(email)
    r = await client.get(
        f"{settings.SUPERSET_URL}/api/v1/security/users/?q={_filter_q('username', email)}",
        headers=_headers(token),
    )
    if r.status_code == 200 and r.json().get("count"):
        return password  # already provisioned with the deterministic password
    gamma = await _role_id(client, token, GAMMA_ROLE)
    cr = await client.post(
        f"{settings.SUPERSET_URL}/api/v1/security/users/",
        json={"active": True, "first_name": first or email.split("@")[0],
              "last_name": last or "(Hub)", "email": _ns_email(email), "username": email,
              "password": password, "roles": [gamma]},
        headers=_headers(token, csrf), cookies=cookies,
    )
    if cr.status_code not in (200, 201):
        raise SupersetError(f"Create Superset user failed: {cr.status_code} {cr.text}")
    return password


async def _dashboard_id_by_title(client, token, title) -> int | None:
    r = await client.get(
        f"{settings.SUPERSET_URL}/api/v1/dashboard/?q={_filter_q('dashboard_title', title)}",
        headers=_headers(token),
    )
    if r.status_code == 200 and r.json().get("count"):
        return r.json()["result"][0]["id"]
    return None


async def _enable_embed(client, token, csrf, cookies, dash_id) -> str:
    # POST is an idempotent upsert that keeps the same embed uuid, so always
    # (re)apply the configured allowed_domains — this keeps existing embeds in
    # sync when the domain list changes (a stale list causes 403s on the embed).
    r = await client.post(
        f"{settings.SUPERSET_URL}/api/v1/dashboard/{dash_id}/embedded",
        json={"allowed_domains": settings.SUPERSET_ALLOWED_EMBED_DOMAINS},
        headers=_headers(token, csrf), cookies=cookies,
    )
    if r.status_code not in (200, 201):
        raise SupersetError(f"Enable embedding failed: {r.status_code} {r.text}")
    return r.json()["result"]["uuid"]


async def _ensure_private_dashboard(client, token, csrf, cookies, email, user_id) -> int:
    """Clone the master into a private, customer-owned dashboard (own chart
    copies) on first use. Returns the private dashboard id."""
    title = PRIVATE_TITLE.format(email=email)
    existing = await _dashboard_id_by_title(client, token, title)
    if existing:
        return existing

    master_id = await _dashboard_id_by_title(client, token, MASTER_TITLE)
    if not master_id:
        raise SupersetError("Master dashboard not found")
    master = (await client.get(
        f"{settings.SUPERSET_URL}/api/v1/dashboard/{master_id}", headers=_headers(token)
    )).json()["result"]

    metadata = json.loads(master["json_metadata"])
    metadata["positions"] = json.loads(master["position_json"])
    cr = await client.post(
        f"{settings.SUPERSET_URL}/api/v1/dashboard/{master_id}/copy/",
        json={"dashboard_title": title, "duplicate_slices": True,
              "css": master.get("css") or "", "json_metadata": json.dumps(metadata)},
        headers=_headers(token, csrf), cookies=cookies,
    )
    if cr.status_code not in (200, 201):
        raise SupersetError(f"Clone dashboard failed: {cr.status_code} {cr.text}")
    new_id = cr.json()["result"]["id"]
    await client.put(
        f"{settings.SUPERSET_URL}/api/v1/dashboard/{new_id}",
        json={"owners": [user_id], "published": True},
        headers=_headers(token, csrf), cookies=cookies,
    )
    return new_id


async def _user_id(client, token, email) -> int:
    r = await client.get(
        f"{settings.SUPERSET_URL}/api/v1/security/users/?q={_filter_q('username', email)}",
        headers=_headers(token),
    )
    return r.json()["result"][0]["id"]


async def ensure_customer_workspace(email: str, first: str = "", last: str = "") -> dict:
    """Provision (idempotently) the customer's Superset account + private editable
    dashboard, and return everything the auth-bridge page needs."""
    if not settings.SUPERSET_DASHBOARD_ID:
        raise SupersetError("SUPERSET_DASHBOARD_ID is not configured")
    async with httpx.AsyncClient(timeout=30) as client:
        token = await _login(client)
        csrf, cookies = await _csrf(client, token)
        password = await _ensure_user(client, token, csrf, cookies, email, first, last)
        user_id = await _user_id(client, token, email)
        dash_id = await _ensure_private_dashboard(client, token, csrf, cookies, email, user_id)
        await _enable_embed(client, token, csrf, cookies, dash_id)
        return {
            "superset_domain": settings.SUPERSET_PUBLIC_URL,
            "username": email,
            "password": password,
            "dashboard_id": dash_id,
            "edit_path": f"/superset/dashboard/{dash_id}/?edit=true",
        }
