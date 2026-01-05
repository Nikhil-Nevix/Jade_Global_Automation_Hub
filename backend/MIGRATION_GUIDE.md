# 🔄 Database Migration Guide

## Overview

This guide covers database setup, migrations, and schema evolution for the Infrastructure Automation Platform.

---

## 📋 Prerequisites

- MySQL 8.0+ installed
- Python 3.11+ with virtual environment
- Flask-Migrate installed
- Database credentials configured in `.env`

---

## 🚀 Initial Setup

### Step 1: Create MySQL Database

```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Create database user
CREATE USER 'infra_user'@'localhost' IDENTIFIED BY 'secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON infra_automation.* TO 'infra_user'@'localhost';
FLUSH PRIVILEGES;

# Exit MySQL
EXIT;
```

### Step 2: Configure Environment

Edit `backend/.env`:

```env
# Database Configuration
DATABASE_URL=mysql+pymysql://infra_user:secure_password@localhost:3306/infra_automation?charset=utf8mb4

# Or using components
DB_HOST=localhost
DB_PORT=3306
DB_NAME=infra_automation
DB_USER=infra_user
DB_PASSWORD=secure_password
```

### Step 3: Initialize Flask-Migrate

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Initialize migration repository (first time only)
flask db init

# This creates the migrations/ directory structure
```

### Step 4: Create Initial Migration

```bash
# Generate migration from models
flask db migrate -m "Initial schema - users, servers, playbooks, jobs, job_logs, tickets, audit_logs"

# Review the generated migration file
# Location: migrations/versions/xxxx_initial_schema.py
```

### Step 5: Apply Migration

```bash
# Apply migration to database
flask db upgrade

# Verify tables created
mysql -u infra_user -p infra_automation -e "SHOW TABLES;"
```

---

## 🗄️ Database Schema Commands

### Using Flask CLI

```bash
# Initialize database (creates all tables)
flask init-db

# Create admin user
flask create-admin

# Seed sample data
flask seed-data

# Check database connection
flask db-status
```

### Using Raw SQL

```bash
# Import schema directly (alternative to migrations)
mysql -u infra_user -p infra_automation < schema.sql

# Export current schema
mysqldump -u infra_user -p --no-data infra_automation > schema_export.sql
```

---

## 📊 Migration Workflow

### Creating a New Migration

**Scenario:** Adding a new column to `servers` table

1. **Update Model**

```python
# app/models.py
class Server(db.Model):
    # ... existing fields ...
    location = db.Column(db.String(100), nullable=True)  # New field
```

2. **Generate Migration**

```bash
flask db migrate -m "Add location column to servers table"
```

3. **Review Migration**

```python
# migrations/versions/xxxx_add_location_column.py
def upgrade():
    op.add_column('servers', sa.Column('location', sa.String(length=100), nullable=True))

def downgrade():
    op.drop_column('servers', 'location')
```

4. **Apply Migration**

```bash
flask db upgrade
```

### Reverting a Migration

```bash
# Rollback last migration
flask db downgrade

# Rollback to specific version
flask db downgrade <revision_id>

# Check current version
flask db current

# View migration history
flask db history
```

---

## 🔍 Verification & Testing

### Check Table Structure

```sql
-- Describe users table
DESC users;

-- Show indexes on jobs table
SHOW INDEX FROM jobs;

-- Show foreign keys
SELECT 
    TABLE_NAME, 
    COLUMN_NAME, 
    CONSTRAINT_NAME, 
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'infra_automation'
    AND REFERENCED_TABLE_NAME IS NOT NULL;
```

### Verify Relationships

```python
# In Flask shell
flask shell

>>> from app.models import User, Server, Job
>>> user = User.query.first()
>>> user.jobs.count()
>>> job = Job.query.first()
>>> job.user
>>> job.server
>>> job.playbook
```

### Test Data Integrity

```sql
-- Test foreign key constraints
INSERT INTO jobs (job_id, playbook_id, server_id, user_id, status)
VALUES ('test-uuid', 999, 999, 999, 'pending');
-- Should fail with foreign key constraint error

-- Test unique constraints
INSERT INTO users (username, email, password_hash, role)
VALUES ('admin', 'duplicate@example.com', 'hash', 'admin');
-- Should fail with duplicate key error

-- Test enum constraints
INSERT INTO jobs (job_id, playbook_id, server_id, user_id, status)
VALUES ('test-uuid-2', 1, 1, 1, 'invalid_status');
-- Should fail with invalid enum value
```

---

## 🛠️ Common Migration Patterns

### Adding an Index

```python
def upgrade():
    op.create_index(
        'idx_jobs_completed_at',
        'jobs',
        ['completed_at'],
        unique=False
    )

def downgrade():
    op.drop_index('idx_jobs_completed_at', table_name='jobs')
```

### Modifying Column Type

```python
def upgrade():
    # MySQL requires explicit type change
    op.alter_column(
        'servers',
        'description',
        existing_type=sa.String(500),
        type_=sa.Text(),
        existing_nullable=True
    )

def downgrade():
    op.alter_column(
        'servers',
        'description',
        existing_type=sa.Text(),
        type_=sa.String(500),
        existing_nullable=True
    )
```

### Adding Foreign Key

```python
def upgrade():
    op.add_column('servers', sa.Column('created_by', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_servers_created_by',
        'servers', 'users',
        ['created_by'], ['id'],
        ondelete='SET NULL'
    )

def downgrade():
    op.drop_constraint('fk_servers_created_by', 'servers', type_='foreignkey')
    op.drop_column('servers', 'created_by')
```

### Data Migration (Seeding)

```python
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

def upgrade():
    # Create temporary table reference
    environments = table('environments',
        column('id', sa.Integer),
        column('name', sa.String),
        column('description', sa.String)
    )
    
    # Insert data
    op.bulk_insert(environments, [
        {'id': 1, 'name': 'development', 'description': 'Dev environment'},
        {'id': 2, 'name': 'staging', 'description': 'Staging environment'},
        {'id': 3, 'name': 'production', 'description': 'Production environment'}
    ])

def downgrade():
    op.execute("DELETE FROM environments WHERE id IN (1, 2, 3)")
```

---

## 🔒 Production Migration Best Practices

### Pre-Migration Checklist

- [ ] Backup database before migration
- [ ] Test migration on staging environment
- [ ] Review generated SQL (use `--sql` flag)
- [ ] Check for data loss risks
- [ ] Estimate downtime if required
- [ ] Prepare rollback plan
- [ ] Notify stakeholders

### Safe Migration Steps

```bash
# 1. Backup database
mysqldump -u infra_user -p infra_automation > backup_pre_migration_$(date +%Y%m%d).sql

# 2. Test migration on staging
flask db upgrade --sql > migration_preview.sql
cat migration_preview.sql  # Review SQL

# 3. Apply to staging
FLASK_ENV=staging flask db upgrade

# 4. Verify staging
flask db-status
# Run integration tests

# 5. Apply to production (maintenance window)
FLASK_ENV=production flask db upgrade

# 6. Verify production
flask db-status
# Run smoke tests

# 7. Backup after migration
mysqldump -u infra_user -p infra_automation > backup_post_migration_$(date +%Y%m%d).sql
```

### Zero-Downtime Migrations

For production systems requiring zero downtime:

1. **Backward Compatible Changes**
   - Add nullable columns first
   - Populate data in background
   - Make non-nullable in separate migration

2. **Blue-Green Deployment**
   - Deploy new version alongside old
   - Migrate when both versions support schema

3. **Expand-Contract Pattern**
   - Phase 1: Add new column (expand)
   - Phase 2: Dual-write to old and new
   - Phase 3: Migrate data
   - Phase 4: Update code to read new column
   - Phase 5: Remove old column (contract)

---

## 📈 Performance Considerations

### Large Table Migrations

For tables with millions of rows (e.g., `job_logs`):

```python
def upgrade():
    # Use pt-online-schema-change for large tables
    # This tool from Percona performs migrations without locking
    
    # Example: Add index without blocking writes
    op.execute("""
        pt-online-schema-change 
        --alter "ADD INDEX idx_new_field (new_field)" 
        D=infra_automation,t=job_logs 
        --execute
    """)
```

### Partition Management

```sql
-- Create partitioned table (job_logs example)
CREATE TABLE job_logs_partitioned LIKE job_logs;

ALTER TABLE job_logs_partitioned
PARTITION BY RANGE (YEAR(timestamp) * 100 + MONTH(timestamp)) (
    PARTITION p202401 VALUES LESS THAN (202402),
    PARTITION p202402 VALUES LESS THAN (202403),
    PARTITION p202403 VALUES LESS THAN (202404),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- Migrate data in batches
INSERT INTO job_logs_partitioned SELECT * FROM job_logs WHERE timestamp < '2024-02-01';
-- ... continue for each partition ...

-- Swap tables
RENAME TABLE 
    job_logs TO job_logs_old,
    job_logs_partitioned TO job_logs;
```

---

## 🚨 Troubleshooting

### Migration Fails

**Symptom:** Migration errors during `flask db upgrade`

**Solutions:**

```bash
# Check current state
flask db current

# View pending migrations
flask db show

# Force stamp (use with caution)
flask db stamp head

# Manual fix
flask shell
>>> from app import db
>>> db.session.rollback()
>>> exit()
```

### Alembic Version Conflicts

**Symptom:** Multiple migration heads

```bash
# Check for multiple heads
flask db heads

# Merge migration branches
flask db merge heads -m "Merge migration branches"
flask db upgrade
```

### Foreign Key Constraint Errors

**Symptom:** Cannot drop table due to foreign keys

```sql
-- Disable foreign key checks (CAUTION!)
SET FOREIGN_KEY_CHECKS = 0;

-- Perform operation
DROP TABLE table_name;

-- Re-enable checks
SET FOREIGN_KEY_CHECKS = 1;
```

---

## 📚 Additional Resources

### Flask-Migrate Commands Reference

```bash
flask db --help                 # Show all commands
flask db current               # Show current revision
flask db history               # Show migration history
flask db show <revision>       # Show migration details
flask db upgrade              # Apply migrations
flask db downgrade            # Revert migrations
flask db stamp <revision>     # Set version without running migration
flask db migrate              # Auto-generate migration
flask db revision             # Create empty migration
flask db merge                # Merge migration branches
flask db heads                # Show current heads
```

### Useful SQL Queries

```sql
-- Check table sizes
SELECT 
    table_name,
    table_rows,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'infra_automation'
ORDER BY (data_length + index_length) DESC;

-- Check index cardinality
SELECT 
    table_name,
    index_name,
    cardinality,
    non_unique
FROM information_schema.STATISTICS
WHERE table_schema = 'infra_automation'
ORDER BY table_name, index_name;

-- Find unused indexes
SELECT 
    object_schema,
    object_name,
    index_name
FROM performance_schema.table_io_waits_summary_by_index_usage
WHERE index_name IS NOT NULL
    AND count_star = 0
    AND object_schema = 'infra_automation'
ORDER BY object_name, index_name;
```

---

## ✅ Migration Checklist

### Development
- [ ] Models updated in `app/models.py`
- [ ] Migration generated: `flask db migrate`
- [ ] Migration reviewed manually
- [ ] Upgrade/downgrade tested locally
- [ ] Documentation updated

### Staging
- [ ] Database backed up
- [ ] Migration applied successfully
- [ ] Integration tests pass
- [ ] Performance validated

### Production
- [ ] Maintenance window scheduled
- [ ] Stakeholders notified
- [ ] Database backed up
- [ ] Rollback plan prepared
- [ ] Migration applied
- [ ] Smoke tests pass
- [ ] Monitoring confirmed healthy
- [ ] Post-migration backup created

---

**Last Updated:** December 29, 2025  
**Schema Version:** 1.0.0
