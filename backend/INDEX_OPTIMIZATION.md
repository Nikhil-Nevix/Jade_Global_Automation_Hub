# 📊 Index Optimization & Performance Analysis

## Overview

This document explains the indexing strategy for the Infrastructure Automation Platform database, query patterns, and performance optimization techniques.

---

## 🎯 Index Strategy Philosophy

### Design Principles

1. **Query Pattern Driven:** Indexes based on actual query patterns from API endpoints
2. **Write-Read Balance:** Minimize index overhead on high-write tables (job_logs)
3. **Cardinality First:** Index high-cardinality columns first in composite indexes
4. **Covering Indexes:** Use composite indexes to avoid table lookups where possible
5. **Monitoring Based:** Continuously monitor and adjust based on actual usage

---

## 📋 Table-by-Table Analysis

### 1️⃣ users Table

**Read:Write Ratio:** 80:20 (mostly reads)  
**Total Rows:** Low (< 1,000)  
**Growth Rate:** Slow

#### Indexes

| Index Name | Columns | Type | Purpose | Query Pattern |
|------------|---------|------|---------|---------------|
| PRIMARY | id | Unique | Primary key | `WHERE id = ?` |
| username | username | Unique | Login lookup | `WHERE username = ?` |
| email | email | Unique | Email lookup | `WHERE email = ?` |
| idx_users_role | role | Non-unique | Role filtering | `WHERE role = ?` |

#### Query Patterns

```sql
-- Login authentication (frequency: high)
SELECT * FROM users 
WHERE username = 'admin' AND is_active = TRUE;
-- Uses: username index + table scan for is_active

-- Role-based access (frequency: medium)
SELECT * FROM users 
WHERE role = 'admin';
-- Uses: idx_users_role

-- Email validation (frequency: medium)
SELECT COUNT(*) FROM users 
WHERE email = 'user@example.com';
-- Uses: email index (covering)
```

#### Optimization Notes

- Small table, indexes are very effective
- Consider adding `is_active` to compound indexes if filtering becomes common
- Email stored as lowercase for case-insensitive search

---

### 2️⃣ servers Table

**Read:Write Ratio:** 70:30  
**Total Rows:** Medium (1,000 - 10,000)  
**Growth Rate:** Moderate

#### Indexes

| Index Name | Columns | Type | Purpose | Query Pattern |
|------------|---------|------|---------|---------------|
| PRIMARY | id | Unique | Primary key | `WHERE id = ?` |
| hostname | hostname | Unique | Hostname lookup | `WHERE hostname = ?` |
| idx_servers_ip | ip_address | Non-unique | IP search | `WHERE ip_address = ?` |
| idx_servers_active_env | is_active, environment | Composite | Active server filtering | `WHERE is_active = TRUE AND environment = ?` |

#### Query Patterns

```sql
-- List active production servers (frequency: high)
SELECT * FROM servers 
WHERE is_active = TRUE AND environment = 'production'
ORDER BY hostname;
-- Uses: idx_servers_active_env + filesort

-- Search by IP (frequency: medium)
SELECT * FROM servers 
WHERE ip_address = '192.168.1.100';
-- Uses: idx_servers_ip

-- Server details (frequency: high)
SELECT * FROM servers 
WHERE id = ?;
-- Uses: PRIMARY key (fastest)
```

#### Optimization Recommendations

```sql
-- Add covering index for dashboard queries
CREATE INDEX idx_servers_list 
ON servers (is_active, environment, hostname, ip_address);

-- This avoids table lookups for common list queries
```

---

### 3️⃣ playbooks Table

**Read:Write Ratio:** 90:10 (mostly reads)  
**Total Rows:** Low (< 500)  
**Growth Rate:** Slow

#### Indexes

| Index Name | Columns | Type | Purpose | Query Pattern |
|------------|---------|------|---------|---------------|
| PRIMARY | id | Unique | Primary key | `WHERE id = ?` |
| name | name | Unique | Name lookup | `WHERE name = ?` |

#### Query Patterns

```sql
-- List active playbooks (frequency: high)
SELECT id, name, description, created_at 
FROM playbooks 
WHERE is_active = TRUE
ORDER BY name;
-- Full table scan (acceptable for small table)

-- Playbook by name (frequency: medium)
SELECT * FROM playbooks 
WHERE name = 'deploy_nginx';
-- Uses: name index
```

#### Optimization Notes

- Small table, additional indexes not needed
- Full table scans are acceptable
- Name uniqueness enforced at database level

---

### 4️⃣ jobs Table

**Read:Write Ratio:** 60:40  
**Total Rows:** High (100,000+)  
**Growth Rate:** Fast (100-1000 jobs/day)

#### Indexes

| Index Name | Columns | Type | Purpose | Query Pattern |
|------------|---------|------|---------|---------------|
| PRIMARY | id | Unique | Primary key | `WHERE id = ?` |
| job_id | job_id | Unique | UUID lookup | `WHERE job_id = ?` |
| idx_jobs_playbook | playbook_id | Non-unique | Playbook history | `WHERE playbook_id = ?` |
| idx_jobs_server | server_id | Non-unique | Server history | `WHERE server_id = ?` |
| idx_jobs_user | user_id | Non-unique | User jobs | `WHERE user_id = ?` |
| idx_jobs_status | status | Non-unique | Status filtering | `WHERE status = ?` |
| idx_jobs_celery_task | celery_task_id | Non-unique | Task lookup | `WHERE celery_task_id = ?` |
| idx_jobs_status_created | status, created_at | Composite | Dashboard queries | `WHERE status = ? ORDER BY created_at DESC` |
| idx_jobs_user_status | user_id, status | Composite | User filtering | `WHERE user_id = ? AND status = ?` |

#### Query Patterns

```sql
-- Dashboard: Recent running jobs (frequency: very high)
SELECT j.*, p.name as playbook_name, s.hostname 
FROM jobs j
JOIN playbooks p ON j.playbook_id = p.id
JOIN servers s ON j.server_id = s.id
WHERE j.status = 'running'
ORDER BY j.created_at DESC
LIMIT 10;
-- Uses: idx_jobs_status_created + JOIN lookups

-- User job history (frequency: high)
SELECT * FROM jobs 
WHERE user_id = 123 AND status IN ('success', 'failed')
ORDER BY created_at DESC
LIMIT 20;
-- Uses: idx_jobs_user_status

-- Job statistics (frequency: high)
SELECT 
    status, 
    COUNT(*) as count,
    AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_duration
FROM jobs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY status;
-- Uses: table scan (acceptable for aggregation)
```

#### Optimization Recommendations

```sql
-- Add covering index for job list API
CREATE INDEX idx_jobs_list_covering 
ON jobs (status, created_at, id, playbook_id, server_id, user_id);

-- Add index for duration calculations
CREATE INDEX idx_jobs_timing 
ON jobs (started_at, completed_at);

-- Partition by created_at (for scaling)
ALTER TABLE jobs
PARTITION BY RANGE (YEAR(created_at) * 100 + MONTH(created_at)) (
    PARTITION p202401 VALUES LESS THAN (202402),
    PARTITION p202402 VALUES LESS THAN (202403),
    -- Add partitions monthly
    PARTITION p_future VALUES LESS THAN MAXVALUE
);
```

---

### 5️⃣ job_logs Table

**Read:Write Ratio:** 20:80 (write-heavy)  
**Total Rows:** Very High (millions)  
**Growth Rate:** Very Fast (10,000+ per day)

#### Indexes

| Index Name | Columns | Type | Purpose | Query Pattern |
|------------|---------|------|---------|---------------|
| PRIMARY | id | Unique | Primary key (BIGINT) | `WHERE id = ?` |
| idx_joblogs_job | job_id | Non-unique | Job log retrieval | `WHERE job_id = ?` |
| idx_joblogs_timestamp | timestamp | Non-unique | Time-based queries | `WHERE timestamp >= ?` |
| idx_joblogs_job_line | job_id, line_number | Composite | Ordered retrieval | `WHERE job_id = ? ORDER BY line_number` |

#### Query Patterns

```sql
-- Real-time log streaming (frequency: very high)
SELECT content, log_level, timestamp 
FROM job_logs 
WHERE job_id = 12345 AND line_number >= 0
ORDER BY line_number ASC
LIMIT 100;
-- Uses: idx_joblogs_job_line (covering index ideal)

-- Pagination: Next 100 lines (frequency: very high)
SELECT content, log_level, timestamp 
FROM job_logs 
WHERE job_id = 12345 AND line_number >= 100
ORDER BY line_number ASC
LIMIT 100;
-- Uses: idx_joblogs_job_line

-- Log cleanup (frequency: daily)
DELETE FROM job_logs 
WHERE timestamp < DATE_SUB(NOW(), INTERVAL 90 DAY)
LIMIT 10000;
-- Uses: idx_joblogs_timestamp
```

#### Performance Critical Optimizations

```sql
-- 1. Use BIGINT for primary key (future-proof)
ALTER TABLE job_logs MODIFY id BIGINT AUTO_INCREMENT;

-- 2. Create covering index for log streaming
CREATE INDEX idx_joblogs_covering 
ON job_logs (job_id, line_number, content, log_level, timestamp);

-- 3. Partition by timestamp (essential for scale)
ALTER TABLE job_logs
PARTITION BY RANGE (UNIX_TIMESTAMP(timestamp)) (
    PARTITION p202401 VALUES LESS THAN (UNIX_TIMESTAMP('2024-02-01')),
    PARTITION p202402 VALUES LESS THAN (UNIX_TIMESTAMP('2024-03-01')),
    PARTITION p202403 VALUES LESS THAN (UNIX_TIMESTAMP('2024-04-01')),
    PARTITION p_current VALUES LESS THAN MAXVALUE
);

-- 4. Use DELAYED inserts for bulk logging (if possible)
INSERT DELAYED INTO job_logs (job_id, line_number, content, timestamp)
VALUES (?, ?, ?, ?);

-- 5. Batch inserts in application code
INSERT INTO job_logs (job_id, line_number, content, timestamp) VALUES
(1, 1, 'Log line 1', NOW()),
(1, 2, 'Log line 2', NOW()),
(1, 3, 'Log line 3', NOW());
-- Use executemany() in SQLAlchemy
```

#### Write Optimization Strategy

**Application-Level Buffering:**

```python
# Buffer logs in memory, flush every 100 lines or 5 seconds
class LogBuffer:
    def __init__(self):
        self.buffer = []
        self.max_size = 100
        
    def add_log(self, job_id, line_number, content):
        self.buffer.append({
            'job_id': job_id,
            'line_number': line_number,
            'content': content,
            'timestamp': datetime.utcnow()
        })
        
        if len(self.buffer) >= self.max_size:
            self.flush()
    
    def flush(self):
        db.session.bulk_insert_mappings(JobLog, self.buffer)
        db.session.commit()
        self.buffer = []
```

---

### 6️⃣ tickets Table

**Read:Write Ratio:** 70:30  
**Total Rows:** Medium (10,000+)  
**Growth Rate:** Moderate

#### Indexes

| Index Name | Columns | Type | Purpose | Query Pattern |
|------------|---------|------|---------|---------------|
| PRIMARY | id | Unique | Primary key | `WHERE id = ?` |
| ticket_id | ticket_id | Unique | UUID lookup | `WHERE ticket_id = ?` |
| idx_tickets_job | job_id | Non-unique | Job tickets | `WHERE job_id = ?` |
| idx_tickets_created_by | created_by | Non-unique | User tickets | `WHERE created_by = ?` |
| idx_tickets_status | status | Non-unique | Status filtering | `WHERE status = ?` |
| idx_tickets_status_priority | status, priority | Composite | Ticket queue | `WHERE status = ? ORDER BY priority DESC` |

#### Query Patterns

```sql
-- Ticket dashboard (frequency: high)
SELECT * FROM tickets 
WHERE status IN ('open', 'in_progress')
ORDER BY priority DESC, created_at ASC;
-- Uses: idx_tickets_status_priority

-- User's tickets (frequency: medium)
SELECT * FROM tickets 
WHERE created_by = 123
ORDER BY created_at DESC;
-- Uses: idx_tickets_created_by + filesort
```

---

### 7️⃣ audit_logs Table

**Read:Write Ratio:** 10:90 (write-heavy)  
**Total Rows:** Very High (millions)  
**Growth Rate:** Fast

#### Indexes

| Index Name | Columns | Type | Purpose | Query Pattern |
|------------|---------|------|---------|---------------|
| PRIMARY | id | Unique | Primary key (BIGINT) | `WHERE id = ?` |
| idx_audit_user | user_id | Non-unique | User actions | `WHERE user_id = ?` |
| idx_audit_action | action | Non-unique | Action filtering | `WHERE action = ?` |
| idx_audit_resource_type | resource_type | Non-unique | Resource type | `WHERE resource_type = ?` |
| idx_audit_timestamp | timestamp | Non-unique | Time-based queries | `WHERE timestamp >= ?` |
| idx_audit_resource | resource_type, resource_id | Composite | Entity history | `WHERE resource_type = ? AND resource_id = ?` |
| idx_audit_action_timestamp | action, timestamp | Composite | Action timeline | `WHERE action = ? ORDER BY timestamp DESC` |

#### Query Patterns

```sql
-- Entity history (frequency: medium)
SELECT * FROM audit_logs 
WHERE resource_type = 'server' AND resource_id = 456
ORDER BY timestamp DESC;
-- Uses: idx_audit_resource

-- Recent actions (frequency: low)
SELECT * FROM audit_logs 
WHERE action = 'DELETE' AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
ORDER BY timestamp DESC;
-- Uses: idx_audit_action_timestamp
```

---

## 🔬 Index Performance Analysis

### Measuring Index Effectiveness

```sql
-- 1. Check index usage
SELECT 
    object_schema,
    object_name,
    index_name,
    count_star,
    count_read,
    count_write
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema = 'infra_automation'
ORDER BY count_star DESC;

-- 2. Find unused indexes
SELECT 
    object_name,
    index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE object_schema = 'infra_automation'
    AND index_name IS NOT NULL
    AND index_name != 'PRIMARY'
    AND count_star = 0;

-- 3. Index cardinality
SELECT 
    table_name,
    index_name,
    cardinality,
    ROUND(cardinality / table_rows * 100, 2) AS selectivity_pct
FROM information_schema.statistics s
JOIN information_schema.tables t USING (table_schema, table_name)
WHERE s.table_schema = 'infra_automation'
    AND s.seq_in_index = 1
ORDER BY selectivity_pct DESC;

-- 4. Duplicate indexes
SELECT 
    s1.table_name,
    s1.index_name AS index1,
    s2.index_name AS index2,
    s1.column_name
FROM information_schema.statistics s1
JOIN information_schema.statistics s2 
    ON s1.table_schema = s2.table_schema
    AND s1.table_name = s2.table_name
    AND s1.column_name = s2.column_name
    AND s1.index_name < s2.index_name
WHERE s1.table_schema = 'infra_automation'
ORDER BY s1.table_name, s1.index_name;
```

---

## 🎯 Query Optimization Examples

### Slow Query Transformation

**Before (Slow):**
```sql
SELECT j.*, u.username, p.name AS playbook_name, s.hostname
FROM jobs j
LEFT JOIN users u ON j.user_id = u.id
LEFT JOIN playbooks p ON j.playbook_id = p.id
LEFT JOIN servers s ON j.server_id = s.id
WHERE j.status = 'running'
ORDER BY j.created_at DESC;
```

**EXPLAIN Output:**
```
| type | key               | rows  | Extra                                    |
|------|-------------------|-------|------------------------------------------|
| ref  | idx_jobs_status   | 1000  | Using where; Using temporary; Using filesort |
| ref  | PRIMARY           | 1     |                                          |
| ref  | PRIMARY           | 1     |                                          |
| ref  | PRIMARY           | 1     |                                          |
```

**After (Optimized):**
```sql
-- Use covering index and avoid filesort
SELECT 
    j.id, j.job_id, j.status, j.created_at,
    j.user_id, j.playbook_id, j.server_id
FROM jobs j USE INDEX (idx_jobs_status_created)
WHERE j.status = 'running'
ORDER BY j.created_at DESC
LIMIT 20;

-- Fetch related data in separate queries (or use SQLAlchemy joinedload)
SELECT id, username FROM users WHERE id IN (...);
SELECT id, name FROM playbooks WHERE id IN (...);
SELECT id, hostname FROM servers WHERE id IN (...);
```

**EXPLAIN Output:**
```
| type | key                     | rows | Extra       |
|------|-------------------------|------|-------------|
| ref  | idx_jobs_status_created | 20   | Using index |
```

---

## 🚀 Scaling Recommendations

### Short-term (< 1M rows per table)
- [x] Current index strategy is sufficient
- [x] Monitor slow query log
- [x] Adjust buffer pool size

### Medium-term (1M - 10M rows)
- [ ] Implement partitioning on job_logs and audit_logs
- [ ] Add covering indexes for hot queries
- [ ] Consider read replicas for reporting

### Long-term (> 10M rows)
- [ ] Archival strategy for old data
- [ ] Sharding for multi-tenant scenarios
- [ ] Consider time-series database for logs (ClickHouse, TimescaleDB)

---

## ✅ Index Maintenance Checklist

### Weekly
- [ ] Review slow query log
- [ ] Check index usage statistics
- [ ] Monitor table growth

### Monthly
- [ ] Run ANALYZE TABLE on all tables
- [ ] Check for fragmentation
- [ ] Review and drop unused indexes

### Quarterly
- [ ] Evaluate new query patterns
- [ ] Test new index candidates on staging
- [ ] Update documentation

---

**Last Updated:** December 29, 2025  
**Version:** 1.0.0
