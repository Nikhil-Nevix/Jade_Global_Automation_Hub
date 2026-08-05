# Operations Manual — Jade Automation Hub

**Server:** Jade-Automation-Hub-SVR1
**Service User:** svc-ansible
**App Directory:** /home/svc-ansible/apps/InfraAnsible
**Last Updated:** 23-June-2026
**Owner:** Abhishek & Rohit (Infrastructure), Nikhil (Application)

---

## 1. Service Overview

| Service | Systemd Unit | Port | Role |
|---------|-------------|------|------|
| MySQL 8.4.9 | `mysqld` | 3306 | Primary database |
| Redis | `redis` | 6379 | Task queue / cache |
| Gunicorn (Flask) | `infraansible-backend` | 5000 | Backend API |
| Celery Worker | `infraansible-celery` | — | Async job execution |
| Nginx | `nginx` | 80 / 443 | Reverse proxy / static files |

---

## 2. Startup Procedure

Start services in this exact order — each depends on the one above it.

```bash
# 1. Start MySQL
sudo systemctl start mysqld

# 2. Start Redis
sudo systemctl start redis

# 3. Start Backend (Gunicorn)
sudo systemctl start infraansible-backend

# 4. Start Celery Worker
sudo systemctl start infraansible-celery

# 5. Start Nginx
sudo systemctl start nginx
```

### Verify everything is up

```bash
sudo systemctl status mysqld infraansible-backend infraansible-celery redis nginx
```

### Health check

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{"checks":{"database":"ok","redis":"ok"},"environment":"production","status":"healthy","version":"1.0.0"}
```

---

## 3. Shutdown Procedure

Stop in reverse order to allow in-flight jobs to complete.

```bash
# 1. Stop Nginx (stop accepting new requests)
sudo systemctl stop nginx

# 2. Stop Celery (allow running jobs to finish — wait ~30s before forcing)
sudo systemctl stop infraansible-celery

# 3. Stop Backend
sudo systemctl stop infraansible-backend

# 4. Stop Redis
sudo systemctl stop redis

# 5. Stop MySQL (last — data must be flushed safely)
sudo systemctl stop mysqld
```

---

## 4. Restart Procedures

### Restart individual service (normal)

```bash
sudo systemctl restart mysqld
sudo systemctl restart redis
sudo systemctl restart infraansible-backend
sudo systemctl restart infraansible-celery
sudo systemctl restart nginx
```

### Restart after application code update

```bash
# Pull latest code (as svc-ansible)
cd /home/svc-ansible/apps/InfraAnsible
git pull origin main

# Install any new Python dependencies
source backend/venv/bin/activate
pip install -r backend/requirements.txt

# Apply any DB migrations
cd backend
flask db upgrade

# Rebuild frontend if changed
cd /home/svc-ansible/apps/InfraAnsible/frontend
npm install
npm run build

# Restart app services (no need to restart MySQL or Redis)
sudo systemctl restart infraansible-backend
sudo systemctl restart infraansible-celery
sudo systemctl restart nginx
```

### Full server reboot recovery

All 5 services are enabled on boot (`systemctl enable`). After a reboot:

```bash
# Wait ~60 seconds after boot, then verify
sudo systemctl status mysqld infraansible-backend infraansible-celery redis nginx
curl http://localhost:5000/health
```

---

## 5. Service Enable / Disable on Boot

```bash
# Enable a service to auto-start on boot
sudo systemctl enable mysqld
sudo systemctl enable redis
sudo systemctl enable infraansible-backend
sudo systemctl enable infraansible-celery
sudo systemctl enable nginx

# Verify all are enabled
sudo systemctl is-enabled mysqld redis infraansible-backend infraansible-celery nginx
```

---

## 6. Log Locations

| Component | Log Path |
|-----------|----------|
| Application (Flask) | `/var/log/infra-automation/app.log` |
| Celery Worker | `/var/log/infra-automation/celery.log` |
| Nginx Access | `/var/log/nginx/access.log` |
| Nginx Error | `/var/log/nginx/error.log` |
| MySQL | `/var/log/mysqld.log` |
| Systemd (any service) | `journalctl -u <service-name> -n 100` |

### Tail live logs

```bash
# Application log
tail -f /var/log/infra-automation/app.log

# Backend service log (systemd)
journalctl -u infraansible-backend -f

# Celery log
journalctl -u infraansible-celery -f

# Nginx error log
tail -f /var/log/nginx/error.log
```

---

## 7. Key File Paths

| Item | Path |
|------|------|
| Application root | `/home/svc-ansible/apps/InfraAnsible/` |
| Backend code | `/home/svc-ansible/apps/InfraAnsible/backend/` |
| Frontend build (dist) | `/home/svc-ansible/apps/InfraAnsible/frontend/dist/` |
| Environment config | `/home/svc-ansible/apps/InfraAnsible/backend/.env` |
| Python virtualenv | `/home/svc-ansible/apps/InfraAnsible/backend/venv/` |
| Ansible playbook storage | `/var/lib/infra-automation/` |
| Application logs | `/var/log/infra-automation/` |
| Nginx config | `/etc/nginx/conf.d/infraansible.conf` |
| MySQL config | `/etc/my.cnf` |
| Systemd service files | `/etc/systemd/system/infraansible-*.service` |

---

## 8. Database Access

```bash
# Connect as application user
mysql -u infra_user -p infra_automation

# Connect as root (for admin tasks)
sudo mysql -u root -p

# Quick health check
mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT 1;"
```

### Check DB table row counts

```sql
SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = 'infra_automation'
ORDER BY table_name;
```

---

## 9. Redis Access

```bash
# Verify Redis is responding
redis-cli ping

# Check Redis info (memory, clients, uptime)
redis-cli info server | grep -E "uptime|version"
redis-cli info memory | grep used_memory_human

# Check active Celery task queue
redis-cli llen celery
```

---

## 10. Support Contacts

| Role | Name | Responsibility |
|------|------|----------------|
| Application support | Nikhil Rokade | Backend, frontend, Ansible, app bugs |
| Infrastructure support | Abhishek | MySQL, Nginx, SSL, OS, firewall |
| Infrastructure support | Rohit | Redis, backups, systemd, monitoring |
