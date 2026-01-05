# ✅ Deployment Verification Checklist

Use this checklist to verify that your Infra Automation Platform backend is properly configured and running.

---

## 📋 Pre-Deployment Checklist

### Environment Setup
- [ ] Python 3.10+ installed
- [ ] MySQL 8.0+ installed and running
- [ ] Redis 6.0+ installed and running
- [ ] Virtual environment created
- [ ] All dependencies installed (`pip install -r requirements.txt`)

### Configuration
- [ ] `.env` file created from `.env.example`
- [ ] `SECRET_KEY` changed from default
- [ ] `JWT_SECRET_KEY` changed from default
- [ ] `ENCRYPTION_KEY` changed from default
- [ ] `DATABASE_URL` configured correctly
- [ ] `CELERY_BROKER_URL` configured correctly
- [ ] `CORS_ORIGINS` set to frontend URL
- [ ] File paths configured for target environment

### Database
- [ ] MySQL database created
- [ ] Database user created with proper permissions
- [ ] Tables initialized (`flask init-db`)
- [ ] Admin user created (`flask create-admin`)
- [ ] Database connection tested

### Directories
- [ ] Upload folder exists with correct permissions
- [ ] Ansible runner directory exists
- [ ] SSH keys directory exists (chmod 700)
- [ ] Log directory exists and writable

---

## 🧪 Functional Testing Checklist

### Health Check
```bash
curl http://localhost:5000/health
```
- [ ] Returns 200 status
- [ ] Returns JSON with "healthy" status

### Authentication
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'
```
- [ ] Returns 200 status
- [ ] Returns access_token
- [ ] Returns refresh_token
- [ ] Returns user object

### Token Validation
```bash
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:5000/auth/me
```
- [ ] Returns 200 status
- [ ] Returns current user info

### Server Management
```bash
# Create server
curl -X POST http://localhost:5000/servers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "test-server",
    "ip_address": "192.168.1.100",
    "os_type": "ubuntu",
    "ssh_user": "ubuntu"
  }'
```
- [ ] Server creation successful (201)
- [ ] Server appears in GET /servers
- [ ] Server details retrievable
- [ ] Server update works
- [ ] Server deletion works

### Playbook Management
```bash
# Upload playbook
curl -X POST http://localhost:5000/playbooks/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@sample_playbook.yml" \
  -F "name=Test Playbook"
```
- [ ] Playbook upload successful (201)
- [ ] File stored in upload directory
- [ ] File has correct permissions (640)
- [ ] Playbook appears in GET /playbooks
- [ ] Playbook content retrievable

### Job Execution
```bash
# Create job
curl -X POST http://localhost:5000/jobs \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "playbook_id": 1,
    "server_id": 1
  }'
```
- [ ] Job creation successful (201)
- [ ] Job appears in GET /jobs
- [ ] Job status updates (pending → running → success/failed)
- [ ] Logs appear in GET /jobs/:id/logs

### User Management
```bash
# List users
curl -H "Authorization: Bearer <token>" \
  http://localhost:5000/users
```
- [ ] User listing works (admin only)
- [ ] User creation works
- [ ] User update works
- [ ] User deletion works

---

## 🔧 Service Health Checklist

### Flask Application
- [ ] Application starts without errors
- [ ] No import errors
- [ ] All blueprints registered
- [ ] Extensions initialized correctly
- [ ] Logging working

### Celery Worker
```bash
celery -A run.celery_app inspect ping
```
- [ ] Worker is running
- [ ] Worker responds to ping
- [ ] Tasks can be discovered
- [ ] No connection errors

### Database
```bash
mysql -u <user> -p -e "SHOW TABLES;" infra_automation
```
- [ ] All tables exist (users, servers, playbooks, jobs, job_logs, tickets, audit_logs)
- [ ] Can connect successfully
- [ ] Queries execute without errors

### Redis
```bash
redis-cli ping
```
- [ ] Redis responds with PONG
- [ ] Can connect successfully
- [ ] Celery can connect to Redis

---

## 🔐 Security Checklist

### Secrets
- [ ] All default keys changed in production
- [ ] `.env` file not committed to git
- [ ] Database password is strong
- [ ] Redis password set (production)

### File Permissions
```bash
ls -la /var/lib/infra-automation/
```
- [ ] Keys directory is 700 (drwx------)
- [ ] Key files are 600 (-rw-------)
- [ ] Playbook files are 640 (-rw-r-----)
- [ ] Owned by correct user

### Network
- [ ] Firewall configured correctly
- [ ] Only necessary ports open
- [ ] MySQL not exposed externally
- [ ] Redis not exposed externally

### SSL/TLS
- [ ] SSL certificate installed (production)
- [ ] HTTPS working
- [ ] HTTP redirects to HTTPS
- [ ] Certificate auto-renewal configured

---

## 📊 Performance Checklist

### Response Times
- [ ] Health check < 100ms
- [ ] Login < 500ms
- [ ] List endpoints < 1s
- [ ] Job creation < 500ms

### Database
- [ ] Indexes created on key fields
- [ ] Query performance acceptable
- [ ] Connection pooling working
- [ ] No connection leaks

### Celery
- [ ] Tasks execute within expected time
- [ ] No task failures
- [ ] Worker not overloaded
- [ ] Task results stored correctly

---

## 📝 Logging Checklist

### Application Logs
```bash
tail -f /var/log/infra-automation/app.log
```
- [ ] Logs being written
- [ ] Log format correct
- [ ] Log level appropriate
- [ ] No spam/excessive logging

### Error Tracking
- [ ] Errors logged with stack traces
- [ ] User actions audited
- [ ] Failed logins tracked
- [ ] Job failures logged

### Log Rotation
- [ ] Logrotate configured
- [ ] Old logs being compressed
- [ ] Disk space not filling up

---

## 🔄 Integration Checklist

### Frontend Integration
- [ ] CORS configured for frontend domain
- [ ] API accessible from frontend
- [ ] Authentication flow works
- [ ] All endpoints accessible
- [ ] Proper error responses

### Ansible Integration
- [ ] Ansible installed and accessible
- [ ] Can execute playbooks
- [ ] Logs captured correctly
- [ ] SSH keys working
- [ ] Inventory generation works

---

## 🚨 Error Handling Checklist

### Test Error Scenarios
- [ ] Invalid credentials → 401
- [ ] Missing token → 401
- [ ] Insufficient permissions → 403
- [ ] Resource not found → 404
- [ ] Invalid input → 400 with details
- [ ] Server error → 500 with safe message

### Recovery
- [ ] Application recovers from crashes
- [ ] Database connection retry works
- [ ] Celery tasks retry on failure
- [ ] Failed jobs can be retried

---

## 📈 Monitoring Checklist (Optional but Recommended)

### Metrics
- [ ] CPU usage monitored
- [ ] Memory usage monitored
- [ ] Disk space monitored
- [ ] API response times tracked
- [ ] Job success rate tracked

### Alerts
- [ ] Email alerts configured
- [ ] Critical errors trigger alerts
- [ ] Disk space warnings
- [ ] Service down alerts

---

## 🎯 Production-Specific Checklist

### System Services
```bash
systemctl status infra-automation-api
systemctl status infra-automation-celery
```
- [ ] Services enabled at boot
- [ ] Services running
- [ ] Services restart on failure
- [ ] Logs accessible via journalctl

### Backups
- [ ] Database backup script configured
- [ ] Backups running daily
- [ ] Backup retention policy set
- [ ] Restore tested

### Documentation
- [ ] API documentation accessible
- [ ] Deployment procedures documented
- [ ] Troubleshooting guide available
- [ ] Contact information updated

---

## ✅ Final Verification

After completing all items above:

1. **Restart all services**
   ```bash
   sudo systemctl restart infra-automation-api
   sudo systemctl restart infra-automation-celery
   ```

2. **Run full workflow test**
   - Login as admin
   - Create a server
   - Upload a playbook
   - Execute a job
   - View logs
   - Create a ticket

3. **Monitor for 24 hours**
   - Check logs for errors
   - Verify background tasks running
   - Test under load (if applicable)

4. **Sign off**
   - [ ] All critical items verified
   - [ ] No errors in logs
   - [ ] Performance acceptable
   - [ ] Security measures in place
   - [ ] Ready for production use

---

**Deployment Date**: ______________

**Verified By**: ______________

**Environment**: [ ] Development [ ] Staging [ ] Production

**Notes**:
_________________________________________
_________________________________________
_________________________________________
