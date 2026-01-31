# Jade Global Automation Hub

A production-ready web-based platform for managing infrastructure automation using Ansible. Built with Flask (backend) and React TypeScript (frontend), this platform enables teams to execute Ansible playbooks, manage servers, monitor jobs, and maintain comprehensive audit trails through an intuitive dashboard.

> **Note**: This project is intended for internal use within Jade Global.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)
- [Support](#-support)

---

## 🚀 Features

### Job Execution & Monitoring
- **Create and Execute Jobs**: Run Ansible playbooks on target servers with one click
- **Real-time Log Streaming**: View live execution logs with auto-refresh
- **Job Status Tracking**: Monitor jobs across 5 states (pending, running, success, failed, cancelled)
- **Job History**: Complete execution history with filtering by status, playbook, server, or user
- **Job Cancellation**: Stop running jobs on demand
- **Download Logs**: Export job logs for offline analysis
- **Job Re-run**: Quickly re-execute previous jobs with same parameters
- **Job Statistics**: Visual dashboard with success rates and performance metrics

### Playbook Management
- **Upload Playbooks**: Upload Ansible YAML playbooks via web interface
- **Playbook Library**: Centralized repository of all playbooks with metadata
- **Edit Playbooks**: In-browser YAML editor with syntax highlighting
- **Playbook Versioning**: Complete audit trail of all playbook changes (create, update, delete)
- **Content Comparison**: View before/after diffs for playbook modifications
- **Soft Delete**: Deactivate playbooks without permanent deletion
- **File Validation**: Automatic YAML syntax validation on upload

### Server Management
- **Server Inventory**: Centralized database of all managed servers
- **CRUD Operations**: Add, update, view, and delete servers
- **Real-time Monitoring**: Live CPU, memory, and disk usage metrics
- **Auto-refresh Metrics**: Automatic metric updates every 5 seconds
- **SSH Configuration**: Store SSH connection details (user, port, key path)
- **Server Status**: Active/inactive status tracking

### User Management & RBAC
- **Role-Based Access Control**: 3-tier hierarchy (super_admin, admin, user)
- **User CRUD**: Complete user lifecycle management (super_admin only)
- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Session Management**: Automatic token refresh and logout
- **Timezone Support**: Per-user timezone preferences for accurate timestamps
- **Last Login Tracking**: Monitor user activity

### Audit & Compliance
- **Comprehensive Audit Logs**: Track all system actions (289+ logged events)
- **Resource Tracking**: Monitor changes to users, servers, playbooks, and jobs
- **IP Address Logging**: Record source IP for all actions
- **Playbook Audit Trail**: Detailed history with full content snapshots
- **Immutable Records**: Audit logs cannot be modified or deleted
- **Action Types**: LOGIN, CREATE, UPDATE, DELETE, CANCEL, HARD_DELETE, UPDATE_CONTENT

### Dashboard & Analytics
- **Key Metrics Display**: Total servers, playbooks, jobs, and users
- **Job Status Breakdown**: Visual pie chart of job distribution
- **Recent Activity**: Latest 10 jobs with quick access
- **Success Rate Tracking**: Overall job performance metrics
- **Quick Navigation**: Direct links to all major features

---

## 🏗️ Architecture

### System Overview

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Browser   │ ──HTTP──│ Flask Backend│ ──SQL───│   MySQL     │
│  (React UI) │         │  (REST API)  │         │  Database   │
└─────────────┘         └──────────────┘         └─────────────┘
                              │
                              │ Tasks
                              ↓
                        ┌──────────────┐         ┌─────────────┐
                        │    Celery    │ ────────│    Redis    │
                        │   Workers    │  Queue  │   Message   │
                        └──────────────┘         │   Broker    │
                              │                  └─────────────┘
                              │ Executes
                              ↓
                        ┌──────────────┐
                        │   Ansible    │
                        │    Runner    │
                        └──────────────┘
                              │
                              │ SSH
                              ↓
                        ┌──────────────┐
                        │   Target     │
                        │   Servers    │
                        └──────────────┘
```

### Component Breakdown

**Frontend (React + TypeScript)**
- Single Page Application (SPA) with React Router
- State management using Zustand
- Axios for API communication
- TailwindCSS for styling
- Real-time updates via polling

**Backend (Flask + SQLAlchemy)**
- RESTful API with JWT authentication
- Service layer pattern for business logic
- SQLAlchemy ORM for database operations
- Marshmallow for request/response serialization
- Role-based authorization middleware

**Task Queue (Celery + Redis)**
- Asynchronous job execution
- Background task processing
- Job status updates
- Worker process management

**Database (MySQL)**
- 8 tables: users, servers, playbooks, jobs, job_logs, tickets, audit_logs, playbook_audit_logs
- Indexed for performance
- Foreign key constraints for data integrity
- JSON columns for flexible metadata

**Automation Engine (Ansible Runner)**
- Playbook execution wrapper
- SSH key management
- Inventory generation
- Output parsing and logging

---

## 💻 Technology Stack

### Backend
- **Python**: 3.10+
- **Flask**: 3.0.0 - Web framework
- **SQLAlchemy**: 2.0.23 - ORM
- **MySQL**: 8.0 - Database
- **Celery**: 5.3.4 - Task queue
- **Redis**: 5.0.1 - Message broker
- **Ansible**: 8.7.0 - Automation engine
- **Ansible Runner**: 2.3.4 - Execution wrapper
- **JWT Extended**: 4.5.3 - Authentication
- **Marshmallow**: 3.20.1 - Serialization
- **Bcrypt**: 4.1.2 - Password hashing

### Frontend
- **React**: 18.2 - UI framework
- **TypeScript**: 5.3 - Type safety
- **Vite**: 5.0 - Build tool
- **Zustand**: 4.4 - State management
- **TailwindCSS**: 3.3 - Styling
- **Axios**: 1.6 - HTTP client
- **React Router**: 6.21 - Routing
- **Lucide React**: Icons

### Development Tools
- **npm**: Package manager (frontend)
- **pip**: Package manager (backend)
- **Git**: Version control

---

## 📦 Prerequisites

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

## 📖 Usage

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

## 📂 Project Structure

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

## 📡 API Documentation

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

## 🔍 Troubleshooting

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

## 📸 Screenshots

> **Note**: Screenshots will be added in a future update to showcase the dashboard, job execution, and management interfaces.

---

## 📄 License

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

## 📧 Support

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

**Built with ❤️ for Infrastructure Automation**
