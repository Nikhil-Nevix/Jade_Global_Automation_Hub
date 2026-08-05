## Jade Global Automation Hub

A production-ready web platform for infrastructure automation using Ansible. The system provides a secure, auditable, and operationally safe way to run playbooks across server fleets with centralized governance, analytics, and reporting. It combines a React TypeScript frontend with a Flask backend, a MySQL database, and a Celery + Redis task queue to execute jobs reliably at scale.

This project is intended for internal use within Jade Global.

---

## Table of Contents

- [Introduction](#introduction)
- [Project Objective](#project-objective)
- [Problem Statement](#problem-statement)
- [Solution Overview](#solution-overview)
- [Key Features](#key-features)
- [Architecture Overview](#architecture-overview)
- [Component-Level Documentation](#component-level-documentation)
- [Data Model and Storage](#data-model-and-storage)
- [Security and Access Control](#security-and-access-control)
- [Operational Flow](#operational-flow)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Support](#support)

---

## Introduction

Jade Global Automation Hub is a centralized automation platform designed to standardize how infrastructure operations teams execute Ansible playbooks. The system provides a governed workflow with authentication, role-based access control, job orchestration, log collection, and audit trails. It replaces ad-hoc SSH and manual playbook execution with a reliable, repeatable, and secure pipeline that can be tracked end-to-end.

---

## Project Objective

- Create a unified interface to manage playbooks, servers, and execution jobs.
- Enforce security and governance through authentication, RBAC, and audit logs.
- Provide operational insights via dashboards and analytics.
- Reduce execution risk with controlled job lifecycle management, logging, and verification.

---

## Problem Statement

Infrastructure teams often run Ansible playbooks manually, resulting in:

- Inconsistent execution practices and hard-to-reproduce outcomes.
- Limited visibility into job success rates and historical runs.
- Lack of centralized ownership and auditability.
- Increased operational risk due to manual server access and ad-hoc scripts.

---

## Solution Overview

This platform introduces a structured automation workflow:

- Users authenticate and execute jobs through a secured UI.
- Playbooks and servers are centrally registered and governed.
- Jobs are executed asynchronously via Celery workers, ensuring reliability and scalability.
- Logs, analytics, and audit trails provide traceability and compliance readiness.

---

## Key Features

### Job Execution and Monitoring
- Execute playbooks against managed servers with controlled parameters.
- Track job lifecycle states: pending, running, success, failed, cancelled.
- Stream and retain logs for real-time monitoring and historical review.
- Cancel running jobs and re-run previous configurations safely.
- View execution metrics and performance summaries.

### Playbook Management
- Upload and manage YAML playbooks with version-aware auditing.
- Maintain metadata and descriptions for discovery and reuse.
- Validate content and enforce file integrity at upload time.
- Track playbook audit history with full diff visibility.

### Server Management
- Maintain a centralized inventory of target servers.
- Capture connection details, tags, environment, and operational status.
- Collect monitoring metrics and update health in near real time.

### User Management and RBAC
- Enforce role-based access with super_admin, admin, and user roles.
- Secure APIs with JWT access and refresh tokens.
- Track session activity and user-specific timezone settings.

### Audit and Compliance
- Record all critical actions across users, jobs, servers, and playbooks.
- Store audit trails for immutable compliance review.
- Track IP address and actor identity per event.

### Analytics and Dashboards
- Present success rates, execution trends, and failure analysis.
- Offer time-range filters and exports for reports.
- Provide quick navigation to operational data.

---

## Architecture Overview

```
Browser (React UI)
  │
  ▼
Flask REST API  ───► MySQL Database
  │
  ▼
Celery Worker Pool  ───► Redis Broker
  │
  ▼
Ansible Runner  ───► Target Servers (SSH)
```

### Architectural Purpose

- The frontend provides the operator interface and reporting UI.
- The backend enforces rules, permissions, and business logic.
- The task queue isolates execution workloads from the web process.
- The database stores immutable records and operational history.

---

## Component-Level Documentation

### Frontend Application

**Purpose**: A single-page React app that provides the UI for managing playbooks, servers, jobs, analytics, and user settings.

**Key Elements**

- **Routing Layer**: Central navigation and protected routes for authenticated access.
- **API Client**: Axios-based client for consistent request handling and token refresh.
- **State Stores**: Zustand stores for auth, UI preferences, and shared app state.
- **Pages**: Modular screens for Dashboard, Jobs, Servers, Playbooks, Users, Audit, and Settings.
- **Components**: Reusable UI modules like charts, tables, status badges, dialogs, and modals.

**Pages and Purpose**

- **Dashboard**: Overall system metrics, analytics, and recent activity.
- **Jobs**: Execution history with filters and status details.
- **Job Details**: Live logs, job metadata, and execution artifacts.
- **Playbooks**: Playbook library, upload, and metadata management.
- **Playbook Audit**: Full edit history with diff tracking.
- **Servers**: Inventory management with monitoring metrics.
- **Users**: Role-based account management (super_admin only).
- **Settings**: User preferences, timezone, and system configuration.
- **Notifications**: System alerts and unread tracking.

**Reusable Components**

- **DynamicChart**: Visualization of job metrics and distributions.
- **StatusBadge**: Consistent status rendering across tables and cards.
- **Navbar and Sidebar**: Navigation, quick actions, and layout structure.
- **Modals and Dialogs**: Playbook upload, server edits, batch actions.

**Working Flow**

1. User logs in and receives access/refresh tokens.
2. API client attaches tokens to outgoing requests.
3. UI renders data from backend endpoints with pagination and filters.
4. State stores synchronize user session, theme, and navigation state.

### Backend Application

**Purpose**: A Flask-based API that owns authentication, validation, execution orchestration, and data integrity.

**Core Layers**

- **App Factory**: Initializes configuration, routes, extensions, and environment.
- **Extensions**: SQLAlchemy, Marshmallow, JWT, CORS, and Celery integration.
- **API Blueprints**: Route grouping for auth, users, servers, playbooks, jobs, analytics, and notifications.
- **Service Layer**: Encapsulates business logic (execution, validation, monitoring, auditing).
- **Schema Layer**: Marshmallow schemas for input validation and output serialization.

**API Modules and Purpose**

- **auth**: Login, token refresh, and session management.
- **users**: User creation, updates, and role enforcement.
- **servers**: Inventory CRUD and monitoring endpoints.
- **playbooks**: Upload, edit, delete, and audit history.
- **jobs**: Job creation, status, logs, analytics, and exports.
- **notifications**: Alerts, preferences, and read states.
- **playbook_audit**: Dedicated audit trail lookups.

**Service Modules and Purpose**

- **auth_service**: Permission checks, password verification, token workflows.
- **server_service**: Server CRUD, validation, and monitoring orchestration.
- **playbook_service**: File storage, validation, and audit tracking.
- **job_service**: Job lifecycle, logs, analytics, and export helpers.
- **notification_service**: Event routing and notification persistence.
- **monitor_service**: Metric collection and health status updates.

**Task Modules and Purpose**

- **tasks**: Celery job execution, status updates, and result handling.
- **celery_worker**: Worker bootstrap and execution context.

**Utilities**

- **log_parser**: Normalize Ansible output for structured job logs.
- **file_manager**: Secure file handling for playbooks and generated artifacts.

**Working Flow**

1. Requests hit API endpoints secured by JWT decorators.
2. Payloads are validated using Marshmallow schemas.
3. Service layer executes business logic and returns structured results.
4. Results are serialized and returned to the UI.

### Job Orchestration (Celery + Redis)

**Purpose**: Execute long-running playbooks asynchronously without blocking the API.

- Celery workers consume jobs from Redis queues.
- Each job updates its status and logs during execution.
- Failures are recorded and surfaced in analytics and audit logs.

### Ansible Execution Layer

**Purpose**: Provide consistent playbook execution with structured output.

- Builds dynamic inventories from server data.
- Runs playbooks through Ansible Runner for safe execution.
- Captures stdout/stderr and structures logs into job records.

### Monitoring and Metrics

**Purpose**: Provide operational visibility into server health and job execution.

- Periodic polling of server metrics.
- Logs and job metrics feed dashboards and analytics.

### Notifications System

**Purpose**: Deliver critical system events (job failures, server issues, batch completion) to users.

- Event-driven notifications stored in the database.
- UI surfaces alerts and unread counts.
- Email/SSE support is available where configured.

---

## Data Model and Storage

**Primary Tables**

- **users**: Accounts, roles, credentials, and timezone preferences.
- **servers**: Inventory, connection parameters, tags, and health metadata.
- **playbooks**: Metadata, file paths, and storage references.
- **jobs**: Job lifecycle tracking with timestamps and status.
- **job_logs**: Structured log lines for all executions.
- **audit_logs**: Immutable records of all important actions.
- **playbook_audit_logs**: Version history with before/after content.
- **tickets**: Support workflow for failed jobs.

**Purpose of the Database**

- Maintain authoritative operational state.
- Enable historical reporting, analytics, and compliance checks.
- Support reproducible execution with immutable job history.

---

## Security and Access Control

- JWT-based authentication with refresh support.
- Role-based access control across all endpoints.
- Password hashing using bcrypt.
- Audit trails for sensitive actions.
- Environment-specific configuration via .env files.

---

## Operational Flow

1. User authenticates and receives JWT tokens.
2. User selects a playbook and target server.
3. Job is created and pushed to the queue.
4. Celery worker executes the playbook via Ansible Runner.
5. Logs and status updates are streamed back to the UI.
6. Job results are stored, summarized, and shown on dashboards.

---

## Technology Stack

### Backend
- Python 3.10+
- Flask 3.x
- SQLAlchemy 2.x
- Marshmallow 3.x
- Celery 5.x
- Redis 5.x
- MySQL 8.x
- Ansible 8.x
- Ansible Runner 2.x
- JWT Extended
- Bcrypt

### Frontend
- React 18
- TypeScript 5
- Vite 5
- Zustand 4
- TailwindCSS 3
- Axios 1.x
- React Router 6

### Development Tools
- npm, pip, Git

---

## Prerequisites

### System Requirements
- **Operating System**: Linux (CentOS, Ubuntu, RHEL, or similar)
- **CPU**: 2+ cores recommended
- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 20GB available space
- **Network**: Internet access for package installation

### Software Requirements
- **Python**: 3.10 or higher
- **Node.js**: 18.0 or higher
- **npm**: 9.0 or higher
- **MySQL**: 8.0 or higher
- **Redis**: 6.0 or higher
- **Ansible**: 8.0 or higher (installed via backend dependencies)

### Development Tools
```bash
# Check versions
python --version          # Should be 3.10+
node --version            # Should be 18.0+
npm --version             # Should be 9.0+
mysql --version           # Should be 8.0+
redis-server --version    # Should be 6.0+
```

---

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Nikhil-Nevix/Jade_Global_Automation_Hub.git
cd Jade_Global_Automation_Hub
```

### 2. Database Setup

```bash
# Start MySQL service
sudo systemctl start mysqld
sudo systemctl enable mysqld

# Login to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'infra_user'@'localhost' IDENTIFIED BY 'infra_pass123';
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Import schema
cd backend
mysql -u infra_user -pinfra_pass123 infra_automation < schema.sql
```

### 3. Redis Setup

```bash
# Start Redis service
sudo systemctl start redis
sudo systemctl enable redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### 4. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Edit .env with your configuration
nano .env
```

**Environment Variables** (`.env`):
```env
# Flask
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-here-change-in-production

# Database
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@localhost:3306/infra_automation

# JWT
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production
JWT_ACCESS_TOKEN_EXPIRES=3600
JWT_REFRESH_TOKEN_EXPIRES=2592000

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# File Storage
PLAYBOOKS_DIR=./data/playbooks
```

```bash
# Start Flask development server
python run.py
# Backend will run on http://localhost:5000
```

### 5. Start Celery Worker (in new terminal)

```bash
cd backend
source venv/bin/activate
celery -A app.celery_app worker --loglevel=info
```

### 6. Frontend Setup

```bash
# Navigate to frontend directory (in new terminal)
cd frontend

# Install dependencies
npm install

# Create environment file
nano .env
```

**Frontend Environment** (`.env`):
```env
VITE_API_URL=http://localhost:5000/api
```

```bash
# Start development server
npm run dev
# Frontend will run on http://localhost:5173
```

### 7. Create Initial Admin User

```bash
# In a new terminal, navigate to backend
cd backend
source venv/bin/activate
python

# In Python shell:
from app import create_app, db
from app.models import User

app = create_app()
with app.app_context():
    admin = User(
        username='admin',
        email='admin@jadeglobal.com',
        role='super_admin',
        timezone='UTC'
    )
    admin.set_password('Admin@123')
    db.session.add(admin)
    db.session.commit()
    print("Admin user created successfully!")
exit()
```

### 8. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Default Credentials**: 
  - Username: `admin`
  - Password: `Admin@123`

---

## ⚙️ Configuration

### Backend Configuration

**Database Connection** (`backend/.env`):
```env
DATABASE_URL=mysql+pymysql://username:password@host:port/database
```

**JWT Settings** (`backend/.env`):
```env
JWT_SECRET_KEY=strong-secret-key
JWT_ACCESS_TOKEN_EXPIRES=3600      # 1 hour
JWT_REFRESH_TOKEN_EXPIRES=2592000  # 30 days
```

**Celery Settings** (`backend/.env`):
```env
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

**File Storage** (`backend/.env`):
```env
PLAYBOOKS_DIR=./data/playbooks  # Relative or absolute path
```

### Frontend Configuration

**API Endpoint** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:5000/api  # Development
# VITE_API_URL=https://api.yourdomain.com/api  # Production
```

### SSH Configuration for Servers

When adding servers, provide:
- **SSH User**: Username for Ansible connection (e.g., `root`, `ansible`)
- **SSH Port**: Default is 22
- **SSH Key Path**: Absolute path to private key (e.g., `/home/user/.ssh/id_rsa`)

Ensure the SSH key has:
- Correct permissions: `chmod 600 /path/to/private_key`
- Public key installed on target server: `~/.ssh/authorized_keys`

---

## Usage Guide

### Basic Workflow

#### 1. Login
- Navigate to http://localhost:5173
- Enter credentials (default: `admin` / `Admin@123`)
- You'll be redirected to the Dashboard

#### 2. Add a Server
- Go to **Servers** page
- Click **"Add Server"** button
- Fill in details:
  - Hostname: `web-server-01`
  - IP Address: `192.168.1.100`
  - OS Type: `linux`
  - SSH User: `root`
  - SSH Port: `22`
  - SSH Key Path: `/home/user/.ssh/id_rsa`
- Click **"Add Server"**

#### 3. Upload a Playbook
- Go to **Playbooks** page
- Click **"Upload Playbook"** button
- Select a `.yml` file or drag & drop
- Add description (optional)
- Click **"Upload"**

**Example Playbook** (`ping_test.yml`):
```yaml
---
- name: Ping Test
  hosts: all
  gather_facts: yes
  tasks:
    - name: Ping the server
      ping:
```

#### 4. Execute a Job
- On **Playbooks** page, click the **Play icon** next to a playbook
- Select target server from dropdown
- Click **"Execute"**
- You'll be redirected to the Job Details page

#### 5. Monitor Job Execution
- View real-time logs on **Job Details** page
- Logs auto-refresh every 5 seconds
- See job status: pending → running → success/failed
- Download logs using **"Download Logs"** button
- Cancel job using **"Cancel Job"** button (if running)

#### 6. View Job History
- Go to **Jobs** page
- Filter by status, playbook, server, or user
- Click on any job to view details

### User Management (Super Admin Only)

#### Create New User
- Go to **Users** page
- Click **"Add User"** button
- Fill in details:
  - Username
  - Email
  - Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
  - Role: `user`, `admin`, or `super_admin`
  - Timezone (optional)
- Click **"Create User"**

#### Role Permissions

| Feature | User | Admin | Super Admin |
|---------|------|-------|-------------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Servers | ✅ | ✅ | ✅ |
| Add/Edit Servers | ❌ | ✅ | ✅ |
| Delete Servers | ❌ | ❌ | ✅ |
| View Playbooks | ✅ | ✅ | ✅ |
| Upload Playbooks | ✅ | ✅ | ✅ |
| Edit Playbooks | ❌ | ✅ | ✅ |
| Delete Playbooks | ❌ | ❌ | ✅ |
| Create Jobs | ✅ | ✅ | ✅ |
| Cancel Jobs | ✅ | ✅ | ✅ |
| View Jobs | ✅ | ✅ | ✅ |
| View Users | ❌ | ✅ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |

### Playbook Audit Trail

- Go to **Playbook Audit** page
- Select a playbook from dropdown
- View complete history of all changes:
  - Created events
  - Updated events (with before/after content)
  - Deleted events
- Click **"View Diff"** to compare versions
- See who made changes and when

---

## Project Structure

```
Jade_Global_Automation_Hub/
├── backend/                      # Flask backend
│   ├── app/
│   │   ├── __init__.py          # App factory
│   │   ├── config.py            # Configuration classes
│   │   ├── extensions.py        # Flask extensions (db, jwt, ma, cors, celery)
│   │   ├── models.py            # SQLAlchemy models (8 tables)
│   │   ├── schemas.py           # Marshmallow schemas
│   │   ├── tasks.py             # Celery tasks
│   │   ├── api/                 # REST API endpoints
│   │   │   ├── auth.py          # Login, token refresh
│   │   │   ├── users.py         # User CRUD
│   │   │   ├── servers.py       # Server management
│   │   │   ├── playbooks.py     # Playbook upload/edit/delete
│   │   │   └── jobs.py          # Job execution and monitoring
│   │   ├── services/            # Business logic
│   │   │   ├── auth_service.py  # Authentication & authorization
│   │   │   ├── server_service.py# Server operations
│   │   │   ├── playbook_service.py # Playbook management
│   │   │   ├── job_service.py   # Job lifecycle
│   │   │   └── monitor_service.py # Server monitoring
│   │   ├── playbooks/           # Ansible integration
│   │   │   └── run.py           # Ansible Runner wrapper
│   │   └── utils/               # Utilities
│   │       └── log_parser.py    # Log parsing
│   ├── data/
│   │   └── playbooks/           # Uploaded playbook files
│   ├── migrations/              # Database migration scripts
│   ├── run.py                   # Application entry point
│   ├── schema.sql               # Database schema
│   ├── requirements.txt         # Python dependencies
│   └── .env.example             # Environment template
│
├── frontend/                     # React frontend
│   ├── src/
│   │   ├── api/
│   │   │   └── api.ts           # Axios API client
│   │   ├── components/          # Reusable components
│   │   │   ├── Navbar/
│   │   │   ├── Sidebar/
│   │   │   ├── StatusBadge/
│   │   │   └── DynamicChart/
│   │   ├── pages/               # Page components
│   │   │   ├── Dashboard/
│   │   │   ├── LoginPage/
│   │   │   ├── ServersPage/
│   │   │   ├── PlaybooksPage/
│   │   │   ├── JobsPage/
│   │   │   ├── JobDetailsPage/
│   │   │   ├── UsersPage/
│   │   │   ├── SettingsPage/
│   │   │   ├── PlaybookAuditPage/
│   │   │   └── PlaybookAuditLogsPage/
│   │   ├── store/               # Zustand state stores
│   │   │   ├── authStore.ts
│   │   │   └── uiStore.ts
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript interfaces
│   │   ├── utils/
│   │   │   └── timezone.ts      # Timezone utilities
│   │   ├── App.tsx              # Main app with routing
│   │   ├── main.tsx             # Entry point
│   │   └── index.css            # Global styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── Documentation/                # Project documentation
│   ├── Database_Schema_Details.md
│   ├── Folder_uploading_enhancement.md
│   ├── Complete_Setup.md
│   ├── ARCHITECTURE_EXPLAINED.md
│   ├── SYSTEM_COMPONENTS.md
│   └── functionalities/         # Feature documentation
│       ├── Job-Execution-and-Monitoring.md
│       ├── Playbook-Management.md
│       ├── Server-Management.md
│       ├── User-Management.md
│       ├── Authentication-and-Authorization.md
│       └── Audit-and-Logging.md
│
└── README.md                     # This file
```

---

## API Documentation

### Authentication

**Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "Admin@123"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@jadeglobal.com",
    "role": "super_admin"
  }
}
```

**Refresh Token**
```http
POST /api/auth/refresh
Authorization: Bearer <refresh_token>

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### Job Execution

**Create Job**
```http
POST /api/jobs
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "playbook_id": 1,
  "server_id": 2,
  "extra_vars": {}  # Optional runtime variables
}

Response:
{
  "id": 42,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "playbook": {
    "id": 1,
    "name": "ping_test"
  },
  "server": {
    "id": 2,
    "hostname": "web-server-01",
    "ip_address": "192.168.1.100"
  },
  "created_at": "2026-01-31T10:00:00"
}
```

**Get Job Details**
```http
GET /api/jobs/42
Authorization: Bearer <access_token>

Response:
{
  "id": 42,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "started_at": "2026-01-31T10:00:05",
  "completed_at": "2026-01-31T10:00:15",
  ...
}
```

**Get Job Logs**
```http
GET /api/jobs/42/logs
Authorization: Bearer <access_token>

Response:
{
  "job_id": 42,
  "logs": [
    {
      "id": 1,
      "line_number": 1,
      "content": "PLAY [Ping Test] ***************",
      "log_level": "INFO",
      "timestamp": "2026-01-31T10:00:05"
    },
    ...
  ],
  "total_lines": 25
}
```

**Cancel Job**
```http
POST /api/jobs/42/cancel
Authorization: Bearer <access_token>

Response:
{
  "id": 42,
  "status": "cancelled",
  "error_message": "Job cancelled by user"
}
```

### Additional Endpoints

- **Servers**: `/api/servers` (GET, POST, PUT, DELETE)
- **Playbooks**: `/api/playbooks` (GET, POST, PUT, DELETE)
- **Users**: `/api/users` (GET, POST, PUT, DELETE)
- **Playbook Audit**: `/api/playbooks/audit/{playbook_id}`

For complete API documentation, see [backend/API_DOCS.md](backend/API_DOCS.md)

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Error
```
Error: (2003, "Can't connect to MySQL server")
```
**Solution**:
- Verify MySQL is running: `sudo systemctl status mysqld`
- Check credentials in `.env` file
- Ensure database exists: `mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT 1;"`

#### 2. Redis Connection Error
```
Error: ConnectionError: Error 111 connecting to localhost:6379
```
**Solution**:
- Start Redis: `sudo systemctl start redis`
- Check Redis is listening: `redis-cli ping`

#### 3. Celery Worker Not Starting
```
Error: Couldn't ack xyz, reason: ConnectionResetError
```
**Solution**:
- Restart Redis: `sudo systemctl restart redis`
- Restart Celery worker: Kill process and start again

#### 4. Import Error: No module named 'app'
```
ImportError: No module named 'app'
```
**Solution**:
- Ensure you're in the backend directory: `cd backend`
- Activate virtual environment: `source venv/bin/activate`
- Verify PYTHONPATH: Add backend to PYTHONPATH if needed

#### 5. Job Stuck in "Pending" Status
**Possible Causes**:
- Celery worker not running
- Redis connection issues
- Task queue backlog

**Solution**:
- Check Celery worker logs
- Restart Celery worker: `celery -A app.celery_app worker --loglevel=info`

#### 6. Ansible Playbook Execution Fails
```
Error: Failed to connect to the host via ssh
```
**Solution**:
- Verify SSH key permissions: `chmod 600 /path/to/key`
- Test SSH manually: `ssh -i /path/to/key user@host`
- Check SSH key path in server configuration
- Ensure public key is in target server's `~/.ssh/authorized_keys`

#### 7. Frontend Cannot Connect to Backend
```
Error: Network Error / CORS Error
```
**Solution**:
- Verify backend is running on port 5000
- Check `VITE_API_URL` in `frontend/.env`
- Ensure CORS is enabled in Flask (already configured)

#### 8. Token Expired Error
```
Error: Token has expired
```
**Solution**:
- Logout and login again
- Frontend will automatically refresh tokens if refresh token is valid
- Check JWT expiry settings in backend `.env`

### Logs Location

- **Flask Logs**: Terminal where `python run.py` is running
- **Celery Logs**: Terminal where Celery worker is running
- **Job Logs**: Database (`job_logs` table) + Job Details page
- **Audit Logs**: Database (`audit_logs` table)
- **MySQL Logs**: `/var/log/mysqld.log` (or `/var/log/mysql/error.log`)
- **Redis Logs**: `/var/log/redis/redis.log`

### Debug Mode

Enable detailed error messages:

**Backend** (`.env`):
```env
FLASK_ENV=development
FLASK_DEBUG=1
```

**Celery**:
```bash
celery -A app.celery_app worker --loglevel=debug
```

---

## Screenshots

> **Note**: Screenshots will be added in a future update to showcase the dashboard, job execution, and management interfaces.

---

## License

This project is licensed under the MIT License.

```
MIT License

Copyright (c) 2026 Jade Global

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Support

For questions, issues, or support requests, please contact:

**Nikhil Rokade**  
Email: [nikhil.rokade@jadeglobal.com](mailto:nikhil.rokade@jadeglobal.com)

---

## 🎯 Roadmap

Future enhancements being considered:

- [ ] Support for structured Ansible playbooks (roles, inventories)
- [ ] Scheduled job execution (cron-like)
- [ ] Email notifications for job completion
- [ ] Multi-server job execution (run on multiple servers simultaneously)
- [ ] Playbook templates library
- [ ] Advanced filtering and search
- [ ] Dark mode support
- [ ] Mobile responsive improvements
- [ ] Export audit logs to CSV
- [ ] Integration with external monitoring tools (Prometheus, Grafana)

---

**Built by-
Nikhil Rokade |
Jade Global Software Pvt Ltd**
