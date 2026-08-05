# Startup Guide
### InfraAnsible — Vulnerability Update

> Step-by-step guide to run the entire application from scratch.
> Covers **first-time setup**, **development mode** (run by hand), and **production mode** (systemd).

---

## 0. Overview — What Needs to Run

The application is made of **7 processes**. They must start in roughly this order:

| # |      Component      | Port                      | Purpose                               |
|---|---------------------|---------------------------|---------------------------------------|
| 1 | **PostgreSQL**      | 5432                      | Primary database                      |
| 2 | **Redis**           | 6379                      | Celery broker + Socket.IO message bus |
| 3 | **MinIO**           | 9000 / 9001               | Raw CSV file storage                  |
| 4 | **Apache Superset** | 8088                      | Embedded analytics dashboard          |
| 5 | **FastAPI backend** | 8000                      | REST API + WebSocket                  |
| 6 | **Celery worker**   |  —                        | Runs playbooks + scan ingestion       |
| 7 | **Celery beat**     | —                         | Triggers the hourly scan              |
| 8 | **Frontend**        | 5173 (dev) / 9292 (nginx) | React UI                              |

> Everything runs on the **same VM** on its own port and does **not** touch the existing deployed app.

---

## 1. Prerequisites (install once)

> ### ⚠️ Python version — read before you start
> This VM **already has Python 3.9 and Python 3.11 installed side-by-side**:
> ```
> /usr/bin/python3.9    ← Python 3.9.x  (system default: python3 → python3.9)
> /usr/bin/python3.11   ← Python 3.11.x (used by THIS app only)
> ```
> Another application on this VM runs on **Python 3.9** in its own venv. This app
> uses **3.11** in its own venv. They are fully isolated and do not interfere.
>
> **There is nothing to "upgrade."** 3.11 is a side-by-side install. To keep the
> 3.9 app safe, **do NOT**:
> - ❌ change the default symlink (`alternatives --set python3 …` or `ln -sf … python3`) — leave `python3 → python3.9`
> - ❌ remove Python 3.9 (`dnf remove python3.9`)
> - ❌ `sudo pip install` into the system Python — always install inside a venv
>
> Always create this app's venv with the explicit interpreter: `python3.11 -m venv venv`.
> If `python3.11` is missing on a fresh VM, install it **alongside** 3.9 (never replacing it):
> `sudo dnf install -y python3.11`

```bash
# Verify both versions exist (do not change the default)
python3.11 --version          # must be 3.11+  (used by this app)
python3 --version             # 3.9.x is fine — leave it as the system default
node --version                # must be 18+

# redis + nginx
sudo dnf install -y redis nginx

# PostgreSQL via the official PGDG repo (recommended on this VM — Oracle's own
# AppStream repo is not configured here, so 'postgresql-server' won't be found).
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-9-x86_64/pgdg-redhat-repo-latest.noarch.rpm
sudo dnf install -y postgresql16-server postgresql16-contrib
# PGDG specifics: service = 'postgresql-16', binaries in /usr/pgsql-16/bin
#
# ALTERNATIVE — if Oracle's AppStream repo IS available on your box, you can
# instead use the distro package (PostgreSQL 13, also fully compatible):
#   sudo dnf config-manager --set-enabled ol9_appstream   # exact name: dnf repolist all | grep appstream
#   sudo dnf install -y postgresql-server postgresql-contrib

# MinIO binary (download to /tmp to avoid permission errors in non-writable dirs)
wget -O /tmp/minio https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x /tmp/minio && sudo mv /tmp/minio /usr/local/bin/
```

---

## 2. First-Time Setup

### 2.1 PostgreSQL — create the database

```bash
# PGDG (PostgreSQL 16) — used on this VM:
sudo /usr/pgsql-16/bin/postgresql-16-setup initdb     # first time only
sudo systemctl enable --now postgresql-16

sudo -u postgres /usr/pgsql-16/bin/psql <<'SQL'
CREATE DATABASE ansible_vulnerability;
CREATE USER ansible_user WITH PASSWORD 'Infra@321';
GRANT ALL PRIVILEGES ON DATABASE ansible_vulnerability TO ansible_user;
\c ansible_vulnerability
GRANT ALL ON SCHEMA public TO ansible_user;
SQL

# (If you used the AppStream package instead: the command is
#  'sudo postgresql-setup --initdb', service 'postgresql', and plain 'psql'.)
```

### 2.2 Redis

```bash
sudo systemctl enable --now redis
redis-cli ping        # should print: PONG
```

### 2.3 MinIO — start server + create bucket

```bash
# Start MinIO (dev: data in /data/minio)
sudo mkdir -p /data/minio && sudo chown $USER:$USER /data/minio
MINIO_ROOT_USER=minioadmin MINIO_ROOT_PASSWORD=minioadmin \
  minio server /data/minio --console-address "127.0.0.1:9001" &

# Console: http://<vm-ip>:9001  (login: minioadmin / minioadmin)
# The backend auto-creates the "vulnerability-reports" bucket on startup,
# or create it manually in the console.
```

### 2.4 Backend — venv, dependencies, environment

```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability/backend

python3.11 -m venv venv
./venv/bin/python3.11 -m pip install --upgrade pip
./venv/bin/python3.11 -m pip install -r requirements.txt

# Create the .env (already generated during the build, but verify it)
cp -n .env.example .env
nano .env     # set DATABASE_URL password, MINIO_*, SUPERSET_*, SECRET_KEY
```

**Key `.env` values to confirm:**
```env
DATABASE_URL=postgresql+asyncpg://ansible_user:Infra%40321@localhost:5432/ansible_vulnerability
REDIS_URL=redis://localhost:6379/0
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
UPLOAD_FOLDER=/var/lib/ansible_vulnerability/playbooks
REPORTS_DIR=/var/lib/ansible_vulnerability/reports
ANSIBLE_RUNNER_DIR=/var/lib/ansible_vulnerability/ansible-runner
ANSIBLE_PRIVATE_KEY_DIR=/var/lib/ansible_vulnerability/keys
SUPERSET_URL=http://localhost:8088
SUPERSET_DASHBOARD_ID=          # fill in after step 2.6
```

### 2.5 Storage directories

```bash
sudo mkdir -p /var/lib/ansible_vulnerability/{playbooks,reports,ansible-runner,keys}
sudo chown -R $USER:$USER /var/lib/ansible_vulnerability
```

### 2.6 Database tables

Tables are **created automatically** the first time the FastAPI backend starts.
For migration-managed schemas instead, use Alembic:

```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability/backend
./venv/bin/alembic revision --autogenerate -m "init"
./venv/bin/alembic upgrade head
```

### 2.7 Apache Superset (one-time)

```bash
# Install in its own venv to avoid dependency clashes
python3.11 -m venv /home/svc-ansible/superset-venv
/home/svc-ansible/superset-venv/bin/pip install apache-superset

export FLASK_APP=superset
/home/svc-ansible/superset-venv/bin/superset db upgrade
/home/svc-ansible/superset-venv/bin/superset fab create-admin
/home/svc-ansible/superset-venv/bin/superset init
```

Enable embedding — add to `~/.superset/superset_config.py`:
```python
FEATURE_FLAGS = {"EMBEDDED_SUPERSET": True}
GUEST_ROLE_NAME = "Public"
CORS_OPTIONS = {"supports_credentials": True, "origins": ["*"]}
ENABLE_CORS = True
```

Then in the Superset UI:
1. Add database connection → point to the `ansible_vulnerability` PostgreSQL DB.
2. Create datasets from `vulnerability_findings` and `scan_runs`.
3. Build the dashboard → **⋯ menu → Embed dashboard** → copy the **embed ID (UUID)**.
4. Put that UUID in `backend/.env` as `SUPERSET_DASHBOARD_ID` and restart the backend.

### 2.8 Frontend — install + build

```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability/frontend
npm install
npm run build          # production build → dist/
```

---

## 3. Running in DEVELOPMENT Mode (manual, 4 terminals)

Use this while developing. Start the infra services first (PostgreSQL, Redis, MinIO, Superset from section 2), then:

**Terminal 1 — FastAPI backend**
```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability/backend
./venv/bin/python3.11 run.py
# → http://localhost:8000   (docs at /docs)
```

**Terminal 2 — Celery worker**
```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability/backend
./venv/bin/celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
```

**Terminal 3 — Celery beat (hourly scan scheduler)**
```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability/backend
./venv/bin/celery -A app.tasks.celery_app beat --loglevel=info
```

**Terminal 4 — Frontend dev server**
```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability/frontend
npm run dev
# Vite serves on http://localhost:5173/   (base path is "/")
```

### Accessing the app from your laptop (VS Code port forwarding)

In development the app runs on the **VM**, but your browser is on your **laptop**,
and only the VM's loopback ports are used (nothing is exposed to the network, and
**nginx is NOT involved** — that's production only, section 4). Because you connect
with **VS Code Remote-SSH**, let VS Code forward the ports to your laptop's `localhost`:

1. Open the **PORTS** tab (next to TERMINAL at the bottom of VS Code).
2. Ensure these ports are forwarded (VS Code usually auto-forwards them; if a port
   misbehaves after restarting a process, right-click the row → **Stop Forwarding Port**,
   then **Add Port** to re-create it):

   | Port     | For                                                                                  |
   |----------|--------------------------------------------------------------------------------------|
   | **5173** | the React app                                                                        |
   | **8088** | the embedded Superset dashboard (the browser loads this directly)                    |
   | 8000     | backend API (optional — the Vite dev server already proxies `/api` + `/socket.io`)   |

3. Open **http://localhost:5173/** on your laptop. Tip: click the **globe / "Open in
   Browser"** icon on the `5173` row in the PORTS tab to be sure you hit the tunnel.
4. Confirm Superset is reachable: open **http://localhost:8088/health** → it should
   show `OK`. The Vulnerability Dashboard's analytics panel stays on
   *"Loading Superset dashboard…"* until port 8088 is reachable.

> ⚠️ **Do not** use the `http://10.30.1.113:5173/` "Network" URL that Vite prints.
> `10.30.1.113` is the VM's **private cloud IP** and is unreachable from your laptop
> (the browser just buffers / times out). Always use `http://localhost:5173/` via the
> forwarded port.
>
> If the page won't load after restarting `npm run dev`, the forward can go stale —
> re-forward port 5173, and try an **Incognito** window to bypass a cached redirect.

---

## 4. Running in PRODUCTION Mode (systemd + nginx)

### 4.1 Install service files (once)

```bash
cd /home/svc-ansible/apps/InfraAnsible_Vulnerability
sudo cp deploy/vuln-backend.service       /etc/systemd/system/
sudo cp deploy/vuln-celery.service        /etc/systemd/system/
sudo cp deploy/vuln-celery-beat.service   /etc/systemd/system/
sudo cp deploy/vuln-infraansible.nginx.conf /etc/nginx/conf.d/
sudo systemctl daemon-reload
sudo systemctl enable vuln-backend vuln-celery vuln-celery-beat
```

### 4.2 Start / stop / status — one command

```bash
# Start the whole stack (postgres → redis → minio → backend → celery → beat → nginx)
sudo bash deploy/vuln-app-control.sh start

# Check status
sudo bash deploy/vuln-app-control.sh status

# Stop everything
sudo bash deploy/vuln-app-control.sh stop

# Restart
sudo bash deploy/vuln-app-control.sh restart
```

Open **https://<vm-ip>/vulnhub/** in the browser (e.g. `https://10.30.1.113/vulnhub/`).

> **Note:** MinIO and Superset are not managed by the control script unless you
> create systemd units for them. Start them separately, or add `minio.service`
> and `superset.service` units and they will be picked up automatically.

---

## 5. First Login & Smoke Test

1. **Create the first user** — open the app and use the Sign Up screen, or via API:
   ```bash
   curl -X POST http://localhost:8000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","email":"admin@jadeglobal.com","password":"Passw0rd!"}'
   ```
   > Domain is auto-detected from the email. New signups get the `user` role;
   > promote to `super_admin` directly in PostgreSQL for the first admin:
   ```sql
   UPDATE users SET role='super_admin' WHERE username='admin';
   ```

2. **Health check:**
   ```bash
   curl http://localhost:8000/api/health
   # {"status":"ok","service":"infraansible","version":"2.0.0"}
   ```

3. **Add a server / tag**, **upload the vulnerability playbook**, then trigger a scan
   from the **Vulnerability Dashboard** (select tags and/or enter IPs → Run Scan).

4. The hourly scan runs automatically once **Celery beat** is up.

---

## 6. Quick Reference — Start Order Cheat Sheet

```
PostgreSQL  →  Redis  →  MinIO  →  Superset  →  FastAPI  →  Celery worker  →  Celery beat  →  nginx
```

---

## 7. Troubleshooting

|-----------------------------------------------------------------------------------------------------------------------|
|           Symptom                         |                                 Check                                     |
|-------------------------------------------|---------------------------------------------------------------------------|
| Backend won't start, `pymysql` / DB error | `DATABASE_URL` in `.env` must be `postgresql+asyncpg://…`                 |
| `connection refused` on startup           | Is PostgreSQL / Redis running? `systemctl status postgresql redis`        |
| Jobs stuck in `pending`                   | Celery worker not running, or wrong `REDIS_URL`                           |
| Hourly scan never runs                    | Celery **beat** not running                                               |
| Dashboard stuck "Loading Superset dashboard…" | Port **8088 not forwarded** to your laptop — open `http://localhost:8088/health` (must show `OK`), re-forward 8088 if not |
| Vulnerability Dashboard blank             | `SUPERSET_DASHBOARD_ID` empty, or Superset embedding not enabled          |
| Live job logs not streaming               | Redis down; in dev the Vite dev server proxies `/socket.io` to :8000 (in prod, nginx does) |
| App URL just buffers / times out          | Using the `10.30.1.113:5173` Network URL (private IP) — use `http://localhost:5173/` via the forwarded port instead |
| CSV not ingested after scan               | Playbook log didn't print a `*.csv` path the parser recognizes            |
| MinIO upload fails                        | Bucket missing — check MinIO console / `MINIO_*` creds                    |
| Frontend 404s on refresh                  | nginx `try_files … /autohub/index.html` rule (already in provided config) |
|-----------------------------------------------------------------------------------------------------------------------|
---

*Servers run independently of the existing deployed application — different ports, services, and database.*
