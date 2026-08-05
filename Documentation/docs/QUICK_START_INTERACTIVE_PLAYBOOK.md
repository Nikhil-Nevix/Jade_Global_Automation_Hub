# Quick Start: Interactive Playbook System

## Prerequisites
- Backend running on port 5000
- Frontend running on port 5173  
- At least one server configured in the system
- Celery worker running
- Redis running

## Quick Test (5 minutes)

### 1. Start Services

**Terminal 1 - Backend:**
```bash
cd /home/NikhilRokade/InfraAnsible/backend
python run.py
```

**Terminal 2 - Celery Worker:**
```bash
cd /home/NikhilRokade/InfraAnsible/backend
celery -A app.extensions.celery worker --loglevel=info
```

**Terminal 3 - Frontend:**
```bash
cd /home/NikhilRokade/InfraAnsible/frontend
npm run dev
```

### 2. Verify WebSocket Connection

1. Open browser to `http://localhost:5173`
2. Login to the system
3. Open browser console (F12)
4. Look for message: `Socket connected: <socket_id>`

If you see this, WebSocket is working! ✅

### 3. Upload Sample Playbook

1. Go to **Playbooks** page
2. Click **Upload Playbook**
3. Upload `backend/sample_interactive_playbook.yml`
4. Give it a name like "Interactive Patch Test"

### 4. Run the Playbook

1. Select the uploaded playbook
2. Select a target server
3. Click **Execute**
4. Watch the job start running

### 5. Test the Interactive Dialog

When the playbook reaches the interactive step:

**Expected Behavior:**
- ✅ Popup dialog appears automatically
- ✅ Shows list of available patches
- ✅ Timer counts down from 1 hour (3600 seconds)
- ✅ Can select/deselect patches
- ✅ "Select All" checkbox works
- ✅ Submit button is enabled when patches selected

**User Actions:**
1. Select some patches using checkboxes
2. Click "Submit Selected"
3. Dialog closes
4. Playbook continues execution
5. Selected patches are installed

### 6. Test Timeout

To test the timeout functionality:

1. Run the playbook again
2. Wait for dialog to appear
3. **Don't click anything** - just wait
4. After timeout (default 1 hour, can be reduced for testing):
   - ✅ Job should be cancelled automatically
   - ✅ Job status becomes "cancelled"
   - ✅ Alert shown to user

**To test faster:** Edit the playbook and change:
```yaml
wait_timeout_seconds: 60  # 1 minute instead of 1 hour
```

## Troubleshooting

### Dialog doesn't appear

**Check 1: WebSocket Connection**
```javascript
// In browser console:
socketService.isConnected()  // Should return true
```

**Check 2: Backend Logs**
Look for:
```
Patches ready notification received for job <job_id>
```

**Check 3: Network Tab**
- Look for WebSocket connection (ws://)
- Should be "101 Switching Protocols"

### "Job not found" error

This means the job_id wasn't passed correctly to the playbook.

**Verify:**
1. Check job logs for extra_vars
2. Should see: `job_id: <uuid>` and `backend_url: http://...`

### SSH connection fails

**Check:**
1. Server credentials are correct
2. SSH port is accessible
3. Test SSH manually:
   ```bash
   ssh user@server-ip
   ```

### Playbook can't reach backend

**Fix:**
1. Ensure BACKEND_URL is accessible from remote server
2. Check firewall rules
3. Test from remote server:
   ```bash
   curl http://backend-url:5000/health
   ```

## Sample Output

### Backend Console
```
[INFO] WebSocket - Socket.IO is running in threading mode
[INFO] interactive_playbook - Patches ready notification received for job abc123, file: /tmp/available_patches_abc123.txt
[INFO] ssh_service - Successfully read file /tmp/available_patches_abc123.txt from 192.168.1.100
[INFO] ssh_service - Successfully wrote file /tmp/selected_patches_abc123.txt to 192.168.1.100
[INFO] tasks - Selected patches written for job abc123: 5 patches
```

### Frontend Console
```
[App] Initializing WebSocket connection...
Socket connected: 2x3y4z5a6b
[App] Patches ready event received: {job_id: "abc123", file_path: "/tmp/available_patches_abc123.txt"}
```

### Playbook Output
```
TASK [Check for available patches (Debian/Ubuntu)] *****
ok: [server1]

TASK [Display available patches count] *****
ok: [server1] => {
    "msg": "Found 25 available patches"
}

TASK [Notify backend that patches are ready] *****
ok: [server1 -> localhost]

TASK [Wait for user to select patches] *****
ok: [server1]

TASK [Install selected patches (Debian/Ubuntu)] *****
changed: [server1]

TASK [Installation complete] *****
ok: [server1] => {
    "msg": "Successfully installed 5 patches"
}
```

## Advanced Testing

### Test with Multiple Users

1. Open two browser windows
2. Login as different users
3. Run interactive playbook
4. Both should see the dialog (if they have access to the job)

### Test with Custom Data

Modify the playbook to send different data:

```yaml
- name: Create custom list
  copy:
    content: |
      Option A
      Option B
      Option C
    dest: "/tmp/available_patches_{{ job_id }}.txt"
```

### Test Error Handling

**Scenario 1: Empty selection**
- Don't select any patches
- Click Submit
- Should show error: "Please select at least one patch"

**Scenario 2: Backend offline**
- Stop backend
- Run playbook
- Should timeout and show error

## Performance Tips

### Reduce Timeout for Testing

In your playbook:
```yaml
vars:
  wait_timeout_seconds: 120  # 2 minutes
```

### Increase Timeout for Production

For long-running manual processes:
```yaml
vars:
  wait_timeout_seconds: 7200  # 2 hours
```

## Next Steps

1. ✅ Verify all tests pass
2. ✅ Create your own interactive playbooks
3. ✅ Deploy to staging environment
4. ✅ Train users on the feature
5. ✅ Monitor production usage

## Support

For issues or questions:
1. Check [INTERACTIVE_PLAYBOOK_SYSTEM.md](INTERACTIVE_PLAYBOOK_SYSTEM.md)
2. Review backend logs
3. Check browser console
4. Verify WebSocket connection

---

**Happy Automating! 🚀**
