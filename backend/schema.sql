-- ============================================================================
-- Infrastructure Automation Platform - MySQL 8 Database Schema
-- ============================================================================
-- Database: infra_automation
-- Engine: InnoDB
-- Charset: utf8mb4
-- Collation: utf8mb4_unicode_ci
-- Generated: December 29, 2025
-- ============================================================================

-- Drop existing database (CAUTION: This deletes all data)
-- DROP DATABASE IF EXISTS infra_automation;

-- Create database with proper charset
CREATE DATABASE IF NOT EXISTS infra_automation
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE infra_automation;

-- ============================================================================
-- Table: users
-- Purpose: User authentication and authorization
-- ============================================================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'operator', 'viewer') NOT NULL DEFAULT 'viewer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login DATETIME NULL,
    
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='User accounts for authentication and RBAC';

-- ============================================================================
-- Table: servers
-- Purpose: Infrastructure server inventory
-- ============================================================================
CREATE TABLE servers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    os_type VARCHAR(50) NOT NULL,
    os_version VARCHAR(50) NULL,
    ssh_port INT NOT NULL DEFAULT 22,
    ssh_user VARCHAR(50) NOT NULL DEFAULT 'root',
    ssh_key_path VARCHAR(500) NULL,
    tags JSON NULL,
    environment VARCHAR(50) NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_servers_hostname (hostname),
    INDEX idx_servers_ip (ip_address),
    INDEX idx_servers_active_env (is_active, environment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Target servers for Ansible automation';

-- ============================================================================
-- Table: playbooks
-- Purpose: Ansible playbook metadata and file tracking
-- ============================================================================
CREATE TABLE playbooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64) NOT NULL COMMENT 'SHA256 checksum',
    tags JSON NULL,
    variables JSON NULL COMMENT 'Default Ansible variables',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_playbooks_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ansible playbook registry';

-- ============================================================================
-- Table: jobs
-- Purpose: Ansible job execution tracking
-- ============================================================================
CREATE TABLE jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(36) NOT NULL UNIQUE COMMENT 'UUID',
    playbook_id INT NOT NULL,
    server_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('pending', 'running', 'success', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
    celery_task_id VARCHAR(255) NULL,
    extra_vars JSON NULL COMMENT 'Runtime Ansible variables',
    error_message TEXT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_jobs_job_id (job_id),
    INDEX idx_jobs_playbook (playbook_id),
    INDEX idx_jobs_server (server_id),
    INDEX idx_jobs_user (user_id),
    INDEX idx_jobs_status (status),
    INDEX idx_jobs_celery_task (celery_task_id),
    INDEX idx_jobs_status_created (status, created_at),
    INDEX idx_jobs_user_status (user_id, status),
    
    CONSTRAINT fk_jobs_playbook FOREIGN KEY (playbook_id) 
        REFERENCES playbooks(id) ON DELETE RESTRICT,
    CONSTRAINT fk_jobs_server FOREIGN KEY (server_id) 
        REFERENCES servers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_jobs_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Ansible execution job tracking';

-- ============================================================================
-- Table: job_logs
-- Purpose: Line-by-line execution logs (high write volume)
-- ============================================================================
CREATE TABLE job_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    line_number INT NOT NULL,
    content TEXT NOT NULL,
    log_level VARCHAR(20) NULL COMMENT 'INFO, WARNING, ERROR, DEBUG',
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_joblogs_job (job_id),
    INDEX idx_joblogs_timestamp (timestamp),
    INDEX idx_joblogs_job_line (job_id, line_number),
    
    CONSTRAINT fk_joblogs_job FOREIGN KEY (job_id) 
        REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Execution logs with high insert volume';

-- ============================================================================
-- Table: tickets
-- Purpose: Operational support tickets
-- ============================================================================
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id VARCHAR(36) NOT NULL UNIQUE COMMENT 'UUID',
    job_id INT NOT NULL,
    created_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    priority ENUM('low', 'medium', 'high', 'critical') NOT NULL DEFAULT 'medium',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    
    INDEX idx_tickets_ticket_id (ticket_id),
    INDEX idx_tickets_job (job_id),
    INDEX idx_tickets_created_by (created_by),
    INDEX idx_tickets_status (status),
    INDEX idx_tickets_status_priority (status, priority),
    
    CONSTRAINT fk_tickets_job FOREIGN KEY (job_id) 
        REFERENCES jobs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tickets_user FOREIGN KEY (created_by) 
        REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Support tickets for job issues';

-- ============================================================================
-- Table: audit_logs
-- Purpose: Compliance and security audit trail
-- ============================================================================
CREATE TABLE audit_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL COMMENT 'NULL for system actions',
    action VARCHAR(100) NOT NULL COMMENT 'CREATE, UPDATE, DELETE, LOGIN, etc.',
    resource_type VARCHAR(50) NOT NULL COMMENT 'user, server, playbook, job',
    resource_id INT NULL,
    details JSON NULL COMMENT 'Additional context (old/new values)',
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_resource_type (resource_type),
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_action_timestamp (action, timestamp),
    
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Immutable audit trail for compliance';

-- ============================================================================
-- Initial Data: Admin User
-- ============================================================================
-- Password: admin123 (bcrypt hash)
-- IMPORTANT: Change this password in production!
INSERT INTO users (username, email, password_hash, role, is_active)
VALUES (
    'admin',
    'admin@example.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5ePvTpfXL6p7e',
    'admin',
    TRUE
);

-- ============================================================================
-- Performance Tuning Recommendations
-- ============================================================================

-- 1. InnoDB Buffer Pool (Set to 70-80% of RAM)
-- SET GLOBAL innodb_buffer_pool_size = 4294967296; -- 4GB

-- 2. Connection Pool
-- SET GLOBAL max_connections = 200;

-- 3. Query Cache (Disabled by default in MySQL 8)
-- Not needed - InnoDB buffer pool is more efficient

-- 4. Slow Query Log (Development only)
-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 2;

-- ============================================================================
-- Maintenance Queries
-- ============================================================================

-- Check table sizes
SELECT 
    table_name AS 'Table',
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)'
FROM information_schema.TABLES
WHERE table_schema = 'infra_automation'
ORDER BY (data_length + index_length) DESC;

-- Check index usage
SELECT 
    t.table_name,
    s.index_name,
    s.cardinality,
    s.seq_in_index
FROM information_schema.statistics s
JOIN information_schema.tables t ON s.table_name = t.table_name
WHERE s.table_schema = 'infra_automation'
ORDER BY s.table_name, s.index_name;

-- Analyze table fragmentation
SELECT 
    table_name,
    ROUND(data_length / 1024 / 1024, 2) AS 'Data (MB)',
    ROUND(data_free / 1024 / 1024, 2) AS 'Free (MB)',
    ROUND((data_free / (data_length + data_free)) * 100, 2) AS 'Fragmentation (%)'
FROM information_schema.tables
WHERE table_schema = 'infra_automation'
    AND data_free > 0;

-- ============================================================================
-- Backup Script (Example)
-- ============================================================================
-- mysqldump -u root -p --single-transaction --routines --triggers \
--   --databases infra_automation > backup_$(date +%Y%m%d_%H%M%S).sql

-- ============================================================================
-- Optimization: Partitioning job_logs (Future)
-- ============================================================================
-- ALTER TABLE job_logs
-- PARTITION BY RANGE (YEAR(timestamp) * 100 + MONTH(timestamp)) (
--     PARTITION p202401 VALUES LESS THAN (202402),
--     PARTITION p202402 VALUES LESS THAN (202403),
--     PARTITION p202403 VALUES LESS THAN (202404),
--     PARTITION pmax VALUES LESS THAN MAXVALUE
-- );

-- ============================================================================
-- End of Schema
-- ============================================================================
