# Troubleshooting Guide — Jade Automation Hub

**Server:** Jade-Automation-Hub-SVR1
**Last Updated:** 23-June-2026
**Owner:** Nikhil Rokade (Application), Abhishek & Rohit (Infrastructure)

---

## Quick Diagnostics — Run First

Before investigating any issue, run this block to get a full picture:

```bash
# Service states
sudo systemctl status mysqld redis infraansible-backend infraansible-celery nginx

# App health
curl http://localhost:5000/health

# Disk space
df -h /

# Memory
free -h

# Recent app errors
journalctl -u infraansible-backend -n 50 --no-pager
journalctl -u infraansible-celery -n 50 --no-pager
```

---

## Problem 1: Application not accessible in browser

**Symptoms:** Browser shows "connection refused", "site can't be reached", or 502 Bad Gateway.

### Check Nginx

```bash
sudo systemctl status nginx
sudo nginx -t          # test config syntax
tail -f /var/log/nginx/error.log
```

If Nginx is stopped:
```bash
sudo systemctl start nginx
```

If Nginx config test fails:
```bash
# Review config
sudo cat /etc/nginx/conf.d/infraansible.conf
# Fix syntax error, then reload
sudo nginx -t && sudo systemctl reload nginx
```

### Check Backend (Gunicorn)

```bash
sudo systemctl status infraansible-backend
journalctl -u infraansible-backend -n 50 --no-pager
```

If backend is stopped:
```bash
sudo systemctl start infraansible-backend
curl http://localhost:5000/health
```

If health check returns unhealthy — check database and Redis (Problems 2 and 3 below).

---

## Problem 2: "Database connection error" / health check shows database: error

**Symptoms:** `/health` returns `"database": "error"` or backend logs show `OperationalError`.

### Check MySQL

```bash
sudo systemctl status mysqld
```

If stopped:
```bash
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

### Verify DB connectivity

```bash
mysql -u infra_user -pinfra_pass123 infra_automation -e "SELECT 1;"
```

If login fails — check credentials in the `.env` file:
```bash
cat /home/svc-ansible/apps/InfraAnsible/backend/.env | grep DATABASE_URL
```

### Check MySQL error log

```bash
sudo tail -n 50 /var/log/mysqld.log
```

### MySQL disk space issue

If MySQL fails to start and logs show disk errors:
```bash
df -h /var/lib/mysql
```
If disk is over 90% full — see Problem 6 (Disk Space).

---

## Problem 3: Celery shows Redis connection errors / jobs stuck in queue

**Symptoms:** Jobs submitted but never execute; Celery logs show `redis.exceptions.ConnectionError`.

### Check Redis

```bash
sudo systemctl status redis
redis-cli ping      # expected: PONG
```

If stopped:
```bash
sudo systemctl start redis
sudo systemctl enable redis
```

### Check Redis connectivity from app

```bash
cat /home/svc-ansible/apps/InfraAnsible/backend/.env | grep REDIS_URL
redis-cli -u <REDIS_URL from .env> ping
```

### Restart Celery after Redis recovery

```bash
sudo systemctl restart infraansible-celery
journalctl -u infraansible-celery -f
```

### Check job backlog in queue

```bash
redis-cli llen celery
```

A high number (>50) means jobs are queued but Celery is not consuming them — restart Celery worker.

---

## Problem 4: Jobs submitted but Ansible playbook execution fails

**Symptoms:** Job shows status `failed` immediately; logs show `ansible-playbook: command not found` or SSH errors.

### Check Ansible is installed

```bash
source /home/svc-ansible/apps/InfraAnsible/backend/venv/bin/activate
ansible --version
ansible-runner --version
```

If not found — reinstall in virtualenv:
```bash
pip install ansible==8.7.0 ansible-runner==2.3.4
```

### Check SSH key for managed servers

```bash
# As svc-ansible user
sudo -u svc-ansible ssh -i ~/.ssh/id_rsa <target-server-ip>
```

If SSH fails:
- Verify the target server's `authorized_keys` has the svc-ansible public key
- Check firewall allows SSH from this server's IP

### Check Ansible runner working directory

```bash
ls -la /var/lib/infra-automation/
```

Permissions must be owned by `svc-ansible`. If not:
```bash
sudo chown -R svc-ansible:svc-ansible /var/lib/infra-automation/
```

---

## Problem 5: WebSocket real-time logs not streaming

**Symptoms:** Job executes but log window stays blank or shows "WebSocket connection failed".

### Check backend WebSocket support

```bash
journalctl -u infraansible-backend -n 30 --no-pager | grep -i websocket
```

### Check Nginx WebSocket proxy headers

```bash
sudo grep -A5 "websocket\|upgrade\|Upgrade" /etc/nginx/conf.d/infraansible.conf
```

Nginx config must include:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

If missing, add these lines to the `/api/` location block and reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Check firewall allows WebSocket port

```bash
sudo firewall-cmd --list-ports
```

Port 5000 must be listed. If not:
```bash
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload
```

---

## Problem 6: Disk space running low

**Symptoms:** Services start failing; logs show `No space left on device`.

### Check disk usage

```bash
df -h /
du -sh /var/log/infra-automation/*
du -sh /var/lib/mysql/
du -sh /var/log/nginx/
```

### Clear old application logs (keep last 7 days)

```bash
find /var/log/infra-automation/ -name "*.log" -mtime +7 -exec rm {} \;
```

### Clear old Nginx logs

```bash
sudo find /var/log/nginx/ -name "*.log.gz" -mtime +30 -exec rm {} \;
```

### Clear old DB backups beyond retention

```bash
find /var/backups/infra-automation/ -name "*.sql.gz" -mtime +30 -exec rm {} \;
```

### Check MySQL binary logs

```bash
sudo mysql -u root -p -e "SHOW BINARY LOGS;"
sudo mysql -u root -p -e "PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 7 DAY);"
```

---

## Problem 7: "502 Bad Gateway" from Nginx

**Symptoms:** Browser shows 502 error; Nginx is running but backend is not.

```bash
# Confirm backend is down
curl http://localhost:5000/health

# Restart backend
sudo systemctl restart infraansible-backend

# Watch it come up
journalctl -u infraansible-backend -f
```

If backend keeps crashing — check for Python import errors:
```bash
cd /home/svc-ansible/apps/InfraAnsible/backend
source venv/bin/activate
python -c "from app import create_app; create_app()"
```

---

## Problem 8: Frontend shows blank page or old content after update

**Symptoms:** Browser shows blank page or outdated UI after a code deployment.

```bash
# Rebuild frontend
cd /home/svc-ansible/apps/InfraAnsible/frontend
npm install
npm run build

# Reload Nginx to serve new static files
sudo systemctl reload nginx

# Hard refresh in browser: Ctrl+Shift+R
```

---

## Problem 9: Login fails — "Invalid credentials" for known-good account

**Symptoms:** Admin or user cannot log in despite correct password.

### Check user exists in DB

```bash
mysql -u infra_user -pinfra_pass123 infra_automation \
  -e "SELECT username, is_active, role FROM users WHERE username='admin';"
```

If `is_active = 0` — re-enable the account:
```bash
mysql -u infra_user -pinfra_pass123 infra_automation \
  -e "UPDATE users SET is_active=1 WHERE username='admin';"
```

### Reset admin password via Flask CLI

```bash
cd /home/svc-ansible/apps/InfraAnsible/backend
source venv/bin/activate
flask shell
```

Inside Flask shell:
```python
from app.models import User
from app import db
u = User.query.filter_by(username='admin').first()
u.set_password('NewSecurePassword123!')
db.session.commit()
exit()
```

---

## Problem 10: Service fails to start on reboot

**Symptoms:** After server reboot, one or more services are not running.

```bash
# Check which services are not active
sudo systemctl status mysqld redis infraansible-backend infraansible-celery nginx

# Check if they are enabled
sudo systemctl is-enabled mysqld redis infraansible-backend infraansible-celery nginx

# Enable any that are not
sudo systemctl enable mysqld redis infraansible-backend infraansible-celery nginx

# Start them manually now
sudo systemctl start mysqld
sudo systemctl start redis
sudo systemctl start infraansible-backend
sudo systemctl start infraansible-celery
sudo systemctl start nginx
```

Check journal for the failed service for root cause:
```bash
journalctl -u infraansible-backend -b --no-pager | tail -30
```

`-b` shows logs from the current boot only.

---

## Escalation Path

| Severity | Description | Contact |
|----------|-------------|---------|
| P1 — Critical | App completely down, data loss risk | Nikhil + Abhishek immediately |
| P2 — High | Core feature broken (jobs not running, login failing) | Nikhil within 1 hour |
| P3 — Medium | Non-critical feature degraded (export, notifications) | Nikhil next business day |
| P4 — Low | UI glitch, cosmetic issue | Log in GitHub Issues |
