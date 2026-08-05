# Maintenance Runbook — Jade Automation Hub

**Server:** Jade-Automation-Hub-SVR1
**Last Updated:** 23-June-2026
**Owner:** Abhishek & Rohit (Infrastructure), Nikhil (Application)

---

## Daily Checks (Every Morning — 5 min)

Run this block each morning to confirm overnight health:

```bash
# 1. All services running?
sudo systemctl status mysqld redis infraansible-backend infraansible-celery nginx --no-pager | grep -E "Active|●"

# 2. App health endpoint
curl -s http://localhost:5000/health | python3 -m json.tool

# 3. Disk space OK? (alert threshold: 80%)
df -h / | awk 'NR==2 {print "Disk used: " $5}'

# 4. Any overnight errors in app log?
grep -i "error\|critical\|exception" /var/log/infra-automation/app.log \
  --since "yesterday" 2>/dev/null | tail -20

# 5. Celery job queue depth (should be near 0)
redis-cli llen celery
```

**Pass criteria:** All services active, health returns `"status":"healthy"`, disk < 80%, no critical errors, queue depth < 5.

---

## Weekly Tasks (Every Monday — 15 min)

### 1. Verify automated DB backup ran

```bash
# List recent backups
ls -lh /var/backups/infra-automation/ | tail -10

# Most recent backup should be from last night
# Verify it is not zero bytes
```

### 2. Test DB backup restore (on a test schema — never on production)

```bash
# Create a test schema
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS infra_automation_test;"

# Restore latest backup into test schema
LATEST=$(ls /var/backups/infra-automation/*.sql.gz 2>/dev/null | sort | tail -1)
echo "Testing restore of: $LATEST"
gunzip -c "$LATEST" | mysql -u root -p infra_automation_test

# Verify row count matches production
mysql -u root -p -e "
  SELECT 'production' AS schema_name, COUNT(*) AS user_count FROM infra_automation.users
  UNION ALL
  SELECT 'test_restore', COUNT(*) FROM infra_automation_test.users;
"

# Clean up test schema
mysql -u root -p -e "DROP DATABASE infra_automation_test;"
```

### 3. Review Nginx access log for anomalies

```bash
# Top 10 IPs by request count this week
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# Any 5xx errors?
grep ' 5[0-9][0-9] ' /var/log/nginx/access.log | tail -20
```

### 4. Check system resource trends

```bash
# Memory usage
free -h

# CPU load average
uptime

# MySQL connections
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected';"

# Redis memory
redis-cli info memory | grep used_memory_human
```

### 5. Rotate logs manually if logrotate hasn't run

```bash
sudo logrotate -f /etc/logrotate.d/infra-automation
```

---

## Monthly Tasks (1st of each month — 30 min)

### 1. OS security patches

```bash
# Check for available updates
sudo dnf check-update

# Apply security patches only (non-disruptive)
sudo dnf update --security -y

# If kernel updated, schedule reboot during maintenance window
```

### 2. SSL certificate expiry check

```bash
# Check certificate expiry date
sudo openssl x509 -enddate -noout \
  -in /etc/nginx/ssl/jade-automation.crt 2>/dev/null \
  || echo "Check SSL cert path in Nginx config"

# Nginx config SSL path
sudo grep -r "ssl_certificate " /etc/nginx/conf.d/
```

Renew if expiry is within 30 days.

### 3. Review disk space and clean old files

```bash
# Overall disk
df -h /

# Largest directories
du -sh /var/log/* /var/lib/mysql /var/backups/infra-automation 2>/dev/null | sort -rh | head -10

# Remove DB backups older than 30 days
find /var/backups/infra-automation/ -name "*.sql.gz" -mtime +30 -exec rm -v {} \;

# Remove log archives older than 30 days
find /var/log/infra-automation/ -name "*.gz" -mtime +30 -exec rm -v {} \;
```

### 4. Review user accounts and RBAC

```bash
# List all active users and their roles
mysql -u infra_user -pinfra_pass123 infra_automation \
  -e "SELECT username, email, role, is_active, last_login FROM users ORDER BY role, username;"
```

Deactivate accounts for anyone who has left the team:
```bash
mysql -u infra_user -pinfra_pass123 infra_automation \
  -e "UPDATE users SET is_active=0 WHERE username='<departed-user>';"
```

### 5. Check MySQL slow query log

```bash
sudo tail -n 100 /var/log/mysql/slow.log 2>/dev/null || \
  mysql -u root -p -e "SHOW VARIABLES LIKE 'slow_query_log%';"
```

---

## Backup Procedures

### Automated DB backup (cron — runs daily)

The daily backup cron job runs as `svc-ansible`. Verify it is in place:

```bash
crontab -l -u svc-ansible | grep mysqldump
```

Expected entry (adjust path/time as configured):
```
0 2 * * * mysqldump -u infra_user -pinfra_pass123 infra_automation | gzip > /var/backups/infra-automation/db_$(date +\%F).sql.gz
```

If missing — recreate it:
```bash
(crontab -l -u svc-ansible 2>/dev/null; echo "0 2 * * * mysqldump -u infra_user -pinfra_pass123 infra_automation | gzip > /var/backups/infra-automation/db_\$(date +\%F).sql.gz") | crontab -u svc-ansible -
```

### Manual backup (before any deployment or major change)

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mysqldump -u infra_user -pinfra_pass123 infra_automation \
  | gzip > /var/backups/infra-automation/manual_backup_${TIMESTAMP}.sql.gz
echo "Backup saved: manual_backup_${TIMESTAMP}.sql.gz"
```

### Playbook file backup

```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf /var/backups/infra-automation/playbooks_${TIMESTAMP}.tar.gz \
  /var/lib/infra-automation/
echo "Playbooks backed up."
```

---

## Planned Maintenance Window Procedure

Use this procedure for deployments, OS patching requiring reboot, or infrastructure changes.

### Before the window

1. Notify users (Slack / email) — at least 2 hours in advance
2. Take a manual DB backup (see above)
3. Note current git commit: `git -C /home/svc-ansible/apps/InfraAnsible log -1 --oneline`
4. Confirm no jobs are running: check UI or `redis-cli llen celery`

### During the window

```bash
# Stop application (graceful)
sudo systemctl stop nginx
sudo systemctl stop infraansible-celery
sudo systemctl stop infraansible-backend

# Perform maintenance work here
# ...

# Restart services
sudo systemctl start mysqld
sudo systemctl start redis
sudo systemctl start infraansible-backend
sudo systemctl start infraansible-celery
sudo systemctl start nginx

# Verify
curl http://localhost:5000/health
```

### After the window

1. Confirm health check returns healthy
2. Test login and run a sample job
3. Notify users that service is restored

---

## Service Auto-Restart Verification

All services are configured with `Restart=always`. Verify this is set:

```bash
sudo systemctl show infraansible-backend | grep Restart
sudo systemctl show infraansible-celery | grep Restart
```

Both should return `Restart=always`. If not, check the service unit files:

```bash
sudo cat /etc/systemd/system/infraansible-backend.service
sudo cat /etc/systemd/system/infraansible-celery.service
```

---

## Health Check Monitoring Script

Save this as `/home/svc-ansible/scripts/health_check.sh` for manual or cron-based checks:

```bash
#!/bin/bash
HEALTH=$(curl -s http://localhost:5000/health)
DB=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['checks']['database'])")
REDIS=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['checks']['redis'])")

echo "=== Jade Automation Hub Health Check — $(date) ==="
echo "Database : $DB"
echo "Redis    : $REDIS"
echo ""

for SVC in mysqld redis infraansible-backend infraansible-celery nginx; do
  STATUS=$(systemctl is-active "$SVC")
  echo "$SVC: $STATUS"
done

echo ""
echo "Disk usage: $(df -h / | awk 'NR==2{print $5}')"
echo "Celery queue depth: $(redis-cli llen celery)"
```

```bash
chmod +x /home/svc-ansible/scripts/health_check.sh
```

---

## Maintenance Log

Record significant maintenance events here:

| Date | Action | Performed By | Notes |
|------|--------|-------------|-------|
| 23-Jun-2026 | Production go-live. Log directory created `/var/log/infra-automation/`. Service names confirmed: `mysqld` (MySQL 8.4.9), `redis`, `infraansible-backend`, `infraansible-celery`, `nginx`. | Nikhil | Health check confirmed healthy. |
