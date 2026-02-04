-- Migration: Add Folder Upload Support for Playbooks
-- Date: 2026-02-03
-- Description: Extends playbooks table to support both single-file and folder-based playbook uploads

-- Add new columns to playbooks table
ALTER TABLE playbooks
ADD COLUMN is_folder BOOLEAN DEFAULT FALSE COMMENT 'TRUE if playbook is a folder structure, FALSE for single file',
ADD COLUMN main_playbook_file VARCHAR(255) DEFAULT NULL COMMENT 'Relative path to main playbook file within folder (e.g., site.yml or playbooks/main.yml)',
ADD COLUMN file_structure JSON DEFAULT NULL COMMENT 'JSON tree structure of all files in the playbook folder',
ADD COLUMN file_count INT DEFAULT 1 COMMENT 'Total number of files in the playbook (1 for single file)',
ADD COLUMN total_size_kb INT DEFAULT 0 COMMENT 'Total size of all files in KB';

-- Update existing single-file playbooks to have proper defaults
UPDATE playbooks
SET 
    is_folder = FALSE,
    main_playbook_file = NULL,
    file_structure = NULL,
    file_count = 1,
    total_size_kb = 0
WHERE is_folder IS NULL;

-- Add index for faster folder/file filtering
CREATE INDEX idx_playbooks_is_folder ON playbooks(is_folder);

-- Verification queries
SELECT 'Migration completed successfully' AS status;
SELECT COUNT(*) AS total_playbooks, 
       SUM(CASE WHEN is_folder = TRUE THEN 1 ELSE 0 END) AS folder_playbooks,
       SUM(CASE WHEN is_folder = FALSE THEN 1 ELSE 0 END) AS single_file_playbooks
FROM playbooks;
