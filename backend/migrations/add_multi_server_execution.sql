-- ============================================================================
-- Multi-Server Execution Feature Migration
-- ============================================================================
-- Purpose: Add support for server tags and parent-child job relationships
-- Date: February 2, 2026
-- Version: 1.1.0
-- ============================================================================

USE infra_automation;

-- Start transaction for safety
START TRANSACTION;

-- ============================================================================
-- Step 1: Add tags column to servers table (if not exists)
-- ============================================================================
-- The tags column stores an array of tags in JSON format
-- Example: ["production", "web-server", "critical"]

-- Check if column exists first (MySQL doesn't have IF NOT EXISTS for columns)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'infra_automation' 
    AND TABLE_NAME = 'servers' 
    AND COLUMN_NAME = 'tags'
);

-- Add tags column if it doesn't exist
SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE servers ADD COLUMN tags JSON NULL COMMENT "Server tags for grouping and filtering" AFTER ssh_key_path',
    'SELECT "Column tags already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Step 2: Add parent-child relationship columns to jobs table
-- ============================================================================
-- parent_job_id: Links child jobs to their parent batch job (NULL for standalone jobs)
-- is_batch_job: TRUE for parent jobs that orchestrate multiple child jobs
-- batch_config: Stores batch execution configuration (concurrent limit, stop on failure, etc.)

-- Add parent_job_id column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'infra_automation' 
    AND TABLE_NAME = 'jobs' 
    AND COLUMN_NAME = 'parent_job_id'
);

SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE jobs ADD COLUMN parent_job_id INT NULL COMMENT "Parent batch job ID (NULL for standalone jobs)" AFTER id',
    'SELECT "Column parent_job_id already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_batch_job column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'infra_automation' 
    AND TABLE_NAME = 'jobs' 
    AND COLUMN_NAME = 'is_batch_job'
);

SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE jobs ADD COLUMN is_batch_job BOOLEAN NOT NULL DEFAULT FALSE COMMENT "TRUE for parent batch jobs" AFTER parent_job_id',
    'SELECT "Column is_batch_job already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add batch_config column
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'infra_automation' 
    AND TABLE_NAME = 'jobs' 
    AND COLUMN_NAME = 'batch_config'
);

SET @sql = IF(
    @col_exists = 0,
    'ALTER TABLE jobs ADD COLUMN batch_config JSON NULL COMMENT "Batch execution settings (concurrent_limit, stop_on_failure)" AFTER is_batch_job',
    'SELECT "Column batch_config already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Step 3: Add foreign key constraint for parent-child relationship
-- ============================================================================
-- This ensures data integrity for batch jobs

SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = 'infra_automation'
    AND TABLE_NAME = 'jobs'
    AND CONSTRAINT_NAME = 'fk_jobs_parent'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(
    @fk_exists = 0,
    'ALTER TABLE jobs ADD CONSTRAINT fk_jobs_parent FOREIGN KEY (parent_job_id) REFERENCES jobs(id) ON DELETE CASCADE',
    'SELECT "Foreign key fk_jobs_parent already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Step 4: Add indexes for performance optimization
-- ============================================================================

-- Index for finding child jobs of a parent
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'infra_automation'
    AND TABLE_NAME = 'jobs'
    AND INDEX_NAME = 'idx_jobs_parent'
);

SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_jobs_parent ON jobs(parent_job_id)',
    'SELECT "Index idx_jobs_parent already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for filtering batch jobs
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = 'infra_automation'
    AND TABLE_NAME = 'jobs'
    AND INDEX_NAME = 'idx_jobs_batch'
);

SET @sql = IF(
    @idx_exists = 0,
    'CREATE INDEX idx_jobs_batch ON jobs(is_batch_job)',
    'SELECT "Index idx_jobs_batch already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Step 5: Update existing data (set defaults)
-- ============================================================================

-- Set default empty tags for existing servers (if tags column was just added)
UPDATE servers SET tags = JSON_ARRAY() WHERE tags IS NULL;

-- Set is_batch_job to FALSE for all existing jobs (if column was just added)
UPDATE jobs SET is_batch_job = FALSE WHERE is_batch_job IS NULL;

-- ============================================================================
-- Commit transaction
-- ============================================================================
COMMIT;

-- ============================================================================
-- Verification Queries
-- ============================================================================
-- Run these to verify the migration was successful

SELECT 'Migration completed successfully!' AS status;

-- Show updated servers table structure
DESCRIBE servers;

-- Show updated jobs table structure
DESCRIBE jobs;

-- Show indexes on jobs table
SHOW INDEXES FROM jobs WHERE Key_name IN ('idx_jobs_parent', 'idx_jobs_batch');

-- Count servers with tags
SELECT 
    COUNT(*) as total_servers,
    SUM(CASE WHEN tags IS NOT NULL AND JSON_LENGTH(tags) > 0 THEN 1 ELSE 0 END) as servers_with_tags
FROM servers;

-- Count batch jobs
SELECT 
    COUNT(*) as total_jobs,
    SUM(CASE WHEN is_batch_job = TRUE THEN 1 ELSE 0 END) as batch_jobs,
    SUM(CASE WHEN parent_job_id IS NOT NULL THEN 1 ELSE 0 END) as child_jobs
FROM jobs;

-- ============================================================================
-- Rollback Instructions (if needed)
-- ============================================================================
/*
-- CAUTION: Only run this if you need to undo the migration

START TRANSACTION;

-- Remove foreign key
ALTER TABLE jobs DROP FOREIGN KEY fk_jobs_parent;

-- Remove indexes
DROP INDEX idx_jobs_parent ON jobs;
DROP INDEX idx_jobs_batch ON jobs;

-- Remove columns from jobs table
ALTER TABLE jobs DROP COLUMN batch_config;
ALTER TABLE jobs DROP COLUMN is_batch_job;
ALTER TABLE jobs DROP COLUMN parent_job_id;

-- Remove tags column from servers table
ALTER TABLE servers DROP COLUMN tags;

COMMIT;
*/
