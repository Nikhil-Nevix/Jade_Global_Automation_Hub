from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List
from datetime import timedelta
import os


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_ENV: str = "development"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://infraansible_user:password@localhost:5432/infraansible"

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"

    # MinIO
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "vulnerability-reports"
    MINIO_SECURE: bool = False

    # Superset
    # Server-side base URL the backend uses to call Superset's API.
    SUPERSET_URL: str = "http://localhost:8088"
    # Browser-facing Superset base URL (what the iframe loads). In local dev the
    # browser reaches Superset via VS Code's forwarded :8088 port. Set this to the
    # public URL when deploying behind a reverse proxy.
    SUPERSET_PUBLIC_URL: str = "http://localhost:8088"
    SUPERSET_ADMIN_USER: str = "admin"
    SUPERSET_ADMIN_PASSWORD: str = "admin"
    SUPERSET_DASHBOARD_ID: str = ""
    # Origins allowed to embed customer dashboards (must match Superset's frame-ancestors)
    SUPERSET_ALLOWED_EMBED_DOMAINS: List[str] = [
        "http://localhost:5173", "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:9191", "http://localhost:8000",
        "https://10.30.1.113", "http://10.30.1.113",
        "http://10.30.1.113:5175",
    ]

    # File storage
    UPLOAD_FOLDER: str = "/var/lib/infraansible/playbooks"
    REPORTS_DIR: str = "/var/lib/infraansible/reports"
    ANSIBLE_RUNNER_DIR: str = "/var/lib/infraansible/ansible-runner"
    ANSIBLE_PRIVATE_KEY_DIR: str = "/var/lib/infraansible/keys"

    # Backend URL (used by ansible playbooks for callbacks)
    BACKEND_URL: str = "http://0.0.0.0:8000"

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:9191"

    # Vulnerability scan schedule (seconds)
    VULN_SCAN_INTERVAL_SECONDS: int = 3600

    # Server metrics refresh schedule (seconds)
    SERVER_METRICS_INTERVAL_SECONDS: int = 300

    # ─── SMTP / Email notifications (ported from InfraAnsible VM) ──────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "Jade Global Automation Hub"
    SMTP_ENABLED: bool = False

    # Logging
    LOG_LEVEL: str = "INFO"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def access_token_expires(self) -> timedelta:
        return timedelta(minutes=self.ACCESS_TOKEN_EXPIRE_MINUTES)

    @property
    def refresh_token_expires(self) -> timedelta:
        return timedelta(days=self.REFRESH_TOKEN_EXPIRE_DAYS)

    # Allowed email domains → group name
    DOMAIN_MAP: dict = {
        "jadeglobal.com": "jadeglobal",
        "intuitivesurgicals.com": "intuitivesurgicals",
        "client.com": "client",
    }

    def get_domain_group(self, email: str) -> str:
        domain = email.split("@")[-1].lower()
        return self.DOMAIN_MAP.get(domain, "unknown")


settings = Settings()
