# Infrastructure Automation Platform - Complete Setup & Startup Guide
## From Fresh Machine to Running Application

**This guide will take you from a fresh Linux machine to a fully running application.**

---

## 📋 TABLE OF CONTENTS

1. **[ARCHITECTURE OVERVIEW](#architecture-overview)** - System components and how they connect
2. **[PART 0: FRESH MACHINE SETUP](#part-0-fresh-machine-setup-start-here-if-new-machine)** - Install all required software
   - System Dependencies
   - MySQL/MariaDB Installation
   - Redis Installation
   - Node.js Installation
   - Ansible Installation
   - Clone Project
   - Python Virtual Environment
   - Firewall Configuration
3. **[PART 1: DATABASE & PROJECT CONFIGURATION](#part-1-database--project-configuration-one-time-setup)** - One-time setup
   - Database Setup
   - Backend Configuration (.env file)
   - Frontend Configuration (.env file)
4. **[PART 2: START SERVICES](#part-2-start-services-on-linux-vm)** - Start Backend & Celery
5. **[PART 3: START FRONTEND](#part-3-start-frontend-on-linux-vm)** - Start Frontend Dev Server
6. **[PART 4: VERIFICATION & TESTING](#part-4-verification--testing)** - Verify everything works
7. **[PART 5: TROUBLESHOOTING](#part-5-troubleshooting)** - Common issues and solutions
8. **[PART 6: SHUTDOWN PROCEDURE](#part-6-shutdown-procedure)** - Properly stop all services
9. **[PART 7: USING TMUX](#part-7-using-tmux-for-persistent-sessions-recommended)** - Manage services efficiently
10. **[PRODUCTION DEPLOYMENT](#production-deployment-notes)** - Production considerations
11. **[QUICK START SUMMARY](#quick-start-summary---for-experienced-users)** - Fast reference for experienced users
12. **[COMPLETE SUMMARY](#complete-summary)** - All key information in one place

---

## ✅ BEFORE YOU BEGIN - CHECKLIST

Make sure you have:
- [ ] A Linux machine (Rocky Linux, RHEL, CentOS, or Ubuntu) with **sudo privileges**
- [ ] Minimum **4GB RAM** (8GB recommended)
- [ ] Minimum **20GB free disk space**
- [ ] **Network access** from the machine (for downloading packages)
- [ ] **IP address** of your Linux machine (e.g., 192.168.10.200)
- [ ] Basic knowledge of **Linux terminal commands**
- [ ] Access to the **project source code** (Git repository or zip file)

**Time Estimate:**
- Fresh machine software installation: **30-45 minutes**
- Project configuration: **15-20 minutes**
- Daily startup (after initial setup): **2-3 minutes**

**What You'll Install:**
- Python 3.9+, Node.js 18+, MariaDB 10.3+, Redis 5.0+, Ansible 2.9+, Git, Development Tools

---

## ARCHITECTURE OVERVIEW

```
┌──────────────────────────────────────────────────────────────────┐
│                     LINUX VM (192.168.10.200)                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   MySQL/     │  │    Redis     │  │    Flask     │          │
│  │  MariaDB     │  │   (Port      │  │   Backend    │          │
│  │  (Port 3306) │  │    6379)     │  │ (Port 5000)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                   │                 │                  │
│         └───────────────────┴─────────────────┘                  │
│                             │                                    │
│                    ┌────────┴────────┐                           │
│                    │  Celery Worker  │                           │
│                    │  (Async Tasks)  │                           │
│                    └─────────────────┘                           │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              React Frontend (Vite)                     │    │
│  │            http://192.168.10.200:5173                  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
                             ▲
                             │ Browser Access
                             │ http://192.168.10.200:5173
                             │
                    ┌────────┴────────┐
                    │  Windows PC     │
                    │  (Browser)      │
                    └─────────────────┘
```

## STARTUP ORDER (CRITICAL!)

```
1. Database (MySQL/MariaDB)  →  Must be running first
2. Redis                     →  Required for Celery
3. Flask Backend            →  Depends on Database + Redis
4. Celery Worker            →  Depends on Backend + Redis
5. Frontend (Vite)          →  Serves frontend on Linux VM
```

**All services run on Linux VM (192.168.10.200)**
**Access via browser:** http://192.168.10.200:5173

---

# ═══════════════════════════════════════════════════════════════
# PART 0: FRESH MACHINE SETUP (START HERE IF NEW MACHINE)
# ═══════════════════════════════════════════════════════════════

## System Requirements

- **Operating System:** Linux (Rocky Linux 8/9, RHEL 8/9, CentOS 8/9, Ubuntu 20.04+, or similar)
- **RAM:** Minimum 4GB (8GB recommended)
- **Disk Space:** Minimum 20GB free space
- **Network:** Static IP or DHCP reservation (e.g., 192.168.10.200)
- **User:** Non-root user with sudo privileges

---

## A. INSTALL SYSTEM DEPENDENCIES

### 1. Update System Packages

```bash
# For Rocky Linux / RHEL / CentOS
sudo dnf update -y

# For Ubuntu / Debian
# sudo apt update && sudo apt upgrade -y
```

### 2. Install Essential Development Tools

```bash
# For Rocky Linux / RHEL / CentOS
sudo dnf groupinstall "Development Tools" -y
sudo dnf install -y git wget curl vim

# For Ubuntu / Debian
# sudo apt install -y build-essential git wget curl vim
```

### 3. Install Python 3.9+ (if not already installed)

```bash
# Check current Python version
python3 --version

# For Rocky Linux / RHEL / CentOS (if Python needs update)
sudo dnf install -y python3 python3-pip python3-devel python3-venv

# For Ubuntu / Debian
# sudo apt install -y python3 python3-pip python3-dev python3-venv

# Verify installation
python3 --version
pip3 --version
```

**Expected:** Python 3.9 or higher

---

## B. INSTALL AND CONFIGURE MYSQL/MARIADB

### 1. Install MariaDB Server

```bash
# For Rocky Linux / RHEL / CentOS
sudo dnf install -y mariadb-server mariadb

# For Ubuntu / Debian
# sudo apt install -y mariadb-server mariadb-client

# Start and enable MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Verify it's running
sudo systemctl status mariadb
```

**✅ Expected:** Active (running)

### 2. Secure MariaDB Installation

```bash
# Run security script
sudo mysql_secure_installation
```

**Follow the prompts:**
- Enter current password for root: `(press Enter for none)`
- Set root password? `Y`
- Enter new password: `(choose a secure password)`
- Remove anonymous users? `Y`
- Disallow root login remotely? `N` (if you want remote access)
- Remove test database? `Y`
- Reload privilege tables? `Y`

### 3. Configure MariaDB for Network Access (Optional)

```bash
# Edit MariaDB configuration
sudo vim /etc/my.cnf.d/mariadb-server.cnf
# OR for Ubuntu: sudo vim /etc/mysql/mariadb.conf.d/50-server.cnf

# Find the line with 'bind-address' and change to:
# bind-address = 0.0.0.0

# Save and restart MariaDB
sudo systemctl restart mariadb
```

### 4. Configure Firewall for MariaDB (Optional - for remote access)

```bash
# For firewalld (Rocky Linux / RHEL / CentOS)
sudo firewall-cmd --permanent --add-service=mysql
sudo firewall-cmd --reload

# For UFW (Ubuntu)
# sudo ufw allow 3306/tcp
```

---

## C. INSTALL AND CONFIGURE REDIS

### 1. Install Redis Server

```bash
# For Rocky Linux / RHEL / CentOS
sudo dnf install -y redis

# For Ubuntu / Debian
# sudo apt install -y redis-server

# Start and enable Redis
sudo systemctl start redis
sudo systemctl enable redis

# Verify it's running
sudo systemctl status redis
```

**✅ Expected:** Active (running)

### 2. Test Redis Connection

```bash
# Test Redis
redis-cli ping
```

**✅ Expected Output:** `PONG`

---

## D. INSTALL NODE.JS AND NPM

### 1. Install Node.js (v18 or higher)

```bash
# For Rocky Linux / RHEL / CentOS - Install Node.js 18.x
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# For Ubuntu / Debian
# curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
# sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

**Expected:** Node v18.x or higher, npm 9.x or higher

---

## E. INSTALL ANSIBLE

### 1. Install Ansible

```bash
# For Rocky Linux / RHEL / CentOS
sudo dnf install -y ansible

# For Ubuntu / Debian
# sudo apt install -y ansible

# Verify installation
ansible --version
```

**Expected:** Ansible 2.9 or higher

---

## F. CLONE THE PROJECT

### 1. Navigate to Home Directory and Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository (replace with your actual repo URL)
git clone https://github.com/yourusername/InfraAnsible.git

# OR if you have the project as a zip file:
# unzip InfraAnsible.zip

# Navigate into project directory
cd InfraAnsible

# Verify project structure
ls -la
```

**✅ Expected:** You should see `backend/`, `frontend/`, and `Documentation/` directories

---

## G. SETUP PYTHON VIRTUAL ENVIRONMENT

### 1. Create Virtual Environment for Backend

```bash
# Navigate to backend directory
cd ~/InfraAnsible/backend

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install Python dependencies
pip install -r requirements.txt
```

**This may take 5-10 minutes depending on your internet connection.**

### 2. Verify Python Packages

```bash
# List installed packages
pip list | grep -E "Flask|celery|redis|ansible|SQLAlchemy|PyMySQL"
```

**✅ Expected:** All packages should be listed

---

## H. CONFIGURE FIREWALL FOR APPLICATION PORTS

### 1. Open Required Ports

```bash
# For firewalld (Rocky Linux / RHEL / CentOS)
sudo firewall-cmd --permanent --add-port=5000/tcp   # Flask Backend
sudo firewall-cmd --permanent --add-port=5173/tcp   # Vite Frontend
sudo firewall-cmd --permanent --add-port=6379/tcp   # Redis (if remote access needed)
sudo firewall-cmd --reload

# Verify ports are open
sudo firewall-cmd --list-ports

# For UFW (Ubuntu)
# sudo ufw allow 5000/tcp
# sudo ufw allow 5173/tcp
# sudo ufw allow 6379/tcp
```

---

## I. CONFIGURE SELINUX (Rocky Linux / RHEL / CentOS Only)

### 1. Set SELinux to Permissive (or configure policies)

```bash
# Check SELinux status
getenforce

# Temporarily set to permissive (for testing)
sudo setenforce 0

# OR permanently disable (for development only)
# sudo vim /etc/selinux/config
# Change SELINUX=enforcing to SELINUX=permissive
# Requires reboot: sudo reboot
```

**⚠️ Note:** For production, configure proper SELinux policies instead of disabling.

---

# ═══════════════════════════════════════════════════════════════
# PART 1: DATABASE & PROJECT CONFIGURATION (ONE-TIME SETUP)
# ═══════════════════════════════════════════════════════════════

## A. DATABASE SETUP

### 1. Verify MySQL/MariaDB is Running

```bash
# Check if MySQL/MariaDB is running
sudo systemctl status mariadb

# If not running, start it
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

### 2. Create Database and User

```bash
# Login as root
sudo mysql -u root -p

# In MySQL prompt, run:
CREATE DATABASE IF NOT EXISTS infra_automation
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'infra_user'@'localhost' IDENTIFIED BY 'infra_pass123';
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';

# Allow remote connection from Windows (optional but recommended)
CREATE USER IF NOT EXISTS 'infra_user'@'%' IDENTIFIED BY 'infra_pass123';
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'%';

FLUSH PRIVILEGES;
EXIT;
```

### 3. Import Schema

```bash
# Navigate to backend directory
cd ~/InfraAnsible/backend

# Import the schema
mysql -u infra_user -pinfra_pass123 infra_automation < schema.sql

# Verify tables were created
mysql -u infra_user -pinfra_pass123 -e "USE infra_automation; SHOW TABLES;"
```

### 4. Create Admin User

```bash
# Make sure you're in the backend directory
cd ~/InfraAnsible/backend

# Activate virtual environment
source venv/bin/activate

# Create admin user
flask create-admin

# You should see: "✅ Admin user 'admin' created successfully!"
```

**Expected Output:**
```
✅ Admin user 'admin' created successfully!
   Username: admin
   Password: admin123
   Role: admin
```

---

## B. BACKEND CONFIGURATION

### 1. Create .env file

```bash
cd ~/InfraAnsible/backend

# Create .env file
cat > .env << 'EOF'
# Flask Configuration
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production

# Database Configuration
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation

# Celery & Redis Configuration
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# CORS Configuration (Allow Windows frontend)
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# Logging
LOG_LEVEL=INFO
EOF

# Verify .env file was created
cat .env
```

### 2. Verify Python Dependencies

```bash
cd ~/InfraAnsible/backend
source venv/bin/activate

# Check if all packages are installed
pip list | grep -E "Flask|celery|redis|ansible|SQLAlchemy|PyMySQL"

# If any are missing, install
pip install -r requirements.txt
```

---

## C. FRONTEND CONFIGURATION

### 1. Create .env file

```bash
cd ~/InfraAnsible/frontend

# Create .env file
cat > .env << 'EOF'
# Demo Mode - Disabled for real backend connection
VITE_DEMO_MODE=false

# Backend API URL (localhost since frontend and backend are on same VM)
VITE_API_URL=http://localhost:5000/api
EOF

# Verify .env file was created
cat .env
```

### 2. Install Frontend Dependencies

```bash
cd ~/InfraAnsible/frontend

# Install Node.js dependencies (this may take a few minutes)
npm install

# Verify installation
npm list --depth=0
```

**✅ Expected:** List of installed packages without errors

### 3. Test Backend Connection (Make Sure Backend is Running First)

```bash
# Test if backend is accessible
curl http://localhost:5000/api/health

# Should return: {"status":"healthy"}
```

**⚠️ Note:** Backend must be running for this test to work. If not running yet, skip this test and come back to it later.

---

# ═══════════════════════════════════════════════════════════════
# PART 2: START SERVICES ON LINUX VM
# ═══════════════════════════════════════════════════════════════

## Quick Reference - Starting Services

**You'll need 3 terminal windows/tabs (or use tmux - see section at bottom):**
- Terminal 1: Flask Backend
- Terminal 2: Celery Worker
- Terminal 3: Frontend Dev Server

---

## Step 1: Verify Prerequisites are Running

```bash
# Check Database
sudo systemctl status mariadb

# Check Redis
sudo systemctl status redis
redis-cli ping

# If Redis is not running:
sudo systemctl start redis
sudo systemctl enable redis
```

**✅ Expected:**
- MariaDB: Active (running)
- Redis: Active (running)
- `redis-cli ping` returns: PONG

---

## Step 2: Start Flask Backend (Terminal 1)

```bash
# Navigate to backend directory
cd ~/InfraAnsible/backend

# Activate virtual environment
source venv/bin/activate

# Verify .env file exists
cat .env | grep DATABASE_URL

# Start Flask development server
python run.py
```

**✅ Expected Output:**
```
 * Serving Flask app 'app'
 * Debug mode: on
WARNING: This is a development server. Do not use it in a production deployment.
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
 * Running on http://192.168.10.200:5000
Press CTRL+C to quit
```

**⚠️ KEEP THIS TERMINAL OPEN! Do not close it.**

**❌ If Backend fails to start:**
```bash
# Common issues:

# 1. Port 5000 already in use
sudo lsof -i :5000
# Kill the process: sudo kill -9 <PID>

# 2. Database connection error
mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT 1;"

# 3. Missing .env file
ls -la .env
cat .env

# 4. Python dependencies missing
pip install -r requirements.txt
```

---

## Step 3: Start Celery Worker (Terminal 2)

**Open a NEW terminal window/tab (or SSH session):**

```bash
# New terminal window/tab
cd ~/InfraAnsible/backend

# Activate virtual environment
source venv/bin/activate

# Start Celery worker
celery -A celery_worker worker --loglevel=info
```

**✅ Expected Output:**
```
-------------- celery@<hostname> v5.3.4 (emerald-rush)
--- ***** ----- 
-- ******* ---- Linux-5.x.x-x86_64-with-glibc2.xx
- *** --- * --- 
- ** ---------- [config]
- ** ---------- .> app:         app:0x...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     redis://localhost:6379/0
- *** --- * --- .> concurrency: 4 (prefork)
-- ******* ---- .> task events: OFF
--- ***** ----- 
-------------- [queues]
                .> celery           exchange=celery(direct) key=celery

[tasks]
  . app.tasks.execute_playbook

[2026-01-09 12:00:00,000: INFO/MainProcess] Connected to redis://localhost:6379/0
[2026-01-09 12:00:00,000: INFO/MainProcess] mingle: searching for neighbors
[2026-01-09 12:00:00,000: INFO/MainProcess] mingle: all alone
[2026-01-09 12:00:00,000: INFO/MainProcess] celery@<hostname> ready.
```

**⚠️ KEEP THIS TERMINAL OPEN! Do not close it.**

**❌ If Celery fails:**
```bash
# 1. Redis connection error
redis-cli ping

# 2. Check if Redis is accessible
redis-cli -h localhost -p 6379 ping

# 3. Verify Celery configuration
cd ~/InfraAnsible/backend
source venv/bin/activate
python -c "from celery_worker import celery; print(celery.conf.broker_url)"
```

---

## Step 4: Verify Backend is Accessible

**Test the backend is responding:**

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Should return: {"status":"healthy"}
```

**From Windows PC (if accessing remotely):**

```powershell
# Test from Windows
Invoke-RestMethod -Uri "http://192.168.10.200:5000/api/health"

# Should return: status: healthy
```

---

# ═══════════════════════════════════════════════════════════════
# PART 3: START FRONTEND ON LINUX VM
# ═══════════════════════════════════════════════════════════════

## Step 5: Start Frontend Dev Server (Terminal 3)

**Open a NEW terminal window/tab:**
```

## Step 5: Start Frontend Dev Server (Terminal 3)

**Open a NEW terminal window/tab:**

```bash
# Navigate to frontend directory
cd ~/InfraAnsible/frontend
```

---

## Step 6: Verify Frontend Configuration

```bash
# Check .env file
cat .env

# Should show:
# VITE_DEMO_MODE=false
# VITE_API_URL=http://localhost:5000/api
```

**Note:** Frontend and backend are on the same VM, so `localhost` is correct.

---

## Step 7: Start Vite Development Server

```bash
# Start Vite with --host flag to allow external connections
npm run dev -- --host
```

**✅ Expected Output:**
```
> infra-automation-frontend@1.0.0 dev
> vite --host

  VITE v5.4.21  ready in 1040 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.10.200:5173/
  ➜  press h + enter to show help
```

**⚠️ KEEP THIS TERMINAL OPEN! Do not close it.**

**💡 Note: If port 5173 is in use, Vite will automatically use 5174 or another port**

---

## Step 8: Access Application in Browser

**On Windows PC or any device on the network:**

1. **Open browser** (Chrome, Edge, Firefox)
2. **Navigate to:** `http://192.168.10.200:5173`
   - Replace `192.168.10.200` with your actual Linux VM IP
   - Or if accessing from the Linux VM itself: `http://localhost:5173`
3. **Login with default credentials:**
   - Username: `admin`
   - Password: `admin123`

**✅ Expected: You should see the Dashboard page**

**💡 If you cannot access:**
```bash
# On Linux VM, check firewall
sudo firewall-cmd --list-ports

# Add port 5173 if needed
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --reload
```

---

# ═══════════════════════════════════════════════════════════════
# PART 4: VERIFICATION & TESTING
# ═══════════════════════════════════════════════════════════════

## Complete System Health Check

### 1. Database Check (Linux VM)

```bash
mysql -u infra_user -pinfra_pass123 -e "
USE infra_automation;
SELECT 'Users:', COUNT(*) FROM users
UNION ALL
SELECT 'Servers:', COUNT(*) FROM servers
UNION ALL
SELECT 'Playbooks:', COUNT(*) FROM playbooks
UNION ALL
SELECT 'Jobs:', COUNT(*) FROM jobs;
"
```

### 2. Redis Check (Linux VM)

```bash
redis-cli ping
redis-cli info | grep uptime_in_seconds
```

### 3. Backend Check (Linux VM)

```bash
curl http://localhost:5000/api/health
```

**Expected:** `{"status":"healthy"}`

### 4. Celery Check (Linux VM)

Look at the Celery terminal - should show:
```
[INFO/MainProcess] celery@<hostname> ready.
```

No errors about Redis connection.

### 5. Frontend Check (Browser)

Open browser (http://192.168.10.200:5173) and check console (F12):
- ✅ No CORS errors
- ✅ No 404 errors for API calls
- ✅ No network errors
- ✅ Login works
- ✅ Dashboard loads with data

### 6. End-to-End Test

1. **Login** to the application
2. **Navigate to Servers page** - Should load server list
3. **Navigate to Playbooks page** - Should load playbooks
4. **Navigate to Jobs page** - Should load job history
5. **Try creating a new account:**
   - Click "Create an account" on login page
   - Fill in username, email, password
   - Click "Sign Up"
   - Should see success message

---

# ═══════════════════════════════════════════════════════════════
# PART 5: TROUBLESHOOTING
# ═══════════════════════════════════════════════════════════════

## Problem: "Cannot connect to server" on signup/login

**Cause:** Backend not running or connection issue

**Solution:**
```bash
# On Linux VM, check if backend is running
sudo lsof -i :5000

# Test backend connection
curl http://localhost:5000/api/health

# Check if ports are open in firewall
sudo firewall-cmd --list-ports
```

---

## Problem: "Database connection error" in backend

**Cause:** MySQL not running or wrong credentials

**Solution:**
```bash
# On Linux VM
sudo systemctl status mariadb
mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT 1;"

# Check .env file
cd ~/InfraAnsible/backend
cat .env | grep DATABASE_URL
```

---

## Problem: Celery shows Redis connection errors

**Cause:** Redis not running

**Solution:**
```bash
# On Linux VM
sudo systemctl status redis
redis-cli ping

# If not running
sudo systemctl start redis
```

---

## Problem: CORS errors in browser console

**Cause:** Backend CORS not configured for frontend URL

**Solution:**
```bash
# On Linux VM, check backend .env
cd ~/InfraAnsible/backend
cat .env | grep CORS_ORIGINS

# Should include: http://localhost:5173
# If not, add it:
echo "CORS_ORIGINS=http://localhost:5173,http://localhost:5174" >> .env

# Restart backend
```

---

## Problem: Port 5000 already in use on Linux

**Solution:**
```bash
# Find what's using port 5000
sudo lsof -i :5000

# Kill the process
sudo kill -9 <PID>

# Or use a different port
export FLASK_RUN_PORT=5001
python run.py
```

---

## Problem: Frontend shows blank page

**Cause:** Node modules not installed or build errors

**Solution:**
```bash
# On Linux VM
cd ~/InfraAnsible/frontend

# Reinstall dependencies
rm -rf node_modules
npm install

# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev -- --host
```

---

## Problem: Cannot access frontend from Windows browser

**Cause:** Firewall blocking port 5173 or Vite not exposing network

**Solution:**
```bash
# On Linux VM - Add firewall rule
sudo firewall-cmd --permanent --add-port=5173/tcp
sudo firewall-cmd --reload

# Make sure Vite is started with --host flag
cd ~/InfraAnsible/frontend
npm run dev -- --host

# Test from Linux VM
curl http://localhost:5173
```

---

## Problem: Python package installation fails

**Cause:** Missing system dependencies or pip issues

**Solution:**
```bash
# On Linux VM
cd ~/InfraAnsible/backend
source venv/bin/activate

# Upgrade pip and setuptools
pip install --upgrade pip setuptools wheel

# Reinstall requirements
pip install -r requirements.txt

# If specific package fails (e.g., mysqlclient or pymysql)
sudo dnf install -y python3-devel mysql-devel
# OR for Ubuntu: sudo apt install -y python3-dev libmysqlclient-dev

# Then retry
pip install -r requirements.txt
```

---

## Problem: npm install fails or takes too long

**Cause:** Network issues, npm cache, or permissions

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock
cd ~/InfraAnsible/frontend
rm -rf node_modules package-lock.json

# Reinstall with verbose logging
npm install --verbose

# If permission errors
sudo chown -R $USER:$USER ~/InfraAnsible/frontend
npm install
```

---

## Problem: "Command not found" errors

**Cause:** Commands not in PATH or software not installed

**Solution:**
```bash
# For Python/pip commands
which python3
which pip3

# If not found, reinstall Python
sudo dnf install -y python3 python3-pip

# For Node/npm commands
which node
which npm

# If not found, reinstall Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# For Redis
which redis-cli
sudo dnf install -y redis

# For MySQL
which mysql
sudo dnf install -y mariadb
```

---

## Problem: Service fails to start on boot

**Cause:** Service not enabled

**Solution:**
```bash
# Enable services to start on boot
sudo systemctl enable mariadb
sudo systemctl enable redis

# Verify they're enabled
sudo systemctl is-enabled mariadb
sudo systemctl is-enabled redis
```

---

# ═══════════════════════════════════════════════════════════════
# PART 6: SHUTDOWN PROCEDURE
# ═══════════════════════════════════════════════════════════════

## Normal Shutdown (End of Day)

### 1. Stop Frontend (Linux VM - Terminal 3)
```
Press Ctrl + C in Frontend terminal
```

### 2. Stop Celery Worker (Linux VM - Terminal 2)
```
Press Ctrl + C in Celery terminal
```

### 3. Stop Flask Backend (Linux VM - Terminal 1)
```
Press Ctrl + C in Flask terminal
```

### 4. Redis & Database
```bash
# Redis can stay running (recommended for faster restart)
# Database stays running (always-on service)

# If you want to stop them:
sudo systemctl stop redis     # Optional
sudo systemctl stop mariadb   # Not recommended
```

---

# ═══════════════════════════════════════════════════════════════
# QUICK REFERENCE
# ═══════════════════════════════════════════════════════════════

## Startup Order (Remember this!)

```
1. Database  ✅ (Always running)
2. Redis     ✅ sudo systemctl start redis
3. Backend   ✅ python run.py
4. Celery    ✅ celery -A celery_worker worker --loglevel=info
5. Frontend  ✅ npm run dev
```

## Key URLs

| Service  | URL (From Windows Browser)      | URL (From Linux VM) |
|----------|---------------------------------|---------------------|
| Frontend | http://192.168.10.200:5173      | http://localhost:5173 |
| Backend  | http://192.168.10.200:5000      | http://localhost:5000 |
| Health   | http://192.168.10.200:5000/api/health | http://localhost:5000/api/health |
| Database | mysql://192.168.10.200:3306     | mysql://localhost:3306 |
| Redis    | redis://192.168.10.200:6379     | redis://localhost:6379 |

## Default Credentials

| Service  | Username/User | Password        |
|----------|---------------|-----------------|
| Admin    | admin         | admin123        |
| Database | infra_user    | infra_pass123   |
| Database | root          | (set by admin)  |

## Common Commands Cheat Sheet

```bash
# Linux VM - Quick Start Backend
ssh NikhilRokade@192.168.10.200
redis-cli ping
cd ~/InfraAnsible/backend && source venv/bin/activate && python run.py

# Linux VM - Quick Start Frontend
ssh NikhilRokade@192.168.10.200
cd ~/InfraAnsible/frontend && npm run dev -- --host

# Database Quick Check
mysql -u infra_user -pinfra_pass123 infra_automation -e "SHOW TABLES;"

# View Backend Logs
cd ~/InfraAnsible/backend
tail -f app.log

# Test Backend API
curl http://localhost:5000/api/health

# Check Firewall Ports
sudo firewall-cmd --list-ports
```

---

# ═══════════════════════════════════════════════════════════════
# PART 7: USING TMUX FOR PERSISTENT SESSIONS (RECOMMENDED)
# ═══════════════════════════════════════════════════════════════

## Why Use Tmux?

Tmux allows you to:
- Keep all services running in one terminal session
- Disconnect from SSH without stopping services
- Easily switch between service views
- Resume exactly where you left off

## Install Tmux (if not installed)

```bash
# For Rocky Linux / RHEL / CentOS
sudo dnf install -y tmux

# For Ubuntu / Debian
# sudo apt install -y tmux

# Verify installation
tmux -V
```

---

## Initial Setup with Tmux

```bash
# Create new tmux session named 'infraapp'
tmux new -s infraapp

# Split into 3 panes
Ctrl+b then "   (split horizontally)
Ctrl+b then %   (split vertically for current pane)

# Navigate between panes
Ctrl+b then arrow keys
```

## Running Services in Tmux

**Pane 1: Flask Backend**
```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
python run.py
```

**Pane 2: Celery Worker**
```bash
cd ~/InfraAnsible/backend
source venv/bin/activate
celery -A celery_worker worker --loglevel=info
```

**Pane 3: Frontend**
```bash
cd ~/InfraAnsible/frontend
npm run dev -- --host
```

## Tmux Commands

```bash
# Detach from session (services keep running)
Ctrl+b then d

# List sessions
tmux ls

# Reattach to session
tmux attach -t infraapp

# Kill session (stops all services)
tmux kill-session -t infraapp
```

---

# ═══════════════════════════════════════════════════════════════
# PRODUCTION DEPLOYMENT NOTES
# ═══════════════════════════════════════════════════════════════

**⚠️ For production deployment, DO NOT use `python run.py`**

Use production-grade servers:

```bash
# Backend: Use Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 "app:create_app()"

# Celery: Use systemd service
sudo systemctl start celery-worker

# Frontend: Build and serve with Nginx
npm run build
# Copy dist/ folder to Nginx web root
```

Refer to production deployment documentation for details.

---

# ═══════════════════════════════════════════════════════════════
# QUICK START SUMMARY - FOR EXPERIENCED USERS
# ═══════════════════════════════════════════════════════════════

## One-Time Setup (Fresh Machine)

```bash
# 1. Install system packages
sudo dnf update -y
sudo dnf groupinstall "Development Tools" -y
sudo dnf install -y git wget curl vim python3 python3-pip python3-venv mariadb-server mariadb redis ansible

# 2. Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# 3. Start services
sudo systemctl start mariadb redis
sudo systemctl enable mariadb redis

# 4. Secure MariaDB
sudo mysql_secure_installation

# 5. Clone project
cd ~ && git clone <your-repo-url> InfraAnsible
cd InfraAnsible

# 6. Setup database
sudo mysql -u root -p
# CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# CREATE USER 'infra_user'@'localhost' IDENTIFIED BY 'infra_pass123';
# GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';
# FLUSH PRIVILEGES; EXIT;

mysql -u infra_user -pinfra_pass123 infra_automation < backend/schema.sql

# 7. Setup backend
cd ~/InfraAnsible/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file (see PART 1 for content)
vim .env

# Create admin user
flask create-admin

# 8. Setup frontend
cd ~/InfraAnsible/frontend
npm install

# Create .env file (see PART 1 for content)
vim .env

# 9. Configure firewall
sudo firewall-cmd --permanent --add-port={3306,5000,5173,6379}/tcp
sudo firewall-cmd --reload
```

---

## Daily Startup (After Machine Reboot)

```bash
# Terminal 1: Backend
cd ~/InfraAnsible/backend && source venv/bin/activate && python run.py

# Terminal 2: Celery
cd ~/InfraAnsible/backend && source venv/bin/activate && celery -A celery_worker worker --loglevel=info

# Terminal 3: Frontend
cd ~/InfraAnsible/frontend && npm run dev -- --host
```

**Then open browser:** http://192.168.10.200:5173 (or http://localhost:5173)

---

# ═══════════════════════════════════════════════════════════════
# COMPLETE SUMMARY
# ═══════════════════════════════════════════════════════════════

## What Runs Where

**Linux VM (192.168.10.200):**
- ✅ MySQL/MariaDB Database (Port 3306)
- ✅ Redis Server (Port 6379)
- ✅ Flask Backend API (Port 5000)
- ✅ Celery Worker (Background Tasks)
- ✅ React Frontend (Port 5173)

**Access Points:**
- **Local (on Linux VM):** http://localhost:5173
- **Remote (from Windows/other PC):** http://192.168.10.200:5173

---

## Software Requirements

| Software | Minimum Version | Installation Command (Rocky/RHEL) |
|----------|----------------|-----------------------------------|
| Python | 3.9+ | `sudo dnf install python3` |
| Node.js | 18.x+ | `curl -fsSL https://rpm.nodesource.com/setup_18.x \| sudo bash - && sudo dnf install nodejs` |
| MariaDB | 10.3+ | `sudo dnf install mariadb-server` |
| Redis | 5.0+ | `sudo dnf install redis` |
| Ansible | 2.9+ | `sudo dnf install ansible` |
| Git | 2.0+ | `sudo dnf install git` |

---

## Critical Configuration Files

**Backend (.env):**
```env
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
LOG_LEVEL=INFO
```

**Frontend (.env):**
```env
VITE_DEMO_MODE=false
VITE_API_URL=http://localhost:5000/api
```

---

## Service Startup Order (Critical!)

```
1. MariaDB  → sudo systemctl start mariadb
2. Redis    → sudo systemctl start redis  
3. Backend  → python run.py
4. Celery   → celery -A celery_worker worker --loglevel=info
5. Frontend → npm run dev -- --host
```

---

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Admin Login | admin | admin123 |
| Database | infra_user | infra_pass123 |
| Database Root | root | (set during mysql_secure_installation) |

---

## Important Ports

| Port | Service | Access |
|------|---------|--------|
| 3306 | MariaDB | Database connections |
| 5000 | Flask Backend | API endpoints |
| 5173 | Vite Frontend | Web application |
| 6379 | Redis | Task queue |

---

## Common Commands Reference

```bash
# Check service status
sudo systemctl status mariadb
sudo systemctl status redis

# Test connections
mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT 1;"
redis-cli ping
curl http://localhost:5000/api/health

# View logs
cd ~/InfraAnsible/backend && tail -f app.log

# Restart services
sudo systemctl restart mariadb
sudo systemctl restart redis

# Check firewall
sudo firewall-cmd --list-ports

# Activate Python venv
cd ~/InfraAnsible/backend && source venv/bin/activate
```

---

## Key Points to Remember

1. ✅ **Fresh Machine:** Follow PART 0 for complete software installation
2. ✅ **One-Time Setup:** Follow PART 1 for database and configuration
3. ✅ **Daily Use:** Follow PART 2 & 3 to start services
4. ✅ **All services run on Linux VM** - Browser connects remotely
5. ✅ **Use tmux** for managing multiple services easily
6. ✅ **Check firewall** if cannot access from remote machine
7. ✅ **Start services in order:** Database → Redis → Backend → Celery → Frontend
8. ✅ **Default admin:** username: `admin`, password: `admin123`

---

## Need Help?

1. **Check PART 5 (Troubleshooting)** for common issues
2. **Verify all services are running:** Database, Redis, Backend, Celery
3. **Check firewall ports:** 3306, 5000, 5173, 6379
4. **Review logs:** Backend logs in `backend/app.log`
5. **Test individual components:** Use curl/redis-cli/mysql commands

---

**✅ You're all set! Access the application at: http://192.168.10.200:5173**

---

# ═══════════════════════════════════════════════════════════════
# APPENDIX: GLOSSARY FOR NEW USERS
# ═══════════════════════════════════════════════════════════════

## Key Terms Explained

**MariaDB/MySQL:** Database software that stores all application data (users, servers, jobs, playbooks)

**Redis:** In-memory data store used as a message broker for background tasks

**Flask:** Python web framework that powers the backend API

**Celery:** Background task processor that runs Ansible playbooks asynchronously

**Vite:** Fast frontend development server and build tool for React

**React:** JavaScript library for building the user interface

**Ansible:** Automation tool that executes commands on remote servers

**Virtual Environment (venv):** Isolated Python environment to avoid package conflicts

**npm:** Node Package Manager for installing JavaScript dependencies

**Port:** Network endpoint where services listen (e.g., 5000 for Flask, 5173 for Vite)

**Firewall:** Security system that controls which ports are accessible

**tmux:** Terminal multiplexer for managing multiple terminal sessions

**API:** Application Programming Interface - how frontend communicates with backend

**CORS:** Cross-Origin Resource Sharing - security mechanism for web requests

---

## Common Commands Explained

```bash
# System commands
sudo systemctl start mariadb    # Start MariaDB database service
sudo systemctl enable redis      # Enable Redis to start on boot
sudo systemctl status mariadb    # Check if MariaDB is running

# Database commands
mysql -u infra_user -p          # Login to MySQL as infra_user
mysql -u root -p                # Login to MySQL as root user

# Python commands
python3 -m venv venv            # Create virtual environment
source venv/bin/activate        # Activate virtual environment
pip install -r requirements.txt # Install Python packages from file
deactivate                      # Exit virtual environment

# Node.js commands
npm install                     # Install Node.js packages
npm run dev                     # Start development server

# Flask commands
flask create-admin              # Create admin user (custom command)
python run.py                   # Start Flask application

# Celery commands
celery -A celery_worker worker  # Start Celery worker process

# Redis commands
redis-cli ping                  # Test Redis connection (returns PONG)

# Network testing
curl http://localhost:5000/api/health  # Test backend API
```

---

## File Structure Explained

```
InfraAnsible/
├── backend/                    # Python Flask backend
│   ├── app/                   # Application code
│   │   ├── api/              # API endpoints (routes)
│   │   ├── models.py         # Database models
│   │   ├── tasks.py          # Celery tasks
│   │   └── services/         # Business logic
│   ├── venv/                 # Python virtual environment
│   ├── run.py                # Flask application entry point
│   ├── celery_worker.py      # Celery worker entry point
│   ├── requirements.txt      # Python dependencies list
│   ├── schema.sql            # Database schema
│   ├── .env                  # Environment variables (YOU CREATE THIS)
│   └── app.log               # Application logs
│
├── frontend/                  # React frontend
│   ├── src/                  # Source code
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components
│   │   ├── api/             # API client code
│   │   └── store/           # State management
│   ├── node_modules/         # Node.js dependencies (auto-created)
│   ├── package.json          # Node.js dependencies list
│   ├── .env                  # Environment variables (YOU CREATE THIS)
│   └── vite.config.ts        # Vite configuration
│
└── Documentation/            # Project documentation
    └── Setup&Start.md       # This file!
```

---

## Understanding .env Files

**.env files contain configuration and secrets. Never commit them to Git!**

**backend/.env example:**
```env
DATABASE_URL=mysql+pymysql://user:password@localhost/database_name
SECRET_KEY=your-secret-key-here
CELERY_BROKER_URL=redis://localhost:6379/0
```

**frontend/.env example:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_DEMO_MODE=false
```

---

## What Happens When You Start Each Service?

1. **MariaDB (`sudo systemctl start mariadb`)**
   - Starts database server
   - Listens on port 3306
   - Stores persistent data

2. **Redis (`sudo systemctl start redis`)**
   - Starts Redis server
   - Listens on port 6379
   - Acts as message queue for Celery

3. **Flask Backend (`python run.py`)**
   - Starts web server
   - Listens on port 5000
   - Provides API endpoints for frontend
   - Connects to database

4. **Celery Worker (`celery -A celery_worker worker`)**
   - Starts background task processor
   - Connects to Redis
   - Executes Ansible playbooks asynchronously
   - Processes jobs from queue

5. **Frontend (`npm run dev`)**
   - Starts development server
   - Listens on port 5173
   - Serves React application
   - Makes API calls to backend

---

## Troubleshooting Philosophy

**When something doesn't work:**

1. **Check if services are running**
   ```bash
   sudo systemctl status mariadb
   sudo systemctl status redis
   # Check if Flask/Celery/Frontend terminals are still active
   ```

2. **Check logs**
   ```bash
   # MariaDB logs
   sudo journalctl -u mariadb -n 50
   
   # Redis logs
   sudo journalctl -u redis -n 50
   
   # Flask logs (in terminal or app.log)
   tail -f ~/InfraAnsible/backend/app.log
   ```

3. **Test connections individually**
   ```bash
   # Test database
   mysql -u infra_user -pinfra_pass123 -e "SELECT 1;"
   
   # Test Redis
   redis-cli ping
   
   # Test backend
   curl http://localhost:5000/api/health
   ```

4. **Check firewall (if accessing remotely)**
   ```bash
   sudo firewall-cmd --list-ports
   ```

5. **Verify configuration files**
   ```bash
   cat ~/InfraAnsible/backend/.env
   cat ~/InfraAnsible/frontend/.env
   ```

---

**🎉 Congratulations! You now have a complete guide to set up and run the Infrastructure Automation Platform from a fresh machine. Happy automating! 🚀**
