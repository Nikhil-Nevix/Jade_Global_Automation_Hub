-- Migration: Add Notifications System
-- Date: 2026-02-02
-- Description: Adds notifications, notification_preferences tables and related functionality

-- =====================================================================
-- 1. Create notifications table
-- =====================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
    event_type VARCHAR(100) NOT NULL COMMENT 'job_success, job_failure, batch_complete, server_failure, high_cpu, user_change, playbook_update, system_alert',
    related_entity_type VARCHAR(50) NULL COMMENT 'job, server, user, playbook, system',
    related_entity_id INT NULL,
    is_read BOOLEAN DEFAULT 0,
    read_at DATETIME NULL,
    channels_sent JSON COMMENT 'Array of channels: ["in_app", "email", "browser_push"]',
    metadata JSON COMMENT 'Additional context data',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL COMMENT 'Auto-dismiss timestamp',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_notifications (user_id, created_at DESC),
    INDEX idx_unread_notifications (user_id, is_read),
    INDEX idx_event_type (event_type),
    INDEX idx_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. Create notification_preferences table
-- =====================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    in_app_enabled BOOLEAN DEFAULT 1,
    email_enabled BOOLEAN DEFAULT 0,
    browser_push_enabled BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_event (user_id, event_type),
    INDEX idx_user_prefs (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3. Add email configuration to users table (if not exists)
-- =====================================================================

-- Check if email column exists, if not add it
-- Note: Some systems may already have email in users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT 0;

-- =====================================================================
-- 4. Insert default notification preferences for all existing users
-- =====================================================================

-- Default preferences for all event types
INSERT INTO notification_preferences (user_id, event_type, in_app_enabled, email_enabled, browser_push_enabled)
SELECT 
    u.id,
    event_type,
    1, -- in_app enabled by default
    CASE 
        WHEN event_type IN ('job_failure', 'batch_complete', 'server_failure', 'system_alert') THEN 1
        ELSE 0
    END, -- email enabled for critical events
    0 -- browser_push disabled by default
FROM users u
CROSS JOIN (
    SELECT 'job_success' AS event_type
    UNION SELECT 'job_failure'
    UNION SELECT 'batch_complete'
    UNION SELECT 'server_failure'
    UNION SELECT 'high_cpu'
    UNION SELECT 'user_change'
    UNION SELECT 'playbook_update'
    UNION SELECT 'system_alert'
) events
ON DUPLICATE KEY UPDATE id=id; -- Ignore if already exists

-- =====================================================================
-- 5. Verification queries
-- =====================================================================

-- Verify notifications table structure
SELECT 'Notifications table structure:' AS info;
DESCRIBE notifications;

-- Verify notification_preferences table structure
SELECT 'Notification Preferences table structure:' AS info;
DESCRIBE notification_preferences;

-- Count default preferences created
SELECT 'Default preferences count:' AS info;
SELECT COUNT(*) AS total_preferences FROM notification_preferences;

-- Show sample preferences
SELECT 'Sample notification preferences:' AS info;
SELECT 
    np.user_id,
    u.username,
    np.event_type,
    np.in_app_enabled,
    np.email_enabled,
    np.browser_push_enabled
FROM notification_preferences np
JOIN users u ON np.user_id = u.id
LIMIT 10;

-- =====================================================================
-- Migration complete
-- =====================================================================

SELECT 'Notification system migration completed successfully!' AS status;
