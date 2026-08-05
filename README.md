# Vulnerability Dashboard & Infrastructure Automation Hub

A full-stack platform that unifies **Ansible-based infrastructure automation** with **vulnerability management and analytics**. Upload and run playbooks against fleets of servers, watch job logs stream in real time, ingest vulnerability scan data (e.g. Qualys exports), and explore it through embedded Apache Superset dashboards — all behind role-based access control and a full audit trail.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Getting Started (Local Development)](#getting-started-local-development)
- [Configuration](#configuration)
- [Database Migrations](#database-migrations)
- [Running Background Workers](#running-background-workers)
- [Production Deployment](#production-deployment)
- [API Overview](#api-overview)
- [License](#license)

---

## Features

### Infrastructure Automation
- **Server management** — register target servers, group them with tags, and store SSH connection details.
- **Playbook management** — upload single playbooks, ZIP archives, or full folder structures; browse them in an in-app file tree.
- **Job execution & real-time monitoring** — run playbooks against one or many servers via `ansible-runner`, with live log streaming over WebSockets (Socket.IO).
- **Interactive playbooks** — prompt for patch/parameter input at run time.
- **Playbook audit** — dedicated audit logs for every playbook change and execution.

### Vulnerability Management
- **Scan ingestion pipeline** — parse vulnerability CSV exports (e.g. Qualys) into structured `ScanRun` and `VulnerabilityFinding` records.
- **Scheduled scans** — periodic ingestion driven by Celery Beat (`VULN_SCAN_INTERVAL_SECONDS`).
- **Embedded analytics** — Apache Superset dashboards framed directly in the app via the Superset embedded SDK.
- **Report storage** — raw reports and artifacts persisted to MinIO (S3-compatible object storage).

### Platform
- **Authentication & RBAC** — JWT access/refresh tokens with role-based authorization.
- **Notifications** — in-app notification center with per-user preferences.
- **Audit logging** — system-wide audit trail of user and system actions.

---

## Architecture

```
┌──────────────┐     REST + WebSocket      ┌───────────────────────────┐
│   Frontend   │ ─────────────────────────▶│         Backend           │
│ React + Vite │◀───────────────────────── │        (FastAPI)          │
└──────┬───────┘      Socket.IO logs        └────┬───────────┬──────────┘
       │                                         │           │
       │ embed (Superset SDK)                    │           │ enqueue
       ▼                                         ▼           ▼
┌──────────────┐                        ┌────────────┐  ┌────────────┐
│   Superset   │                        │ PostgreSQL │  │   Redis    │
│  dashboards  │                        └────────────┘  └─────┬──────┘
└──────────────┘                                              │
                                                              ▼
                                        ┌──────────────────────────────┐
                                        │   Celery workers + beat        │
                                        │ ansible-runner · vuln pipeline │
                                        └───────────────┬────────────────┘
                                                        ▼
                                    ┌────────────┐  ┌───────────────────┐
                                    │   MinIO    │  │  Target servers    │
                                    │ (reports)  │  │  (SSH / Ansible)   │
                                    └────────────┘  └───────────────────┘
```

- **FastAPI** serves the REST API and mounts a Socket.IO ASGI app at `/socket.io` for live job logs.
- **PostgreSQL** (async via SQLAlchemy 2 / asyncpg) is the system of record; **Alembic** manages schema migrations.
- **Redis + Celery** run playbook jobs and the vulnerability ingestion pipeline asynchronously; **Celery Beat** schedules periodic scans.
- **MinIO** stores raw scan reports and artifacts.
- **Apache Superset** provides the analytics dashboards embedded in the frontend.

Diagrams are also available under [`Images/`](Images/).

---

## Tech Stack

| Layer      | Technologies |
|------------|--------------|
| Frontend   | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Router, Recharts, Socket.IO client, `@superset-ui/embedded-sdk` |
| Backend    | FastAPI, Uvicorn, SQLAlchemy 2 (async), Pydantic v2, python-socketio |
| Async      | Celery, Redis, Celery Beat |
| Automation | Ansible 8.x, `ansible-runner`, Paramiko |
| Data       | PostgreSQL (asyncpg / psycopg2), Alembic, MinIO |
| Analytics  | Apache Superset |
| Auth       | JWT (python-jose), Passlib/bcrypt |

---

## Repository Layout

```
.
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── api/            # REST routers (auth, servers, playbooks, jobs, vulnerability, superset, …)
│   │   ├── services/       # Business logic (ansible_runner, vuln_pipeline, csv_parser, minio, superset, …)
│   │   ├── tasks/          # Celery app + job/vuln tasks
│   │   ├── websocket/      # Socket.IO server & event emitters
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── core/           # config, database, security, dependencies
│   │   ├── utils/          # file manager, log parser, SSH client
│   │   └── main.py         # FastAPI entrypoint
│   ├── alembic/            # Database migrations
│   └── requirements.txt
├── frontend/               # React + Vite application
│   └── src/
│       ├── pages/          # Dashboard, Servers, Playbooks, Jobs, VulnerabilityDashboard, …
│       ├── components/     # Reusable UI components
│       ├── services/ api/  # API clients
│       └── store/          # Zustand state
├── deploy/                 # systemd unit files, nginx configs, install & control scripts
├── Documentation/          # Architecture, setup, and functionality docs
└── Images/                 # Architecture diagrams & flowcharts
```

---

## Prerequisites

- **Python** 3.11+
- **Node.js** 18+ and npm
- **PostgreSQL** 14+
- **Redis** 6+
- **MinIO** (or any S3-compatible store)
- **Apache Superset** (for embedded dashboards)
- **Ansible** on the host running the backend/workers

---

## Getting Started (Local Development)

### 1. Clone

```bash
git clone https://github.com/NikhilRokade-jg/Vulnerability_Dashboard-Marvel.git
cd Vulnerability_Dashboard-Marvel
```

### 2. Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env      # then edit values (see Configuration)
alembic upgrade head      # apply migrations

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs are then available at `http://localhost:8000/docs`, health check at `http://localhost:8000/api/health`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. When developing via a VS Code port forward, forward ports **5173** (frontend) and **8088** (Superset).

---

## Configuration

Backend configuration is loaded from `backend/.env`. Copy `backend/.env.example` and fill in the values. Key groups:

| Variable(s) | Purpose |
|-------------|---------|
| `SECRET_KEY`, `JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT signing & token lifetimes |
| `DATABASE_URL` | PostgreSQL async connection string |
| `REDIS_URL` | Redis broker/result backend for Celery |
| `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET` | Object storage for reports |
| `SUPERSET_URL`, `SUPERSET_PUBLIC_URL`, `SUPERSET_ADMIN_*`, `SUPERSET_DASHBOARD_ID` | Superset API + embedded dashboard |
| `UPLOAD_FOLDER`, `REPORTS_DIR`, `ANSIBLE_RUNNER_DIR`, `ANSIBLE_PRIVATE_KEY_DIR` | File/artifact storage paths |
| `CORS_ORIGINS` | Comma-separated allowed origins (must include your frontend URL, or Socket.IO returns 403) |
| `VULN_SCAN_INTERVAL_SECONDS` | Scheduled vulnerability scan interval |

> ⚠️ Never commit a real `.env` — it is gitignored. Always change `SECRET_KEY` and all default credentials before deploying.

---

## Database Migrations

Migrations are managed with Alembic:

```bash
cd backend
alembic upgrade head                      # apply latest
alembic revision --autogenerate -m "msg"  # create a new migration after model changes
```

On startup the app will also create any missing tables as a fallback, but **Alembic is the source of truth**.

---

## Running Background Workers

Playbook execution and vulnerability ingestion run on Celery. In separate terminals (with the venv active):

```bash
# Worker (jobs + vulnerability tasks)
celery -A app.tasks.celery_app worker --loglevel=info

# Beat (scheduled vulnerability scans)
celery -A app.tasks.celery_app beat --loglevel=info
```

Both require Redis to be running.

---

## Production Deployment

The [`deploy/`](deploy/) directory contains everything needed to run the stack under **systemd** behind **nginx**:

- `vuln-backend.service`, `vuln-celery.service`, `vuln-celery-beat.service` — systemd units
- `vuln-infraansible.nginx.conf` — reverse-proxy config (API, WebSocket, and static frontend)
- `vuln-install.sh` — installer script
- `vuln-app-control.sh` — start/stop/restart helper

When deploying behind a reverse proxy, remember to:
1. Set `SUPERSET_PUBLIC_URL` to the browser-facing Superset URL.
2. Add your deployment hostname to `CORS_ORIGINS`.
3. Build the frontend with `npm run build` and serve the `dist/` output via nginx.

---

## API Overview

The backend exposes REST routers (all under `/api`) plus a Socket.IO endpoint:

| Area | Description |
|------|-------------|
| `auth` | Login, token refresh, current user |
| `users` | User administration (RBAC) |
| `servers` / `tags` | Managed servers and grouping tags |
| `playbooks` | Upload, browse, and manage playbooks |
| `jobs` | Trigger and track playbook executions |
| `vulnerability` | Scan runs and findings |
| `superset` | Guest tokens / embedded dashboard config |
| `notifications` | Notifications and preferences |
| `/socket.io` | Real-time job log streaming |

Interactive API documentation is served at `/docs` (Swagger UI) and `/redoc` when the backend is running.

---

## License

Internal / proprietary. See repository owner for usage terms.
# InfraAnsible_VM_ansible_vulnerability
