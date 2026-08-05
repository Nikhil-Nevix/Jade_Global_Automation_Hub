"""Seed an initial super_admin user for the merged app.

Usage:
    ./venv/bin/python seed_admin.py [username] [email] [password]

Defaults: admin / admin@jadeglobal.com / Admin@123 (change the password after first login).
Idempotent — if a user with the username or email already exists, it is left as-is.
"""
import sys

from app.core.sync_db import get_sync_session
from app.core.security import hash_password
from app.core.config import settings
from app.models import User


def main():
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    email = (sys.argv[2] if len(sys.argv) > 2 else "admin@jadeglobal.com").lower()
    password = sys.argv[3] if len(sys.argv) > 3 else "Admin@123"

    with get_sync_session() as session:
        existing = session.query(User).filter(
            (User.username == username) | (User.email == email)
        ).first()
        if existing:
            print(f"User already exists: {existing.username} <{existing.email}> "
                  f"(role={existing.role}). Nothing to do.")
            return
        user = User(
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="super_admin",
            domain=settings.get_domain_group(email),
            is_active=True,
        )
        session.add(user)
        session.commit()
        print(f"Created super_admin '{username}' <{email}>. Password: {password}")
        print("→ Log in and change this password immediately.")


if __name__ == "__main__":
    main()
