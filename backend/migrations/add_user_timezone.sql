-- Migration: Add timezone column to users table
-- Description: Adds timezone preference field for each user (default: UTC)
-- Date: 2024

ALTER TABLE users ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'UTC' AFTER is_active;
