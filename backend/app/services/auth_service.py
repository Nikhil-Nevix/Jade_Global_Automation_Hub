from datetime import datetime
from typing import Optional

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
)
from app.models import User
from app.services.audit_service import create_audit_log


class AuthError(Exception):
    """Raised on authentication / registration failure."""


async def register_user(
    db: AsyncSession,
    *,
    username: str,
    email: str,
    password: str,
    role: str = "user",
) -> User:
    email = email.lower()

    existing = await db.execute(
        select(User).where(or_(User.username == username, User.email == email))
    )
    if existing.scalar_one_or_none() is not None:
        raise AuthError("Username or email already exists")

    domain = settings.get_domain_group(email)

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        role=role,
        domain=domain,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    await create_audit_log(
        db, user_id=user.id, action="CREATE", resource_type="user",
        resource_id=user.id, details={"username": username, "role": role, "domain": domain},
    )
    await db.commit()
    await db.refresh(user)
    return user


async def authenticate(
    db: AsyncSession,
    *,
    username: str,
    password: str,
    ip_address: Optional[str] = None,
) -> dict:
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.password_hash):
        await create_audit_log(
            db, user_id=None, action="LOGIN_FAILED", resource_type="user",
            details={"username": username}, ip_address=ip_address,
        )
        await db.commit()
        raise AuthError("Invalid username or password")

    if not user.is_active:
        raise AuthError("User account is disabled")

    user.last_login = datetime.utcnow()
    await create_audit_log(
        db, user_id=user.id, action="LOGIN", resource_type="user",
        resource_id=user.id, details={"username": username}, ip_address=ip_address,
    )
    await db.commit()
    await db.refresh(user)

    return {
        "access_token": create_access_token(user.id, user.username, user.role, user.domain),
        "refresh_token": create_refresh_token(user.id, user.username, user.role, user.domain),
        "user": user,
    }


async def change_password(
    db: AsyncSession, *, user: User, old_password: str, new_password: str
) -> None:
    if not verify_password(old_password, user.password_hash):
        raise AuthError("Current password is incorrect")
    user.password_hash = hash_password(new_password)
    await create_audit_log(
        db, user_id=user.id, action="PASSWORD_CHANGE", resource_type="user",
        resource_id=user.id, details={"username": user.username},
    )
    await db.commit()
