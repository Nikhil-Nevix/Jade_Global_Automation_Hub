# Interactive Patch Management System

## Overview

The Interactive Patch Management System allows administrators to check for available system patches on servers and selectively apply updates through an intuitive GUI interface.

## Features

### ✅ Implemented Features

1. **Server-Based Patch Checking**
   - Select any registered server from dropdown
   - Synchronous patch check (5-10 seconds)
   - Uses Ansible ad-hoc commands to query `yum check-update`
   - Displays real-time feedback during check

2. **Interactive Patch Selection**
   - Table view with all available patches
   - Checkbox selection for individual patches
   - "Select All" / "Deselect All" functionality
   - Shows package name, architecture, available version, and repository
   - Selection counter shows how many patches selected

3. **Asynchronous Patch Application**
   - Creates standard Job workflow for patch application
   - Generates temporary Ansible playbook with selected packages
   - Tracks execution through existing Jobs page
   - Audit trail via standard job logging

4. **Role-Based Access Control**
   - Available only to `admin` and `super_admin` roles
   - Uses existing `@admin_required` decorator
   - Enforced at both API and UI levels

5. **User Experience**
   - Clean, intuitive interface matching existing design system
   - Success/error notifications
   - Option to navigate to Jobs page after submission
   - Server information display
   - Empty states and loading indicators

## Architecture

### Backend Components

#### 1. Patch Service (`/backend/app/services/patch_service.py`)
```python
class PatchService:
    - check_patches(server_id, server_hostname, server_ip)
      → Runs ansible ad-hoc to check for updates
      → Parses yum output into structured data
      → Returns list of patches
    
    - _parse_yum_output(output)
      → Parses yum check-update format
      → Extracts package, version, repo, architecture
    
    - generate_patch_playbook(patches, server_id)
      → Creates Ansible playbook for selected patches
      → Returns playbook file path
```

#### 2. Patch API (`/backend/app/api/patches.py`)
```python
Routes:
- POST /api/patches/check/<server_id>
  → Synchronous endpoint
  → Checks for available patches
  → Returns JSON with patch list
  
- POST /api/patches/apply
  → Asynchronous endpoint
  → Creates Job for patch application
  → Generates playbook and executes via Celery
  → Returns job details
```

### Frontend Components

#### 1. Patch Management Page (`/frontend/src/pages/PatchManagement/PatchManagement.tsx`)
- Server selection dropdown
- "Check for Patches" button
- Patches table with checkboxes
- "Apply Selected Patches" button
- Real-time state management
- Success/error messaging

#### 2. Patch API Client (`/frontend/src/api/patches.ts`)
- TypeScript interfaces for type safety
- API methods for check and apply
- Axios-based HTTP client

## User Workflow

### Step 1: Access Patch Management
1. Login as admin or super_admin user
2. Navigate to "Patch Management" from sidebar
3. System displays server selection interface

### Step 2: Check for Patches
1. Select target server from dropdown
2. Click "Check for Patches" button
3. Wait 5-10 seconds (synchronous check)
4. System displays available patches in table

### Step 3: Select Patches
1. Review available patches in table
2. Use checkboxes to select desired patches
   - Click individual checkboxes for specific patches
   - Use "Select All" checkbox to select/deselect all
3. Counter shows number of selected patches

### Step 4: Apply Patches
1. Click "Apply Selected Patches (N)" button
2. System creates a Job and starts execution
3. Optional: Navigate to Jobs page to monitor progress
4. Check job logs for detailed execution output

## Technical Details

### Patch Check Process

**Command Executed:**
```bash
ansible <server_ip> -i <server_ip>, -m shell \
  -a 'yum check-update --quiet || true' \
  -u root --become
```

**Parsing Logic:**
- Skips header lines and metadata
- Extracts package.architecture, version, repository
- Returns structured JSON array

**Example Output Format:**
```json
{
  "success": true,
  "server": {
    "id": 1,
    "hostname": "web-server-01",
    "ip_address": "192.168.1.100"
  },
  "patches": [
    {
      "package": "vim-enhanced",
      "architecture": "x86_64",
      "current_version": "unknown",
      "available_version": "2:8.0.1763-16.el8",
      "repository": "baseos",
      "full_name": "vim-enhanced.x86_64"
    }
  ],
  "total_count": 1
}
```

### Patch Application Process

**Generated Playbook:**
```yaml
- name: Apply Selected Patches
  hosts: all
  become: True
  tasks:
    - name: Update package: vim-enhanced
      yum:
        name: vim-enhanced
        state: latest
    - name: Update package: kernel
      yum:
        name: kernel
        state: latest
```

**Execution:**
1. Playbook saved to `PLAYBOOK_DIR/patch_apply_server{id}_{timestamp}.yml`
2. Playbook record created/updated in database
3. Job created with playbook and server association
4. Celery task executes via ansible-runner
5. Job logs capture all output

## Permissions

- **super_admin**: Full access
- **admin**: Full access
- **user**: No access (feature not visible in sidebar)

## Design Decisions (POC Level)

1. **No Database Tables**: Patches are not persisted, generated on-demand
2. **Single Server**: One server at a time for simplicity
3. **Synchronous Check**: Immediate feedback vs job-based workflow
4. **Standard Jobs**: Reuses existing job infrastructure
5. **Temporary Playbooks**: Auto-generated, not manually created

## Future Enhancements (Out of Scope for POC)

- [ ] Multi-server patch management
- [ ] Scheduled patch maintenance windows
- [ ] Patch history and rollback capability
- [ ] CVE severity ratings integration
- [ ] Patch dependency analysis
- [ ] Pre-check validation (disk space, services)
- [ ] Email notifications for patch availability
- [ ] Patch exclusion rules
- [ ] Current version display (requires additional ansible task)

## Testing the Feature

### Prerequisites
1. Backend and Celery running
2. At least one server configured
3. Server accessible via Ansible (SSH key configured)
4. Admin or super_admin user account

### Test Scenario 1: Check Patches
```bash
# Ensure server has updates available
ssh user@server
sudo yum check-update

# In application:
1. Login as admin
2. Go to Patch Management
3. Select server
4. Click "Check for Patches"
5. Verify patches display correctly
```

### Test Scenario 2: Apply Patches
```bash
# In application:
1. Check patches (as above)
2. Select 1-2 non-critical patches (avoid kernel for testing)
3. Click "Apply Selected Patches"
4. Navigate to Jobs page
5. Monitor job execution
6. Verify job completes successfully
7. SSH to server and verify packages updated
```

### Test Scenario 3: Empty State
```bash
# On server with no updates:
ssh user@server
sudo yum update -y  # Update everything first

# In application:
1. Check patches
2. Verify "No patches available" message
```

## API Documentation

### Check Patches
**Endpoint:** `POST /api/patches/check/<server_id>`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "server": {
    "id": 1,
    "hostname": "web-01",
    "ip_address": "192.168.1.100"
  },
  "patches": [...],
  "total_count": 5
}
```

### Apply Patches
**Endpoint:** `POST /api/patches/apply`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**
```json
{
  "server_id": 1,
  "patches": ["vim-enhanced", "openssl"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Patch application job created for 2 package(s)",
  "job": {
    "id": 42,
    "job_id": "job_20260204_123456",
    "status": "pending"
  },
  "patches_count": 2
}
```

## Troubleshooting

### Issue: "Failed to check patches"
**Cause:** Ansible cannot connect to server
**Solution:** 
- Verify SSH connectivity
- Check SSH key permissions
- Verify ansible_user in server configuration

### Issue: Patch check times out
**Cause:** Slow network or large package repository
**Solution:**
- Increase timeout in `patch_service.py` (default: 60s)
- Check server network connectivity

### Issue: Patches don't apply
**Cause:** Permission issues or package conflicts
**Solution:**
- Check job logs for specific error
- Verify sudo/root access on server
- Check for package dependency conflicts

### Issue: Empty patch list but updates available
**Cause:** Parsing error in yum output
**Solution:**
- Check backend logs for parse errors
- Verify yum output format matches expectations
- Test command manually on server

## Files Modified/Created

### Backend
- ✅ `/backend/app/services/patch_service.py` (new)
- ✅ `/backend/app/api/patches.py` (new)
- ✅ `/backend/app/api/__init__.py` (modified - added patches_bp)
- ✅ `/backend/app/__init__.py` (modified - registered patches_bp)

### Frontend
- ✅ `/frontend/src/api/patches.ts` (new)
- ✅ `/frontend/src/pages/PatchManagement/PatchManagement.tsx` (new)
- ✅ `/frontend/src/pages/PatchManagement/index.ts` (new)
- ✅ `/frontend/src/App.tsx` (modified - added route)
- ✅ `/frontend/src/components/Sidebar/Sidebar.tsx` (modified - added nav item)

### Documentation
- ✅ `PATCH_MANAGEMENT_IMPLEMENTATION.md` (this file)

## Summary

The Interactive Patch Management System provides a POC-level, user-friendly interface for checking and applying system patches. It leverages existing infrastructure (Ansible, Jobs, Celery) while introducing a new workflow for human-in-the-loop patch approval. The implementation is clean, modular, and ready for demo purposes.
