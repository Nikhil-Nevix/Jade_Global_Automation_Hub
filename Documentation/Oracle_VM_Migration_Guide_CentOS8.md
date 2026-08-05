# Oracle VM Migration Guide - CentOS 8

Document Date: 2026-05-18

## Purpose
Provide a formal, step-by-step procedure to migrate the Jade Global Automation Hub to an Oracle VM running CentOS 8 with identical specs: 2 vCPU, 8 GB RAM, 100 GB disk.

## Scope
This guide covers OS baseline, package installation, application deployment, data migration, service setup, and validation for a production deployment on a single VM. MySQL and Redis are installed on the same VM.

## Assumptions
- Source environment is the current VM hosting the application.
- Target environment is a new Oracle VM with CentOS 8 already installed.
- You have SSH access and sudo privileges on both VMs.
- No domain and TLS are required (IP-only access).

## Target VM Specifications
- vCPU: 2
- RAM: 8 GB
- Disk: 100 GB
- OS: CentOS 8

## Ports
Open these ports on the Oracle VM security list and firewall:
- 22/tcp for SSH
- 80/tcp for HTTP (production reverse proxy)
- 443/tcp if HTTPS is later enabled

## Phase 1 - Pre-migration Preparation
1. Confirm version control status of the project repository.
2. Record the current backend environment configuration from backend/.env.
3. Identify data locations:
   - MySQL database: infra_automation
   - Playbook files: backend/data/playbooks
   - Optional logs: /var/log (if used in your deployment)
4. Schedule a maintenance window to avoid in-flight job execution.

## Phase 2 - Source VM Backup
### 2.1 Database Dump (source VM)
```bash
mysqldump -u infra_user -p infra_automation > /tmp/infra_automation.sql
```

### 2.2 Playbooks and Uploads (source VM)
```bash
tar -czf /tmp/playbooks_data.tar.gz -C /path/to/repo/backend/data playbooks
```

### 2.3 Application Repository Snapshot (source VM)
If you have local changes not in Git, create a tarball:
```bash
tar -czf /tmp/infra_app_repo.tar.gz /path/to/repo
```

Copy the dump and tar files to the Oracle VM using scp or rsync.

## Phase 3 - Oracle VM Baseline Setup
### 3.1 System Update
```bash
sudo dnf -y update
sudo dnf -y install epel-release
```

### 3.2 Baseline Tools
```bash
sudo dnf -y install git curl wget unzip rsync gcc make openssl-devel bzip2-devel libffi-devel zlib-devel
```

### 3.3 Time Sync and Hostname
```bash
sudo timedatectl set-timezone UTC
sudo hostnamectl set-hostname automation-hub
```

### 3.4 Firewall
```bash
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

## Phase 4 - Install Runtime Dependencies
### 4.1 Python 3.10+
Attempt to install via dnf (recommended when available in your repo mirror):
```bash
sudo dnf -y install python3.10 python3.10-devel
```
If python3.10 is not available, use a managed repository approved by your organization or build from source in a controlled manner.

### 4.2 Node.js 18
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf -y install nodejs
```

### 4.3 MySQL 8
```bash
sudo dnf -y install https://dev.mysql.com/get/mysql80-community-release-el8-3.noarch.rpm
sudo dnf -y install mysql-community-server
sudo systemctl enable --now mysqld
```
Secure MySQL and set root password:
```bash
sudo mysql_secure_installation
```

### 4.4 Redis 6
```bash
sudo dnf -y install redis
sudo systemctl enable --now redis
```

### 4.5 Nginx
```bash
sudo dnf -y install nginx
sudo systemctl enable --now nginx
```

## Phase 5 - Application Deployment
### 5.1 Create Application User and Directories
```bash
sudo useradd -r -s /sbin/nologin jadeapp
sudo mkdir -p /opt/jade-automation
sudo chown jadeapp:jadeapp /opt/jade-automation
```

### 5.2 Obtain the Application
Option A - Git clone:
```bash
sudo -u jadeapp git clone https://github.com/Nikhil-Nevix/Jade_Global_Automation_Hub.git /opt/jade-automation
```

Option B - Extract a repository tarball (from source VM):
```bash
sudo -u jadeapp tar -xzf /tmp/infra_app_repo.tar.gz -C /opt
sudo mv /opt/path/to/repo /opt/jade-automation
sudo chown -R jadeapp:jadeapp /opt/jade-automation
```

### 5.3 Backend Virtual Environment and Dependencies
```bash
cd /opt/jade-automation/backend
sudo -u jadeapp python3.10 -m venv venv
sudo -u jadeapp /opt/jade-automation/backend/venv/bin/pip install -r requirements.txt
```

### 5.4 Backend Environment Configuration
Create backend/.env based on backend/.env.example or copy from the source VM. Example:
```env
FLASK_APP=run.py
FLASK_ENV=production
SECRET_KEY=change-me
DATABASE_URL=mysql+pymysql://infra_user:infra_pass123@localhost:3306/infra_automation
JWT_SECRET_KEY=change-me
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
PLAYBOOKS_DIR=./data/playbooks
```

### 5.5 Database Setup and Restore
Create database and user:
```bash
mysql -u root -p
CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'infra_user'@'localhost' IDENTIFIED BY 'infra_pass123';
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Restore database:
```bash
mysql -u infra_user -p infra_automation < /tmp/infra_automation.sql
```

### 5.6 Restore Playbook Files
```bash
tar -xzf /tmp/playbooks_data.tar.gz -C /opt/jade-automation/backend/data
sudo chown -R jadeapp:jadeapp /opt/jade-automation/backend/data/playbooks
```

### 5.7 Frontend Build
```bash
cd /opt/jade-automation/frontend
sudo -u jadeapp npm install
sudo -u jadeapp npm run build
```

## Phase 6 - Systemd Services
### 6.1 Gunicorn Service
Create /etc/systemd/system/jade-backend.service
```ini
[Unit]
Description=Jade Automation Hub Backend
After=network.target

[Service]
User=jadeapp
Group=jadeapp
WorkingDirectory=/opt/jade-automation/backend
EnvironmentFile=/opt/jade-automation/backend/.env
ExecStart=/opt/jade-automation/backend/venv/bin/gunicorn -w 3 -b 127.0.0.1:5000 run:app
Restart=always

[Install]
WantedBy=multi-user.target
```

### 6.2 Celery Worker Service
Create /etc/systemd/system/jade-celery.service
```ini
[Unit]
Description=Jade Automation Hub Celery Worker
After=network.target redis.service

[Service]
User=jadeapp
Group=jadeapp
WorkingDirectory=/opt/jade-automation/backend
EnvironmentFile=/opt/jade-automation/backend/.env
ExecStart=/opt/jade-automation/backend/venv/bin/celery -A app.celery_app worker --loglevel=info
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now jade-backend
sudo systemctl enable --now jade-celery
```

## Phase 7 - Nginx Reverse Proxy
Create /etc/nginx/conf.d/jade-automation.conf
```nginx
server {
    listen 80;
    server_name _;

    location / {
        root /opt/jade-automation/frontend/dist;
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Phase 8 - Validation
1. Backend health check:
```bash
curl http://127.0.0.1:5000/api/health
```
2. Frontend access:
- Open http://<oracle-vm-ip>/ in a browser.
3. Login using an existing admin account.
4. Execute a test playbook against a non-production server.
5. Verify job logs, status updates, and audit records.

## Phase 9 - Cutover and Rollback
- Cutover: direct users to the new Oracle VM IP address.
- Rollback: if issues are found, point users back to the source VM and re-run failed jobs there.

## Appendix A - Sample Data Transfer (scp)
```bash
scp /tmp/infra_automation.sql /tmp/playbooks_data.tar.gz user@<oracle-vm-ip>:/tmp/
```

## Appendix B - Optional SELinux Notes
If SELinux blocks Nginx or file access, review denials:
```bash
sudo ausearch -m avc -ts recent
```
Adjust policies or set permissive mode during initial testing:
```bash
sudo setenforce 0
```
Use enforcing mode in production after policy adjustment.
