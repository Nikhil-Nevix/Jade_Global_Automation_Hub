# Database Schema Documentation

**Database Name:** `infra_automation`  
**Database Engine:** MySQL 8.0  
**Character Set:** utf8mb4  
**Collation:** utf8mb4_unicode_ci  
**Storage Engine:** InnoDB  
**Last Updated:** January 29, 2026

---

## 📊 Database Overview

### Connection Details
```bash
Database: infra_automation
Username: infra_user
Password: infra_pass123
Host: localhost
Port: 3306
```

### Tables Summary
| # | Table Name | Records | Status | Purpose |
|---|------------|---------|--------|---------|
| 1 | users | 4 | ✅ Active | User authentication & authorization |
| 2 | servers | 1 | ✅ Active | Infrastructure inventory & monitoring |
| 3 | playbooks | 3 | ✅ Active | Ansible playbook metadata |
| 4 | jobs | 5 | ✅ Active | Job execution tracking |
| 5 | job_logs | 116 | ✅ Active | Console output logs |
| 6 | tickets | 0 | ⚠️ Unused | Support ticket system |
| 7 | audit_logs | 286 | ✅ Active | System audit trail |
| 8 | playbook_audit_logs | 2 | ✅ Active | Playbook version control |

**Total Tables:** 8  
**Total Records:** 417 (excluding empty tickets table)

---

## 📋 Table 1: users

### Purpose
User authentication, authorization, and profile management with role-based access control (RBAC).


### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | INT(11) | NO | AUTO_INCREMENT | Primary key |
| username | VARCHAR(80) | NO | - | Unique username |
| email | VARCHAR(120) | NO | - | Unique email address |
| password_hash | VARCHAR(255) | NO | - | Bcrypt hashed password |
| role | ENUM | NO | user | User role (super_admin/admin/user) |
| is_active | TINYINT(1) | NO | 1 | Account active status |
| timezone | VARCHAR(50) | NO | UTC | User's timezone preference |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | Account creation timestamp |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP | Last update timestamp |
| last_login | DATETIME | YES | NULL | Last login timestamp |

### Sample Data
```sql
+----+----------------+------------------------------+-------------+-----------+----------+---------------------+---------------------+
| id | username       | email                        | role        | is_active | timezone | created_at          | last_login          |
+----+----------------+------------------------------+-------------+-----------+----------+---------------------+---------------------+
|  2 | testuser       | testuser@example.com         | admin       |         1 | UTC      | 2026-01-09 11:12:17 | 2026-01-29 05:19:00 |
|  4 | Atharva Botreq | atharvabotre@gmail.com       | admin       |         1 | UTC      | 2026-01-12 08:32:04 | 2026-01-14 10:00:08 |
|  5 | Nikhil         | nikhil.rokade@jadeglobal.com | super_admin |         1 | UTC      | 2026-01-19 09:24:55 | 2026-01-26 12:09:38 |
|  6 | Abhishek       | abhishek@gmail.com           | admin       |         1 | UTC      | 2026-01-21 06:34:42 | 2026-01-21 06:34:52 |
+----+----------------+------------------------------+-------------+-----------+----------+---------------------+---------------------+
```

### Used By
- **Frontend Pages:** Login, Users Management, Settings, All authenticated pages
- **Features:** Authentication, RBAC, User profile, Timezone preferences

### Relationships
- → jobs (one-to-many: creator)
- → tickets (one-to-many: creator)
- → audit_logs (one-to-many: actor)
- → playbook_audit_logs (one-to-many: editor)

---

## 📋 Table 2: servers

### Purpose
Infrastructure inventory management with real-time resource monitoring (CPU, Memory, Disk).

### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | INT(11) | NO | AUTO_INCREMENT | Primary key |
| hostname | VARCHAR(255) | NO | - | Unique server hostname |
| ip_address | VARCHAR(45) | NO | - | IPv4/IPv6 address |
| os_type | VARCHAR(50) | NO | - | Operating system (linux, windows) |
| os_version | VARCHAR(50) | YES | NULL | OS version (e.g., CentOS 7) |
| ssh_port | INT(11) | NO | 22 | SSH connection port |
| ssh_user | VARCHAR(50) | NO | root | SSH username |
| ssh_key_path | VARCHAR(500) | YES | NULL | Path to SSH private key |
| is_active | TINYINT(1) | NO | 1 | Server active status |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | Server added timestamp |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP | Last update timestamp |
| cpu_usage | FLOAT | YES | 0 | CPU usage % (0-100) |
| memory_usage | FLOAT | YES | 0 | Memory usage % (0-100) |
| disk_usage | FLOAT | YES | 0 | Disk usage % (0-100) |
| last_monitored | DATETIME | YES | NULL | Last metrics update time |

### Sample Data
```sql
+----+--------------+----------------+---------+------------+----------+--------------+--------------------------------+-----------+---------------------+---------------------+-----------+--------------+------------+---------------------+
| id | hostname     | ip_address     | os_type | os_version | ssh_port | ssh_user     | ssh_key_path                   | is_active | created_at          | updated_at          | cpu_usage | memory_usage | disk_usage | last_monitored      |
+----+--------------+----------------+---------+------------+----------+--------------+--------------------------------+-----------+---------------------+---------------------+-----------+--------------+------------+---------------------+
|  6 | NikhilRokade | 192.168.10.200 | linux   | CentOS     |       22 | NikhilRokade | /home/NikhilRokade/.ssh/id_rsa |         1 | 2026-01-28 11:08:18 | 2026-01-29 06:23:56 |      22.2 |        51.01 |          8 | 2026-01-29 06:23:56 |
+----+--------------+----------------+---------+------------+----------+--------------+--------------------------------+-----------+---------------------+---------------------+-----------+--------------+------------+---------------------+
```

### Used By
- **Frontend Pages:** Servers Page (CRUD, monitoring), Dashboard, Job execution target selector
- **Features:** Server inventory, Real-time monitoring (auto-refresh every 5 seconds), SSH connection management

### Relationships
- → jobs (one-to-many: execution target)

---

## 📋 Table 3: playbooks

### Purpose
Ansible playbook metadata, file management, and version tracking.


### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | INT(11) | NO | AUTO_INCREMENT | Primary key |
| name | VARCHAR(255) | NO | - | Unique playbook name |
| description | TEXT | YES | NULL | Playbook description |
| file_path | VARCHAR(500) | NO | - | Filesystem path to playbook file |
| is_active | TINYINT(1) | NO | 1 | Playbook active status (soft delete) |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP | Last modification timestamp |

### Sample Data
```sql
+----+------------------------+--------------------------+--------------------------------------------------------------------------------------------+-----------+---------------------+---------------------+
| id | name                   | description              | file_path                                                                                  | is_active | created_at          | updated_at          |
+----+------------------------+--------------------------+--------------------------------------------------------------------------------------------+-----------+---------------------+---------------------+
|  5 | fetch-basic-details    | fetch basic details      | /home/NikhilRokade/InfraAnsible/backend/data/playbooks/fetch-basic-details_c0351db1.yml    |         1 | 2026-01-15 08:57:12 | 2026-01-27 04:30:53 |
|  6 | fetch-server-info      | fetch server information | /home/NikhilRokade/InfraAnsible/backend/data/playbooks/fetch-server-info_5ff1787d.yml      |         1 | 2026-01-15 09:46:49 | 2026-01-28 10:49:09 |
| 12 | check_security_patches | check security patches   | /home/NikhilRokade/InfraAnsible/backend/data/playbooks/check_security_patches_4acd6bd2.yml |         1 | 2026-01-28 08:28:05 | 2026-01-29 06:08:34 |
+----+------------------------+--------------------------+--------------------------------------------------------------------------------------------+-----------+---------------------+---------------------+
```

### Used By
- **Frontend Pages:** Playbooks Page (CRUD, upload), Playbook Audit Pages (history viewer), Job execution
- **Features:** Playbook management, Upload, Edit, Delete, Version tracking, Audit trail

### Relationships
- → jobs (one-to-many: execution definition)
- → playbook_audit_logs (one-to-many: change history)

---

## 📋 Table 4: jobs

### Purpose
Job execution tracking, status monitoring, and history management.


### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | INT(11) | NO | AUTO_INCREMENT | Primary key |
| job_id | VARCHAR(36) | NO | - | Unique UUID for job |
| playbook_id | INT(11) | NO | - | Reference to playbooks table |
| server_id | INT(11) | NO | - | Reference to servers table |
| user_id | INT(11) | NO | - | Reference to users table (creator) |
| status | ENUM | NO | pending | Job status (5 states) |
| celery_task_id | VARCHAR(255) | YES | NULL | Celery async task ID |
| extra_vars | JSON | YES | NULL | Runtime variables (JSON) |
| error_message | TEXT | YES | NULL | Error details for failed jobs |
| started_at | DATETIME | YES | NULL | Job start timestamp |
| completed_at | DATETIME | YES | NULL | Job completion timestamp |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | Job creation timestamp |

### Sample Data
```sql
+----+--------------------------------------+-------------+-----------+---------+-----------+---------------------+---------------------+---------------------+
| id | job_id                               | playbook_id | server_id | user_id | status    | started_at          | completed_at        | created_at          |
+----+--------------------------------------+-------------+-----------+---------+-----------+---------------------+---------------------+---------------------+
| 86 | b50456d5-9e35-4cf0-af59-af721af6aa14 |           6 |         6 |       2 | cancelled | 2026-01-28 11:08:25 | 2026-01-28 11:08:29 | 2026-01-28 11:08:25 |
| 87 | 7a640415-6915-462b-bee8-bc17da86c5ba |           5 |         6 |       2 | failed    | 2026-01-28 11:09:16 | 2026-01-28 11:09:21 | 2026-01-28 11:09:16 |
| 88 | f160a1b4-aaa1-4437-a03b-b86a40caaec6 |           6 |         6 |       2 | success   | 2026-01-28 11:32:48 | 2026-01-28 11:32:54 | 2026-01-28 11:32:48 |
| 89 | fe4e2e08-99b0-4ef7-a957-6fdd7605bc2e |          12 |         6 |       2 | cancelled | 2026-01-28 11:41:34 | 2026-01-28 11:42:20 | 2026-01-28 11:41:33 |
| 90 | 8f3c79b2-b759-4052-a528-cc1cf6e6a0df |           6 |         6 |       2 | success   | 2026-01-28 12:06:45 | 2026-01-28 12:06:50 | 2026-01-28 12:06:45 |
+----+--------------------------------------+-------------+-----------+---------+-----------+---------------------+---------------------+---------------------+
```

### Job Statistics
- **Total Jobs:** 5
- **Success:** 2 (40%)
- **Failed:** 1 (20%)
- **Cancelled:** 2 (40%)

### Used By
- **Frontend Pages:** Jobs Page (history, filtering), Job Details Page (execution details), Dashboard (statistics)
- **Features:** Job execution, Status monitoring, Filtering by status, Job cancellation, Timeline visualization

### Relationships
- ← playbooks (many-to-one: execution definition)
- ← servers (many-to-one: execution target)
- ← users (many-to-one: job creator)
- → job_logs (one-to-many: console output)
- → tickets (one-to-many: support escalation)

---

## 📋 Table 5: job_logs

### Purpose
Line-by-line console output and execution logs for jobs.


### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | BIGINT(20) | NO | AUTO_INCREMENT | Primary key (high volume) |
| job_id | INT(11) | NO | - | Reference to jobs table |
| line_number | INT(11) | NO | - | Sequential line number |
| content | TEXT | NO | - | Actual log content |
| log_level | VARCHAR(20) | YES | NULL | Log severity (INFO/WARNING/ERROR/DEBUG) |
| timestamp | DATETIME | NO | CURRENT_TIMESTAMP | Log creation timestamp |

### Sample Data
```sql
+------+--------+-------------+--------------------------------------------------------------+-----------+---------------------+
| id   | job_id | line_number | content_preview                                              | log_level | timestamp           |
+------+--------+-------------+--------------------------------------------------------------+-----------+---------------------+
| 2409 |     86 |           1 | ansible-playbook [core 2.15.13]                              | INFO      | 2026-01-28 11:08:28 |
| 2410 |     86 |           2 | config file = None                                           | INFO      | 2026-01-28 11:08:28 |
| 2411 |     86 |           3 | configured module search path = ['/home/NikhilRokade/.ansi   | INFO      | 2026-01-28 11:08:28 |
| 2412 |     86 |           4 | ansible python module location = /home/NikhilRokade/InfraA   | INFO      | 2026-01-28 11:08:28 |
| 2413 |     86 |           5 | ansible collection location = /home/NikhilRokade/.ansible/   | INFO      | 2026-01-28 11:08:28 |
| 2414 |     86 |           6 | executable location = /home/NikhilRokade/InfraAnsible/back   | INFO      | 2026-01-28 11:08:28 |
| 2415 |     86 |           7 | python version = 3.9.6 (default, Aug 25 2021, 16:22:38) [G   | INFO      | 2026-01-28 11:08:28 |
| 2416 |     86 |           8 | jinja version = 3.1.6                                        | INFO      | 2026-01-28 11:08:28 |
| 2417 |     86 |           9 | libyaml = True                                               | INFO      | 2026-01-28 11:08:28 |
| 2418 |     86 |          10 | No config file found; using defaults                         | INFO      | 2026-01-28 11:08:28 |
+------+--------+-------------+--------------------------------------------------------------+-----------+---------------------+
```

### Log Statistics
- **Total Logs:** 116
- **Average per Job:** ~23 lines
- **Storage:** High-volume table (BIGINT primary key)

### Used By
- **Frontend Pages:** Job Details Page (console output viewer)
- **Features:** Syntax highlighting, Line-by-line display, Collapsible console output

### Relationships
- ← jobs (many-to-one: parent job, CASCADE DELETE)

### Performance Notes
- Uses BIGINT for scalability (millions of rows expected)
- Composite index (job_id, line_number) for ordered retrieval
- Cascade delete when parent job is deleted
- **Recommendation:** Implement 90-day retention policy

---

## 📋 Table 6: tickets

### Purpose
Support ticket system for failed jobs (CURRENTLY UNUSED).


### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | INT(11) | NO | AUTO_INCREMENT | Primary key |
| ticket_id | VARCHAR(36) | NO | - | Unique UUID for ticket |
| job_id | INT(11) | NO | - | Reference to failed job |
| created_by | INT(11) | NO | - | Reference to user who created ticket |
| title | VARCHAR(255) | NO | - | Ticket title/subject |
| description | TEXT | YES | NULL | Detailed issue description |
| status | ENUM | NO | open | Ticket status (4 states) |
| priority | ENUM | NO | medium | Priority level (4 levels) |
| created_at | DATETIME | NO | CURRENT_TIMESTAMP | Creation timestamp |
| updated_at | DATETIME | NO | CURRENT_TIMESTAMP | Last update timestamp |
| resolved_at | DATETIME | YES | NULL | Resolution timestamp |

### Sample Data
```
NO DATA - TABLE IS EMPTY (0 records)
```

### Status
⚠️ **COMPLETELY UNUSED**
- No records in database
- No frontend implementation
- No API endpoints
- No UI pages

### Recommendation
**REMOVE THIS TABLE** - Can be added back later if needed.

---

## 📋 Table 7: audit_logs

### Purpose
System-wide audit trail for compliance, security, and activity tracking.


### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | BIGINT(20) | NO | AUTO_INCREMENT | Primary key (long-term retention) |
| user_id | INT(11) | YES | NULL | User who performed action (NULL for system) |
| action | VARCHAR(100) | NO | - | Action type (LOGIN, CREATE, UPDATE, DELETE, etc.) |
| resource_type | VARCHAR(50) | NO | - | Resource type (user, server, playbook, job) |
| resource_id | INT(11) | YES | NULL | ID of affected resource |
| details | JSON | YES | NULL | Additional context data |
| ip_address | VARCHAR(45) | YES | NULL | Request IP address |
| timestamp | DATETIME | NO | CURRENT_TIMESTAMP | Action timestamp |

### Sample Data (Recent 15 entries)
```sql
+-----+---------+----------------+---------------+-------------+---------------+---------------------+
| id  | user_id | action         | resource_type | resource_id | ip_address    | timestamp           |
+-----+---------+----------------+---------------+-------------+---------------+---------------------+
| 289 |       2 | UPDATE_CONTENT | playbook      |          12 | NULL          | 2026-01-29 06:08:34 |
| 288 |       2 | UPDATE_CONTENT | playbook      |          12 | NULL          | 2026-01-29 06:08:05 |
| 287 |       2 | LOGIN          | user          |           2 | 192.168.56.69 | 2026-01-29 05:19:01 |
| 286 |       2 | LOGIN          | user          |           2 | 192.168.56.69 | 2026-01-29 04:48:04 |
| 285 |       2 | CREATE         | job           |          90 | NULL          | 2026-01-28 12:06:45 |
| 284 |       2 | CANCEL         | job           |          86 | NULL          | 2026-01-28 11:44:29 |
| 283 |       2 | UPDATE_CONTENT | playbook      |          12 | NULL          | 2026-01-28 11:43:17 |
| 282 |       2 | CANCEL         | job           |          89 | NULL          | 2026-01-28 11:42:20 |
| 281 |       2 | CREATE         | job           |          89 | NULL          | 2026-01-28 11:41:33 |
| 280 |       2 | LOGIN          | user          |           2 | 192.168.56.69 | 2026-01-28 11:36:44 |
| 279 |       2 | CREATE         | job           |          88 | NULL          | 2026-01-28 11:32:48 |
| 278 |       2 | CREATE         | job           |          87 | NULL          | 2026-01-28 11:09:16 |
| 277 |       2 | CREATE         | job           |          86 | NULL          | 2026-01-28 11:08:25 |
| 276 |       2 | CREATE         | server        |           6 | NULL          | 2026-01-28 11:08:18 |
| 275 |       2 | CANCEL         | job           |          67 | NULL          | 2026-01-28 11:04:00 |
+-----+---------+----------------+---------------+-------------+---------------+---------------------+
```

### Audit Statistics
- **Total Logs:** 286
- **Most Active User:** testuser (id=2)
- **Common Actions:** LOGIN, CREATE, UPDATE, CANCEL, update_content

### Action Types
| Action | Description | Example |
|--------|-------------|---------|
| LOGIN | User authentication | User login events |
| CREATE | Resource creation | New job, server, playbook |
| UPDATE | Resource modification | Update server details |
| DELETE | Resource deletion | Delete user, server |
| CANCEL | Job cancellation | Cancel running job |
| update_content | Playbook content change | Edit playbook YAML |

### Used By
- **Backend:** Automatic logging for all CRUD operations
- **Frontend:** No dedicated page (backend-only)
- **Features:** Compliance tracking, Security monitoring, Activity history

### Relationships
- ← users (many-to-one: actor, SET NULL on delete)

### Compliance Notes
- Immutable records (no updates/deletes)
- BIGINT for long-term retention (1+ year minimum)
- Captures both user and system actions

---

## 📋 Table 8: playbook_audit_logs

### Purpose
Detailed version control and change tracking for playbooks with complete content history.


### Columns
| Column | Type | Null | Default | Description |
|--------|------|------|---------|-------------|
| id | INT(11) | NO | AUTO_INCREMENT | Primary key |
| playbook_id | INT(11) | NO | - | Playbook ID (NOT FK - preserves deleted history) |
| playbook_name | VARCHAR(255) | NO | - | Playbook name snapshot |
| user_id | INT(11) | NO | - | User who made the change |
| action | ENUM | NO | - | Action type (5 types) |
| old_content | TEXT | YES | NULL | Complete previous YAML content |
| new_content | TEXT | YES | NULL | Complete new YAML content |
| changes_description | TEXT | YES | NULL | Human-readable change summary |
| ip_address | VARCHAR(45) | YES | NULL | Request IP address |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | Change timestamp |

### Sample Data
```sql
+----+-------------+------------------------+---------+---------+---------------------------------------------------+---------------------+
| id | playbook_id | playbook_name          | user_id | action  | changes_summary                                   | created_at          |
+----+-------------+------------------------+---------+---------+---------------------------------------------------+---------------------+
|  1 |          12 | check_security_patches |       2 | updated | Playbook "check_security_patches" content updated | 2026-01-29 06:08:05 |
|  2 |          12 | check_security_patches |       2 | updated | Playbook "check_security_patches" content updated | 2026-01-29 06:08:34 |
+----+-------------+------------------------+---------+---------+---------------------------------------------------+---------------------+
```

### Action Types
| Action | Description |
|--------|-------------|
| created | New playbook created |
| updated | Playbook content modified |
| deleted | Playbook soft-deleted |
| uploaded | New playbook uploaded |
| replaced | Playbook file replaced |

### Used By
- **Frontend Pages:** Playbook Audit Page (side-by-side diff viewer), Playbook Audit Logs Page (overview)
- **Features:** Version control, Content comparison, Change history, Rollback capability

### Key Features
- Stores complete file versions (old & new content)
- Preserves history even after playbook deletion
- Powers side-by-side YAML diff viewer
- Enables rollback to previous versions

### Relationships
- playbook_id: NOT a foreign key (intentional - preserves deleted playbook history)
- ← users (many-to-one: editor)

### Storage Notes
- Stores full YAML content (can be large)
- 2 records = 2 versions of same playbook tracked

---

## 🔗 Database Relationships Diagram

```
users (4)
  ├─→ jobs (many-to-one: creator)
  ├─→ tickets (many-to-one: creator)
  ├─→ audit_logs (many-to-one: actor)
  └─→ playbook_audit_logs (many-to-one: editor)

servers (1)
  └─→ jobs (many-to-one: execution target)

playbooks (3)
  ├─→ jobs (many-to-one: execution definition)
  └─→ playbook_audit_logs (one-to-many: change history) [NOT FK]

jobs (5)
  ├─→ job_logs (one-to-many: console output, CASCADE DELETE)
  └─→ tickets (one-to-many: support escalation)
```

---

## 📊 Database Statistics

### Record Distribution
```
Total Records: 417
├─ users: 4 (1%)
├─ servers: 1 (<1%)
├─ playbooks: 3 (<1%)
├─ jobs: 5 (1%)
├─ job_logs: 116 (28%)
├─ tickets: 0 (0%)
├─ audit_logs: 286 (69%)
└─ playbook_audit_logs: 2 (<1%)
```

### Growth Trends
- **High Volume:** job_logs (23 per job), audit_logs (~71 per user)
- **Medium Volume:** jobs (growing with usage)
- **Low Volume:** users, servers, playbooks (stable)
- **Zero Volume:** tickets (unused)

---


## 📝 Notes

1. **Unused Tables:** The `tickets` table has zero records and no implementation. Consider removal.

2. **High Growth Tables:** 
   - `job_logs` grows at ~23 lines per job
   - `audit_logs` captures all system actions
   - Both need retention policies

3. **Critical Tables:** 
   - `users`, `servers`, `playbooks`, `jobs` are essential
   - Cannot be removed without breaking the application

4. **Version Control:** 
   - `playbook_audit_logs` provides complete version history
   - Stores full YAML content for diff comparison

5. **Real-time Monitoring:**
   - `servers` table includes live metrics (CPU, Memory, Disk)
   - Updated every 5 seconds when viewing server details

---

**Document Version:** 1.0  
**Last Updated:** January 29, 2026  
**Maintained By:** Infrastructure Automation Team
