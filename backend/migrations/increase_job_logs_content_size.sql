-- ============================================================================
-- Migration: Increase job_logs.content column size
-- Purpose: Fix "Data too long for column 'content'" error for verbose Ansible logs
-- Date: 2026-02-09
-- ============================================================================

USE infra_automation;

-- Increase content column from TEXT (64KB) to MEDIUMTEXT (16MB)
ALTER TABLE job_logs 
MODIFY COLUMN content MEDIUMTEXT NOT NULL;

-- Verify the change
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH,
    COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'infra_automation' 
  AND TABLE_NAME = 'job_logs' 
  AND COLUMN_NAME = 'content';
