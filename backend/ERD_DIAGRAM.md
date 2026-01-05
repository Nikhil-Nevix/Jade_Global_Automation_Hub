# 🗺️ Entity Relationship Diagram (ERD)

## Visual Schema Representation

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    Infrastructure Automation Platform                     │
│                          Database Schema (MySQL 8)                        │
└──────────────────────────────────────────────────────────────────────────┘


                           ┌─────────────────────┐
                           │       users         │
                           ├─────────────────────┤
                           │ PK id               │
                           │ UQ username         │
                           │ UQ email            │
                           │    password_hash    │
                           │    role (ENUM)      │
                           │    is_active        │
                           │    created_at       │
                           │    updated_at       │
                           │    last_login       │
                           └─────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    │                │                │
         (user_id)  │     (triggered_by)  (created_by)
                    ↓                ↓                ↓
    ┌──────────────────┐   ┌─────────────────────┐   ┌────────────────────┐
    │  audit_logs      │   │       jobs          │   │     tickets        │
    ├──────────────────┤   ├─────────────────────┤   ├────────────────────┤
    │ PK id (BIGINT)   │   │ PK id               │   │ PK id              │
    │ FK user_id       │   │ UQ job_id (UUID)    │   │ UQ ticket_id (UUID)│
    │    action        │   │ FK playbook_id ─────┼───┼─────────┐          │
    │    resource_type │   │ FK server_id ───────┼───┼──┐      │          │
    │    resource_id   │   │ FK user_id          │   │  │      │          │
    │    details (JSON)│   │    status (ENUM)    │   │  │      │          │
    │    ip_address    │   │    celery_task_id   │   │  │      │          │
    │    user_agent    │   │    extra_vars (JSON)│   │  │      │          │
    │    timestamp     │   │    error_message    │   │  │      │          │
    └──────────────────┘   │    started_at       │   │  │      │          │
                           │    completed_at     │   │  │      │          │
                           │    created_at       │   │  │      │          │
                           └─────────────────────┘   │  │      │          │
                                     │                │  │      │          │
                                     │                │  │      │          │
                          (job_id)   │                │  │      │          │
                                     ↓                │  │      │          │
                        ┌────────────────────┐        │  │      │          │
                        │    job_logs        │        │  │      │          │
                        ├────────────────────┤        │  │      │ (job_id) │
                        │ PK id (BIGINT)     │        │  │      └──────────┤
                        │ FK job_id (CASCADE)│────────┘  │                 │
                        │    line_number     │           │    FK job_id    │
                        │    content (TEXT)  │           │    FK created_by│
                        │    log_level       │           │    title        │
                        │    timestamp       │           │    description  │
                        └────────────────────┘           │    status (ENUM)│
                                                         │    priority     │
                                                         │    created_at   │
                                                         │    updated_at   │
                                                         │    resolved_at  │
                                                         └────────────────┘

                           
    ┌─────────────────────┐          ┌─────────────────────┐
    │     servers         │          │    playbooks        │
    ├─────────────────────┤          ├─────────────────────┤
    │ PK id               │          │ PK id               │
    │ UQ hostname         │          │ UQ name             │
    │    ip_address       │          │    description      │
    │    os_type          │          │    file_path        │
    │    os_version       │          │    file_hash (SHA256│
    │    ssh_port         │          │    tags (JSON)      │
    │    ssh_user         │          │    variables (JSON) │
    │    ssh_key_path     │          │    is_active        │
    │    tags (JSON)      │          │    created_at       │
    │    environment      │          │    updated_at       │
    │    description      │          └─────────────────────┘
    │    is_active        │                     │
    │    created_at       │                     │
    │    updated_at       │                     │
    └─────────────────────┘                     │
              │                                 │
              │                                 │
              └─────────(server_id)──┬──(playbook_id)─┘
                                     │
                                     ↓
                             ┌─────────────────────┐
                             │       jobs          │
                             │   (already shown)   │
                             └─────────────────────┘
```

---

## Relationship Details

### One-to-Many Relationships

```
users (1) ──→ (N) jobs
    FK: jobs.user_id → users.id
    ON DELETE: RESTRICT
    Description: User triggers job execution

users (1) ──→ (N) tickets
    FK: tickets.created_by → users.id
    ON DELETE: RESTRICT
    Description: User creates support tickets

users (1) ──→ (N) audit_logs
    FK: audit_logs.user_id → users.id
    ON DELETE: SET NULL
    Description: User actions logged for compliance

servers (1) ──→ (N) jobs
    FK: jobs.server_id → servers.id
    ON DELETE: RESTRICT
    Description: Server is target for automation

playbooks (1) ──→ (N) jobs
    FK: jobs.playbook_id → playbooks.id
    ON DELETE: RESTRICT
    Description: Playbook executed in job

jobs (1) ──→ (N) job_logs
    FK: job_logs.job_id → jobs.id
    ON DELETE: CASCADE
    Description: Execution logs for job (auto-cleanup)

jobs (1) ──→ (N) tickets
    FK: tickets.job_id → jobs.id
    ON DELETE: RESTRICT
    Description: Tickets raised for job issues
```

---

## Cardinality Summary

| Parent | Child | Relationship | Cascade | Notes |
|--------|-------|--------------|---------|-------|
| users | jobs | 1:N | RESTRICT | User can have multiple jobs |
| users | tickets | 1:N | RESTRICT | User can create multiple tickets |
| users | audit_logs | 1:N | SET NULL | User actions tracked |
| servers | jobs | 1:N | RESTRICT | Server can run multiple jobs |
| playbooks | jobs | 1:N | RESTRICT | Playbook used in multiple jobs |
| jobs | job_logs | 1:N | CASCADE | Each job has many logs |
| jobs | tickets | 1:N | RESTRICT | Each job can have tickets |

---

## Index Coverage Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INDEX STRATEGY                               │
└─────────────────────────────────────────────────────────────────────┘

users:
  - PRIMARY KEY (id)
  - UNIQUE INDEX (username)
  - UNIQUE INDEX (email)
  - INDEX (role)

servers:
  - PRIMARY KEY (id)
  - UNIQUE INDEX (hostname)
  - INDEX (ip_address)
  - COMPOSITE INDEX (is_active, environment)

playbooks:
  - PRIMARY KEY (id)
  - UNIQUE INDEX (name)

jobs:
  - PRIMARY KEY (id)
  - UNIQUE INDEX (job_id)
  - INDEX (playbook_id)  ◄─── Foreign Key
  - INDEX (server_id)    ◄─── Foreign Key
  - INDEX (user_id)      ◄─── Foreign Key
  - INDEX (status)
  - INDEX (celery_task_id)
  - COMPOSITE INDEX (status, created_at)      ◄─── Dashboard queries
  - COMPOSITE INDEX (user_id, status)        ◄─── User history

job_logs:  ⚠️ HIGH VOLUME
  - PRIMARY KEY (id) - BIGINT
  - INDEX (job_id)              ◄─── Foreign Key
  - INDEX (timestamp)
  - COMPOSITE INDEX (job_id, line_number)    ◄─── Log streaming

tickets:
  - PRIMARY KEY (id)
  - UNIQUE INDEX (ticket_id)
  - INDEX (job_id)         ◄─── Foreign Key
  - INDEX (created_by)     ◄─── Foreign Key
  - INDEX (status)
  - COMPOSITE INDEX (status, priority)       ◄─── Ticket queue

audit_logs:  ⚠️ HIGH VOLUME
  - PRIMARY KEY (id) - BIGINT
  - INDEX (user_id)        ◄─── Foreign Key
  - INDEX (action)
  - INDEX (resource_type)
  - INDEX (timestamp)
  - COMPOSITE INDEX (resource_type, resource_id) ◄─── Entity history
  - COMPOSITE INDEX (action, timestamp)          ◄─── Action timeline
```

---

## Query Flow Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                    COMMON QUERY PATTERNS                           │
└───────────────────────────────────────────────────────────────────┘

1. Dashboard: Recent Jobs
   ┌─────────┐
   │ Client  │──────► SELECT * FROM jobs
   └─────────┘        WHERE status = 'running'
                      ORDER BY created_at DESC
                      LIMIT 10;
                      
                      Uses: idx_jobs_status_created ✓


2. Job Details with Logs
   ┌─────────┐
   │ Client  │──────► SELECT * FROM jobs WHERE id = ?;
   └─────────┘        Uses: PRIMARY KEY ✓
        │
        ├──────────► SELECT * FROM job_logs
        │            WHERE job_id = ? 
        │            ORDER BY line_number;
        │            Uses: idx_joblogs_job_line ✓
        │
        └──────────► JOINs for playbook, server, user
                     Uses: PRIMARY KEYs ✓


3. User Job History
   ┌─────────┐
   │ Client  │──────► SELECT * FROM jobs
   └─────────┘        WHERE user_id = ? AND status IN (...)
                      ORDER BY created_at DESC;
                      
                      Uses: idx_jobs_user_status ✓


4. Audit Trail
   ┌─────────┐
   │ Client  │──────► SELECT * FROM audit_logs
   └─────────┘        WHERE resource_type = 'server'
                      AND resource_id = ?
                      ORDER BY timestamp DESC;
                      
                      Uses: idx_audit_resource ✓


5. Job Statistics
   ┌─────────┐
   │ Client  │──────► SELECT status, COUNT(*) 
   └─────────┘        FROM jobs
                      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                      GROUP BY status;
                      
                      Uses: Table scan (acceptable for aggregation)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                  JOB EXECUTION LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────────┘

1. User triggers job
   ┌──────┐
   │ User │─────► POST /api/jobs
   └──────┘       { playbook_id, server_id, extra_vars }
                  │
                  ↓
              ┌────────┐
              │  jobs  │─────► status = 'pending'
              └────────┘       created_at = NOW()
                  │
                  ↓
              Celery Task Created
              celery_task_id stored


2. Celery worker picks up task
                  │
                  ↓
              ┌────────┐
              │  jobs  │─────► status = 'running'
              └────────┘       started_at = NOW()


3. Ansible Runner executes playbook
                  │
                  ├─────► ┌──────────┐
                  │       │ job_logs │──► Line-by-line logs
                  │       └──────────┘    (Batch insert)
                  │
                  ↓
              Real-time log streaming to frontend
              (Polling /api/jobs/:id/logs)


4. Execution completes
                  │
                  ↓
              ┌────────┐
              │  jobs  │─────► status = 'success' | 'failed'
              └────────┘       completed_at = NOW()
                  │            error_message (if failed)
                  │
                  ↓ (if failed)
              ┌─────────┐
              │ tickets │─────► Auto-created ticket
              └─────────┘       status = 'open'


5. Audit logging
   All operations logged ──► ┌────────────┐
                             │ audit_logs │
                             └────────────┘
```

---

## Performance Hotspots

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PERFORMANCE ANALYSIS                              │
└─────────────────────────────────────────────────────────────────────┘

🔥 HOT TABLES (High Traffic)
┌──────────────┬────────────┬──────────┬─────────────────────────────┐
│    Table     │   Reads/s  │ Writes/s │  Optimization               │
├──────────────┼────────────┼──────────┼─────────────────────────────┤
│ jobs         │    100     │    20    │ Composite indexes ✓         │
│ job_logs     │    500     │   1000   │ BIGINT PK, Partitioning ⚠️  │
│ audit_logs   │    10      │    100   │ BIGINT PK, Archival ⚠️      │
│ servers      │    50      │    5     │ Current indexes sufficient  │
│ playbooks    │    30      │    2     │ Small table, no issues      │
│ tickets      │    20      │    10    │ Current indexes sufficient  │
│ users        │    100     │    1     │ Small table, fully indexed  │
└──────────────┴────────────┴──────────┴─────────────────────────────┘

⚠️ SCALING RECOMMENDATIONS:

job_logs:
  - Current: Single table
  - At 10M rows: Partition by month
  - At 100M rows: Consider time-series DB (ClickHouse)
  - Archival: Move logs > 90 days to cold storage

audit_logs:
  - Current: Single table
  - At 10M rows: Partition by month
  - Retention: 1 year (compliance requirement)
  - Never DELETE (immutable audit trail)

jobs:
  - Current: Single table sufficient
  - At 50M rows: Consider partitioning by created_at
  - Cleanup: Soft delete via status = 'archived'
```

---

## Schema Version History

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MIGRATION TIMELINE                                │
└─────────────────────────────────────────────────────────────────────┘

v1.0.0 - December 29, 2025
├─ Initial schema design
├─ 7 tables created
├─ 11 foreign key relationships
├─ 35+ indexes defined
├─ Production-ready baseline
└─ Documentation completed

Future versions:
v1.1.0 - Planned Q1 2026
├─ Add job_logs partitioning (if needed)
├─ Add notification_settings table
└─ Performance index tuning

v1.2.0 - Planned Q2 2026
├─ Add job_templates table
├─ Add server_groups table (clustering)
└─ Enhanced audit trail fields
```

---

**Diagram Version:** 1.0.0  
**Last Updated:** December 29, 2025  
**Format:** ASCII Art (Markdown-compatible)  
**Tools:** Can be visualized with draw.io, dbdiagram.io, or MySQL Workbench
