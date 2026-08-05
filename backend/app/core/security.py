from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from jose import jwt, JWTError

from app.core.config import settings


# ─── Password hashing (bcrypt directly, matching legacy behaviour) ────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# ─── JWT ──────────────────────────────────────────────────────────────────────

def _create_token(subject: str, claims: dict, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
        "type": token_type,
        **claims,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(user_id: int, username: str, role: str, domain: str) -> str:
    return _create_token(
        subject=str(user_id),
        claims={"username": username, "role": role, "domain": domain},
        expires_delta=settings.access_token_expires,
        token_type="access",
    )


def create_refresh_token(user_id: int, username: str, role: str, domain: str) -> str:
    return _create_token(
        subject=str(user_id),
        claims={"username": username, "role": role, "domain": domain},
        expires_delta=settings.refresh_token_expires,
        token_type="refresh",
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
