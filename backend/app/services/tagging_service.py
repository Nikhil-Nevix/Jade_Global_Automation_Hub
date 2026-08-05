"""Marvel naming-convention grouping.

Hostnames follow ``{role}-{env}-{NNNN}.company.local`` (e.g. ``web-pro-0578``).
This service parses that convention and materialises three tag *categories* on each
server — environment, role and location — so the estate can be grouped and reported
on per environment. Canonical labels are chosen to match the values already stored on
``vulnerability_findings`` (``asset_group`` / ``server_role`` / ``location``) so the
server-side grouping and the finding-side reporting line up exactly.
"""
from typing import Optional, Dict, List, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Server, Tag

# ── tag categories ────────────────────────────────────────────────────────────
CAT_ENVIRONMENT = "environment"
CAT_ROLE = "role"
CAT_LOCATION = "location"
CATEGORIES = (CAT_ENVIRONMENT, CAT_ROLE, CAT_LOCATION)

# ── canonical label maps (hostname segment → finding-aligned label) ───────────
# env segment → asset_group label used in vulnerability_findings
ENV_LABELS: Dict[str, str] = {
    "dev": "Development",
    "qa": "QA",
    "sta": "Staging",
    "uat": "UAT",
    "pro": "Production",
    "dr": "DR",
    "dmz": "DMZ",
}
# role segment → server_role label used in vulnerability_findings
ROLE_LABELS: Dict[str, str] = {
    "web": "Web",
    "db": "DB",
    "api": "API",
    "app": "App",
    "file": "File",
    "proxy": "Proxy",
    "dns": "DNS",
    "backup": "Backup",
    "monitoring": "Monitoring",
    "docker": "Docker",
    "kubernetes": "Kubernetes",
    "gitlab": "GitLab",
    "jenkins": "Jenkins",
    "domaincontroller": "DomainController",
}


def parse_hostname(hostname: Optional[str]) -> Dict[str, Optional[str]]:
    """Split a Marvel-convention hostname into its role and environment labels.

    Returns canonical labels (or ``None`` when a segment is missing/unknown).
    Tolerant of the ``.company.local`` suffix, case, and hostnames that are bare
    IPs (returns all ``None``).
    """
    role = env = None
    if hostname:
        base = hostname.strip().split(".", 1)[0].lower()
        parts = base.split("-")
        if len(parts) >= 3:
            role = ROLE_LABELS.get(parts[0])
            env = ENV_LABELS.get(parts[1])
    return {"role": role, "environment": env}


def derive_tags(server: Server) -> List[Tuple[str, str]]:
    """The (category, label) tags a server should carry, derived from its hostname
    and location column. Order: environment, role, location."""
    parsed = parse_hostname(server.hostname)
    tags: List[Tuple[str, str]] = []
    if parsed["environment"]:
        tags.append((CAT_ENVIRONMENT, parsed["environment"]))
    if parsed["role"]:
        tags.append((CAT_ROLE, parsed["role"]))
    if server.location:
        tags.append((CAT_LOCATION, server.location))
    return tags


async def _get_or_create_tag(db: AsyncSession, category: str, name: str,
                             cache: Dict[str, Tag]) -> Tag:
    """Fetch (or create) the tag with this name. Tag names are globally unique, so
    an existing same-named tag is reused and back-filled with its category."""
    if name in cache:
        return cache[name]
    tag = (await db.execute(select(Tag).where(Tag.name == name))).scalar_one_or_none()
    if tag is None:
        tag = Tag(name=name, category=category,
                  description=f"Auto-generated {category} group")
        db.add(tag)
        await db.flush()
    elif tag.category is None:
        tag.category = category
    cache[name] = tag
    return tag


async def sync_server_tags(db: AsyncSession, server: Server,
                           cache: Optional[Dict[str, Tag]] = None) -> int:
    """Ensure ``server`` carries its derived category tags. Additive — it never
    removes manually-assigned tags. Returns how many new associations were added.
    Caller is responsible for committing. ``server.tags`` must be loaded."""
    if cache is None:
        cache = {}
    existing = {t.name for t in server.tags}
    added = 0
    for category, name in derive_tags(server):
        if name not in existing:
            server.tags.append(await _get_or_create_tag(db, category, name, cache))
            existing.add(name)
            added += 1
    return added


async def backfill_all(db: AsyncSession) -> Dict[str, int]:
    """Derive and attach category tags for every active server. Idempotent.
    Returns a small summary."""
    servers = (await db.execute(
        select(Server).options(selectinload(Server.tags)).where(Server.is_active.is_(True))
    )).scalars().all()
    cache: Dict[str, Tag] = {}
    servers_tagged = 0
    associations_added = 0
    for server in servers:
        added = await sync_server_tags(db, server, cache)
        if added:
            servers_tagged += 1
            associations_added += added
    await db.commit()
    tag_total = (await db.execute(
        select(func.count()).select_from(Tag).where(Tag.category.in_(CATEGORIES))
    )).scalar_one()
    return {
        "servers_processed": len(servers),
        "servers_updated": servers_tagged,
        "associations_added": associations_added,
        "category_tags": tag_total,
    }
