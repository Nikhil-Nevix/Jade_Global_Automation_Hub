# Developer's Documentation
### InfraAnsible — Vulnerability Update

> This document is the single source of truth for any developer onboarding onto this project.
> Read it fully before touching any code.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Versions](#2-tech-stack--versions)
3. [System Architecture](#3-system-architecture)
4. [Repository Structure](#4-repository-structure)
5. [Prerequisites & Local Setup](#5-prerequisites--local-setup)
6. [Environment Variables](#6-environment-variables)
7. [Database Schema (PostgreSQL)](#7-database-schema-postgresql)
8. [Backend — FastAPI](#8-backend--fastapi)
9. [Async Tasks — Celery](#9-async-tasks--celery)
10. [File Storage — MinIO](#10-file-storage--minio)
11. [Vulnerability Data Pipeline](#11-vulnerability-data-pipeline)
12. [Dashboard — Apache Superset](#12-dashboard--apache-superset)
13. [Frontend — React](#13-frontend--react)
14. [RBAC & Authentication](#14-rbac--authentication)
15. [WebSocket & Real-time Logs](#15-websocket--real-time-logs)
16. [Deployment Guide](#16-deployment-guide)
17. [Port Reference](#17-port-reference)
18. [Coding Conventions](#18-coding-conventions)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Project Overview

**InfraAnsible** is an internal web application for managing and executing Ansible playbooks across server infrastructure. The **Vulnerability Update** is a complete rewrite of the application with an added vulnerability scanning and visualization pipeline.

### What the application does
- Manages a server inventory (grouped by tags)
- Uploads, stores, and executes Ansible playbooks against selected servers
- Streams real-time execution logs to the user via WebSocket
- Runs a vulnerability scanning playbook on-demand or on a 1-hour schedule
- Collects vulnerability scan output (CSV), stores it in MinIO and PostgreSQL
- Renders an interactive Apache Superset dashboard embedded in the React frontend for visualizing CVE data, severity trends, patch status, and compliance metrics

### What changed from the previous version
| Was | Now |
|---|---|
| Flask 3.0 | FastAPI |
| MySQL / MariaDB | PostgreSQL |
| No file storage | MinIO |
| Custom React client dashboard | Apache Superset embedded dashboard |
| Gunicorn | Uvicorn |

---

## 2. Tech Stack & Versions

| Technology | Version | Role |
|---|---|---|
| **Python** | 3.11+ | Backend language |
| **FastAPI** | 0.111+ | REST API framework |
| **Uvicorn** | 0.29+ | ASGI server |
| **SQLAlchemy** | 2.0+ | ORM |
| **Alembic** | 1.13+ | Database migrations |
| **PostgreSQL** | 15+ | Primary database |
| **asyncpg** | 0.29+ | Async PostgreSQL driver |
| **Celery** | 5.3+ | Async task queue |
| **Celery Beat** | 5.3+ | Scheduled task runner |
| **Redis** | 7.0+ | Celery broker + result backend |
| **MinIO** | Latest | Object storage for CSV files |
| **minio (Python SDK)** | 7.2+ | MinIO client |
| **Apache Superset** | 3.1+ | Embedded analytics dashboard |
| **ansible-runner** | 2.3+ | Ansible execution |
| **ansible** | 8.7+ | Playbook engine |
| **paramiko** | 3.4+ | SSH/SCP for remote file retrieval |
| **python-jose** | 3.3+ | JWT auth |
| **passlib[bcrypt]** | 1.7+ | Password hashing |
| **python-dotenv** | 1.0+ | Environment variable loading |
| **React** | 18+ | Frontend framework |
| **TypeScript** | 5+ | Frontend language |
| **Vite** | 5+ | Frontend build tool |
| **Tailwind CSS** | 3+ | Frontend styling |
| **Nginx** | 1.24+ | Reverse proxy |

---

## 3. System Architecture

### Component Diagram

```
┌──────────────────────────────────────────────────────┐
│                    Same VM                            │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │            React Frontend (Nginx)            │     │
│  │  - All app pages                            │     │
│  │  - Vulnerability Dashboard (Superset iframe) │     │
│  └────────────────────┬────────────────────────┘     │
│                       │ HTTP/WS                       │
│  ┌────────────────────▼────────────────────────┐     │
│  │         FastAPI Backend (:8000)              │     │
│  │  - REST API (auth, servers, playbooks,       │     │
│  │    jobs, users, notifications, vuln)         │     │
│  │  - WebSocket (real-time job logs)            │     │
│  │  - Guest token generator for Superset        │     │
│  └──┬──────────┬──────────┬────────────────────┘     │
│     │          │          │                           │
│  ┌──▼──┐  ┌───▼───┐  ┌───▼──────┐                   │
│  │ PG  │  │ MinIO │  │  Redis   │                   │
│  │:5432│  │:9000  │  │  :6379   │                   │
│  └─────┘  └───────┘  └────┬─────┘                   │
│                            │                          │
│                    ┌───────▼────────┐                 │
│                    │ Celery Worker  │                 │
│                    │ + Celery Beat  │                 │
│                    │ (Ansible runs) │                 │
│                    └───────────────┘                 │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │       Apache Superset (:8088)                │     │
│  │  - Reads from PostgreSQL                    │     │
│  │  - Guest token API for embedding            │     │
│  └─────────────────────────────────────────────┘     │
│                                                      │
│  ┌─────────────────────────────────────────────┐     │
│  │   Existing Flask App (untouched, old port)   │     │
│  └─────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

### Request Flow — Normal API Call
```
Browser → Nginx → FastAPI (:8000) → PostgreSQL
```

### Request Flow — Playbook Execution
```
Browser → FastAPI → Celery Task (Redis queue)
                         │
                    ansible-runner executes playbook
                         │
                    Real-time logs → WebSocket → Browser
                         │
                    CSV path parsed from logs
                         │
                    CSV fetched (local FS or SCP from server)
                         │
                    ┌────┴────┐
                    ▼         ▼
                  MinIO    PostgreSQL
                (raw file) (parsed rows)
```

### Request Flow — Vulnerability Dashboard
```
Browser → FastAPI (/api/superset/guest-token)
              │
         FastAPI calls Superset API → returns guest token
              │
         Token sent to React
              │
         React renders <iframe> with Superset dashboard + token
              │
         Superset queries PostgreSQL (vulnerability_findings table)
```

---

## 4. Repository Structure

```
InfraAnsible_Vulnerability/
├── backend/                        # FastAPI application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── config.py               # Settings via pydantic-settings
│   │   ├── database.py             # SQLAlchemy async engine + session
│   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   ├── server.py
│   │   │   ├── tag.py
│   │   │   ├── playbook.py
│   │   │   ├── job.py
│   │   │   ├── scan_run.py
│   │   │   ├── vulnerability_finding.py
│   │   │   └── notification.py
│   │   ├── schemas/                # Pydantic request/response schemas
│   │   ├── api/                    # Route handlers (routers)
│   │   │   ├── auth.py
│   │   │   ├── servers.py
│   │   │   ├── tags.py
│   │   │   ├── playbooks.py
│   │   │   ├── jobs.py
│   │   │   ├── users.py
│   │   │   ├── notifications.py
│   │   │   ├── vulnerability.py
│   │   │   └── superset.py         # Guest token endpoint
│   │   ├── services/               # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── job_service.py
│   │   │   ├── playbook_service.py
│   │   │   ├── server_service.py
│   │   │   ├── minio_service.py
│   │   │   ├── csv_parser.py
│   │   │   └── superset_service.py
│   │   ├── tasks/                  # Celery tasks
│   │   │   ├── celery_app.py
│   │   │   ├── job_tasks.py        # Playbook execution task
│   │   │   └── scheduler.py       # Celery Beat schedule config
│   │   ├── websocket/
│   │   │   └── job_logs.py        # WebSocket log streaming
│   │   └── utils/
│   │       ├── security.py        # JWT + password helpers
│   │       ├── log_parser.py      # CSV path extraction from logs
│   │       └── ssh_client.py      # SCP file retrieval
│   ├── alembic/                   # DB migrations
│   │   ├── env.py
│   │   └── versions/
│   ├── alembic.ini
│   ├── requirements.txt
│   └── .env
│
├── frontend/                      # React + TypeScript app (unchanged structure)
│   ├── src/
│   │   ├── api/                   # Axios API calls → FastAPI
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── VulnerabilityDashboard/  # New — Superset embedded
│   │   │   └── ...                      # Existing pages (updated API calls)
│   │   ├── store/                 # State management
│   │   └── types/
│   └── ...
│
├── deploy/                        # Systemd service files + Nginx config
├── Documentation/                 # Project docs (you are here)
└── Images/
```

---

## 5. Prerequisites & Local Setup

### System Requirements
- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- MinIO server
- Apache Superset
- Ansible 8+

### Step 1 — Clone and navigate
```bash
git clone <repo-url>
cd InfraAnsible_Vulnerability
```

### Step 2 — Backend setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Step 3 — PostgreSQL setup
```bash
sudo -u postgres psql
CREATE DATABASE infraansible;
CREATE USER infraansible_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE infraansible TO infraansible_user;
\q
```

### Step 4 — Run database migrations
```bash
cd backend
alembic upgrade head
```

### Step 5 — MinIO setup
```bash
# Download and run MinIO (single-node dev setup)
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
./minio server /data/minio --console-address ":9001"
# Access console at http://localhost:9001 (default: minioadmin / minioadmin)
# Create bucket: vulnerability-reports
```

### Step 6 — Superset setup
```bash
pip install apache-superset
superset db upgrade
superset fab create-admin  # create admin user
superset init
superset run -p 8088 --with-threads --reload --debugger
```

> Enable embedded dashboards in Superset:
> Set `FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}` in `superset_config.py`

### Step 7 — Redis
```bash
sudo systemctl start redis
```

### Step 8 — Start Celery worker and beat
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info &
celery -A app.tasks.celery_app beat --loglevel=info &
```

### Step 9 — Start FastAPI backend
```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 10 — Start Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 6. Environment Variables

Create `backend/.env` based on this template:

```env
# Application
APP_ENV=development
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://infraansible_user:yourpassword@localhost:5432/infraansible

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=vulnerability-reports
MINIO_SECURE=false

# Superset
SUPERSET_URL=http://localhost:8088
SUPERSET_ADMIN_USER=admin
SUPERSET_ADMIN_PASSWORD=yourpassword
SUPERSET_DASHBOARD_ID=<dashboard-uuid-from-superset>

# Ansible
ANSIBLE_PLAYBOOKS_DIR=/opt/infraansible/playbooks

# Scheduled Scan
VULN_SCAN_INTERVAL_SECONDS=3600
```

---

## 7. Database Schema (PostgreSQL)

### users
```sql
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(80) UNIQUE NOT NULL,
    email       VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role        VARCHAR(20) NOT NULL DEFAULT 'user',  -- super_admin | admin | user
    domain      VARCHAR(50) NOT NULL,                 -- jadeglobal | intuitivesurgicals | client
    is_active   BOOLEAN NOT NULL DEFAULT true,
    timezone    VARCHAR(50) NOT NULL DEFAULT 'UTC',
    last_login  TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### tags
```sql
CREATE TABLE tags (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by  INTEGER REFERENCES users(id),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### servers
```sql
CREATE TABLE servers (
    id              SERIAL PRIMARY KEY,
    hostname        VARCHAR(255),
    ip_address      VARCHAR(45) UNIQUE NOT NULL,
    os_type         VARCHAR(50),
    os_version      VARCHAR(50),
    ssh_port        INTEGER NOT NULL DEFAULT 22,
    ssh_user        VARCHAR(50) NOT NULL DEFAULT 'root',
    ssh_key_path    VARCHAR(500),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    cpu_usage       FLOAT DEFAULT 0.0,
    memory_usage    FLOAT DEFAULT 0.0,
    disk_usage      FLOAT DEFAULT 0.0,
    last_monitored  TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### server_tags (many-to-many)
```sql
CREATE TABLE server_tags (
    server_id   INTEGER REFERENCES servers(id) ON DELETE CASCADE,
    tag_id      INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (server_id, tag_id)
);
```

### playbooks
```sql
CREATE TABLE playbooks (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(255) UNIQUE NOT NULL,
    description         TEXT,
    file_path           VARCHAR(500) NOT NULL,
    is_folder           BOOLEAN NOT NULL DEFAULT false,
    main_playbook_file  VARCHAR(255),
    file_structure      JSONB,
    file_count          INTEGER NOT NULL DEFAULT 1,
    total_size_kb       INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### jobs
```sql
CREATE TABLE jobs (
    id              SERIAL PRIMARY KEY,
    job_id          VARCHAR(36) UNIQUE NOT NULL,   -- UUID
    parent_job_id   INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    is_batch_job    BOOLEAN NOT NULL DEFAULT false,
    batch_config    JSONB,
    playbook_id     INTEGER NOT NULL REFERENCES playbooks(id),
    server_id       INTEGER NOT NULL REFERENCES servers(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    celery_task_id  VARCHAR(255),
    extra_vars      JSONB,
    error_message   TEXT,
    patch_report    TEXT,
    report_files    JSONB,
    result_summary  JSONB,
    csv_minio_path  VARCHAR(500),   -- MinIO object path if CSV was produced
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### job_logs
```sql
CREATE TABLE job_logs (
    id          BIGSERIAL PRIMARY KEY,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    content     TEXT NOT NULL,
    log_level   VARCHAR(20),
    timestamp   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_job_logs_job_id ON job_logs(job_id, line_number);
```

### scan_runs
```sql
CREATE TABLE scan_runs (
    id              SERIAL PRIMARY KEY,
    run_id          VARCHAR(36) UNIQUE NOT NULL,   -- UUID
    trigger_type    VARCHAR(20) NOT NULL,          -- scheduled | on_demand
    triggered_by    INTEGER REFERENCES users(id),  -- NULL for scheduled
    server_count    INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    minio_path      VARCHAR(500),                  -- raw CSV path in MinIO
    error_message   TEXT,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### vulnerability_findings
```sql
CREATE TABLE vulnerability_findings (
    id                      BIGSERIAL PRIMARY KEY,
    scan_run_id             INTEGER NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,
    ip                      VARCHAR(45),
    network                 VARCHAR(255),
    dns                     VARCHAR(255),
    netbios                 VARCHAR(255),
    os                      VARCHAR(100),
    title                   VARCHAR(500),
    severity                VARCHAR(20),       -- Low | Medium | High | Critical
    cve_id                  VARCHAR(50),
    vendor_reference        VARCHAR(100),
    threat                  TEXT,
    impact                  TEXT,
    solution                TEXT,
    results                 TEXT,
    qds                     FLOAT,
    asset_group             VARCHAR(100),
    server_role             VARCHAR(100),
    last_scan_date          DATE,
    scan_status             VARCHAR(20),       -- Partial | Completed
    os_family               VARCHAR(50),
    created_at              TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_vuln_scan_run ON vulnerability_findings(scan_run_id);
CREATE INDEX idx_vuln_severity  ON vulnerability_findings(severity);
CREATE INDEX idx_vuln_cve_id    ON vulnerability_findings(cve_id);
CREATE INDEX idx_vuln_ip        ON vulnerability_findings(ip);
```

### notifications
```sql
CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(50) NOT NULL,
    title       VARCHAR(255) NOT NULL,
    message     TEXT,
    is_read     BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 8. Backend — FastAPI

### App Entry Point (`app/main.py`)
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import auth, servers, tags, playbooks, jobs, users, notifications, vulnerability, superset
from app.websocket.job_logs import router as ws_router

app = FastAPI(title="InfraAnsible API", version="2.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

# Routers
app.include_router(auth.router,            prefix="/api/auth")
app.include_router(servers.router,         prefix="/api/servers")
app.include_router(tags.router,            prefix="/api/tags")
app.include_router(playbooks.router,       prefix="/api/playbooks")
app.include_router(jobs.router,            prefix="/api/jobs")
app.include_router(users.router,           prefix="/api/users")
app.include_router(notifications.router,   prefix="/api/notifications")
app.include_router(vulnerability.router,   prefix="/api/vulnerability")
app.include_router(superset.router,        prefix="/api/superset")
app.include_router(ws_router)
```

### Key API Endpoints

#### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register new user (domain auto-detected) |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/refresh` | Refresh JWT |
| GET | `/api/auth/me` | Current user info |

#### Servers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/servers` | List all servers |
| POST | `/api/servers` | Add new server (by IP) |
| PUT | `/api/servers/{id}` | Edit server |
| DELETE | `/api/servers/{id}` | Delete server (admin+) |
| GET | `/api/servers/{id}/metrics` | Latest CPU/mem/disk |

#### Tags
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create tag |
| PUT | `/api/tags/{id}` | Edit tag |
| DELETE | `/api/tags/{id}` | Delete tag |
| POST | `/api/tags/{id}/servers` | Add servers to tag |
| DELETE | `/api/tags/{id}/servers/{server_id}` | Remove server from tag |

#### Playbooks
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/playbooks` | List all playbooks |
| POST | `/api/playbooks` | Upload playbook (file or ZIP) |
| PUT | `/api/playbooks/{id}` | Edit playbook metadata |
| DELETE | `/api/playbooks/{id}` | Delete playbook (admin+) |

#### Jobs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/jobs` | List all jobs |
| POST | `/api/jobs` | Execute playbook on servers |
| GET | `/api/jobs/{id}` | Job details + logs |
| POST | `/api/jobs/{id}/cancel` | Cancel running job |

#### Vulnerability
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/vulnerability/runs` | List all scan runs |
| POST | `/api/vulnerability/runs` | Trigger on-demand scan |
| GET | `/api/vulnerability/runs/{id}` | Scan run details |
| GET | `/api/vulnerability/findings` | Query findings (filterable) |

#### Superset
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/superset/guest-token` | Generate Superset guest token for current user |

---

## 9. Async Tasks — Celery

### Celery App (`app/tasks/celery_app.py`)
```python
from celery import Celery
from app.config import settings

celery_app = Celery(
    "infraansible",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)
celery_app.conf.timezone = "UTC"
```

### Scheduled Task — Vulnerability Scan (`app/tasks/scheduler.py`)
```python
from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "hourly-vulnerability-scan": {
        "task": "app.tasks.job_tasks.run_vulnerability_scan",
        "schedule": 3600.0,   # every 1 hour
        "args": ("scheduled",),
    },
}
```

### Playbook Execution Task (`app/tasks/job_tasks.py`)
```python
@celery_app.task(bind=True)
def execute_playbook(self, job_id: str):
    # 1. Load job from DB
    # 2. Run via ansible-runner
    # 3. Stream logs to DB + WebSocket
    # 4. On completion: parse logs for CSV path
    # 5. Fetch CSV (local or SCP)
    # 6. Upload to MinIO
    # 7. Parse CSV rows into PostgreSQL
    # 8. Update job status
```

---

## 10. File Storage — MinIO

### Bucket Structure
```
vulnerability-reports/
└── {year}/
    └── {month}/
        └── {day}/
            └── {timestamp}_{run_id}.csv
```

### MinIO Service (`app/services/minio_service.py`)
```python
from minio import Minio

client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=settings.MINIO_SECURE,
)

def upload_csv(run_id: str, file_path: str) -> str:
    """Upload CSV to MinIO, return object path."""
    ...

def get_csv_url(object_path: str) -> str:
    """Generate presigned URL for download."""
    ...
```

---

## 11. Vulnerability Data Pipeline

### End-to-End Flow

```
Step 1: Ansible playbook runs on target servers
        ↓
Step 2: Celery task monitors ansible-runner output
        ↓
Step 3: Logs stored line-by-line in job_logs table
        ↓
Step 4: Log parser scans lines for CSV file path pattern
        (e.g., lines matching: "CSV saved to /path/to/file.csv")
        ↓
Step 5: Determine file location
        ├── If path is on controller VM → read from local FS
        └── If path is on remote server → SCP via paramiko
        ↓
Step 6: Upload raw CSV to MinIO
        Object path: /{year}/{month}/{day}/{ts}_{run_id}.csv
        ↓
Step 7: Parse CSV rows using Python csv module
        ↓
Step 8: Bulk insert rows into vulnerability_findings table
        (linked to scan_run record)
        ↓
Step 9: Update scan_run: status=completed, minio_path=...
        ↓
Step 10: Superset queries vulnerability_findings for dashboards
```

### Log Parser (`app/utils/log_parser.py`)
```python
import re

CSV_PATH_PATTERN = re.compile(r"CSV (?:saved|written|created) (?:to|at)?\s+([^\s]+\.csv)", re.IGNORECASE)

def extract_csv_path(logs: list[str]) -> str | None:
    """Scan job log lines and return the first CSV file path found."""
    for line in logs:
        match = CSV_PATH_PATTERN.search(line)
        if match:
            return match.group(1)
    return None
```

> **Note:** The exact log pattern depends on what the Ansible playbook outputs. Update `CSV_PATH_PATTERN` once the playbook is finalized.

### CSV Parser (`app/services/csv_parser.py`)
```python
import csv

COLUMN_MAP = {
    "IP": "ip", "Network": "network", "DNS": "dns",
    "NetBIOS": "netbios", "OS": "os", "Title": "title",
    "Severity": "severity", "CVE ID": "cve_id",
    "Vendor Reference": "vendor_reference", "Threat": "threat",
    "Impact": "impact", "Solution": "solution", "Results": "results",
    "QDS": "qds", "Asset Group": "asset_group", "Server Role": "server_role",
    "Last Scan Date": "last_scan_date", "Scan Status": "scan_status",
    "Operating System Family": "os_family",
}

def parse_csv(file_path: str) -> list[dict]:
    """Read CSV and return list of finding dicts mapped to DB column names."""
    ...
```

---

## 12. Dashboard — Apache Superset

### Setup Summary
1. Install Superset and run `superset init`
2. Add PostgreSQL as a database connection in Superset (point to `infraansible` DB)
3. Create datasets from `vulnerability_findings` and `scan_runs` tables
4. Build dashboards using Superset's chart builder
5. Enable embedded feature flag: `FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}`
6. Register the dashboard as "embeddable" in Superset settings
7. Note the dashboard UUID — add it to `backend/.env` as `SUPERSET_DASHBOARD_ID`

### Guest Token Flow (`app/services/superset_service.py`)
```python
import httpx

async def get_guest_token(user_email: str) -> str:
    """
    Authenticate to Superset API, then request a guest token
    for the configured dashboard. Token is short-lived (~5 min).
    """
    # 1. POST /api/v1/security/login  → get access token
    # 2. POST /api/v1/security/guest_token/  → get guest token
    #    payload: { "resources": [{"type": "dashboard", "id": DASHBOARD_ID}],
    #               "rls": [],
    #               "user": {"username": user_email} }
    # 3. Return guest token string
```

### React Embedding (`VulnerabilityDashboard` page)
```tsx
import { embedDashboard } from "@superset-ui/embedded-sdk";

useEffect(() => {
  const token = await api.get("/api/superset/guest-token");
  embedDashboard({
    id: SUPERSET_DASHBOARD_ID,
    supersetDomain: SUPERSET_URL,
    mountPoint: document.getElementById("superset-container"),
    fetchGuestToken: () => token,
    dashboardUiConfig: { hideTitle: true, hideChartControls: false },
  });
}, []);
```

---

## 13. Frontend — React

### Key Changes from Previous Version
- All API calls updated from Flask endpoints to FastAPI endpoints
- `ClientDashboard` page removed — replaced by `VulnerabilityDashboard`
- `Servers` page updated — tag management UI + manual IP input
- `JobDetails` page updated — shows MinIO CSV download link if available
- `Users` page updated — domain-based role display

### VulnerabilityDashboard Page
- Located at `frontend/src/pages/VulnerabilityDashboard/`
- Fetches guest token from `/api/superset/guest-token` on mount
- Renders Superset iframe using `@superset-ui/embedded-sdk`
- Only accessible to authenticated users

### API Layer (`frontend/src/api/api.ts`)
- Base URL points to FastAPI: `http://<vm-ip>:8000`
- Axios instance with JWT interceptor (auto-attach Bearer token)
- Refresh token logic on 401

---

## 14. RBAC & Authentication

### JWT Structure
```json
{
  "sub": "user@jadeglobal.com",
  "user_id": 1,
  "role": "admin",
  "domain": "jadeglobal",
  "exp": 1234567890
}
```

### Domain Detection on Registration
```python
DOMAIN_MAP = {
    "jadeglobal.com":          "jadeglobal",
    "intuitivesurgicals.com":  "intuitivesurgicals",
    "client.com":              "client",
}

def detect_domain(email: str) -> str:
    domain = email.split("@")[1].lower()
    return DOMAIN_MAP.get(domain, "unknown")
```

### Role Permission Matrix

| Action | user | admin | super_admin |
|---|---|---|---|
| View dashboard | ✓ | ✓ | ✓ |
| Execute playbook | ✓ | ✓ | ✓ |
| Upload playbook | ✗ | ✓ | ✓ |
| Edit playbook | ✗ | ✓ | ✓ |
| Delete playbook | ✗ | ✓ | ✓ |
| Add server | ✓ | ✓ | ✓ |
| Delete server | ✗ | ✓ | ✓ |
| Manage tags | ✗ | ✓ | ✓ |
| View users | ✗ | ✓ | ✓ |
| Remove user | ✗ | ✓ | ✓ |
| Upgrade user to admin | ✗ | ✓ | ✓ |
| All system settings | ✗ | ✗ | ✓ |

### FastAPI Dependency (`app/utils/security.py`)
```python
def require_role(*roles: str):
    async def dependency(current_user = Depends(get_current_user)):
        if current_user.role not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return dependency

# Usage in router:
@router.delete("/{id}", dependencies=[Depends(require_role("admin", "super_admin"))])
async def delete_server(id: int): ...
```

---

## 15. WebSocket & Real-time Logs

- FastAPI native WebSocket endpoint: `ws://<host>:8000/ws/jobs/{job_id}`
- Celery task publishes log lines to a Redis pub/sub channel: `job_logs:{job_id}`
- WebSocket handler subscribes to that channel and forwards to connected browser
- Frontend subscribes on job detail page open, unsubscribes on close

---

## 16. Deployment Guide

### Systemd Services

#### FastAPI Backend (`deploy/infraansible-backend.service`)
```ini
[Unit]
Description=InfraAnsible FastAPI Backend
After=network.target postgresql.service redis.service

[Service]
User=svc-ansible
WorkingDirectory=/home/svc-ansible/apps/InfraAnsible_Vulnerability/backend
ExecStart=/home/svc-ansible/apps/InfraAnsible_Vulnerability/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

#### Celery Worker (`deploy/infraansible-celery.service`)
```ini
[Unit]
Description=InfraAnsible Celery Worker
After=network.target redis.service

[Service]
User=svc-ansible
WorkingDirectory=/home/svc-ansible/apps/InfraAnsible_Vulnerability/backend
ExecStart=/home/svc-ansible/apps/InfraAnsible_Vulnerability/backend/venv/bin/celery -A app.tasks.celery_app worker --loglevel=info
Restart=always

[Install]
WantedBy=multi-user.target
```

#### Celery Beat (Scheduler)
```ini
[Unit]
Description=InfraAnsible Celery Beat Scheduler

[Service]
User=svc-ansible
WorkingDirectory=/home/svc-ansible/apps/InfraAnsible_Vulnerability/backend
ExecStart=/home/svc-ansible/apps/InfraAnsible_Vulnerability/backend/venv/bin/celery -A app.tasks.celery_app beat --loglevel=info
Restart=always
```

### Nginx Configuration
```nginx
# New FastAPI backend
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# WebSocket
location /ws/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# Superset (for guest token API only — dashboard is iframed directly)
location /superset/ {
    proxy_pass http://127.0.0.1:8088/;
}

# React frontend
location / {
    root /home/svc-ansible/apps/InfraAnsible_Vulnerability/frontend/dist;
    try_files $uri $uri/ /index.html;
}
```

---

## 17. Port Reference

| Service | Port | Notes |
|---|---|---|
| FastAPI | 8000 | New backend |
| PostgreSQL | 5432 | New database |
| MinIO API | 9000 | S3-compatible file storage |
| MinIO Console | 9001 | Web UI for browsing buckets |
| Apache Superset | 8088 | Dashboard engine |
| Redis | 6379 | Celery broker |
| React (dev) | 5173 | Vite dev server |
| Existing Flask app | (existing) | Do not touch |
| Existing MySQL | (existing) | Do not touch |

---

## 18. Coding Conventions

- **Python**: Follow PEP 8. Use `async/await` throughout the FastAPI layer.
- **Models**: One file per model in `app/models/`. Use SQLAlchemy 2.0 mapped class style.
- **Schemas**: Separate request and response Pydantic schemas. Never expose password hashes.
- **Services**: All business logic lives in `app/services/`. Routers only call services.
- **Migrations**: Always use Alembic. Never manually alter the DB schema.
- **Environment**: Never hardcode secrets. Always use `.env` + `app/config.py` (pydantic-settings).
- **TypeScript**: Strict mode on. No `any` types. API response types defined in `src/types/`.
- **Comments**: Only when the WHY is non-obvious. No docblock walls.

---

## 19. Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `asyncpg` connection refused | PostgreSQL not running | `sudo systemctl start postgresql` |
| Celery tasks not running | Redis not running | `sudo systemctl start redis` |
| MinIO upload fails | Bucket doesn't exist | Create `vulnerability-reports` bucket in MinIO console |
| Superset iframe blank | Guest token expired or CORS | Check `SUPERSET_URL`, enable CORS in Superset config |
| CSV not found after scan | Log pattern doesn't match | Check actual playbook output, update `CSV_PATH_PATTERN` regex |
| 403 on protected route | JWT role claim mismatch | Verify token payload with `/api/auth/me` |
| WebSocket disconnects | Nginx not proxying WS | Ensure `Upgrade` headers are set in Nginx config |
| Alembic migration fails | Inconsistent DB state | Run `alembic history` and check current revision |
