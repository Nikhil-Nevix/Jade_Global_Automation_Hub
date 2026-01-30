-- Migration: Add Playbook Audit Logs Table
-- Description: Track all changes made to playbooks including create, update, delete operations
-- Date: 2026-01-28

CREATE TABLE IF NOT EXISTS playbook_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    playbook_id INT NOT NULL,
    playbook_name VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    action ENUM('created', 'updated', 'deleted', 'uploaded', 'replaced') NOT NULL,
    old_content TEXT,
    new_content TEXT,
    changes_description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_playbook_id (playbook_id),
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
