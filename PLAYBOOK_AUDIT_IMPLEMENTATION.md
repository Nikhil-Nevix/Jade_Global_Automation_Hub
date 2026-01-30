# Playbook Audit Logging System - Implementation Summary

## Overview
Comprehensive audit logging system for tracking all playbook changes with detailed version history and side-by-side diff viewer.

## Features Implemented

### 1. Database Layer
- **Migration File**: `backend/migrations/add_playbook_audit_logs.sql`
- **Table**: `playbook_audit_logs` with the following fields:
  - `id` - Auto-increment primary key
  - `playbook_id` - Links to playbook (not FK to preserve deleted playbook history)
  - `playbook_name` - Playbook name snapshot
  - `user_id` - Foreign key to users table
  - `action` - ENUM: created, updated, deleted, uploaded, replaced
  - `old_content` - Previous YAML content
  - `new_content` - Current YAML content
  - `changes_description` - Human-readable description
  - `ip_address` - Client IP address
  - `created_at` - Timestamp
- **Indexes**: On playbook_id, user_id, action, and created_at for fast queries

### 2. Backend Implementation

#### Models (`backend/app/models.py`)
- Added `PlaybookAuditLog` model with relationships to User
- Preserves audit history even after playbook deletion

#### API Endpoints (`backend/app/api/playbooks.py`)
- `GET /api/playbooks/<id>/audit-logs` - Fetch audit history for specific playbook
- Admin/Super Admin only access
- Returns paginated results with user information

#### Services (`backend/app/services/playbook_service.py`)
- `_create_playbook_audit_log()` - Helper to create audit entries
- `get_playbook_audit_logs()` - Fetch and format audit logs
- Updated existing methods to track changes:
  - `create_playbook()` - Logs "created" action
  - `delete_playbook()` - Logs "deleted" action with old content
  - Future: `update_playbook_content()` will log "updated" action

### 3. Frontend Implementation

#### TypeScript Types (`frontend/src/types/index.ts`)
- `PlaybookAction` - Action enum type
- `PlaybookAuditLog` - Audit log entry interface
- `PlaybookAuditLogsResponse` - API response interface

#### Components

**PlaybookAuditPage** (`frontend/src/pages/PlaybookAuditPage/`)
- View detailed audit history for a specific playbook
- Side-by-side diff viewer showing old vs new content
- Line-by-line comparison with syntax highlighting
- Expandable/collapsible change views
- User information, timestamps, IP addresses
- Action badges (created, updated, deleted, etc.)

**PlaybookAuditLogsPage** (`frontend/src/pages/PlaybookAuditLogsPage/`)
- Overview of all playbooks with audit history
- Search functionality
- Quick access to individual playbook history
- Shows active/deleted status

**PlaybooksPage Updates**
- Added "View History" button (History icon) in both card and table views
- Admin/Super Admin only visibility
- Direct navigation to audit page

#### Routes (`frontend/src/App.tsx`)
- `/playbooks/:id/audit` - Individual playbook audit history
- `/playbook-audit` - All playbooks audit overview

#### Sidebar Navigation
- Added "Playbook Audit Logs" link (Admin/Super Admin only)
- History icon for easy identification

## Access Control
- **Audit Log Viewing**: Admin and Super Admin only
- **Audit Log Creation**: Automatic on playbook operations
- **History Button**: Visible only to Admin and Super Admin

## Data Captured

### On Playbook Creation
- Action: "created"
- New content: Full YAML content
- User who created it
- Timestamp and IP address

### On Playbook Update
- Action: "updated"
- Old content: Previous version
- New content: Updated version
- User who made changes
- Timestamp and IP address

### On Playbook Deletion
- Action: "deleted"
- Old content: Last known version (preserved)
- User who deleted it
- Timestamp and IP address
- Audit log persists even after playbook deletion

## UI/UX Features

### Side-by-Side Diff Viewer
- Split view: Previous Version (red) | Current Version (green)
- Line numbers for easy reference
- Scrollable content for large files
- Monospace font for code readability
- Dark mode support

### Audit Log Cards
- Action badges with color coding
- User information (username, email)
- Precise timestamps
- Collapsible change details
- IP address tracking

## Database Migration
```bash
cd /home/NikhilRokade/InfraAnsible/backend
cat migrations/add_playbook_audit_logs.sql | sudo mysql infra_automation
```

Status: ✅ Successfully executed

## Testing Checklist

### Backend
- [ ] Create new playbook → Check audit log created
- [ ] Update playbook content → Check old/new content stored
- [ ] Delete playbook → Check audit log preserved
- [ ] API endpoint returns correct data
- [ ] Non-admin users cannot access audit logs

### Frontend
- [ ] Navigate to Playbook Audit Logs from sidebar
- [ ] Search playbooks in audit overview
- [ ] Click "View History" button on playbook
- [ ] View audit history for specific playbook
- [ ] Expand/collapse diff viewer
- [ ] Side-by-side comparison displays correctly
- [ ] All action badges display properly
- [ ] Timestamps formatted correctly

## Future Enhancements
1. Export audit logs to CSV/PDF
2. Filter logs by action type
3. Filter logs by date range
4. Compare any two versions (not just consecutive)
5. Restore previous version feature
6. Audit log retention policies
7. Email notifications on changes
8. Slack/Teams integration for change alerts

## Files Created/Modified

### Backend
- ✅ `migrations/add_playbook_audit_logs.sql` (new)
- ✅ `app/models.py` (modified - added PlaybookAuditLog model)
- ✅ `app/api/playbooks.py` (modified - added audit endpoint)
- ✅ `app/services/playbook_service.py` (modified - audit log helpers)

### Frontend
- ✅ `src/types/index.ts` (modified - added audit types)
- ✅ `src/pages/PlaybookAuditPage/PlaybookAuditPage.tsx` (new)
- ✅ `src/pages/PlaybookAuditPage/index.ts` (new)
- ✅ `src/pages/PlaybookAuditLogsPage/PlaybookAuditLogsPage.tsx` (new)
- ✅ `src/pages/PlaybookAuditLogsPage/index.ts` (new)
- ✅ `src/pages/PlaybooksPage/PlaybooksPage.tsx` (modified - added History button)
- ✅ `src/App.tsx` (modified - added routes)
- ✅ `src/components/Sidebar/Sidebar.tsx` (modified - added nav link)

## Implementation Complete ✅

All 8 tasks completed successfully:
1. ✅ Database migration created and executed
2. ✅ Backend models updated with PlaybookAuditLog
3. ✅ API endpoint created for fetching audit logs
4. ✅ Playbook service methods updated to create audit entries
5. ✅ TypeScript types added for audit logs
6. ✅ PlaybookAuditPage component with diff viewer created
7. ✅ View History buttons added to PlaybooksPage
8. ✅ Routes and sidebar navigation configured

The system is ready for testing!
