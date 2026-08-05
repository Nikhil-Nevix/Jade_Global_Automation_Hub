# InfraAnsible — Complete Project Megaprompt

> This document is a self-contained brief that gives any AI assistant a complete picture of the InfraAnsible project: the problem it solves, the architecture it uses, the data it manages, every API endpoint, every frontend page, every service and task, all relationships between components, and the full end-to-end workflows. Read this once and you will have enough context to reason about, extend, or debug any part of the system.

---

## 1. PROBLEM STATEMENT

Infrastructure teams at Jade Global manage dozens to hundreds of Linux servers for client accounts (e.g., Intuitive Surgical). Day-to-day operations — patching packages, configuring services, running compliance checks, deploying software — are performed by Ansible playbooks. Without a centralised platform:

- Engineers run playbooks manually from the CLI with no audit trail.
- Multiple engineers may run the same playbook on the same server simultaneously.
- There is no visibility into which playbooks ran, when, by whom, on which server, and whether they succeeded.
- Failures are silent; no one gets notified.
- Playbooks are scattered across engineers' laptops and Git repos with no governed version history.
- Clients have no visibility into the automation work being done on their behalf.
- Running a single playbook across 50 servers sequentially wastes hours.
- Compliance and audit teams cannot prove what changed, when, and who approved it.

**InfraAnsible solves all of the above** by providing a web-based automation hub that wraps Ansible execution in a governed, auditable, real-time-observable platform with RBAC, multi-server batch execution, interactive playbooks, analytics, and multi-channel notifications.

---

## 2. SOLUTION OVERVIEW

InfraAnsible is a full-stack web application with:

- A **React + TypeScript** SPA frontend served by Nginx.
- A **Flask** REST API backend with JWT authentication.
- **Celery** workers executing Ansible playbooks asynchronously.
- **Flask-SocketIO** for real-time log streaming to the browser.
- **MariaDB/MySQL** as the primary relational database.
- **Redis** as the Celery broker and result backend.
- **ansible-runner** as the Python interface to the Ansible CLI.
- **Paramiko** for SSH-based server metric collection.

The product has two audiences:
1. **Internal users** (Jade Global engineers) — manage servers, upload playbooks, run jobs, review analytics.
2. **Client users** (e.g., Intuitive Surgical) — see a read-only, client-branded dashboard showing compliance metrics and job history for their environment.

---

## 3. TECHNOLOGY STACK

### Backend
| Technology | Version | Role |
|---|---|---|
| Python | 3.11+ | Language |
| Flask | 3.0 | Web framework |
| SQLAlchemy | 2.0 | ORM |
| Flask-Migrate | — | DB schema versioning |
| Flask-JWT-Extended | 4.5 | JWT auth |
| Flask-SocketIO | 5.6 | WebSocket server |
| Flask-CORS | — | Cross-origin support |
| Flask-Marshmallow | — | Serialization/validation |
| Celery | 5.3 | Async task queue |
| Redis | 6.0+ | Broker + result backend |
| MariaDB/MySQL | 10.5+ / 8.0+ | Primary database |
| ansible-runner | 2.3.4 | Ansible execution interface |
| bcrypt | 4.1 | Password hashing |
| paramiko | 3.4 | SSH client |
| reportlab + matplotlib | — | PDF/chart generation |
| eventlet | — | Async mode for SocketIO |

### Frontend
| Technology | Version | Role |
|---|---|---|
| React | 18.2 | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 6.4 | Build tool with HMR |
| TailwindCSS | 3.3 | Utility-first CSS |
| Zustand | 4.4 | Lightweight state management |
| Axios | 1.6 | HTTP client |
| Socket.IO-client | 4.8 | WebSocket client |
| Recharts | 3.7 | Charts and analytics |
| Lucide-react | — | Icons |
| React Router DOM | 6.21 | Client-side routing |

### Infrastructure
| Technology | Role |
|---|---|
| Nginx | Reverse proxy, static asset serving |
| Gunicorn | Python WSGI app server |
| systemd | Service management |
| Linux (CentOS/RHEL/Oracle Linux) | OS |

---

## 4. HIGH-LEVEL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                      │
│  - Axios HTTP client (JWT in headers, silent token refresh)      │
│  - Socket.IO client (real-time log streaming)                    │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ HTTPS                          │ WSS
┌───────────────▼───────────────────────────────▼─────────────────┐
│                        Nginx                                      │
│  - TLS termination                                                │
│  - /api/* → Gunicorn :5000                                        │
│  - / → React dist/ static files                                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                    Flask Application (Gunicorn)                   │
│  - Blueprint-based REST API                                       │
│  - Flask-SocketIO (eventlet async mode)                           │
│  - Flask-JWT-Extended                                             │
│  - SQLAlchemy (connection pool: 10-20 conns, recycle 3600s)       │
└──────┬────────────────────────┬──────────────────────────────────┘
       │                        │
┌──────▼──────┐       ┌─────────▼────────────────────────────────┐
│   MariaDB   │       │              Redis                         │
│  (Primary   │       │  - Celery broker (job queue)               │
│   DB)       │       │  - Celery result backend                   │
└─────────────┘       └─────────┬────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                   Celery Worker Process                           │
│  - execute_playbook_task                                          │
│  - Runs ansible-runner in a thread                                │
│  - Streams stdout logs → WebSocket → browser                      │
│  - Bulk-inserts logs to DB every 10 lines                         │
│  - Emits job_status and job_log events via Socket.IO              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. REPOSITORY STRUCTURE

```
InfraAnsible/
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Application factory
│   │   ├── config.py            # Dev / Test / Prod config classes
│   │   ├── extensions.py        # Flask extension init (db, jwt, celery, redis, socketio, …)
│   │   ├── models.py            # All SQLAlchemy ORM models
│   │   ├── schemas.py           # Marshmallow schemas (request/response validation)
│   │   ├── tasks.py             # Celery task: execute_playbook_task
│   │   ├── api/
│   │   │   ├── auth.py          # /auth/* endpoints
│   │   │   ├── servers.py       # /servers/* endpoints
│   │   │   ├── playbooks.py     # /playbooks/* endpoints
│   │   │   ├── jobs.py          # /jobs/* endpoints + analytics
│   │   │   ├── users.py         # /users/* endpoints
│   │   │   ├── notifications.py # /notifications/* endpoints
│   │   │   ├── websocket_jobs.py# Socket.IO event handlers
│   │   │   └── interactive_playbook.py  # Interactive prompt endpoints
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── job_service.py
│   │   │   ├── playbook_service.py
│   │   │   ├── server_service.py
│   │   │   ├── monitor_service.py
│   │   │   ├── notification_service.py
│   │   │   ├── email_service.py
│   │   │   └── ssh_service.py
│   │   └── utils/
│   │       └── file_manager.py  # ZIP extraction, file tree, YAML utilities
│   └── run.py                   # Entry point; exports celery, socketio
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Root: routes, error boundary, auth guard
│   │   ├── api/
│   │   │   └── api.ts           # Axios client + all API modules
│   │   ├── services/
│   │   │   └── websocket.ts     # Socket.IO service class
│   │   ├── config/
│   │   │   └── network.ts       # Base URLs (API, WebSocket)
│   │   ├── store/
│   │   │   └── authStore.ts     # Zustand auth store
│   │   ├── components/
│   │   │   ├── Sidebar/
│   │   │   ├── Navbar/
│   │   │   ├── Notifications.tsx
│   │   │   └── InteractivePatchesDialog.tsx
│   │   └── pages/
│   │       ├── LoginPage/
│   │       ├── Dashboard/
│   │       ├── ClientDashboard/
│   │       ├── ServersPage/
│   │       ├── PlaybooksPage/
│   │       ├── PlaybookAuditPage/
│   │       ├── PlaybookAuditLogsPage/
│   │       ├── JobsPage/
│   │       ├── JobDetailsPage/
│   │       ├── UsersPage/
│   │       ├── SettingsPage/
│   │       ├── NotificationsPage/
│   │       └── NotificationPreferencesPage/
│   └── package.json
├── deploy/
│   ├── app-control.sh
│   ├── infraansible-backend.service
│   ├── infraansible-celery.service
│   ├── infraansible.nginx.conf
│   └── install.sh
└── Documentation/
    ├── PROJECT_DEPLOYMENT_PLAN.md
    └── (various guides)
```

---

## 6. DATABASE MODELS (backend/app/models.py)

All tables use MySQL InnoDB with UTF8MB4 charset. Foreign keys enforce referential integrity with cascade deletes where appropriate.

### 6.1 User
```
users
├── id                INT PK AUTO_INCREMENT
├── username          VARCHAR(80) UNIQUE NOT NULL  idx
├── email             VARCHAR(120) UNIQUE NOT NULL  idx
├── password_hash     VARCHAR(256)
├── role              ENUM('super_admin','admin','user','viewer') DEFAULT 'user'
├── is_active         BOOL DEFAULT TRUE
├── timezone          VARCHAR(50) DEFAULT 'UTC'
├── created_at        DATETIME
├── updated_at        DATETIME  (auto-updated via event listener)
└── last_login        DATETIME
```
- `set_password()` — bcrypt hash
- `check_password()` — bcrypt verify
- Has 1-to-many with: jobs, tickets, audit_logs, notifications, notification_preferences

### 6.2 Server
```
servers
├── id              INT PK
├── hostname        VARCHAR(255) UNIQUE NOT NULL
├── ip_address      VARCHAR(45) NOT NULL  idx  (IPv4 or IPv6)
├── os_type         VARCHAR(50)
├── os_version      VARCHAR(50)
├── ssh_port        INT DEFAULT 22
├── ssh_user        VARCHAR(50) DEFAULT 'root'
├── ssh_key_path    VARCHAR(255)
├── tags            JSON  (array of strings for grouping/filtering)
├── is_active       BOOL DEFAULT TRUE
├── cpu_usage       FLOAT
├── memory_usage    FLOAT
├── disk_usage      FLOAT
├── last_monitored  DATETIME
├── created_at      DATETIME
└── updated_at      DATETIME
```

### 6.3 Playbook
```
playbooks
├── id                  INT PK
├── name                VARCHAR(255) UNIQUE NOT NULL  idx
├── description         TEXT
├── file_path           VARCHAR(500)  (filesystem path to YAML or folder)
├── is_folder           BOOL DEFAULT FALSE
├── main_playbook_file  VARCHAR(255)  (relative path for folder playbooks)
├── file_structure      JSON  (nested file tree for folder navigation)
├── file_count          INT
├── total_size_kb       FLOAT
├── is_active           BOOL DEFAULT TRUE
├── created_at          DATETIME
└── updated_at          DATETIME
```
- `is_folder=False`: single `.yml`/`.yaml` file
- `is_folder=True`: ZIP-extracted directory with nested structure

### 6.4 Job
```
jobs
├── id               INT PK
├── parent_job_id    INT FK → jobs.id  NULLABLE  (batch child jobs point to parent)
├── is_batch_job     BOOL DEFAULT FALSE
├── batch_config     JSON  {concurrent_limit, stop_on_failure, execution_strategy}
├── job_id           VARCHAR(36) UNIQUE NOT NULL  idx  (UUID)
├── playbook_id      INT FK → playbooks.id  idx
├── server_id        INT FK → servers.id  idx
├── user_id          INT FK → users.id  idx
├── status           ENUM('pending','running','success','failed','cancelled')
├── celery_task_id   VARCHAR(36)  idx
├── extra_vars       JSON
├── error_message    TEXT
├── patch_report     TEXT  (CSV content for RPM patch jobs)
├── started_at       DATETIME
├── completed_at     DATETIME
└── created_at       DATETIME
Composite indexes: (status, created_at), (user_id, status)
```

### 6.5 JobLog
```
job_logs
├── id           BIGINT PK  (BigInt for millions of rows)
├── job_id       INT FK → jobs.id  idx
├── line_number  INT
├── content      TEXT
├── log_level    VARCHAR(20)  (INFO/WARNING/ERROR/DEBUG)
└── timestamp    DATETIME  idx
Composite index: (job_id, line_number)
```

### 6.6 Ticket
```
tickets
├── id          INT PK
├── ticket_id   VARCHAR(36) UNIQUE  idx  (UUID)
├── job_id      INT FK → jobs.id  idx
├── created_by  INT FK → users.id
├── title       VARCHAR(255)
├── description TEXT
├── status      ENUM('open','in_progress','resolved','closed')
├── priority    ENUM('low','medium','high','critical')
├── created_at  DATETIME
├── updated_at  DATETIME
└── resolved_at DATETIME
```

### 6.7 AuditLog
```
audit_logs
├── id            BIGINT PK
├── user_id       INT FK → users.id  NULLABLE  (system actions have no user)
├── action        VARCHAR(50)  idx  (CREATE/UPDATE/DELETE/LOGIN/…)
├── resource_type VARCHAR(50)  idx  (user/server/playbook/job)
├── resource_id   INT
├── details       JSON
├── ip_address    VARCHAR(45)
└── timestamp     DATETIME  idx
Composite indexes: (resource_type, resource_id), (action, timestamp)
```

### 6.8 PlaybookAuditLog
```
playbook_audit_logs
├── id                   INT PK
├── playbook_id          INT  (NOT a FK — preserved after deletion)
├── playbook_name        VARCHAR(255)
├── user_id              INT FK → users.id
├── action               ENUM('created','updated','deleted','uploaded','replaced')
├── old_content          TEXT
├── new_content          TEXT
├── changes_description  TEXT
├── ip_address           VARCHAR(45)
└── created_at           DATETIME  idx
```

### 6.9 Notification
```
notifications
├── id                   INT PK
├── user_id              INT FK → users.id  idx
├── title                VARCHAR(255)
├── message              TEXT
├── severity             ENUM('info','warning','error','critical')
├── event_type           VARCHAR(50)  idx
├── related_entity_type  VARCHAR(50)
├── related_entity_id    INT
├── is_read              BOOL DEFAULT FALSE  idx
├── read_at              DATETIME
├── channels_sent        JSON  (array: ['in_app','email'])
├── extra_data           JSON
├── created_at           DATETIME  idx
└── expires_at           DATETIME  NULLABLE  (auto-dismiss)
Composite indexes: (user_id, created_at), (user_id, is_read)
```

### 6.10 NotificationPreference
```
notification_preferences
├── id              INT PK
├── user_id         INT FK → users.id  idx
├── event_type      VARCHAR(50)
├── in_app_enabled  BOOL DEFAULT TRUE
├── email_enabled   BOOL DEFAULT FALSE
├── browser_push_enabled BOOL DEFAULT FALSE
├── created_at      DATETIME
└── updated_at      DATETIME
Unique constraint: (user_id, event_type)
```

---

## 7. CONFIGURATION (backend/app/config.py)

Three environment classes: `DevelopmentConfig`, `TestingConfig`, `ProductionConfig`.

Key production settings:
```python
SQLALCHEMY_DATABASE_URI = "mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation"
CELERY_BROKER_URL        = "redis://localhost:6379/0"
CELERY_RESULT_BACKEND    = "redis://localhost:6379/0"
JWT_ACCESS_TOKEN_EXPIRES  = timedelta(minutes=30)
JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
JWT_ALGORITHM             = "HS256"
MAX_CONTENT_LENGTH        = 16 * 1024 * 1024   # 16 MB overall
PLAYBOOK_MAX_SIZE         = 500 * 1024          # 500 KB for single YAML
UPLOAD_FOLDER             = "/var/lib/infra-automation/playbooks"
ANSIBLE_RUNNER_DIR        = "/var/lib/infra-automation/ansible-runner"
CORS_ORIGINS = ["http://localhost:5173", "http://192.168.10.200:5173", ...]
```

---

## 8. APPLICATION FACTORY (backend/app/__init__.py)

Flask uses the application factory pattern:
1. Load config by `FLASK_ENV` environment variable.
2. Initialize all extensions (db, migrate, jwt, cors, socketio, marshmallow, celery, redis).
3. Register Blueprints: `auth_bp`, `servers_bp`, `playbooks_bp`, `jobs_bp`, `users_bp`, `notifications_bp`.
4. Register Socket.IO event handlers from `websocket_jobs.py`.
5. Register JWT error handlers (401, 422 responses).
6. Register `/health` endpoint that checks DB and Redis connectivity.
7. Set up rotating file logger (10 MB × 10 files).
8. Register Flask CLI commands: `init-db`, `create-admin`, `seed-data`.

---

## 9. API ENDPOINTS — COMPLETE REFERENCE

All endpoints are prefixed with `/api`. JWT is required unless marked "None".

### 9.1 Authentication (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | None | Login; returns `access_token`, `refresh_token`, user object. Updates `last_login`. |
| POST | `/auth/signup` | None | Self-register; creates user with `role='user'`. |
| POST | `/auth/refresh` | Refresh JWT | Issue new access token. |
| GET | `/auth/me` | JWT | Return current user object. |
| POST | `/auth/change-password` | JWT | Verify old password, set new one. |

### 9.2 Servers (`/api/servers`)

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET | `/servers` | any | List servers. Params: `page`, `per_page` (max 100), `is_active`, `environment`, `os_type`, `search`. |
| GET | `/servers/{id}` | any | Single server detail. |
| POST | `/servers` | user | Create server (hostname, ip_address, os_type, ssh_user, ssh_port, ssh_key_path, tags). |
| PUT | `/servers/{id}` | operator | Update server metadata. |
| DELETE | `/servers/{id}` | admin | Soft or hard delete. |
| GET | `/servers/{id}/metrics` | any | Real-time CPU/memory/disk from `last_monitored`. |
| POST | `/servers/metrics/refresh` | admin | Trigger SSH metric collection for all active servers. |

### 9.3 Playbooks (`/api/playbooks`)

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET | `/playbooks` | any | List with pagination + filters (`is_active`, `search`). |
| GET | `/playbooks/{id}` | any | Single playbook metadata. |
| GET | `/playbooks/{id}/content` | any | Raw YAML content (single-file only). |
| PUT | `/playbooks/{id}/content` | admin | Overwrite YAML content; creates PlaybookAuditLog. |
| POST | `/playbooks/upload` | user | Upload single YAML (max 500 KB). |
| POST | `/playbooks/preview-zip` | user | Preview ZIP before upload; returns YAML list + suggested main. Temp extraction, no DB write. |
| POST | `/playbooks/upload-folder` | user | Upload ZIP; extracts to filesystem; stores file tree JSON. |
| GET | `/playbooks/{id}/files` | any | List all files in folder playbook. |
| GET | `/playbooks/{id}/files/{path}` | any | Read content of specific file. |
| PUT | `/playbooks/{id}/files/{path}` | admin | Update content of specific file. |
| GET | `/playbooks/{id}/download` | any | Download folder playbook as ZIP. |
| PUT | `/playbooks/{id}` | operator | Update metadata (description, tags, is_active). |
| DELETE | `/playbooks/{id}` | admin | Hard-delete from DB and filesystem. |
| GET | `/playbooks/{id}/verify` | any | Check file existence on filesystem. |
| GET | `/playbooks/{id}/audit-logs` | admin | Paginated change history. |

### 9.4 Jobs (`/api/jobs`)

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET | `/jobs` | any | List jobs with filters: `status`, `playbook_id`, `server_id`, `user_id`. |
| GET | `/jobs/{id}` | any | Single job detail including playbook/server/user. |
| POST | `/jobs` | user | Create + execute job: `{playbook_id, server_id, extra_vars}`. Returns job object + UUID. |
| GET | `/jobs/{id}/logs` | any | Paginated logs: `start_line`, `limit`. |
| POST | `/jobs/{id}/cancel` | admin | Revoke Celery task; set status=cancelled. |
| POST | `/jobs/{id}/ticket` | user | Create support ticket from failed job. |
| GET | `/jobs/stats` | any | Aggregate counts by status + overall success rate. |
| POST | `/jobs/batch` | user | Create batch job on ≥2 servers. Body: `{playbook_id, server_ids[], extra_vars, concurrent_limit, stop_on_failure, execution_strategy}`. |
| GET | `/jobs/{id}/children` | any | Child jobs of a batch parent. |
| GET | `/jobs/analytics/success-rate-trends` | any | Params: `range` (7days/30days/3months/custom), `granularity` (daily/weekly/monthly). |
| GET | `/jobs/analytics/execution-time` | any | Avg execution time per playbook. Params: time range. |
| GET | `/jobs/analytics/failure-analysis` | any | Params: `group_by` (playbook/server/both). |
| GET | `/jobs/analytics/export` | any | Params: `format` (pdf/csv), time range. |
| GET | `/jobs/{id}/rpm-csv` | any | Fetch RPM upgrade CSV from remote server via SSH. |
| GET | `/jobs/{id}/generated-files` | any | Detect files written to `/tmp/` or `/var/tmp/` by parsing job logs. |
| GET | `/jobs/{id}/download-file` | any | Download or view detected file from remote server. Params: `file_path`, `action` (download/view). |
| GET | `/jobs/compliance/firmware-matrix` | any | Firmware compliance matrix grouped by location and vendor. |

### 9.5 Users (`/api/users`)

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET | `/users` | admin | List all users. Filters: `role`, `is_active`. |
| GET | `/users/{id}` | admin or self | User detail. |
| PUT | `/users/{id}` | admin or self | Update. Admins can change role/is_active; users can change email only. |
| PATCH | `/users/me/timezone` | user | Update own timezone. |
| DELETE | `/users/{id}` | super_admin | Hard-delete user and all cascading data. |

### 9.6 Notifications (`/api/notifications`)

- GET `/notifications` — paginated list for current user, optional `unread_only=true`
- GET `/notifications/unread-count` — fast integer count
- POST `/notifications/{id}/read` — mark single as read
- POST `/notifications/read-all` — mark all as read
- GET `/notifications/preferences` — get per-event-type preferences
- PUT `/notifications/preferences` — update preferences

### 9.7 WebSocket Events (`Flask-SocketIO`)

Namespace: `/` (default)

| Event | Direction | Payload | Description |
|---|---|---|---|
| `connect` | C→S | `{token}` (optional) | Establish connection; authenticate with JWT |
| `connected` | S→C | `{authenticated, user_id}` | Connection confirmed |
| `subscribe_job` | C→S | `{job_id}` (UUID string) | Subscribe to job's real-time log stream |
| `subscribed` | S→C | `{job_id, status, message}` | Subscription confirmed, includes current status |
| `job_log` | S→C | `{job_id, line_number, content, log_level, timestamp}` | Individual log line during execution |
| `job_status` | S→C | `{job_id, status, started_at?, completed_at?}` | Status transition |
| `unsubscribe_job` | C→S | `{job_id}` | Unsubscribe |
| `unsubscribed` | S→C | `{job_id}` | Confirmation |
| `error` | S→C | `{message}` | Error message |
| `patches_ready` | S→C | `{job_id, patches[]}` | Interactive playbook requesting user selection |

Room naming: `job_{job_id}`. The Celery worker emits to this room during execution.

---

## 10. ROLE-BASED ACCESS CONTROL (RBAC)

```
Level 4: super_admin  → Full system access + user deletion
Level 3: admin        → All resources + user management (no hard delete)
Level 2: operator     → Update servers/playbooks, run jobs
Level 1: user         → Create jobs, upload playbooks, create servers
Level 0: viewer       → Read-only (no create/update/delete)
```

Frontend enforces role-based UI visibility (hide buttons, redirect routes). Backend re-checks roles on every request via JWT claims.

---

## 11. SERVICES LAYER

### AuthService
- `register_user(username, email, password, role)` → User
- `authenticate(username, password)` → `{access_token, refresh_token, user}`
- `refresh_access_token(refresh_token)` → `access_token`
- `change_password(user_id, old_pw, new_pw)` → bool
- `check_permission(user, required_role)` → bool

### JobService
- `create_job(playbook_id, server_id, user_id, extra_vars)` → Job
- `create_batch_job(playbook_id, server_ids[], batch_config, user_id)` → parent Job
- `get_job(id)`, `get_job_by_uuid(uuid)`, `get_all_jobs(filters, page)` → Job(s)
- `update_job_status(job_id, status)` → updates started_at/completed_at
- `add_job_log(job_id, line, content, level)` → JobLog
- `add_job_logs_bulk(job_id, logs[])` → batch insert (performance optimization)
- `get_job_logs(job_id, start_line, limit)` → JobLog[]
- `cancel_job(job_id)` → revokes Celery task, sets status=cancelled
- `create_ticket_from_job(job_id, title, description, priority, user_id)` → Ticket
- `get_job_statistics()` → `{total, pending, running, success, failed, cancelled, success_rate}`
- `get_child_jobs(parent_job_id)` → Job[]
- `get_success_rate_trends(range, granularity)` → time-series data
- `get_execution_time_analytics(range)` → per-playbook avg/min/max durations
- `get_failure_analysis(group_by)` → ranked failure counts
- `export_analytics(format, range)` → bytes (PDF or CSV)

### PlaybookService
- `create_playbook(name, description, file)` → Playbook (single YAML)
- `create_playbook_from_zip(name, description, zip_file, main_playbook_file)` → Playbook
- `get_playbook_content(playbook_id)` → YAML string
- `update_playbook_content(playbook_id, content, user_id)` → creates PlaybookAuditLog
- `get_folder_file_list(playbook_id)` → file tree
- `get_folder_file_content(playbook_id, file_path)` → string
- `download_folder_as_zip(playbook_id)` → bytes
- `verify_playbook_integrity(playbook_id)` → bool
- `get_playbook_audit_logs(playbook_id, page)` → PlaybookAuditLog[]

### ServerService
- `create_server(hostname, ip_address, os_type, ssh_user, ssh_port, ssh_key_path, tags)` → Server
- `get_all_servers(filters, page)` → Server[]
- `update_server(id, fields)` → Server
- `delete_server(id)` / `hard_delete_server(id)`

### MonitorService
- `update_server_metrics(server_id)` → SSH into server, collect CPU/mem/disk, store
- `update_all_servers()` → calls above for all active servers

### NotificationService
- `create_notification(user_id, title, message, severity, event_type, entity_type, entity_id, metadata)` → Notification
- `create_bulk_notifications(user_ids[], ...)` → batch create
- `get_user_notifications(user_id, page, unread_only)` → Notification[]
- `mark_as_read(notification_id, user_id)`
- `get_unread_count(user_id)` → int
- `get_user_notification_preferences(user_id)` → NotificationPreference[]
- `update_notification_preferences(user_id, prefs)` → upsert per event_type

### SSHService (paramiko)
- `file_exists(server, file_path)` → bool
- `read_file(server, file_path)` → string
- Used by: MonitorService (metrics), JobAPI (RPM CSV download, generated file download)

### EmailService
- `send_notification_email(user, event_type, subject, body)` → SMTP send

---

## 12. CELERY TASK: execute_playbook_task

**File:** `backend/app/tasks.py`  
**Triggered by:** `POST /api/jobs` and `POST /api/jobs/batch`

### Full execution flow:
```
1.  Celery worker receives task(job_id)
2.  Load Job from DB with playbook + server
3.  Update Job.status = 'running', store celery_task_id
4.  Emit job_status='running' via Socket.IO to room job_{uuid}
5.  Build Ansible inventory string:
      "[all]\n{hostname} ansible_host={ip} ansible_user={ssh_user}
       ansible_port={ssh_port} ansible_ssh_private_key_file={key_path}"
6.  Merge extra_vars with system vars: {job_id, backend_url}
7.  Resolve playbook path:
      - Single file: playbook.file_path
      - Folder: os.path.join(playbook.file_path, playbook.main_playbook_file)
8.  Launch ansible-runner in async thread:
      runner = ansible_runner.run_async(
          private_data_dir=ANSIBLE_RUNNER_DIR,
          playbook=playbook_path,
          inventory=inventory_string,
          extravars=extra_vars
      )
9.  Poll thread output:
      while runner.rc is None:
          for line in runner.stdout:
              emit job_log via Socket.IO
              buffer.append(line)
              if len(buffer) >= 10:
                  JobService.add_job_logs_bulk(buffer)
                  buffer = []
          check DB if job.status == 'cancelled':
              runner.cancel()
              break
10. Flush remaining log buffer
11. Determine final status from runner.rc and output text
12. Update Job: status, completed_at, error_message
13. Create Notification (job_success or job_failure)
    - In-app always; email if user preference enabled
14. Emit job_status=final_status via Socket.IO
```

**Status transitions:** `pending → running → success | failed | cancelled`

---

## 13. FRONTEND ARCHITECTURE

### 13.1 Entry Point & Routing (App.tsx)

- **ErrorBoundary** wraps entire app; shows error message + refresh on crash
- **ProtectedRoute** checks `useAuthStore().isAuthenticated`; redirects to `/login` if false
- **DashboardGuard** reads user email domain:
  - `@jadeglobal.com` → `/` (internal Dashboard)
  - `@intuitivesurgical.*` → `/client-dashboard`
  - `super_admin` → can see both
- All routes use `<MainLayout>` which renders Sidebar + Navbar + outlet

**Route table:**
```
/login                       → LoginPage (public)
/                            → Dashboard (protected)
/client-dashboard            → ClientDashboard (protected)
/servers                     → ServersPage
/playbooks                   → PlaybooksPage
/playbook-audit              → PlaybookAuditPage
/playbook-audit-logs         → PlaybookAuditLogsPage
/jobs                        → JobsPage
/jobs/:id                    → JobDetailsPage
/users                       → UsersPage (admin only)
/settings                    → SettingsPage
/notifications               → NotificationsPage
/notification-preferences    → NotificationPreferencesPage
```

### 13.2 API Client (frontend/src/api/api.ts)

Axios instance configured with:
- Base URL: `getApiBaseUrl()` from `config/network.ts` → `http://localhost:5000/api`
- Timeout: 30 seconds
- Request interceptor: injects `Authorization: Bearer {access_token}` from localStorage
- Response interceptor:
  - On 401: silently calls `POST /auth/refresh` with `refresh_token`
  - On success: stores new access_token, retries original request
  - On refresh failure: clears tokens, redirects to `/login`

**API Modules exported from api.ts:** `authApi`, `serversApi`, `playbooksApi`, `jobsApi`, `usersApi`, `notificationsApi`

### 13.3 WebSocket Service (frontend/src/services/websocket.ts)

```typescript
class WebSocketService {
  connect(token?)          // Creates Socket.IO connection to backend
  disconnect()             // Cleans up
  subscribeToJob(jobId, {  // Joins room, registers callbacks
    onLog(data),
    onStatus(data),
    onSubscribed(data),
    onError(data)
  })
  unsubscribeFromJob(jobId) // Emits unsubscribe, removes listeners
  isConnected()            // Returns connection state
}
export const wsService = new WebSocketService()
```

Reconnection: Socket.IO built-in (linear 1s–10s, max 5 attempts) + manual exponential backoff (2ⁿ × 1000ms, cap 60s).

### 13.4 State Management (Zustand — authStore)

```typescript
{
  user: { id, username, email, role } | null,
  isAuthenticated: boolean,
  isLoading: boolean,
  login(credentials) → stores tokens in localStorage, sets user
  logout()           → clears localStorage, resets state
  loadUser()         → called on app startup; reads token, calls /auth/me
}
```

### 13.5 Frontend Pages (What Each Page Does)

**LoginPage** — Username/password form. Calls `authApi.login()`. On success, stores tokens and redirects to dashboard guard.

**Dashboard (internal)** — Shows: total jobs this week, server count, playbook count, success rate. Charts: daily success rate trend (Recharts LineChart), top failing playbooks (BarChart), execution time per playbook (BarChart). Calls analytics endpoints.

**ClientDashboard** — Client-branded view for @intuitivesurgical users. Shows compliance metrics, job history for client servers, firmware matrix. Custom color scheme.

**ServersPage** — Table of all servers with CPU/memory/disk badges. Create server modal. Edit/delete inline. Search + filter by OS, environment, active status.

**PlaybooksPage** — Cards/table of playbooks. Upload button opens modal: choose single YAML or ZIP folder. For ZIP, calls `preview-zip` first and shows file list for main playbook selection. Edit YAML inline. Delete with confirmation.

**PlaybookAuditPage** — Table of all playbook audit events across all playbooks. Filter by action, user, date. Shows old vs new content diff on expand.

**PlaybookAuditLogsPage** — Audit history for a single playbook (accessed from playbook detail). Paginated timeline of changes.

**JobsPage** — Main operations page. Table of all jobs with status badges. Create job modal: pick playbook, pick server(s). If multiple servers → batch. Batch options: concurrent limit, strategy, stop on failure. Filter by status, playbook, server. Export CSV/PDF.

**JobDetailsPage** — Real-time job monitor. Connects WebSocket on mount. Streams log lines as they arrive (auto-scrolls). Status indicator (spinner for running, ✓ for success, ✗ for failed). Execution timeline bar. "Generated Files" section appears if log regex detects `/tmp/` files. Cancel button (admin only). Create ticket button (if failed). RPM CSV table if patch job.

**UsersPage** — Admin-only. Table of all users. Create user with role assignment. Edit role/is_active. Delete (super_admin only).

**SettingsPage** — Change password form. Timezone dropdown (IANA timezones). Notification preferences quick access.

**NotificationsPage** — Inbox of all notifications. Mark read/unread. Filter by severity, event type. Badge count syncs with Navbar bell icon.

**NotificationPreferencesPage** — Grid of event types × channels (in-app / email / browser push). Toggle switches. Auto-saves on change.

---

## 14. END-TO-END WORKFLOWS

### Workflow A: Running a Playbook on a Single Server

```
User → JobsPage → "New Job" → select playbook + server → submit
↓
POST /api/jobs {playbook_id, server_id, extra_vars}
↓
Backend: create Job(status=pending) + queue Celery task
↓
Response: {job_id (UUID), job.id}
↓
Frontend: navigate to /jobs/{id}
↓
JobDetailsPage mounts → wsService.connect() → subscribeToJob(uuid)
↓
Celery: task runs → status→running → emits job_log events
↓
Socket.IO → wsService.onLog callback → React state update → log line appears
↓
Ansible finishes → Celery: status→success/failed → emits job_status
↓
wsService.onStatus → UI shows final status badge
↓
Notification created in DB + email (if preference enabled)
```

### Workflow B: Batch Execution on Multiple Servers

```
User → JobsPage → selects 2+ servers → "Batch Job"
↓
POST /api/jobs/batch {playbook_id, server_ids:[1,2,3,4,5],
                       concurrent_limit:3, execution_strategy:'parallel'}
↓
JobService.create_batch_job():
  - creates parent Job (is_batch_job=true)
  - creates 5 child Jobs (parent_job_id = parent.id)
  - queues 5 Celery tasks
↓
Celery: max 3 run simultaneously
↓
Frontend: GET /jobs/{parent_id}/children → polls or uses WS per child
↓
Each child job streams logs independently
↓
When all complete: parent status updated → batch notification sent
```

### Workflow C: Uploading a Complex Folder Playbook

```
User → PlaybooksPage → "Upload Playbook" → select ZIP
↓
Frontend: POST /playbooks/preview-zip {file: zip}
Backend: extract to temp dir, scan for *.yml, suggest main, return list, cleanup
↓
Frontend: show file list, let user pick main_playbook_file
↓
User confirms → POST /playbooks/upload-folder {file: zip, name, main_playbook_file}
↓
Backend: extract to /var/lib/infra-automation/playbooks/{name}_{uuid}/
         generate file_structure JSON tree
         store Playbook(is_folder=True, main_playbook_file, file_structure)
         create PlaybookAuditLog(action='uploaded')
↓
Frontend: redirect to playbook detail → shows file tree
User can: browse files, edit any file, execute on servers, download as ZIP
```

### Workflow D: Interactive Patch Playbook

```
Playbook runs → custom Ansible module reaches "select patches" step
↓
Module: POST /api/jobs/{id}/patches-available {patches: [...]}
Backend: emit patches_ready via Socket.IO to job room
↓
Frontend: InteractivePatchesDialog opens → user selects packages
↓
User submits → POST /api/jobs/{id}/patches-response {selected: [...]}
Backend: stores response, signals playbook to continue with selection
↓
Playbook applies selected patches, completes execution
```

### Workflow E: Token Refresh Flow

```
Frontend: request to any /api/* endpoint
↓
Response: 401 Unauthorized (access token expired)
↓
Axios response interceptor:
  - Calls POST /api/auth/refresh {refresh_token}
  - If 200: store new access_token, replay original request
  - If 401: clear localStorage, redirect to /login
```

---

## 15. FILE STORAGE

| Content | Filesystem Path | Constraints |
|---|---|---|
| Single YAML playbooks | `/var/lib/infra-automation/playbooks/{name}_{uuid}.yaml` | 500 KB max |
| Folder playbooks | `/var/lib/infra-automation/playbooks/{name}_{uuid}/` | 20 MB ZIP max |
| Ansible runner working dirs | `/var/lib/infra-automation/ansible-runner/` | Per-job temp dirs |
| SSH private keys | `/var/lib/infra-automation/keys/` | Referenced by server.ssh_key_path |
| Application logs | `/var/log/infra-automation/app.log` | Rotated: 10 MB × 10 files |

**Security:**
- ZIP extraction validates paths to prevent directory traversal
- File names sanitised before storage
- Generated file download restricted to `/tmp/` and `/var/tmp/` on remote servers
- Max download size: 50 MB

---

## 16. DEPLOYMENT STACK

```
/deploy/
├── infraansible-backend.service   # systemd: gunicorn --bind 0.0.0.0:5000 run:app
├── infraansible-celery.service    # systemd: celery -A run.celery worker
├── infraansible.nginx.conf        # nginx: proxy /api → :5000, serve dist/ for /
├── app-control.sh                 # start/stop/restart all services
└── install.sh                     # First-time setup script
```

**Environment Variables (backend/.env):**
```
FLASK_ENV=production
SECRET_KEY=<strong-random-secret>
JWT_SECRET_KEY=<strong-random-secret>
DATABASE_URL=mysql+pymysql://infra_user:pass@localhost/infra_automation
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
BACKEND_URL=https://infraansible.example.com
UPLOAD_FOLDER=/var/lib/infra-automation/playbooks
ANSIBLE_RUNNER_DIR=/var/lib/infra-automation/ansible-runner
CORS_ORIGINS=https://infraansible.example.com
LOG_FILE=/var/log/infra-automation/app.log
```

**Frontend build:** `npm run build` → `dist/` served by Nginx as static files.

---

## 17. SECURITY DESIGN

| Concern | Mechanism |
|---|---|
| Authentication | JWT HS256, 30-min access / 30-day refresh |
| Password storage | bcrypt 12-14 rounds |
| Authorization | Role hierarchy enforced in both API decorators and frontend |
| SQL injection | SQLAlchemy parameterized queries only |
| Path traversal | ZIP extraction validation, filename sanitization |
| File upload abuse | Extension whitelist, size limits, secure filename generation |
| CORS | Explicit allow-list with credentials support |
| Audit trail | AuditLog + PlaybookAuditLog (immutable append-only) |
| Login tracking | IP address + timestamp logged per auth event |
| Sensitive data | Passwords never logged; JWT secrets in env vars |

---

## 18. PERFORMANCE DESIGN

| Area | Design Decision |
|---|---|
| DB connections | SQLAlchemy pool: 10 base, 20 overflow, recycle 3600s, pre-ping |
| Log writes | Bulk insert every 10 lines (avoids N individual inserts per playbook run) |
| Large tables | BIGINT PKs for job_logs, audit_logs (millions of rows expected) |
| API responses | Pagination on all list endpoints (default 20, max 100) |
| Celery concurrency | Default worker concurrency = CPU count; override via `--concurrency` |
| Frontend bundles | Vite code-splitting by route (lazy-loaded pages) |
| Static assets | Nginx gzip compression + browser cache headers |
| Real-time logs | WebSocket push (no polling); room-based fan-out |
| Analytics queries | Composite indexes on (status, created_at), (user_id, status) |

---

## 19. NOTIFICATION SYSTEM

**Event Types:** `job_success`, `job_failure`, `batch_complete`, `server_failure`, `high_cpu`, `user_change`, `playbook_update`, `system_alert`

**Channels:**
1. **In-App** — stored in `notifications` table, visible in NotificationsPage and Navbar bell
2. **Email** — SMTP via `email_service.py`; HTML templates per event type
3. **Browser Push** — Schema reserved, not yet implemented

**Preference Matrix:** Each user can independently toggle each channel on/off per event type via NotificationPreferences page. Default: in_app=True, email=False.

**Delivery:** NotificationService called by Celery task at job completion. Creates DB record + optionally sends email. Severity: `info` (success), `error` (failure), `warning` (partial batch failure).

---

## 20. AUDIT & COMPLIANCE

Three complementary audit systems:

1. **AuditLog** — All significant actions (login, create, update, delete) across all resource types. Immutable. BigInteger PK for 1+ year retention. Captures IP address.

2. **PlaybookAuditLog** — Playbook-specific changes with full `old_content` / `new_content` for diff comparison. Survives playbook deletion (no FK to playbooks table). Enables compliance proof of "what changed, who changed it, when."

3. **Application Logs** — Flask rotating file handler at `/var/log/infra-automation/app.log`. Captures request/response at INFO level; exceptions at ERROR.

---

## 21. KNOWN EXTENSION POINTS

The codebase has clear seams where features can be added without large refactors:

- **New notification channels** — add channel logic to `NotificationService.create_notification()`; preference model already has `browser_push_enabled` column.
- **New playbook variable types** — `extra_vars` is a JSON column; no schema change needed.
- **Additional analytics** — add methods to `JobService`; add route to `jobs.py`; add chart to Dashboard.
- **New RBAC roles** — add to ENUM in models, update `check_permission()` in `AuthService`, update frontend guards.
- **Server connectivity test** — `testConnection` is in the frontend API module but backend endpoint needs implementation (SSH ping).
- **Rate limiting** — Flask-Limiter is mentioned as a future enhancement; integrate at blueprint level.
- **Browser push notifications** — `NotificationPreference.browser_push_enabled` column exists; implement Web Push protocol in `NotificationService`.

---

*This megaprompt was generated from a live codebase inspection on 2026-06-12 and reflects the actual state of the InfraAnsible repository at that date. When working with this codebase, always treat this document as the architectural reference and verify specific implementation details directly in the source files listed.*
