-- Migration: Add Patch Report Storage
-- Date: 2026-02-09
-- Description: Adds patch_report column to jobs table for storing patch version comparison CSV data

-- =====================================================================
-- Add patch_report column to jobs table
-- =====================================================================

ALTER TABLE jobs 
ADD COLUMN patch_report LONGTEXT NULL 
COMMENT 'CSV data: Package,Old Version,New Version,Status' 
AFTER error_message;

-- =====================================================================
-- Verification Query
-- =====================================================================
-- SELECT COLUMN_NAME, DATA_TYPE, COLUMN_COMMENT 
-- FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'infra_automation' 
-- AND TABLE_NAME = 'jobs' 
-- AND COLUMN_NAME = 'patch_report';
