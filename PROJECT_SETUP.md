# 🏗️ Infrastructure Automation Platform - Complete Setup Guide

**Single Source of Truth for Project Setup and Execution**

---

## 📋 Project Overview

The Infrastructure Automation Platform is a web-based solution for managing infrastructure through Ansible playbooks. It provides a complete workflow for server management, playbook execution, and real-time job monitoring.

### What This Project Does

- **Server Management**: Maintain an inventory of infrastructure servers with SSH credentials
- **Playbook Management**: Upload, organize, and execute Ansible playbooks
- **Job Execution**: Run automation jobs asynchronously with real-time log streaming
- **Access Control**: Role-based authentication (admin, operator, viewer)
- **Audit Trail**: Complete history of all automation activities

### Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Backend** | Flask | 3.0 | REST API server |
| | SQLAlchemy | 2.0 | Database ORM |
| | Celery | 5.3 | Async task processing |
| | Ansible Runner | 2.3 | Playbook execution |
| **Frontend** | React | 18.2 | UI framework |
| | TypeScript | 5.3 | Type safety |
| | Vite | 5.0 | Build tool |
| | Zustand | 4.4 | State management |
| | TailwindCSS | 3.3 | Styling |
| **Database** | MySQL | 8.0 | Primary data store |
| **Cache/Queue** | Redis | 6.0+ | Celery broker/backend |

---

## 🔧 Prerequisites

Install the following software before proceeding:

### Required Software with Versions

| Software | Minimum Version | Verify Command | Download Link |
|----------|----------------|----------------|---------------|
| **Python** | 3.9+ | `python --version` | https://www.python.org/downloads/ |
| **Node.js** | 18+ | `node --version` | https://nodejs.org/ |
| **MySQL** | 8.0+ | `mysql --version` | https://dev.mysql.com/downloads/mysql/ |
| **Redis** | 6.0+ | `redis-cli ping` | See options below |
| **Git** | Any | `git --version` | https://git-scm.com/ |

### Verify Installation

Open PowerShell and run:

```powershell
# Check Python
python --version
# Expected: Python 3.9.x or higher

# Check Node.js
node --version
# Expected: v18.x.x or higher

# Check npm
npm --version
# Expected: 9.x.x or higher

# Check MySQL
mysql --version
# Expected: mysql Ver 8.0.x

# Check Git
git --version
# Expected: git version 2.x.x
```

### Redis Installation Options

**Option A: WSL (Recommended for Windows Development)**
```powershell
wsl --install
# Restart computer if prompted
wsl
sudo apt update
sudo apt install redis-server
```

**Option B: Docker**
```powershell
docker run -d -p 6379:6379 --name redis redis:latest
```

**Option C: Memurai (Native Windows)**
Download from: https://www.memurai.com/get-memurai

---

## 📂 Environment Setup

### Folder Structure

```
InfraAnsible/
├── backend/                  # Flask REST API
│   ├── app/                  # Application package
│   │   ├── api/              # API endpoints
│   │   ├── services/         # Business logic
│   │   ├── utils/            # Utilities
│   │   ├── models.py         # Database models
│   │   ├── schemas.py        # Marshmallow schemas
│   │   └── tasks.py          # Celery tasks
│   ├── requirements.txt      # Python dependencies
│   ├── schema.sql            # Database schema
│   └── run.py                # Application entry point
├── frontend/                 # React dashboard
│   ├── src/
│   │   ├── api/              # API client
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── store/            # State management
│   │   └── types/            # TypeScript types
│   ├── package.json          # Node dependencies
│   └── vite.config.ts        # Vite configuration
└── PROJECT_SETUP.md          # This file
```

### Required Environment Variables

The backend requires a `.env` file with the following variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `FLASK_APP` | Flask application entry point | `run.py` |
| `FLASK_ENV` | Environment mode | `development` |
| `SECRET_KEY` | Flask secret key | `dev-secret-key-change-in-production` |
| `JWT_SECRET_KEY` | JWT signing key | `dev-jwt-secret-change-in-production` |
| `DATABASE_URL` | MySQL connection string | `mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379/0` |
| `CELERY_BROKER_URL` | Celery broker URL | `redis://localhost:6379/0` |
| `CELERY_RESULT_BACKEND` | Celery result backend | `redis://localhost:6379/1` |
| `PLAYBOOKS_DIR` | Playbook storage path | `./playbooks` |
| `BCRYPT_LOG_ROUNDS` | Password hashing rounds | `12` |

### .env Example

Create `backend/.env` with this content:

```env
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production

# Database
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Playbooks
PLAYBOOKS_DIR=./playbooks

# Security
BCRYPT_LOG_ROUNDS=12
```

---

## 🗄️ Database Setup

### Step 1: Start MySQL Service

**Option A: Using Administrator PowerShell (Recommended)**

1. Right-click on PowerShell icon
2. Select "Run as Administrator"
3. Execute:

```powershell
net start MySQL80
```

**Option B: Using Start-Service cmdlet**

```powershell
Start-Service MySQL80
```

**Note:** If you get "Access is denied" error, you must run PowerShell as Administrator.

If MySQL is not installed as a service, start it manually from the installation directory.

### Step 2: Create Database and User

Open MySQL client:

```powershell
mysql -u root -p
# Enter password: root (default) or your configured password
```

Execute the following SQL commands:

```sql
-- Create database with proper character set
CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user
CREATE USER 'infra_user'@'localhost' IDENTIFIED BY 'infra_pass123';

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify user and database
SELECT User, Host FROM mysql.user WHERE User = 'infra_user';
SHOW DATABASES LIKE 'infra_automation';

-- Exit MySQL
EXIT;
```

### Step 3: Import Schema

Navigate to the backend directory and import the schema:

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\backend

# PowerShell method (use pipe instead of <)
Get-Content schema.sql | mysql -u infra_user -pinfra_pass123 infra_automation

# Alternative: Use cmd shell
cmd /c "mysql -u infra_user -pinfra_pass123 infra_automation < schema.sql"
```

**Note:** No space between `-p` and the password. PowerShell doesn't support `<` for input redirection, so use `Get-Content` and pipe instead.

### Step 4: Verify Tables

Check that all tables were created successfully:

```powershell
mysql -u infra_user -pinfra_pass123 infra_automation -e "SHOW TABLES;"
```

**Expected output (7 tables):**
```
+----------------------------+
| Tables_in_infra_automation |
+----------------------------+
| audit_logs                 |
| job_logs                   |
| jobs                       |
| playbooks                  |
| servers                    |
| tickets                    |
| users                      |
+----------------------------+
```

**Note:** The `alembic_version` table is not listed because it's only created when using Flask-Migrate (`flask db upgrade`). Since you imported the schema directly, you have the correct 7 core tables needed for the application.

---

## 🐍 Backend Setup

⚠️ **IMPORTANT - Windows Limitation:**

The backend uses `ansible_runner` which requires Unix-specific modules (`fcntl`) that **do not exist on Windows**. This means:

- ✅ **You CAN:** Set up the database, install dependencies, create admin user, and test non-Ansible features
- ❌ **You CANNOT:** Start the Flask server completely or execute Ansible playbooks on Windows
- 🐧 **Solution:** For full functionality including Ansible job execution, you **must** use a Linux VM

**Recommendation:** Complete Steps 1-8 below on Windows for initial setup, then proceed to the **🐧 Linux VM Migration Guide** section at the end of this document for production execution.

---

### Step 1: Navigate to Backend Directory

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\backend
```

### Step 2: Create Virtual Environment

```powershell
python -m venv InfraAuto
```

### Step 3: Activate Virtual Environment

```powershell
.\InfraAuto\Scripts\Activate.ps1
```

**Note:** If you get an execution policy error, run:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Your prompt should now show `(InfraAuto)` at the beginning.

### Step 4: Install Dependencies

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

This installs:
- Flask 3.0 (web framework)
- SQLAlchemy 2.0 (ORM)
- Celery 5.3 (async tasks)
- Ansible Runner 2.3 (playbook execution)
- PyMySQL 1.1 (MySQL driver)
- Marshmallow 3.20 (serialization)
- Flask-JWT-Extended 4.5 (authentication)
- And more... (see requirements.txt)

### Step 5: Create Environment File

```powershell
Copy-Item .env.example .env -ErrorAction SilentlyContinue
```

If `.env.example` doesn't exist, create `.env` manually using the template in the "Environment Setup" section above.

### Step 6: Create Playbooks Directory

```powershell
New-Item -ItemType Directory -Force -Path playbooks
```

### Step 7: Initialize Database (Optional) [not working right now]

If you want to use Flask-Migrate instead of direct schema import:

```powershell
flask db upgrade
```

### Step 8: Create Admin User

**IMPORTANT:** This step is required to login to the application.

```powershell
# Method 1: Using Flask CLI (if command exists)
flask create-admin

# Method 2: Using Python directly
python -c "from app import create_app, db; from app.models import User; app = create_app(); app.app_context().push(); admin = User(username='admin', email='admin@example.com', role='admin'); admin.set_password('admin123'); db.session.add(admin); db.session.commit(); print('Admin user created')"
```

**Verify admin user:**
```powershell
mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT id, username, email, role FROM users;"
```

### Step 9: Start Backend Server (⚠️ Will Fail on Windows)

⚠️ **CRITICAL:** This step will **FAIL** on Windows due to `ansible_runner` requiring Unix-specific `fcntl` module.

```powershell
python run.py
```

**Expected ERROR on Windows:**
```
Traceback (most recent call last):
  File "run.py", line 1, in <module>
    from app import create_app
  File "backend\app\__init__.py", line 11, in <module>
    from app.api import auth_bp, servers_bp, playbooks_bp, jobs_bp, users_bp
  ...
  File "backend\app\tasks.py", line 9, in <module>
    from app.playbooks.run import ansible_runner_instance
  File "backend\app\playbooks\run.py", line 6, in <module>
    import ansible_runner
  ...
    import fcntl
ModuleNotFoundError: No module named 'fcntl'
```

**This is expected and NOT a bug.** `fcntl` is a Unix-only module required by Ansible.

### ✅ What You've Accomplished So Far (Steps 1-8):

- ✅ Database created and schema imported
- ✅ Admin user created (admin/admin123)
- ✅ Python dependencies installed
- ✅ Environment configured
- ✅ Ready for Linux VM migration

### 🚀 Next Steps:

**To run the backend with full Ansible support, proceed to:** [🐧 Linux VM Migration Guide](#-linux-vm-migration-guide)

The Linux VM migration guide shows you how to:
- Transfer your code to a Linux VM (no changes needed)
- Run the backend on Linux where ansible_runner works
- Keep your frontend on Windows
- Maintain your Git-based development workflow

---

## 🔄 Celery Worker Setup

⚠️ **Windows Limitation:** Celery **CANNOT** run on Windows due to the same `fcntl` error. This section is for reference only. Celery must run on Linux VM.

Celery processes async tasks like Ansible playbook execution. It **must run in a separate terminal** and **must stay running** while using the application.

**Skip this section on Windows.** Proceed to [🐧 Linux VM Migration Guide](#-linux-vm-migration-guide) for Linux setup.

### Step 1: Open New Terminal

Open a **new** PowerShell window (do NOT close the backend terminal).

### Step 2: Navigate and Activate Virtual Environment

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\backend
.\venv\Scripts\Activate.ps1
```

### Step 3: Start Redis

Before starting Celery, ensure Redis is running:

**WSL:**
```powershell
wsl sudo service redis-server start
```

**Docker:**
```powershell
docker start redis
# Or if first time:
docker run -d -p 6379:6379 --name redis redis:latest
```

**Memurai:**
```powershell
net start memurai
```

**Verify Redis:**
```powershell
redis-cli ping
# Expected: PONG
```

### Step 4: Start Celery Worker (Windows)

**CRITICAL:** On Windows, you **must** use `--pool=solo`:

```powershell
celery -A app.celery worker --loglevel=info --pool=solo
```

**Expected output:**
```
 -------------- celery@HOSTNAME v5.3.4 (emerald-rush)
--- ***** ----- 
-- ******* ---- Windows-10-10.0.19045-SP0 2025-12-30 10:00:00
- *** --- * --- 
- ** ---------- [config]
- ** ---------- .> app:         app:0x...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     redis://localhost:6379/1
- *** --- * --- .> concurrency: 8 (solo)
-- ******* ---- .> task events: OFF
--- ***** ----- 
 -------------- [queues]
                .> celery           exchange=celery(direct) key=celery

[tasks]
  . app.tasks.cleanup_old_logs
  . app.tasks.execute_playbook
  . app.tasks.generate_reports
  . app.tasks.health_check_servers

[2025-12-30 10:00:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
[2025-12-30 10:00:00,001: INFO/MainProcess] mingle: searching for neighbors
[2025-12-30 10:00:01,010: INFO/MainProcess] mingle: all alone
[2025-12-30 10:00:01,020: INFO/MainProcess] celery@HOSTNAME ready.
```

### Why Celery Must Stay Running

- Celery executes Ansible playbooks asynchronously
- Without Celery, jobs will stay in "pending" status forever
- The web UI triggers jobs, but Celery actually runs them
- Each job execution can take minutes to hours
- Celery allows multiple jobs to run concurrently

**✅ Celery worker is running! Leave this terminal open.**

---

## ⚛️ Frontend Setup

### Step 1: Open New Terminal

Open a **new** PowerShell window (3rd terminal).

### Step 2: Navigate to Frontend Directory

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\frontend
```

### Step 3: Install Node Dependencies

```powershell
npm install
```

This installs:
- React 18.2 (UI framework)
- TypeScript 5.3 (type checking)
- Vite 5.0 (build tool)
- Zustand 4.4 (state management)
- Axios 1.6 (HTTP client)
- TailwindCSS 3.3 (styling)
- React Router 6.21 (routing)
- And more... (see package.json)

### Step 4: Verify Environment Configuration

```powershell
Get-Content .env
```

**Expected content:**
```env
VITE_API_URL=http://localhost:5000/api
```

If the file doesn't exist, create it:
```powershell
"VITE_API_URL=http://localhost:5000/api" | Out-File -Encoding utf8 .env
```

### Step 5: Start Vite Development Server

```powershell
npm run dev
```

**Expected output:**
```
  VITE v5.0.8  ready in 423 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**✅ Frontend is running! Leave this terminal open.**

---

## 🚀 How to Run the Full Project

⚠️ **IMPORTANT:** Due to Windows limitations with `ansible_runner`, you have two options:

### Option 1: Linux VM (Production - Full Functionality)

You need **3 terminals on Linux VM**:

| Terminal | Location | Command | Purpose | Port |
|----------|----------|---------|---------|------|
| **Terminal 1 (Linux)** | `~/InfraAnsible/backend` | `source venv/bin/activate` then `python run.py` | Flask API Server | 5000 |
| **Terminal 2 (Linux)** | `~/InfraAnsible/backend` | `source venv/bin/activate` then `celery -A app.celery worker --loglevel=info` | Celery Worker | N/A |
| **Terminal 3 (Windows)** | `C:\Users\...\frontend` | `npm run dev` | React Dev Server | 5173 |

**Frontend `.env` on Windows:**
```env
VITE_API_URL=http://<LINUX-VM-IP>:5000/api
```

**See [🐧 Linux VM Migration Guide](#-linux-vm-migration-guide) for complete setup.**

---

### Option 2: Windows Only (Limited - For Frontend Development)

⚠️ **Limitations:** Backend and Celery **will NOT start** due to `fcntl` error. Only frontend development possible.

| Terminal | Location | Command | Purpose | Port |
|----------|----------|---------|---------|------|
| **Terminal 1** | N/A | **WILL FAIL** - Cannot run backend on Windows | Flask API Server | ❌ |
| **Terminal 2** | N/A | **WILL FAIL** - Cannot run Celery on Windows | Celery Worker | ❌ |
| **Terminal 3** | `frontend/` | `npm run dev` | React Dev Server | 5173 |

### Quick Start Commands

**✅ Linux VM Approach (Recommended):**

**Terminal 1 (Flask on Linux VM):**
```bash
ssh ubuntu@<VM-IP>
cd ~/InfraAnsible/backend
source venv/bin/activate
python run.py
```

**Terminal 2 (Celery on Linux VM):**
```bash
ssh ubuntu@<VM-IP>
cd ~/InfraAnsible/backend
source venv/bin/activate
celery -A app.celery worker --loglevel=info
```

**Terminal 3 (React on Windows):**
```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\frontend
npm run dev
```

---

**❌ Windows Only (Will NOT Work):**

```powershell
# These commands will FAIL on Windows with fcntl error:
# python run.py → ModuleNotFoundError: No module named 'fcntl'
# celery -A app.celery worker → ModuleNotFoundError: No module named 'fcntl'

# Only frontend works on Windows:
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\frontend
npm run dev
```

### Service Dependencies

```
Frontend (Port 5173)
    ↓ API calls
Backend (Port 5000)
    ↓ Database queries
MySQL (Port 3306)
    
Backend (Port 5000)
    ↓ Task dispatch
Celery Worker
    ↓ Broker connection
Redis (Port 6379)
```

---

## 🌐 Access & Login Details

### Application URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | Main web interface |
| **Backend API** | http://localhost:5000/api | REST API endpoints |
| **Health Check** | http://localhost:5000/api/health | API status |

### Default Credentials

**Admin Account:**
- **Username:** `admin`
- **Email:** `admin@example.com`
- **Password:** `admin123`
- **Role:** `admin` (full access)

### First Login Steps

1. Open browser and navigate to: **http://localhost:5173**
2. You will see the login page
3. Enter username: `admin`
4. Enter password: `admin123`
5. Click "Login"
6. You should be redirected to the dashboard

### What You'll See After Login

- **Dashboard**: Statistics cards showing server count, playbook count, job count, and success rate
- **Sidebar Navigation**: Dashboard, Servers, Playbooks, Jobs, Users, Tickets, Audit Logs
- **Recent Jobs Table**: List of recent automation jobs with status
- **Top Navigation**: User profile and logout

---

## ✅ End-to-End Validation Checklist

Follow these steps to verify everything works:

### 1. Login Test
- [ ] Navigate to http://localhost:5173
- [ ] Login with admin/admin123
- [ ] Dashboard loads without errors
- [ ] Statistics show zeros (no data yet)

### 2. Server CRUD Operations

**Create:**
- [ ] Click "Servers" in sidebar
- [ ] Click "Add Server" button
- [ ] Fill form:
  ```
  Hostname: test-server-01
  IP Address: 192.168.1.100
  OS Type: ubuntu
  OS Version: 22.04
  SSH Port: 22
  SSH User: ansible
  SSH Key Path: /home/ansible/.ssh/id_rsa
  Environment: development
  Description: Test server for validation
  ```
- [ ] Click "Save"
- [ ] Server appears in the list

**Read:**
- [ ] View server in the servers table
- [ ] Click "View" to see details

**Update:**
- [ ] Click "Edit" button
- [ ] Change description to "Updated test server"
- [ ] Click "Save"
- [ ] Verify description updated

**Delete:**
- [ ] Click "Delete" button
- [ ] Confirm deletion
- [ ] Server removed from list

### 3. Playbook Operations

**Upload:**
- [ ] Click "Playbooks" in sidebar
- [ ] Click "Upload Playbook" button
- [ ] Create a test playbook file `ping.yml`:
  ```yaml
  ---
  - name: Ping Test
    hosts: all
    tasks:
      - name: Ping the server
        ping:
  ```
- [ ] Upload the file
- [ ] Fill form:
  ```
  Name: ping-test
  Description: Simple connectivity test
  Tags: test, connectivity
  ```
- [ ] Click "Upload"
- [ ] Playbook appears in list

### 4. Job Execution

**Execute:**
- [ ] From playbooks page, find "ping-test"
- [ ] Click "Run" button
- [ ] Select a server from dropdown
- [ ] Click "Execute"
- [ ] Job starts and shows "Running" status
- [ ] Navigate to job details page

**Monitor:**
- [ ] Real-time logs stream to the page
- [ ] Terminal-style log viewer shows Ansible output
- [ ] Job status updates automatically
- [ ] Logs auto-refresh every 2 seconds

**Verify:**
- [ ] Job completes successfully (green status)
- [ ] Final status shows "Success"
- [ ] Can download logs
- [ ] Job appears in dashboard "Recent Jobs"

### 5. Log Streaming

- [ ] During job execution, logs appear in real-time
- [ ] Logs show Ansible PLAY, TASK, and PLAY RECAP
- [ ] Timestamps are visible
- [ ] Can scroll through log history
- [ ] Logs persist after job completion

---

## 🐛 Common Issues & Fixes

### MySQL Issues

**Issue:** `Can't connect to MySQL server on 'localhost'`

**Fix:**
```powershell
# Check if MySQL service is running
Get-Service MySQL80

# Start MySQL service (run PowerShell as Administrator)
net start MySQL80
# Or use:
Start-Service MySQL80

# Verify connection
mysql -u infra_user -pinfra_pass123 -e "SELECT 1;"
```

**Issue:** `System error 5 has occurred. Access is denied.` when starting MySQL

**Fix:**
You need Administrator privileges to start Windows services.

**Option 1: Run PowerShell as Administrator**
1. Close current PowerShell window
2. Right-click PowerShell icon → "Run as Administrator"
3. Run: `net start MySQL80`

**Option 2: Use Start-Service cmdlet**
```powershell
Start-Service MySQL80
```

**Option 3: Start from Services Manager**
1. Press `Win + R`
2. Type `services.msc` and press Enter
3. Find "MySQL80" in the list
4. Right-click → Start

**Issue:** `Access denied for user 'infra_user'@'localhost'`

**Fix:**
```powershell
mysql -u root -p
```
```sql
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**Issue:** `Unknown database 'infra_automation'`

**Fix:**
```powershell
mysql -u root -p -e "CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cd backend
mysql -u infra_user -pinfra_pass123 infra_automation < schema.sql
```

### Redis Issues

**Issue:** `Error connecting to Redis on localhost:6379`

**Fix (WSL):**
```powershell
wsl sudo service redis-server status
wsl sudo service redis-server start
```

**Fix (Docker):**
```powershell
docker ps -a | Select-String redis
docker start redis
# If container doesn't exist:
docker run -d -p 6379:6379 --name redis redis:latest
```

**Fix (Memurai):**
```powershell
net start memurai
```

**Verify Redis:**
```powershell
redis-cli ping
# Should return: PONG
```

### Celery Issues

**Issue:** `Celery worker crashes immediately on Windows`

**Fix:**
Always use `--pool=solo` on Windows:
```powershell
celery -A app.celery worker --loglevel=info --pool=solo
```

**Issue:** `ModuleNotFoundError: No module named 'app'`

**Fix:**
Ensure you're in the backend directory and virtual environment is activated:
```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\backend
.\venv\Scripts\Activate.ps1
celery -A app.celery worker --loglevel=info --pool=solo
```

**Issue:** Jobs stay in "pending" status forever

**Fix:**
Celery worker is not running. Start it in a separate terminal:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
celery -A app.celery worker --loglevel=info --pool=solo
```

### Port Conflicts

**Issue:** `Address already in use: Port 5000`

**Fix:**
```powershell
# Find process using port 5000
Get-NetTCPConnection -LocalPort 5000 | Select-Object LocalPort, OwningProcess

# Kill the process (replace <PID> with the actual process ID)
Stop-Process -Id <PID> -Force
```

**Issue:** `Port 5173 is already in use`

**Fix:**
```powershell
# Find and kill process on port 5173
Get-NetTCPConnection -LocalPort 5173 | Select-Object LocalPort, OwningProcess
Stop-Process -Id <PID> -Force

# Or use a different port
npm run dev -- --port 5174
```

### CORS Issues

**Issue:** Frontend shows `CORS policy: No 'Access-Control-Allow-Origin' header`

**Fix:**
1. Verify backend `.env` has:
   ```env
   CORS_ORIGINS=http://localhost:5173
   ```
2. Restart Flask backend
3. Clear browser cache (Ctrl+Shift+Delete)
4. Hard refresh (Ctrl+F5)

**Issue:** CORS errors only on specific endpoints

**Fix:**
Check `backend/app/__init__.py` has CORS configured:
```python
from flask_cors import CORS
CORS(app, origins=app.config.get('CORS_ORIGINS', '*').split(','))
```

### Python Virtual Environment Issues

**Issue:** `ModuleNotFoundError: No module named 'flask'`

**Fix:**
```powershell
# Ensure virtual environment is activated (prompt shows "(venv)")
.\venv\Scripts\Activate.ps1

# If still not working, reinstall dependencies
pip install -r requirements.txt
```

**Issue:** `Activate.ps1 cannot be loaded because running scripts is disabled`

**Fix:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\venv\Scripts\Activate.ps1
```

### Frontend Issues

**Issue:** `npm ERR! code ENOENT`

**Fix:**
```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
npm cache clean --force
npm install
```

**Issue:** Frontend shows "Network Error" or "Request failed with status code 500"

**Fix:**
1. Verify backend is running: http://localhost:5000/api/health
2. Check backend terminal for error logs
3. Verify `.env` file in frontend has correct API URL:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```
4. Open browser console (F12) and check for specific errors
5. Restart both backend and frontend

### Database Schema Issues

**Issue:** `Table 'infra_automation.users' doesn't exist`

**Fix:**
```powershell
cd backend
mysql -u infra_user -pinfra_pass123 infra_automation < schema.sql
# Verify tables
mysql -u infra_user -pinfra_pass123 infra_automation -e "SHOW TABLES;"
```

### Windows Platform Issues

**Issue:** `ModuleNotFoundError: No module named 'fcntl'` when running Flask or Celery

**Explanation:**

This is **NOT an error you can fix on Windows**. The `fcntl` module is Unix-only and required by `ansible_runner`. This is by design—Ansible is a Linux-native tool.

**Fix:**

You have three options:

1. **Use Linux VM (Recommended)** - Proceed to [🐧 Linux VM Migration Guide](#-linux-vm-migration-guide)
2. **Use WSL2** - Not recommended, as WSL has networking complexities
3. **Use Docker** - Not covered in this guide, requires containerization knowledge

**What Works on Windows:**
- ✅ Database setup and management
- ✅ Frontend development (React/Vite)
- ✅ Git operations
- ✅ Code editing in VS Code
- ✅ Admin user creation via MySQL directly

**What Doesn't Work on Windows:**
- ❌ Running Flask backend server
- ❌ Running Celery worker
- ❌ Executing Ansible playbooks
- ❌ Testing job execution
- ❌ End-to-end validation

**Solution:** Complete the [🐧 Linux VM Migration Guide](#-linux-vm-migration-guide) to run the backend on Linux while keeping your frontend and development tools on Windows.

---

## 🏭 Production Notes

### Linux / AWS VM Considerations

**System Preparation:**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y python3.10 python3.10-venv python3-pip \
    mysql-server redis-server nginx supervisor ansible

# Create application user
sudo useradd -m -s /bin/bash infra-automation
```

**Directory Structure:**
```bash
sudo mkdir -p /opt/infra-automation
sudo mkdir -p /var/lib/infra-automation/{playbooks,ansible-runner,keys}
sudo mkdir -p /var/log/infra-automation
sudo chown -R infra-automation:infra-automation /opt/infra-automation
sudo chown -R infra-automation:infra-automation /var/lib/infra-automation
sudo chown -R infra-automation:infra-automation /var/log/infra-automation
sudo chmod 700 /var/lib/infra-automation/keys
```

**Process Management:**
Use Supervisor to manage Flask and Celery as system services:

```ini
# /etc/supervisor/conf.d/infra-automation.conf
[program:infra-api]
command=/opt/infra-automation/backend/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 run:app
directory=/opt/infra-automation/backend
user=infra-automation
autostart=true
autorestart=true
stdout_logfile=/var/log/infra-automation/api.log
stderr_logfile=/var/log/infra-automation/api-error.log

[program:infra-celery]
command=/opt/infra-automation/backend/venv/bin/celery -A app.celery worker --loglevel=info
directory=/opt/infra-automation/backend
user=infra-automation
autostart=true
autorestart=true
stdout_logfile=/var/log/infra-automation/celery.log
stderr_logfile=/var/log/infra-automation/celery-error.log
```

**Nginx Reverse Proxy:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /opt/infra-automation/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Build Frontend:**
```bash
cd /opt/infra-automation/frontend
npm run build
# Output: dist/ directory
```

### Security Reminders

**Change Default Credentials:**
```powershell
# Login to application as admin
# Navigate to Profile → Change Password
# Set strong password (minimum 12 characters, mixed case, numbers, symbols)
```

**Update Environment Variables:**
```env
# Generate strong random keys
SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")

# Use strong database passwords
DATABASE_URL=mysql+pymysql://infra_user:STRONG_RANDOM_PASSWORD@localhost/infra_automation
```

**MySQL Security:**
```sql
-- Remove default accounts
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Set strong root password
ALTER USER 'root'@'localhost' IDENTIFIED BY 'STRONG_ROOT_PASSWORD';

-- Flush privileges
FLUSH PRIVILEGES;
```

**File Permissions:**
```bash
# Ensure proper permissions
chmod 600 /opt/infra-automation/backend/.env
chmod 700 /var/lib/infra-automation/keys
chmod 755 /opt/infra-automation
```

**Firewall Configuration:**
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

**SSL/TLS:**
- Use Let's Encrypt for free SSL certificates
- Configure Nginx to redirect HTTP → HTTPS
- Set secure headers (HSTS, CSP, X-Frame-Options)

**Backup Strategy:**
```bash
# Database backups
mysqldump -u infra_user -p infra_automation > backup-$(date +%Y%m%d).sql

# Backup playbooks and SSH keys
tar -czf playbooks-backup-$(date +%Y%m%d).tar.gz /var/lib/infra-automation/playbooks
tar -czf keys-backup-$(date +%Y%m%d).tar.gz /var/lib/infra-automation/keys
```

---

## 📊 Complete Setup Summary

### What Gets Installed

| Component | Items | Storage Location |
|-----------|-------|------------------|
| **Python Packages** | 30+ packages (Flask, Celery, SQLAlchemy, etc.) | `backend/venv/` |
| **Node Packages** | 40+ packages (React, Vite, TypeScript, etc.) | `frontend/node_modules/` |
| **Database** | 8 tables with indexes | MySQL `infra_automation` DB |
| **Redis** | In-memory data store | Port 6379 |

### Ports Used

| Port | Service | Must be available |
|------|---------|-------------------|
| 3306 | MySQL | Yes |
| 5000 | Flask API | Yes |
| 5173 | Vite Dev Server | Yes (or use alternate) |
| 6379 | Redis | Yes |

### Disk Space Requirements

- Backend: ~500 MB (virtual environment + dependencies)
- Frontend: ~400 MB (node_modules)
- Database: ~50 MB (initial schema)
- Total: ~1 GB for full setup

### Time to Complete Setup

- Prerequisites verification: 5 minutes
- Database setup: 5 minutes
- Backend setup: 5 minutes
- Frontend setup: 3 minutes
- **Total: ~20 minutes** for complete setup

---

## 🎯 Quick Reference Commands

### Daily Startup (Linux VM + Windows)

**Terminal 1 (SSH to Linux VM):**
```bash
ssh ubuntu@<VM-IP>
cd ~/InfraAnsible/backend
source venv/bin/activate
python run.py
# Or with Supervisor:
sudo supervisorctl start infra-api
```

**Terminal 2 (SSH to Linux VM):**
```bash
ssh ubuntu@<VM-IP>
cd ~/InfraAnsible/backend
source venv/bin/activate
celery -A app.celery worker --loglevel=info
# Or with Supervisor:
sudo supervisorctl start infra-celery
```

**Terminal 3 (Windows PowerShell):**
```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\frontend
npm run dev
```

**Note:** Ensure `frontend/.env` has `VITE_API_URL=http://<VM-IP>:5000/api`

### Stop Everything

Press `Ctrl+C` in each terminal, then:

```powershell
# Optional: Stop services (requires Administrator privileges)
Stop-Service MySQL80
# Or: net stop MySQL80 (run PowerShell as Administrator)

wsl sudo service redis-server stop
# or
docker stop redis
```

### Health Checks

```powershell
# MySQL
mysql -u infra_user -pinfra_pass123 -e "SELECT 1;"

# Redis
redis-cli ping

# Flask
curl http://localhost:5000/api/health

# Frontend
curl http://localhost:5173
```

---

## 🏆 Success Criteria

### Windows Setup Success (Initial Phase):

✅ MySQL installed and running  
✅ Database created with 7 tables  
✅ Admin user created (admin/admin123)  
✅ Python dependencies installed  
✅ Frontend runs on Windows (http://localhost:5173)  
✅ Ready for Linux VM migration  

### Full System Success (After Linux VM Migration):

✅ Linux VM provisioned and accessible  
✅ Backend running on Linux VM (port 5000)  
✅ Celery worker running on Linux VM  
✅ Frontend on Windows connects to Linux backend  
✅ You can access http://localhost:5173 in browser  
✅ You can login with admin/admin123  
✅ Dashboard loads and shows statistics  
✅ You can create a test server  
✅ You can upload a test playbook  
✅ **You can execute Ansible jobs successfully (no fcntl errors)**  
✅ Job completes successfully  
✅ Logs stream in real-time during execution  

---

## 📞 Support & Documentation

For detailed technical information, refer to:

- **Database Schema**: `backend/schema.sql`
- **API Endpoints**: `backend/API_DOCS.md`
- **Database Design**: `backend/DATABASE_DESIGN.md`
- **Frontend Integration**: `frontend/INTEGRATION_GUIDE.md`
- **Migration Guide**: `backend/MIGRATION_GUIDE.md`

---

## 🐧 Linux VM Migration Guide

**For Production-Ready Ansible Execution**

### Why Migrate to Linux VM?

**Root Cause:** `ansible_runner` requires Unix-specific modules (`fcntl`) that don't exist on Windows. This is not a bug—it's by design. Ansible and ansible_runner are Linux-native tools.

**Solution:** Use Linux VM as the **execution environment only**. Your code, architecture, and database schema remain completely unchanged.

**What Changes:**
- Execution environment: Windows → Linux VM
- Ansible jobs: Will now execute successfully

**What Stays the Same:**
- All backend code (no rewrites)
- All API contracts (no changes)
- Database schema (identical)
- Frontend code (untouched)
- Development workflow (Git-based)

---

### Migration Strategy

```
┌─────────────────────────────────────────────────────┐
│ Windows Development Machine                         │
│                                                     │
│  ┌─────────────────┐         ┌─────────────────┐  │
│  │   VS Code       │         │   Frontend      │  │
│  │   Git           │         │   (Vite Dev)    │  │
│  │   MySQL Client  │         │   Port 5173     │  │
│  └─────────────────┘         └─────────────────┘  │
│           │                           │            │
│           │ Git Push/Pull             │ API Calls  │
│           ▼                           ▼            │
└───────────┼───────────────────────────┼────────────┘
            │                           │
            │                           │
┌───────────▼───────────────────────────▼────────────┐
│ Linux VM (Ubuntu 22.04 / AWS / Azure)              │
│                                                     │
│  ┌─────────────────┐    ┌─────────────────┐       │
│  │   Git Clone     │    │   Flask API     │       │
│  │   Backend Code  │    │   Port 5000     │       │
│  └─────────────────┘    └─────────────────┘       │
│                                                     │
│  ┌─────────────────┐    ┌─────────────────┐       │
│  │   Celery +      │    │   MySQL 8.0     │       │
│  │   Ansible       │    │   Port 3306     │       │
│  └─────────────────┘    └─────────────────┘       │
│                                                     │
│  ┌─────────────────┐                               │
│  │   Redis         │                               │
│  │   Port 6379     │                               │
│  └─────────────────┘                               │
└─────────────────────────────────────────────────────┘
```

**Key Insight:** You develop on Windows, commit to Git, and execute on Linux. No code changes required.

---

## 📋 Pre-Migration Checklist

Before starting, ensure you have:

- [ ] Linux VM provisioned (Ubuntu 22.04 LTS recommended)
- [ ] SSH access to Linux VM (`ssh user@vm-ip`)
- [ ] Git repository with your code committed
- [ ] MySQL root password (if using existing DB)
- [ ] Database backup (safety first)
- [ ] Firewall rules allowing ports 5000, 6379, 3306
- [ ] Minimum 2 CPU cores, 4GB RAM on VM

---

## 🚀 Step 1: Provision Linux VM

### Option A: AWS EC2

```bash
# Instance Type: t3.medium (2 vCPU, 4GB RAM)
# OS: Ubuntu Server 22.04 LTS
# Storage: 30GB SSD
# Security Group: Allow SSH (22), HTTP (80), Custom TCP (5000, 6379, 3306)
```

### Option B: Azure VM

```bash
# Size: Standard_B2s (2 vCPU, 4GB RAM)
# Image: Ubuntu Server 22.04 LTS
# Storage: 30GB Premium SSD
# Network Security Group: Allow ports 22, 80, 5000, 6379, 3306
```

### Option C: Local VM (VirtualBox/Hyper-V)

```powershell
# Download Ubuntu 22.04 LTS ISO
# Create VM: 2 CPU, 4GB RAM, 30GB disk
# Network: Bridged Adapter (for direct IP access)
```

### Verify SSH Access

From Windows PowerShell:

```powershell
ssh ubuntu@<VM-IP>
# Replace <VM-IP> with your actual VM IP address
```

**Expected:** You should successfully connect to the Linux VM.

---

## 🔧 Step 2: Initial System Setup

### Connect to Linux VM

```bash
ssh ubuntu@<VM-IP>
```

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Install Essential Tools

```bash
sudo apt install -y \
    build-essential \
    git \
    curl \
    wget \
    vim \
    htop \
    net-tools \
    software-properties-common
```

### Install Python 3.10+

```bash
sudo apt install -y python3.10 python3.10-venv python3-pip
python3 --version
# Expected: Python 3.10.x or higher
```

### Install MySQL 8.0

```bash
sudo apt install -y mysql-server mysql-client
sudo systemctl start mysql
sudo systemctl enable mysql
sudo systemctl status mysql
# Expected: active (running)
```

### Secure MySQL Installation

```bash
sudo mysql_secure_installation
# Follow prompts:
# - Set root password (use strong password)
# - Remove anonymous users: Yes
# - Disallow root login remotely: No (we need it for migration)
# - Remove test database: Yes
# - Reload privilege tables: Yes
```

### Install Redis

```bash
sudo apt install -y redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
sudo systemctl status redis-server
# Expected: active (running)

redis-cli ping
# Expected: PONG
```

### Install Ansible (System-Level)

```bash
sudo apt install -y ansible
ansible --version
# Expected: ansible [core 2.x.x]
```

---

## 📦 Step 3: Transfer Code to Linux VM

### Option A: Using Git (Recommended)

**On Linux VM:**

```bash
cd ~
git clone <your-repo-url> InfraAnsible
cd InfraAnsible
git status
# Verify all files are present
```

**If using private repository:**

```bash
# Generate SSH key on VM
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
# Copy public key and add to GitHub/GitLab/Bitbucket SSH keys
```

### Option B: Using SCP (If No Git)

**On Windows PowerShell:**

```powershell
# Transfer entire project directory
scp -r C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible ubuntu@<VM-IP>:~/
```

**Verify on Linux VM:**

```bash
cd ~/InfraAnsible
ls -la
# Expected: backend/, frontend/, PROJECT_SETUP.md, etc.
```

### Verify Folder Structure

```bash
tree -L 2 ~/InfraAnsible
# Expected output:
# InfraAnsible/
# ├── backend/
# │   ├── app/
# │   ├── requirements.txt
# │   ├── run.py
# │   └── schema.sql
# ├── frontend/
# │   ├── src/
# │   ├── package.json
# │   └── vite.config.ts
# └── PROJECT_SETUP.md
```

---

## 🗄️ Step 4: Database Migration

### Decision Point: Keep Existing DB or Migrate?

**Option A: Use Existing Windows MySQL DB (Remote Access)**

**Pros:**
- No data migration needed
- Immediate continuity
- Easy rollback

**Cons:**
- Network latency
- Security concerns (remote DB access)
- Not production-like

**Option B: Migrate DB to Linux VM (Recommended)**

**Pros:**
- Production parity
- Better performance (local DB)
- No network dependency
- Proper security

**Cons:**
- Requires one-time migration
- Slight downtime during migration

---

### Option A: Remote DB Access (Quick Start)

**On Windows MySQL:**

```powershell
mysql -u root -p
```

```sql
-- Allow remote access for infra_user
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'%' IDENTIFIED BY 'infra_pass123';
FLUSH PRIVILEGES;
EXIT;
```

**Configure MySQL to listen on all interfaces:**

Edit `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini`:

```ini
[mysqld]
bind-address = 0.0.0.0
```

Restart MySQL service (Administrator PowerShell):

```powershell
Restart-Service MySQL80
```

**Allow MySQL through Windows Firewall:**

```powershell
New-NetFirewallRule -DisplayName "MySQL" -Direction Inbound -Protocol TCP -LocalPort 3306 -Action Allow
```

**Test from Linux VM:**

```bash
mysql -h <WINDOWS-IP> -u infra_user -pinfra_pass123 infra_automation -e "SHOW TABLES;"
# Expected: List of 7 tables
```

**Update Linux backend/.env:**

```bash
cd ~/InfraAnsible/backend
nano .env
# Change DATABASE_URL to:
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@<WINDOWS-IP>/infra_automation
```

---

### Option B: Migrate DB to Linux VM (Production-Ready)

**Step 1: Backup Windows MySQL Database**

On Windows PowerShell:

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\backend
mysqldump -u infra_user -pinfra_pass123 infra_automation > infra_automation_backup.sql

# Verify backup file
ls infra_automation_backup.sql
# Should show file with size > 0
```

**Step 2: Transfer Backup to Linux VM**

```powershell
scp infra_automation_backup.sql ubuntu@<VM-IP>:~/InfraAnsible/backend/
```

**Step 3: Create Database on Linux VM**

```bash
sudo mysql
```

```sql
-- Create database with proper character set
CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user
CREATE USER 'infra_user'@'localhost' IDENTIFIED BY 'infra_pass123';

-- Grant all privileges
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Verify
SELECT User, Host FROM mysql.user WHERE User = 'infra_user';
SHOW DATABASES LIKE 'infra_automation';

EXIT;
```

**Step 4: Import Backup**

```bash
cd ~/InfraAnsible/backend
mysql -u infra_user -pinfra_pass123 infra_automation < infra_automation_backup.sql
```

**Step 5: Verify Tables**

```bash
mysql -u infra_user -pinfra_pass123 infra_automation -e "SHOW TABLES;"
# Expected: 7 tables (audit_logs, job_logs, jobs, playbooks, servers, tickets, users)
```

**Step 6: Verify Admin User**

```bash
mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT id, username, email, role FROM users;"
# Expected: admin user with id=1
```

**Step 7: Update Linux backend/.env**

```bash
cd ~/InfraAnsible/backend
nano .env
# Ensure DATABASE_URL points to localhost:
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation
```

---

## 🐍 Step 5: Backend Setup on Linux VM

### Navigate to Backend Directory

```bash
cd ~/InfraAnsible/backend
```

### Create Python Virtual Environment

```bash
python3 -m venv venv
```

### Activate Virtual Environment

```bash
source venv/bin/activate
# Prompt should show (venv)
```

### Upgrade pip

```bash
pip install --upgrade pip
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

**Expected:** All packages install successfully, including:
- ansible-runner (this will work on Linux!)
- flask
- celery
- sqlalchemy
- pymysql
- etc.

### Verify Ansible Runner Import

```bash
python -c "import ansible_runner; print('✅ ansible_runner imported successfully')"
# Expected: ✅ ansible_runner imported successfully
```

**This confirms the fcntl issue is resolved!**

### Create .env File

```bash
cd ~/InfraAnsible/backend
nano .env
```

Paste the following (adjust if using remote DB):

```env
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production

# Database (localhost if migrated, Windows IP if remote)
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation

# Redis
REDIS_URL=redis://localhost:6379/0

# Celery
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# Playbooks
PLAYBOOKS_DIR=./playbooks

# Security
BCRYPT_LOG_ROUNDS=12
```

Save and exit (Ctrl+X, Y, Enter).

### Create Playbooks Directory

```bash
mkdir -p ~/InfraAnsible/backend/playbooks
```

### Test Flask Application

```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
python run.py
```

**Expected output:**

```
 * Serving Flask app 'run.py'
 * Debug mode: on
WARNING: This is a development server. Do not use it in a production deployment.
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
```

**✅ Critical Check:** No `ModuleNotFoundError: fcntl` error!

### Test API from Another Terminal

Open new terminal on Linux VM:

```bash
curl http://localhost:5000/api/health
# Expected: {"status":"healthy",...}
```

**Stop Flask** (Ctrl+C) before proceeding.

---

## 🔄 Step 6: Celery & Redis Setup

### Verify Redis is Running

```bash
redis-cli ping
# Expected: PONG
```

### Start Celery Worker

Open new terminal on Linux VM:

```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
celery -A app.celery worker --loglevel=info
```

**Expected output:**

```
 -------------- celery@hostname v5.3.4 (emerald-rush)
--- ***** ----- 
-- ******* ---- Linux-5.15.0-1234-aws 2025-12-30 10:00:00
- *** --- * --- 
- ** ---------- [config]
- ** ---------- .> app:         app:0x...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     redis://localhost:6379/1
- *** --- * --- .> concurrency: 2 (prefork)
-- ******* ---- .> task events: OFF
--- ***** ----- 
 -------------- [queues]
                .> celery           exchange=celery(direct) key=celery

[tasks]
  . app.tasks.cleanup_old_logs
  . app.tasks.execute_playbook
  . app.tasks.generate_reports
  . app.tasks.health_check_servers

[2025-12-30 10:00:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
[2025-12-30 10:00:00,001: INFO/MainProcess] mingle: searching for neighbors
[2025-12-30 10:00:01,010: INFO/MainProcess] mingle: all alone
[2025-12-30 10:00:01,020: INFO/MainProcess] celery@hostname ready.
```

**Notice:** No `--pool=solo` needed on Linux! The default `prefork` pool works perfectly.

**✅ Critical Check:** Celery starts without errors and lists all tasks.

---

## ⚛️ Step 7: Frontend Integration (No Code Changes)

Your frontend can continue running on Windows and connect to the Linux VM backend.

### Update Frontend Environment Variable

**On Windows, in frontend/.env:**

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\frontend
notepad .env
```

Update to point to Linux VM:

```env
VITE_API_URL=http://<VM-IP>:5000/api
```

Replace `<VM-IP>` with your Linux VM's IP address.

### Allow External Connections on Linux VM

**Update Flask to listen on all interfaces:**

Edit `backend/run.py`:

```bash
cd ~/InfraAnsible/backend
nano run.py
```

Change:

```python
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

Save and exit.

### Configure Firewall on Linux VM

```bash
sudo ufw allow 5000/tcp
sudo ufw reload
```

### Start Services on Linux VM

**Terminal 1 (Flask):**

```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
python run.py
```

**Terminal 2 (Celery):**

```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
celery -A app.celery worker --loglevel=info
```

### Start Frontend on Windows

**On Windows PowerShell:**

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\frontend
npm run dev
```

**Expected:** Frontend runs on http://localhost:5173

### Test Cross-Machine Communication

1. Open browser on Windows: http://localhost:5173
2. Login with admin/admin123
3. Check browser console (F12) for API calls
4. Verify API calls go to http://<VM-IP>:5000/api

**✅ Success:** Frontend on Windows talks to Backend on Linux seamlessly!

---

## ✅ Step 8: Verification Checklist

### 1. Database Connectivity

```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
python -c "from app import create_app, db; app = create_app(); app.app_context().push(); print('✅ Database connected'); print('Tables:', db.engine.table_names())"
```

**Expected:** ✅ Database connected, list of 7 tables.

### 2. API Health Check

```bash
curl http://localhost:5000/api/health
```

**Expected:** `{"status":"healthy",...}`

### 3. Admin Login

From Windows browser:
1. Navigate to http://localhost:5173
2. Login with admin/admin123
3. Dashboard should load

**Expected:** ✅ Login successful, dashboard displays.

### 4. Server CRUD Operations

From frontend:
1. Navigate to Servers page
2. Create a test server
3. Edit server
4. Delete server

**Expected:** ✅ All operations complete successfully.

### 5. Playbook Upload

From frontend:
1. Navigate to Playbooks page
2. Upload a test playbook (create `ping.yml` from documentation)
3. Verify playbook appears in list

**Expected:** ✅ Playbook uploaded and stored in `backend/playbooks/`.

### 6. Ansible Job Execution (Critical Test)

From frontend:
1. Navigate to Playbooks page
2. Find uploaded playbook
3. Click "Run" and select a server
4. Click "Execute"

**Watch Celery terminal on Linux VM:**

**Expected output:**

```
[2025-12-30 10:05:00,000: INFO/MainProcess] Task app.tasks.execute_playbook[abc-123] received
[2025-12-30 10:05:01,000: INFO/ForkPoolWorker-1] Ansible runner starting...
[2025-12-30 10:05:02,000: INFO/ForkPoolWorker-1] PLAY [Ping Test] ***************
[2025-12-30 10:05:03,000: INFO/ForkPoolWorker-1] TASK [Ping the server] *********
[2025-12-30 10:05:04,000: INFO/ForkPoolWorker-1] ok: [server-ip]
[2025-12-30 10:05:05,000: INFO/ForkPoolWorker-1] PLAY RECAP *********************
[2025-12-30 10:05:06,000: INFO/ForkPoolWorker-1] Task app.tasks.execute_playbook[abc-123] succeeded
```

**✅ Critical Success:** Ansible job executes without fcntl errors!

### 7. Log Streaming

From frontend job details page:

**Expected:** Logs stream in real-time as Ansible runs.

### 8. Cross-Machine API Calls

From Windows PowerShell:

```powershell
curl http://<VM-IP>:5000/api/health
```

**Expected:** `{"status":"healthy",...}`

---

## 🔄 Step 9: Production Deployment (Using Supervisor)

### Install Supervisor

```bash
sudo apt install -y supervisor
```

### Create Flask Service

```bash
sudo nano /etc/supervisor/conf.d/infra-api.conf
```

Paste:

```ini
[program:infra-api]
command=/home/ubuntu/InfraAnsible/backend/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 run:app
directory=/home/ubuntu/InfraAnsible/backend
user=ubuntu
autostart=true
autorestart=true
stdout_logfile=/var/log/infra-automation/api.log
stderr_logfile=/var/log/infra-automation/api-error.log
environment=PATH="/home/ubuntu/InfraAnsible/backend/venv/bin"
```

### Create Celery Service

```bash
sudo nano /etc/supervisor/conf.d/infra-celery.conf
```

Paste:

```ini
[program:infra-celery]
command=/home/ubuntu/InfraAnsible/backend/venv/bin/celery -A app.celery worker --loglevel=info
directory=/home/ubuntu/InfraAnsible/backend
user=ubuntu
autostart=true
autorestart=true
stdout_logfile=/var/log/infra-automation/celery.log
stderr_logfile=/var/log/infra-automation/celery-error.log
environment=PATH="/home/ubuntu/InfraAnsible/backend/venv/bin"
```

### Create Log Directory

```bash
sudo mkdir -p /var/log/infra-automation
sudo chown ubuntu:ubuntu /var/log/infra-automation
```

### Install Gunicorn

```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
pip install gunicorn
```

### Reload Supervisor

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

**Expected:**

```
infra-api                        RUNNING   pid 1234, uptime 0:00:05
infra-celery                     RUNNING   pid 1235, uptime 0:00:05
```

### Test Production API

```bash
curl http://localhost:5000/api/health
```

**Expected:** `{"status":"healthy",...}`

---

## 🛡️ Step 10: Rollback & Safety Plan

### Rollback to Windows (If Needed)

**On Windows frontend/.env:**

```env
VITE_API_URL=http://localhost:5000/api
```

**Start Windows backend and Celery** (following Windows setup in PROJECT_SETUP.md).

**Note:** Ansible jobs won't execute on Windows, but API/CRUD operations will work for development.

### Database Rollback

**If you migrated DB and want to go back:**

```bash
# On Linux VM
mysqldump -u infra_user -pinfra_pass123 infra_automation > rollback_backup.sql

# Transfer to Windows
scp rollback_backup.sql <windows-user>@<WINDOWS-IP>:C:/Users/nikhil.rokade_jadegl/Documents/
```

**On Windows:**

```powershell
mysql -u infra_user -pinfra_pass123 infra_automation < C:\Users\nikhil.rokade_jadegl\Documents\rollback_backup.sql
```

### Switch to Different Linux VM

**To migrate to another Linux VM later:**

1. Follow Steps 1-6 on new VM
2. Transfer DB backup from old VM to new VM
3. Import backup on new VM
4. Update frontend `.env` to point to new VM IP
5. No code changes needed

**This is the beauty of treating Linux VM as just an execution environment!**

---

## 🎯 Step 11: Development Workflow

### Daily Development Cycle

**On Windows (Development):**

1. Edit code in VS Code
2. Commit changes to Git
3. Push to repository

**On Linux VM (Execution):**

```bash
cd ~/InfraAnsible
git pull
cd backend
source venv/bin/activate
pip install -r requirements.txt  # Only if dependencies changed
sudo supervisorctl restart infra-api
sudo supervisorctl restart infra-celery
```

### Frontend Development

**Stays on Windows completely:**

```powershell
cd C:\Users\nikhil.rokade_jadegl\Documents\InfraAnsible\frontend
# Make changes
npm run dev
# Test against Linux VM backend
```

### Database Migrations (Alembic)

**Generate migration on Windows:**

```powershell
cd backend
.\InfraAuto\Scripts\Activate.ps1
flask db migrate -m "Add new column"
git add migrations/
git commit -m "Migration: Add new column"
git push
```

**Apply migration on Linux VM:**

```bash
cd ~/InfraAnsible
git pull
cd backend
source venv/bin/activate
flask db upgrade
sudo supervisorctl restart infra-api
```

---

## 📊 Migration Completion Checklist

- [ ] Linux VM provisioned and accessible via SSH
- [ ] System packages installed (Python, MySQL, Redis, Ansible)
- [ ] Code transferred to Linux VM (Git or SCP)
- [ ] Database migrated or configured for remote access
- [ ] Backend virtual environment created
- [ ] All Python dependencies installed (including ansible_runner)
- [ ] `.env` file created with correct configuration
- [ ] Flask starts without errors
- [ ] Celery worker starts without errors
- [ ] Frontend `.env` updated to point to Linux VM
- [ ] API health check passes
- [ ] Admin login works from frontend
- [ ] Server CRUD operations work
- [ ] Playbook upload works
- [ ] **Ansible jobs execute successfully (no fcntl errors)**
- [ ] Logs stream in real-time
- [ ] Supervisor configured for production
- [ ] Rollback plan documented and tested

---

## 🏆 Success Criteria

You have successfully migrated when:

✅ **Zero Code Changes:** Backend and frontend code remain identical  
✅ **Zero Schema Changes:** Database structure unchanged  
✅ **Zero API Changes:** All endpoints work identically  
✅ **Ansible Jobs Execute:** No more fcntl errors  
✅ **Cross-Machine Communication:** Windows frontend talks to Linux backend  
✅ **Production Ready:** Services managed by Supervisor  
✅ **Rollback Available:** Can revert to Windows if needed  
✅ **Development Unblocked:** Git-based workflow continues  

---

## 🚨 Common Migration Issues

### Issue: Cannot SSH to Linux VM

**Fix:**

```bash
# On Linux VM (if you have console access)
sudo ufw allow 22/tcp
sudo ufw reload
sudo systemctl restart sshd
```

### Issue: MySQL Connection Refused from Windows

**Fix:**

```bash
# On Linux VM
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
# Change bind-address to 0.0.0.0
sudo systemctl restart mysql
sudo ufw allow 3306/tcp
```

### Issue: CORS Errors in Browser Console

**Fix:**

```bash
# On Linux VM
cd ~/InfraAnsible/backend
nano .env
# Add:
CORS_ORIGINS=http://<WINDOWS-IP>:5173
# Restart Flask
sudo supervisorctl restart infra-api
```

### Issue: Frontend Can't Reach Backend API

**Fix:**

```bash
# On Linux VM
sudo ufw status
sudo ufw allow 5000/tcp
sudo ufw reload

# Test from Windows
curl http://<VM-IP>:5000/api/health
```

### Issue: Ansible Playbooks Fail to Find Hosts

**Fix:**

Ensure your playbooks have proper inventory configuration or use dynamic inventory from your database.

---

## 📞 Migration Support

If you encounter issues during migration:

1. **Check logs:** `sudo tail -f /var/log/infra-automation/*.log`
2. **Verify services:** `sudo supervisorctl status`
3. **Test connectivity:** `ping`, `curl`, `telnet`
4. **Check firewall:** `sudo ufw status verbose`
5. **Review .env:** Ensure all values are correct for Linux environment

---

**Migration Guide Version:** 1.0.0  
**Last Updated:** December 30, 2025  
**Compatibility:** Ubuntu 22.04 LTS, Python 3.10+, MySQL 8.0+

---

**🎉 Your Infrastructure Automation Platform is now Linux-ready! Ansible will work flawlessly! 🚀**

---

**Last Updated:** December 30, 2025  
**Version:** 1.0.0  
**Author:** Infrastructure Team

---

**🎉 You're ready to start automating infrastructure! Happy automating! 🚀**
