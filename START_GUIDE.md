# Merged InfraAnsible App — Startup Guide

The single merged application (FastAPI base + all InfraAnsible VM features). It runs
**fully isolated** from the two live apps — its own database, Redis index, MinIO
bucket, and ports — so starting it never disturbs anything else.

| Component | Value |
|-----------|-------|
| Backend (FastAPI/uvicorn) | `http://127.0.0.1:8001` |
| Frontend (Vite dev) | `http://localhost:5175` |
| Nginx (production) | port `9393` |
| Postgres database | `ansible_merged` (user `ansible_user`) |
| Redis DB index | `/2` |
| MinIO bucket | `merged-reports` |
| Login | `admin` / `Admin@123` (change after first login) |

Project root: `/home/svc-ansible/apps/InfraAnsible_VM`

---

## Prerequisites (already running on this host)

PostgreSQL `:5432`, Redis `:6379`, MinIO `:9000/9001`, Apache Superset `:8088`.
Backend venv is Python 3.11 at `backend/venv`; frontend deps are installed in
`frontend/node_modules`.

---

## Option A — Development (manual, recommended for testing)

Open **three terminals**. In each, start from the project root.

### 1. Backend API (port 8001)
```bash
cd /home/svc-ansible/apps/InfraAnsible_VM/backend
source venv/bin/activate
alembic upgrade head          # first run only / after model changes
uvicorn app.main:app --host 127.0.0.1 --port 8001 --log-level info
```
Health check: `curl http://127.0.0.1:8001/api/health` → `{"status":"ok",...}`
API docs: `http://127.0.0.1:8001/docs`

### 2. Celery worker + beat (background jobs, Redis /2)
```bash
cd /home/svc-ansible/apps/InfraAnsible_VM/backend
source venv/bin/activate
# worker (playbook execution, vuln ingestion, metrics)
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
# in another terminal — beat (scheduled vuln scan + server-metrics refresh)
celery -A app.tasks.celery_app beat --loglevel=info \
    --schedule=/home/svc-ansible/apps/InfraAnsible_VM/backend/celerybeat-schedule
```

### 3. Frontend (port 5175)
```bash
cd /home/svc-ansible/apps/InfraAnsible_VM/frontend
CHOKIDAR_USEPOLLING=true npm run dev
```
> `CHOKIDAR_USEPOLLING=true` is required on this host: the inotify watcher limit
> (`max_user_instances=128`) is already exhausted by the other running Vite/VS Code
> processes. Polling avoids inotify entirely.

Then open **http://localhost:5175** and log in with `admin` / `Admin@123`.

---

## Option B — Production (systemd + nginx)

Unit files and configs live in `deploy/` (`merged-backend.service`,
`merged-celery.service`, `merged-celery-beat.service`,
`merged-infraansible.nginx.conf`, `merged-app-control.sh`). One-time install (sudo):

```bash
cd /home/svc-ansible/apps/InfraAnsible_VM
# 1. build the frontend (served as static files by nginx)
cd frontend && npm run build && cd ..
# 2. install systemd units
sudo cp deploy/merged-backend.service deploy/merged-celery.service \
        deploy/merged-celery-beat.service /etc/systemd/system/
# 3. install the nginx site (serves dist + proxies /api and /socket.io to :8001)
sudo cp deploy/merged-infraansible.nginx.conf /etc/nginx/conf.d/
sudo nginx -t && sudo systemctl reload nginx
# 4. enable + start
sudo systemctl daemon-reload
sudo systemctl enable --now merged-backend merged-celery merged-celery-beat
```

Or use the helper (start/stop/restart/status):
```bash
sudo bash deploy/merged-app-control.sh start
sudo bash deploy/merged-app-control.sh status
```
Then browse to `http://<host>:9393/`.

---

## First-time setup (already done, for reference)

```bash
# database (needs a Postgres superuser or CREATEDB on ansible_user)
createdb -h localhost -U ansible_user ansible_merged
cd backend && source venv/bin/activate
alembic upgrade head          # apply schema (head = c3d4e5f6a7b8)
python seed_admin.py          # create admin / admin@jadeglobal.com / Admin@123
```

Config lives in `backend/.env` (DB, Redis, MinIO, Superset, SMTP, ports, CORS).
To enable email notifications, set `SMTP_ENABLED=true` and the `SMTP_*` credentials.

---

## Stopping

- **Dev:** `Ctrl+C` in each terminal, or `pkill -f "InfraAnsible_VM/backend/venv/bin/uvicorn"`.
- **systemd:** `sudo bash deploy/merged-app-control.sh stop`.

## Quick health checks
```bash
curl http://127.0.0.1:8001/api/health                     # backend
curl -o /dev/null -w "%{http_code}\n" http://localhost:5175/   # frontend (200)
# login smoke test
curl -X POST http://127.0.0.1:8001/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"admin","password":"Admin@123"}'
```

## Troubleshooting
- **Frontend `ENOSPC` on start** → use `CHOKIDAR_USEPOLLING=true npm run dev` (inotify limit).
- **Backend won't start / DB errors** → confirm `ansible_merged` exists and `alembic current` shows `c3d4e5f6a7b8`.
- **Socket.IO 403 / CORS** → ensure the frontend origin is in `CORS_ORIGINS` in `backend/.env` (currently `http://localhost:5175,http://localhost:9393,http://localhost:9191`).
- **Port already in use** → 5173/5174 belong to the other live apps; the merged app deliberately uses 8001/5175/9393.
