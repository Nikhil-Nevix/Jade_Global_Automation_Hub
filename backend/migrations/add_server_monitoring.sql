-- Migration: Add monitoring columns to servers table
-- Date: 2026-01-14
-- Description: Add cpu_usage, memory_usage, disk_usage, and last_monitored columns

ALTER TABLE servers
ADD COLUMN cpu_usage FLOAT DEFAULT 0.0 COMMENT 'CPU usage percentage (0-100)',
ADD COLUMN memory_usage FLOAT DEFAULT 0.0 COMMENT 'Memory usage percentage (0-100)',
ADD COLUMN disk_usage FLOAT DEFAULT 0.0 COMMENT 'Disk usage percentage (0-100)',
ADD COLUMN last_monitored DATETIME DEFAULT NULL COMMENT 'Last time metrics were updated';

-- Update existing servers to have 0 usage
UPDATE servers SET cpu_usage = 0.0, memory_usage = 0.0, disk_usage = 0.0 WHERE cpu_usage IS NULL;
