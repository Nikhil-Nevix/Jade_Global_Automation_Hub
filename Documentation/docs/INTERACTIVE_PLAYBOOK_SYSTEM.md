# Interactive Playbook System

## Overview

The Interactive Playbook System allows Ansible playbooks to pause execution and request user input in real-time through a web-based popup dialog. This enables human-in-the-loop automation workflows where users can make decisions during playbook execution.

## Key Features

- ✅ **Real-time Communication**: WebSocket-based instant notifications
- ✅ **User-Friendly Interface**: Popup dialog with checkboxes and countdown timer
- ✅ **Timeout Handling**: Automatic job cancellation if user doesn't respond
- ✅ **Secure**: JWT authentication for API endpoints
- ✅ **Flexible**: Works with any Ansible playbook that follows the protocol

## Architecture

### Flow Diagram

```
Ansible Playbook (Remote Server)
        ↓
1. Creates available_patches.txt
        ↓
2. Calls POST /api/jobs/{job_id}/patches-ready
        ↓
Backend API
        ↓
3. Emits WebSocket event 'patches_ready'
        ↓
Frontend (User's Browser)
        ↓
4. Shows popup dialog with patches
        ↓
5. User selects patches
        ↓
6. Calls POST /api/jobs/{job_id}/selected-patches
        ↓
Backend API
        ↓
7. Writes selected_patches.txt via SSH to remote server
        ↓
Ansible Playbook
        ↓
8. Detects file and continues execution
```

### Components

#### Backend

1. **WebSocket Server** (`flask-socketio`)
   - Handles real-time communication between backend and frontend
   - Broadcasts `patches_ready` events to connected clients

2. **API Endpoints** (`backend/app/api/interactive_playbook.py`)
   - `POST /api/jobs/<job_id>/patches-ready` - Playbook notifies patches are ready
   - `GET /api/jobs/<job_id>/available-patches` - Frontend fetches patch list
   - `POST /api/jobs/<job_id>/selected-patches` - Frontend sends user selections
   - `POST /api/jobs/<job_id>/cancel` - Cancel job on timeout

3. **SSH Service** (`backend/app/services/ssh_service.py`)
   - Reads files from remote servers
   - Writes selected patches file back to remote server
   - Uses paramiko for SSH operations

4. **Celery Tasks** (`backend/app/tasks.py`)
   - Passes `job_id` and `backend_url` as extra_vars to playbooks
   - Handles job cancellation

#### Frontend

1. **WebSocket Service** (`frontend/src/services/socket.service.ts`)
   - Manages Socket.IO connection
   - Event subscription and emission

2. **Interactive Patches Dialog** (`frontend/src/components/InteractivePatchesDialog/`)
   - Displays available patches with checkboxes
   - Countdown timer showing remaining time
   - Select all / individual selection
   - Submit and cancel actions

3. **App Integration** (`frontend/src/App.tsx`)
   - Initializes WebSocket connection on authentication
   - Listens for `patches_ready` events
   - Shows dialog when event received

## Usage Guide

### 1. Create an Interactive Playbook

Your playbook must follow this protocol:

```yaml
---
- name: Interactive Playbook Example
  hosts: all
  vars:
    wait_timeout_seconds: 3600  # Timeout in seconds (required)
    job_id: ""  # Provided by system automatically
    backend_url: ""  # Provided by system automatically
  
  tasks:
    # Step 1: Generate list of items for user selection
    - name: Create list of available items
      copy:
        content: |
          item1
          item2
          item3
        dest: "/tmp/available_patches_{{ job_id }}.txt"
    
    # Step 2: Notify backend (triggers popup in frontend)
    - name: Notify backend
      uri:
        url: "{{ backend_url }}/api/jobs/{{ job_id }}/patches-ready"
        method: POST
        body_format: json
        body:
          file_path: "/tmp/available_patches_{{ job_id }}.txt"
        headers:
          Content-Type: "application/json"
        status_code: 200
      delegate_to: localhost
    
    # Step 3: Wait for user response
    - name: Wait for user selection
      wait_for:
        path: "/tmp/selected_patches_{{ job_id }}.txt"
        timeout: "{{ wait_timeout_seconds }}"
    
    # Step 4: Read user selections
    - name: Read selected items
      slurp:
        src: "/tmp/selected_patches_{{ job_id }}.txt"
      register: selected_file
    
    - name: Parse selections
      set_fact:
        selected_items: "{{ (selected_file.content | b64decode).split('\n') | select('match', '^.+$') | list }}"
    
    # Step 5: Use the selections
    - name: Process selected items
      debug:
        msg: "User selected: {{ selected_items }}"
    
    # Step 6: Clean up
    - name: Clean up temp files
      file:
        path: "{{ item }}"
        state: absent
      loop:
        - "/tmp/available_patches_{{ job_id }}.txt"
        - "/tmp/selected_patches_{{ job_id }}.txt"
      ignore_errors: yes
```

### 2. Run the Playbook

Just execute the playbook normally through the web interface. The system will automatically:
- Pass `job_id` and `backend_url` as extra_vars
- Listen for the patches-ready callback
- Show the popup dialog to the user
- Handle timeout if user doesn't respond

### 3. User Experience

When the playbook requests user input:

1. **Popup Appears**: A dialog box appears showing all available items
2. **Timer Countdown**: Visual countdown showing time remaining
3. **Selection**: User selects items using checkboxes
4. **Submit**: User clicks "Submit Selected" button
5. **Continuation**: Playbook continues with selected items

If the timeout expires, the job is automatically cancelled.

## File Format

### available_patches.txt

One item per line:
```
package-name-1
package-name-2
package-name-3
```

### selected_patches.txt

Same format - one item per line:
```
package-name-1
package-name-3
```

## Configuration

### Backend Configuration

In `backend/app/config.py`:
```python
BACKEND_URL = os.getenv('BACKEND_URL', 'http://0.0.0.0:5000')
```

This URL is passed to playbooks so they can callback to the API.

### Frontend Configuration

WebSocket connection URL can be configured via environment variable:
```
VITE_API_URL=http://your-backend-url:5000
```

## Timeout Behavior

- Default timeout: 3600 seconds (1 hour)
- Configurable via `wait_timeout_seconds` variable in playbook
- When timeout occurs:
  1. Job is cancelled via Celery
  2. Job status updated to "cancelled"
  3. Log entry added explaining timeout
  4. Frontend shows alert to user

## Security

- All API endpoints require JWT authentication (except patches-ready callback)
- WebSocket connection uses CORS with configured allowed origins
- SSH operations use server credentials from database
- File paths are restricted to /tmp directory

## Example: Patch Installation

See `backend/sample_interactive_playbook.yml` for a complete example that:
1. Scans for available OS patches
2. Displays them to the user
3. Installs only selected patches
4. Cleans up temporary files

## Troubleshooting

### Dialog Doesn't Appear

1. Check browser console for WebSocket connection errors
2. Verify backend is running and accessible
3. Check CORS configuration allows frontend origin
4. Ensure user is authenticated

### Playbook Times Out

1. Check if `backend_url` is correct in extra_vars
2. Verify playbook can reach backend URL from remote server
3. Check firewall rules between remote server and backend
4. Review backend logs for API call errors

### SSH Write Fails

1. Verify server credentials are correct
2. Check SSH key permissions
3. Ensure /tmp directory is writable on remote server
4. Review SSH service logs

## Dependencies

### Backend
- flask-socketio 5.6.0
- python-socketio 5.16.1
- paramiko 3.4.0

### Frontend
- socket.io-client 4.x

## API Reference

### POST /api/jobs/{job_id}/patches-ready

Playbook notifies that patches are ready for selection.

**Request:**
```json
{
  "file_path": "/tmp/available_patches_abc123.txt"
}
```

**Response:**
```json
{
  "message": "Notification sent",
  "job_id": "abc123"
}
```

### GET /api/jobs/{job_id}/available-patches

Fetch list of available patches.

**Query Parameters:**
- `file_path` - Path to file on remote server

**Response:**
```json
{
  "job_id": "abc123",
  "file_path": "/tmp/available_patches_abc123.txt",
  "patches": ["patch1", "patch2", "patch3"],
  "total": 3
}
```

### POST /api/jobs/{job_id}/selected-patches

Submit user's selected patches.

**Request:**
```json
{
  "selected_patches": ["patch1", "patch3"],
  "file_path": "/tmp/selected_patches_abc123.txt"
}
```

**Response:**
```json
{
  "message": "Selected patches saved successfully",
  "job_id": "abc123",
  "patches_count": 2,
  "file_path": "/tmp/selected_patches_abc123.txt"
}
```

### POST /api/jobs/{job_id}/cancel

Cancel job due to timeout.

**Response:**
```json
{
  "message": "Job cancelled successfully",
  "job_id": "abc123"
}
```

## WebSocket Events

### patches_ready

Emitted when playbook notifies patches are ready.

**Payload:**
```javascript
{
  job_id: "abc123",
  file_path: "/tmp/available_patches_abc123.txt"
}
```

## Future Enhancements

- [ ] Support for different input types (text input, dropdowns, radio buttons)
- [ ] Multiple interactive prompts in single playbook
- [ ] User response history and analytics
- [ ] Mobile-responsive dialog design
- [ ] Dark mode support for dialog
- [ ] Audio/visual notifications when dialog appears
- [ ] Collaborative selection (multiple users)

## License

Part of the Infra Automation Platform project.
