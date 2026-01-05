# 🗄️ Database Design Document - Infrastructure Automation Platform

## Overview

**Database Engine:** MySQL 8  
**Character Set:** utf8mb4  
**Collation:** utf8mb4_unicode_ci  
**Storage Engine:** InnoDB  
**Timezone:** UTC  
**ORM:** SQLAlchemy 2.0  

---

## 📊 Schema Architecture

### Entity Relationship Diagram (Textual)

```
users (1) ──────→ (N) jobs
users (1) ──────→ (N) tickets  
users (1) ──────→ (N) audit_logs
servers (1) ─────→ (N) jobs
playbooks (1) ───→ (N) jobs
jobs (1) ────────→ (N) job_logs
jobs (1) ────────→ (N) tickets
```

---

## 📋 Table Definitions

### 1️⃣ users Table

**Purpose:** Authentication, authorization, and user management

| Column | Type | Constraints | Index | Description |
|--------|------|-------------|-------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | PK | Unique user identifier |
| username | VARCHAR(80) | UNIQUE, NOT NULL | UNIQUE | Login username |
| email | VARCHAR(120) | UNIQUE, NOT NULL | UNIQUE | Email address (lowercase) |
| password_hash | VARCHAR(255) | NOT NULL | - | bcrypt hashed password |
| role | ENUM('admin','operator','viewer') | NOT NULL, DEFAULT 'viewer' | INDEX | User role for RBAC |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | - | Account active status |
| created_at | DATETIME | NOT NULL, DEFAULT UTC | - | Account creation timestamp |
| updated_at | DATETIME | NOT NULL, DEFAULT UTC, ON UPDATE UTC | - | Last modification timestamp |
| last_login | DATETIME | NULL | - | Last successful login |

**Relationships:**
- 1 User → N Jobs (user_id)
- 1 User → N Tickets (created_by)
- 1 User → N AuditLogs (user_id)

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (username)
- UNIQUE (email)
- INDEX (role)

**Security:**
- Passwords stored as bcrypt hashes (60 chars, future-proof with 255)
- Email normalized to lowercase on insert/update
- No plaintext credentials ever stored

---

### 2️⃣ servers Table

**Purpose:** Infrastructure inventory for Ansible targets

| Column | Type | Constraints | Index | Description |
|--------|------|-------------|-------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | PK | Unique server identifier |
| hostname | VARCHAR(255) | UNIQUE, NOT NULL | UNIQUE | Server hostname/FQDN |
| ip_address | VARCHAR(45) | NOT NULL | INDEX | IPv4 or IPv6 address |
| os_type | VARCHAR(50) | NOT NULL | - | OS distribution (ubuntu, centos, rhel) |
| os_version | VARCHAR(50) | NULL | - | OS version string |
| ssh_port | INT | NOT NULL, DEFAULT 22 | - | SSH connection port |
| ssh_user | VARCHAR(50) | NOT NULL, DEFAULT 'root' | - | SSH username |
| ssh_key_path | VARCHAR(500) | NULL | - | Linux path to private key |
| tags | JSON | NULL | - | Flexible metadata (labels, annotations) |
| environment | VARCHAR(50) | NULL | - | Environment type (dev/staging/production) |
| description | TEXT | NULL | - | Human-readable description |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | - | Server active status |
| created_at | DATETIME | NOT NULL, DEFAULT UTC | - | Record creation timestamp |
| updated_at | DATETIME | NOT NULL, DEFAULT UTC, ON UPDATE UTC | - | Last modification timestamp |

**Relationships:**
- 1 Server → N Jobs (server_id)

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (hostname)
- INDEX (ip_address)
- COMPOSITE INDEX (is_active, environment)

**Design Notes:**
- `ip_address` supports IPv6 (45 chars)
- `ssh_key_path` assumes Linux filesystem
- `tags` JSON field validated at application layer
- Soft delete via `is_active` flag

---

### 3️⃣ playbooks Table

**Purpose:** Ansible playbook metadata and file tracking

| Column | Type | Constraints | Index | Description |
|--------|------|-------------|-------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | PK | Unique playbook identifier |
| name | VARCHAR(255) | UNIQUE, NOT NULL | UNIQUE | Playbook display name |
| description | TEXT | NULL | - | Human-readable description |
| file_path | VARCHAR(500) | NOT NULL | - | Linux filesystem path to YAML |
| file_hash | VARCHAR(64) | NOT NULL | - | SHA256 checksum for integrity |
| tags | JSON | NULL | - | Metadata tags |
| variables | JSON | NULL | - | Default Ansible variables |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | - | Playbook active status |
| created_at | DATETIME | NOT NULL, DEFAULT UTC | - | Upload timestamp |
| updated_at | DATETIME | NOT NULL, DEFAULT UTC, ON UPDATE UTC | - | Last modification timestamp |

**Relationships:**
- 1 Playbook → N Jobs (playbook_id)

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (name)

**Design Notes:**
- `file_hash` ensures file integrity detection
- `file_path` uses Linux path conventions
- `variables` stores default vars (can be overridden per job)

---

### 4️⃣ jobs Table

**Purpose:** Ansible execution job tracking and status

| Column | Type | Constraints | Index | Description |
|--------|------|-------------|-------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | PK | Unique job identifier |
| job_id | VARCHAR(36) | UNIQUE, NOT NULL | UNIQUE | UUID for external reference |
| playbook_id | INT | FOREIGN KEY → playbooks.id, NOT NULL | INDEX | Playbook executed |
| server_id | INT | FOREIGN KEY → servers.id, NOT NULL | INDEX | Target server |
| user_id | INT | FOREIGN KEY → users.id, NOT NULL | INDEX | User who triggered job |
| status | ENUM('pending','running','success','failed','cancelled') | NOT NULL, DEFAULT 'pending' | INDEX | Execution status |
| celery_task_id | VARCHAR(255) | NULL | INDEX | Celery async task ID |
| extra_vars | JSON | NULL | - | Runtime Ansible variables |
| error_message | TEXT | NULL | - | Error details if failed |
| started_at | DATETIME | NULL | - | Execution start timestamp |
| completed_at | DATETIME | NULL | - | Execution completion timestamp |
| created_at | DATETIME | NOT NULL, DEFAULT UTC | INDEX | Job creation timestamp |

**Relationships:**
- N Jobs → 1 Playbook
- N Jobs → 1 Server
- N Jobs → 1 User
- 1 Job → N JobLogs (job_id)
- 1 Job → N Tickets (job_id)

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (job_id)
- INDEX (playbook_id)
- INDEX (server_id)
- INDEX (user_id)
- INDEX (status)
- INDEX (celery_task_id)
- COMPOSITE INDEX (status, created_at) - For dashboard queries
- COMPOSITE INDEX (user_id, status) - For user-specific filtering

**Design Notes:**
- `job_id` is UUID for traceability across systems
- Status transitions: pending → running → (success|failed|cancelled)
- `celery_task_id` links to async task for cancellation
- `created_at` indexed separately for recent jobs queries

---

### 5️⃣ job_logs Table

**Purpose:** Line-by-line execution logs (high write volume)

| Column | Type | Constraints | Index | Description |
|--------|------|-------------|-------|-------------|
| id | BIGINT | PRIMARY KEY, AUTO_INCREMENT | PK | Unique log entry identifier |
| job_id | INT | FOREIGN KEY → jobs.id, NOT NULL | INDEX | Parent job reference |
| line_number | INT | NOT NULL | - | Sequential line number |
| content | TEXT | NOT NULL | - | Log message content |
| log_level | VARCHAR(20) | NULL | - | Severity (INFO, WARNING, ERROR, DEBUG) |
| timestamp | DATETIME | NOT NULL, DEFAULT UTC | INDEX | Log entry timestamp |

**Relationships:**
- N JobLogs → 1 Job (cascade delete)

**Indexes:**
- PRIMARY KEY (id)
- INDEX (job_id)
- INDEX (timestamp)
- COMPOSITE INDEX (job_id, line_number) - For ordered retrieval

**Performance Optimizations:**
- Uses BIGINT for `id` (expects millions of rows)
- Composite index (job_id, line_number) enables efficient pagination
- Timestamp indexed for time-range queries
- TEXT datatype for variable-length log messages
- Partitioning candidate (by created_at) for scaling

**Design Notes:**
- High insert volume during job execution
- Read pattern: streaming/polling by job_id
- Consider log rotation/archival after 90 days
- No foreign key cascade on delete (intentional data retention)

---

### 6️⃣ tickets Table

**Purpose:** Operational tickets for job issues

| Column | Type | Constraints | Index | Description |
|--------|------|-------------|-------|-------------|
| id | INT | PRIMARY KEY, AUTO_INCREMENT | PK | Unique ticket identifier |
| ticket_id | VARCHAR(36) | UNIQUE, NOT NULL | UNIQUE | UUID for external reference |
| job_id | INT | FOREIGN KEY → jobs.id, NOT NULL | INDEX | Related job |
| created_by | INT | FOREIGN KEY → users.id, NOT NULL | INDEX | User who created ticket |
| title | VARCHAR(255) | NOT NULL | - | Ticket title |
| description | TEXT | NULL | - | Detailed description |
| status | ENUM('open','in_progress','resolved','closed') | NOT NULL, DEFAULT 'open' | INDEX | Ticket lifecycle status |
| priority | ENUM('low','medium','high','critical') | NOT NULL, DEFAULT 'medium' | - | Priority level |
| created_at | DATETIME | NOT NULL, DEFAULT UTC | - | Ticket creation timestamp |
| updated_at | DATETIME | NOT NULL, DEFAULT UTC, ON UPDATE UTC | - | Last modification timestamp |
| resolved_at | DATETIME | NULL | - | Resolution timestamp |

**Relationships:**
- N Tickets → 1 Job
- N Tickets → 1 User (created_by)

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE (ticket_id)
- INDEX (job_id)
- INDEX (created_by)
- INDEX (status)
- COMPOSITE INDEX (status, priority) - For ticket dashboard

**Design Notes:**
- Auto-creation on job failures
- SLA tracking via `created_at` and `resolved_at`
- Priority affects notification routing

---

### 7️⃣ audit_logs Table

**Purpose:** Compliance and security audit trail

| Column | Type | Constraints | Index | Description |
|--------|------|-------------|-------|-------------|
| id | BIGINT | PRIMARY KEY, AUTO_INCREMENT | PK | Unique audit entry identifier |
| user_id | INT | FOREIGN KEY → users.id, NULL | INDEX | User who performed action |
| action | VARCHAR(100) | NOT NULL | INDEX | Action type (CREATE, UPDATE, DELETE, LOGIN) |
| resource_type | VARCHAR(50) | NOT NULL | INDEX | Entity type (user, server, playbook, job) |
| resource_id | INT | NULL | - | Entity ID |
| details | JSON | NULL | - | Additional context (old/new values) |
| ip_address | VARCHAR(45) | NULL | - | Client IP address |
| user_agent | VARCHAR(255) | NULL | - | Client user agent |
| timestamp | DATETIME | NOT NULL, DEFAULT UTC | INDEX | Event timestamp |

**Relationships:**
- N AuditLogs → 1 User (nullable for system actions)

**Indexes:**
- PRIMARY KEY (id)
- INDEX (user_id)
- INDEX (action)
- INDEX (resource_type)
- INDEX (timestamp)
- COMPOSITE INDEX (resource_type, resource_id) - For entity history
- COMPOSITE INDEX (action, timestamp) - For action-based queries

**Design Notes:**
- `user_id` nullable for system-initiated actions
- BIGINT for `id` (high volume, long retention)
- Immutable table (no updates/deletes)
- Partitioning candidate by timestamp
- Retention: 1 year minimum (compliance)

---

## 🔗 Foreign Key Constraints

### ON DELETE Behaviors

| Parent Table | Child Table | Column | ON DELETE |
|--------------|-------------|--------|-----------|
| playbooks | jobs | playbook_id | RESTRICT |
| servers | jobs | server_id | RESTRICT |
| users | jobs | user_id | RESTRICT |
| jobs | job_logs | job_id | CASCADE |
| jobs | tickets | job_id | RESTRICT |
| users | tickets | created_by | RESTRICT |
| users | audit_logs | user_id | SET NULL |

**Rationale:**
- **CASCADE:** job_logs deleted when job is deleted (data cleanup)
- **RESTRICT:** Prevent deletion of entities with active references (data integrity)
- **SET NULL:** audit_logs retain records even if user is deleted (compliance)

---

## 📊 Index Strategy

### Query Pattern Analysis

#### High-Frequency Queries
1. **Job status filtering:** `WHERE status = ? ORDER BY created_at DESC`
   - Index: `(status, created_at)`

2. **User job history:** `WHERE user_id = ? AND status = ?`
   - Index: `(user_id, status)`

3. **Log streaming:** `WHERE job_id = ? ORDER BY line_number`
   - Index: `(job_id, line_number)`

4. **Active servers:** `WHERE is_active = TRUE AND environment = ?`
   - Index: `(is_active, environment)`

5. **Audit trail:** `WHERE resource_type = ? AND resource_id = ?`
   - Index: `(resource_type, resource_id)`

### Write Performance Considerations

**job_logs Table:**
- Heavy insert load during job execution
- Bulk insert optimization recommended
- Consider delayed index updates
- Partition by month for historical data

---

## 🛡️ Security & Compliance

### Password Security
- bcrypt hashing with salt rounds ≥ 12
- Never log or audit password values
- Password rotation enforced at application layer

### Data Retention
- **job_logs:** 90 days (configurable)
- **audit_logs:** 1 year minimum (compliance)
- **jobs:** Indefinite (business records)

### Encryption
- TLS 1.2+ for connections
- Consider at-rest encryption for sensitive data
- SSH keys stored as file paths (not in DB)

---

## 🚀 Performance Optimization

### Connection Pooling
```python
SQLALCHEMY_POOL_SIZE = 20
SQLALCHEMY_POOL_TIMEOUT = 30
SQLALCHEMY_POOL_RECYCLE = 3600
SQLALCHEMY_MAX_OVERFLOW = 10
```

### Query Optimization
- Use `lazy='dynamic'` for large collections
- Avoid N+1 queries with `joinedload()`
- Pagination with `limit`/`offset`
- Index hint usage for complex queries

### Partitioning Strategy (Future)
- **job_logs:** By `created_at` (monthly)
- **audit_logs:** By `timestamp` (monthly)
- Automatic partition management

---

## 🔄 Migration Strategy

### Initial Setup
```bash
flask db init
flask db migrate -m "Initial schema"
flask db upgrade
```

### Schema Evolution
1. Always create reversible migrations
2. Test migrations on staging first
3. Backup before production migration
4. Monitor migration performance

### Version Control
- All migrations in git repository
- Never edit existing migrations
- Document breaking changes

---

## 📈 Scalability Considerations

### Current Limits (Single MySQL Instance)
- **Connections:** 151 max (default)
- **Row Size:** 65,535 bytes (InnoDB)
- **Storage:** Petabyte-scale (InnoDB)

### Scaling Paths
1. **Read Replicas:** For dashboard queries
2. **Partitioning:** job_logs, audit_logs
3. **Archival:** Historical logs to cold storage
4. **Sharding:** By tenant (if multi-tenant)

---

## ✅ Production Readiness Checklist

- [x] All tables use InnoDB engine
- [x] Character set utf8mb4 configured
- [x] Foreign keys enforced
- [x] Indexes optimized for query patterns
- [x] Timestamps use UTC
- [x] Passwords hashed with bcrypt
- [x] Audit logging implemented
- [x] Cascade delete rules defined
- [x] JSON fields validated at app layer
- [x] Migration scripts versioned

---

## 📋 Next Steps

1. **Review Schema:** Validate against business requirements
2. **Generate DDL:** Create MySQL DDL from SQLAlchemy models
3. **Performance Testing:** Load test with realistic data volumes
4. **Documentation:** Update API docs with schema details
5. **Backup Strategy:** Configure automated backups

---

**Schema Status:** ✅ Production-Ready  
**Last Updated:** December 29, 2025  
**Version:** 1.0.0
