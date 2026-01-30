-- Migration: Remove unused sudo_password and require_sudo columns
-- Date: 2026-01-30
-- Reason: These columns were never implemented in the application.
--         The system relies on passwordless sudo or SSH key-based authentication.

-- Drop unused columns from servers table
ALTER TABLE servers 
DROP COLUMN sudo_password,
DROP COLUMN require_sudo;

-- This migration removes:
-- 1. sudo_password (VARCHAR(255)) - Was intended for encrypted sudo passwords
-- 2. require_sudo (TINYINT(1)) - Was intended to flag sudo requirement

-- Note: No data loss as these columns were always NULL/0 (never used)
