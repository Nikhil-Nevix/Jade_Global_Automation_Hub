IMPORTANT CONTEXT

Redis → Backend → Celery → Frontend
               

Order matters


# 1) Login to Linux VM
-- ssh HostName@<VM-IP>

=====================================================================

# 2) Start Redis (FIRST – mandatory)

-- Redis must be running before Celery.

-- sudo systemctl start redis
-- sudo systemctl enable redis

Verify:
-- redis-cli ping

✅ Expected:
PONG

=====================================================================

# 3) Start Flask Backend (Terminal 1)
-- cd ~/InfraAnsible/backend
-- source venv/bin/activate
-- python run.py

✅ Expected:
Running on http://0.0.0.0:5000

=====================================================================
⚠️ Keep this terminal OPEN
=====================================================================

# 4) Start Celery Worker (Terminal 2)

-- cd ~/InfraAnsible/backend
-- source venv/bin/activate
-- celery -A app worker --loglevel=info

✅ Expected:
[INFO/MainProcess] celery@jgpnabhi ready.

=====================================================================
⚠️ Keep this terminal OPEN
=====================================================================

# 5) Open a new Terminal
-- cd ~/InfraAnsible/frontend
-- npm run dev -- --host


✅ Expected:
Local: http://0.0.0.0:5173

=====================================================================
⚠️ Must be Linux VM IP, not localhost
=====================================================================

====================================================================

# 6) Open Application in Browser
Open: http://0.0.0.0:5173

Login:-   Username: testuser
          Password: password123

===================================================================


## READY TO GO

=================================================================


## One-line memory trick

Redis → Backend → Celery → Frontend

Always start in this order.

=================================================================

## DATABASE ACCESS AND VERIFICATION

### Connect to Database

To access the database to verify data:

#### From Terminal

```bash
# SSH into your Linux VM first
ssh HostName@<VM-IP>

# Connect to MySQL/MariaDB
mysql -u infra_user -p infra_automation
# Enter password: infra_pass123
```



### Essential Database Commands

Once connected to MySQL, run these commands to view the database:

```sql
-- Switch to the database
USE infra_automation;

-- Show all tables
SHOW TABLES;

-- View table structures
DESCRIBE users;
DESCRIBE servers;
DESCRIBE playbooks;
DESCRIBE jobs;
DESCRIBE job_logs;
DESCRIBE audit_logs;

-- Check data in tables
SELECT * FROM users;
SELECT * FROM servers;
SELECT * FROM playbooks;
SELECT * FROM jobs;

-- Count records
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM servers;
SELECT COUNT(*) FROM jobs;

-- Check specific user
SELECT id, username, email, role, is_active, created_at 
FROM users 
WHERE username = 'admin';

-- View recent jobs
SELECT j.id, j.job_id, j.status, p.name as playbook, s.hostname as server, j.created_at
FROM jobs j
JOIN playbooks p ON j.playbook_id = p.id
JOIN servers s ON j.server_id = s.id
ORDER BY j.created_at DESC
LIMIT 10;

-- View audit logs
SELECT id, user_id, action, resource_type, timestamp
FROM audit_logs
ORDER BY timestamp DESC
LIMIT 20;

-- Exit MySQL
EXIT;
```

