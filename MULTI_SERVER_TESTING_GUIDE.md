# Multi-Server Execution Feature - Testing Guide

## Overview
This guide provides step-by-step instructions to test the new Multi-Server Execution feature, which allows running Ansible playbooks across multiple servers in batch mode with configurable execution strategies.

## Prerequisites

### 1. System Requirements
- At least **2 active servers** configured in the system
- At least **1 playbook** uploaded and ready
- All services running in order: Redis → Backend → Celery → Frontend

### 2. Start All Services

```bash
# Terminal 1 - Redis
sudo systemctl start redis
redis-cli ping  # Should return PONG

# Terminal 2 - Flask Backend
cd ~/InfraAnsible/backend
source venv/bin/activate
python run.py

# Terminal 3 - Celery Worker
cd ~/InfraAnsible/backend
source venv/bin/activate
celery -A celery_worker worker --loglevel=info

# Terminal 4 - Frontend
cd ~/InfraAnsible/frontend
npm run dev -- --host
```

Open browser: `http://0.0.0.0:5173`

---

## Feature Components Implemented

### 1. Database Layer
- **Table**: `servers` - Added `tags` JSON column
- **Table**: `jobs` - Added `parent_job_id`, `is_batch_job`, `batch_config` columns
- **Migration File**: `backend/migrations/add_multi_server_execution.sql`

### 2. Backend API
- **POST /api/jobs/batch** - Creates batch job with multiple servers
- **GET /api/jobs/{id}/children** - Retrieves child jobs for batch job

### 3. Frontend Components
- **ServersPage**: Server tagging functionality
- **PlaybooksPage**: Multi-server execution modal
- **JobsPage**: Batch job hierarchy display with expandable rows

---

## Testing Workflow

### Phase 1: Tag Your Servers

1. Navigate to **Servers** page
2. For each server:
   - Click **Edit** button
   - In the "Tags" field, add tags like: `web`, `database`, `production`, `staging`
   - Click **Add** button after each tag
   - Save the server
3. Verify tags appear in the servers table (purple badges)

**Expected Result**: Each server should display tags as colored badges

---

### Phase 2: Create a Batch Job

1. Navigate to **Playbooks** page
2. Find any playbook card
3. Click the **Multi** button (purple gradient, next to Run button)

**Modal should open with:**
- List of all servers with checkboxes
- Tag filter dropdown
- Search bar (filter by hostname/IP)
- Advanced configuration panel

#### 2a. Select Servers

**Option A - Manual Selection:**
- Check individual server checkboxes (minimum 2 required)

**Option B - Tag-Based Selection:**
- Use tag filter dropdown OR
- Click quick-select tag buttons
- Selected servers get checkboxes automatically

**Option C - Search:**
- Type hostname or IP in search bar
- Select from filtered results

#### 2b. Configure Execution Strategy

In the **Advanced Configuration** panel:

1. **Execution Strategy**:
   - Choose **Parallel** (run all simultaneously) or
   - Choose **Sequential** (run one by one)

2. **Concurrent Limit** (Parallel mode only):
   - Use slider to set max concurrent executions (1-20)
   - Example: 5 servers, limit=2 means 2 at a time

3. **Failure Handling**:
   - Check **Stop on first failure** to halt batch if any job fails
   - Uncheck to continue executing remaining servers

#### 2c. Execute Batch Job

1. Review selected servers in the list
2. Check warning if >10 servers selected
3. Click **Execute Batch Job** button
4. Modal closes and navigates to job details

**Expected Result**: 
- Success notification appears
- Redirected to parent job details page

---

### Phase 3: Monitor Batch Job Execution

1. Navigate to **Jobs** page
2. Find the newly created batch job

**Batch Job Indicators:**
- Purple "Batch" badge with Layers icon
- Node count shows total servers (e.g., "5 Nodes")
- Progress summary below job ID (e.g., "3/5 completed, 1 running")

#### 3a. Expand Batch Job

1. Click the **chevron icon** (▼/▶) next to the job
2. Child jobs section expands

**Child Jobs Display:**
- Each child job shows:
  - Sequential number (#1, #2, etc.)
  - Server hostname
  - Job ID
  - Server IP address
  - Status badge (pending/running/success/failed)
  - "View Logs" button

#### 3b. Check Individual Child Jobs

1. Click **View Logs** on any child job
2. Review execution logs for that specific server
3. Use browser back button to return to Jobs page

**Expected Result**: Each child job has independent logs and status

---

### Phase 4: Verify Execution Strategies

#### Test 1: Parallel Execution
1. Create batch job with 3+ servers
2. Set execution strategy: **Parallel**
3. Set concurrent limit: **2**
4. Execute and monitor

**Expected Behavior**:
- Jobs start in waves of 2
- Once 2 complete, next 2 start
- Check Celery logs to confirm parallel execution

#### Test 2: Sequential Execution
1. Create batch job with 3+ servers
2. Set execution strategy: **Sequential**
3. Execute and monitor

**Expected Behavior**:
- Jobs execute one at a time
- Next job waits for previous to complete
- Order matches server selection order

#### Test 3: Stop on Failure
1. Create batch job with server that will fail (e.g., invalid credentials)
2. Enable **Stop on first failure**
3. Execute

**Expected Behavior**:
- When one job fails, remaining jobs are cancelled
- Parent job status becomes "failed"
- Check child jobs - some should show "cancelled"

---

## Verification Checklist

### Database Verification

```bash
mysql -u infra_user -p infra_automation
# Password: infra_pass123
```

```sql
-- Check server tags
SELECT id, hostname, tags FROM servers WHERE tags IS NOT NULL;

-- Check batch jobs
SELECT id, job_id, is_batch_job, parent_job_id, batch_config 
FROM jobs 
WHERE is_batch_job = 1 
ORDER BY created_at DESC 
LIMIT 5;

-- Check parent-child relationship
SELECT 
    parent.id as parent_id,
    parent.job_id as parent_job_id,
    child.id as child_id,
    child.job_id as child_job_id,
    child.status
FROM jobs parent
LEFT JOIN jobs child ON child.parent_job_id = parent.id
WHERE parent.is_batch_job = 1
ORDER BY parent.created_at DESC, child.id
LIMIT 20;
```

### UI Verification

- [ ] ServersPage shows tags column
- [ ] ServersPage allows adding/removing tags
- [ ] PlaybooksPage has "Multi" button on each card
- [ ] Modal opens with server selection
- [ ] Modal validates minimum 2 servers
- [ ] Tag filtering works correctly
- [ ] Search filtering works correctly
- [ ] Advanced config options all functional
- [ ] JobsPage shows "Batch" badge for batch jobs
- [ ] JobsPage shows correct node count
- [ ] JobsPage shows progress summary
- [ ] Batch jobs are expandable
- [ ] Child jobs display correctly
- [ ] "View Logs" navigates to child job details

### Backend Verification

Check Celery logs for:
```
[INFO/MainProcess] Received task: app.tasks.execute_batch_job_task
[INFO/MainProcess] Task app.tasks.execute_batch_job_task[<task-id>] succeeded
```

Check Flask logs for:
```
POST /api/jobs/batch - 201
GET /api/jobs/<id>/children - 200
```

---

## Common Issues & Troubleshooting

### Issue 1: "Minimum 2 servers required" error
**Cause**: Selected less than 2 servers  
**Solution**: Select at least 2 servers before executing

### Issue 2: Batch job not expanding
**Cause**: Child jobs failed to load  
**Solution**: Check browser console for API errors, verify backend is running

### Issue 3: All jobs fail immediately
**Cause**: Server connection issues or invalid playbook  
**Solution**: Test single server execution first, verify server credentials

### Issue 4: Tags not saving
**Cause**: Backend not receiving tags data  
**Solution**: Check browser network tab, verify tags are JSON array in request

### Issue 5: Concurrent limit ignored
**Cause**: Celery not processing batch correctly  
**Solution**: Check Celery logs, verify Redis is running

---

## Sample Test Scenarios

### Scenario 1: Web Server Deployment
1. Tag 3 servers as `web`, `production`
2. Select playbook: "Deploy Nginx"
3. Use tag filter: `web`
4. Set parallel execution, concurrent limit: 2
5. Execute and monitor

### Scenario 2: Database Migration
1. Tag 2 servers as `database`, `staging`
2. Select playbook: "Database Migration"
3. Manual select both servers
4. Set sequential execution
5. Enable stop on failure
6. Execute and monitor

### Scenario 3: Mixed Environment Update
1. Tag servers: `prod`, `staging`, `dev`
2. Select playbook: "System Update"
3. Quick-select by tag: `prod`
4. Set parallel, concurrent limit: 3
5. Execute and verify all complete successfully

---

## Performance Notes

- **10+ servers**: Warning appears in modal
- **20+ servers**: Consider breaking into multiple batches
- **Concurrent limit**: Balance between speed and resource usage
- **Database impact**: Parent-child queries optimized with indexes

---

## Next Steps

After successful testing:
1. Document any bugs found
2. Gather user feedback on UI/UX
3. Consider additional features:
   - Scheduled batch jobs
   - Batch job templates
   - Email notifications on batch completion
   - Export batch execution reports

---

## Support

For issues or questions:
- Check browser console (F12)
- Check Celery worker logs (Terminal 3)
- Check Flask backend logs (Terminal 2)
- Verify database state with SQL queries above

---

**Last Updated**: February 2, 2026  
**Feature Version**: 1.0  
**Status**: Ready for Testing
