# Patch Management System - CSV-Based Package Management

## Overview
The Patch Management System allows administrators to upload a CSV file containing package requirements, check the status of those packages on selected servers, and take action to install missing packages or update outdated ones.

## Features

### ✅ Implemented
1. **CSV Upload** - Upload package requirements once, reuse for multiple servers
2. **Package Status Check** - Check if packages are installed, need updates, or are missing
3. **Selective Installation** - Install only missing packages
4. **Selective Updates** - Update only outdated packages
5. **Visual Status Dashboard** - Color-coded cards showing package status summary
6. **Job Integration** - Install/Update actions create standard Jobs

## User Workflow

### Step 1: Prepare CSV File
Create a CSV file with package requirements:

```csv
package_name,required_version
vim,8.0
nginx,1.20
curl,7.7
git,2.39
```

**Sample file provided:** `/home/NikhilRokade/InfraAnsible/sample_packages.csv`

### Step 2: Upload CSV
1. Navigate to **Patch Management** page
2. Click **"Choose CSV File"** button
3. Select your CSV file
4. Wait for upload confirmation

### Step 3: Select Server & Check Packages
1. Select a server from the dropdown
2. Click **"Check Packages"** button
3. Wait 10-30 seconds (depends on number of packages)

### Step 4: Review Results
The system shows three categories:

**🔴 Not Installed** - Packages missing from server
- Example: `nginx` is in CSV but not on server
- Action: Check checkbox → Click "Install Selected"

**🟡 Updates Available** - Packages installed but outdated
- Example: `vim` version 7.4 installed, version 8.0 available
- Action: Check checkbox → Click "Update Selected"

**🟢 Up to Date** - Packages meet requirements
- Example: `curl` version 7.7 matches required version
- Action: No action needed

### Step 5: Take Action
- **Install Missing**: Select packages → Click "Install Selected (N)"
- **Update Outdated**: Select packages → Click "Update Selected (N)"
- Both actions create Jobs → Check Jobs page for progress

## Technical Details

### Backend API Endpoints

#### 1. Upload CSV
```
POST /api/patches/upload-csv
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body: file (CSV file)

Response:
{
  "success": true,
  "message": "CSV uploaded successfully with 6 package(s)",
  "filename": "package_requirements.csv",
  "packages_count": 6
}
```

#### 2. Check Packages
```
POST /api/patches/check/<server_id>
Authorization: Bearer <token>

Response:
{
  "success": true,
  "server": {
    "id": 1,
    "hostname": "web-01",
    "ip_address": "192.168.1.100"
  },
  "packages": [
    {
      "package_name": "vim",
      "required_version": "8.0",
      "current_version": "7.4.160-6.el8",
      "latest_version": "8.0.1763-16.el8",
      "status": "update_available",
      "repository": "baseos"
    },
    {
      "package_name": "nginx",
      "required_version": "1.20",
      "current_version": null,
      "latest_version": "1.20.1-1.el8",
      "status": "not_installed",
      "repository": "appstream"
    }
  ],
  "total_count": 2
}
```

#### 3. Install Packages
```
POST /api/patches/install
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "server_id": 1,
  "packages": ["nginx", "git"]
}

Response:
{
  "success": true,
  "message": "Package installation job created for 2 package(s)",
  "job": {
    "id": 42,
    "job_id": "job_20260204_153045",
    "status": "pending"
  },
  "packages_count": 2
}
```

#### 4. Update Packages
```
POST /api/patches/update
Content-Type: application/json
Authorization: Bearer <token>

Body:
{
  "server_id": 1,
  "packages": ["vim", "curl"]
}

Response:
{
  "success": true,
  "message": "Package update job created for 2 package(s)",
  "job": {
    "id": 43,
    "job_id": "job_20260204_153102",
    "status": "pending"
  },
  "packages_count": 2
}
```

### Package Status Values

| Status | Meaning | Action Available |
|--------|---------|------------------|
| `installed` | Package installed, meets requirements | None (✓ OK) |
| `not_installed` | Package missing from server | Install |
| `update_available` | Package installed but outdated | Update |
| `error` | Error checking package | None |

### How Package Checking Works

For each package in CSV, the backend runs:

1. **Check if installed:**
   ```bash
   ansible <server> -m shell -a 'rpm -q <package> --queryformat "%{VERSION}-%{RELEASE}"'
   ```

2. **Check for updates:**
   ```bash
   ansible <server> -m shell -a 'yum list available <package>'
   ```

3. **Parse results** and return structured JSON

### Generated Playbooks

**Install Playbook Example:**
```yaml
- name: Install Selected Packages
  hosts: all
  become: True
  tasks:
    - name: Install package: nginx
      yum:
        name: nginx
        state: present
    - name: Install package: git
      yum:
        name: git
        state: present
```

**Update Playbook Example:**
```yaml
- name: Update Selected Packages
  hosts: all
  become: True
  tasks:
    - name: Update package: vim
      yum:
        name: vim
        state: latest
    - name: Update package: curl
      yum:
        name: curl
        state: latest
```

## File Storage

- **Uploaded CSV**: `/home/NikhilRokade/InfraAnsible/backend/data/patch_lists/package_requirements.csv`
- **Generated Playbooks**: `/home/NikhilRokade/InfraAnsible/backend/data/playbooks/`

## Permissions

- **Access**: Admin and Super Admin only
- **Enforced at**: API level (JWT + permission check)
- **UI**: Hidden from regular users in sidebar

## Testing the Feature

### Prerequisites
1. Backend running (`python run.py`)
2. Celery worker running
3. Redis running
4. Admin/super_admin account
5. At least one server configured

### Test Scenario

**1. Upload CSV:**
```bash
# Use the provided sample file
/home/NikhilRokade/InfraAnsible/sample_packages.csv
```

**2. Login as admin:**
- Navigate to Patch Management
- Click "Choose CSV File"
- Select sample_packages.csv
- Verify success message

**3. Check packages:**
- Select a server
- Click "Check Packages"
- Wait for results

**4. Install missing packages:**
- Check boxes for packages with "Not Installed" status
- Click "Install Selected"
- Navigate to Jobs page
- Monitor job execution

**5. Update outdated packages:**
- Check boxes for packages with "Update Available" status
- Click "Update Selected"
- Navigate to Jobs page
- Monitor job execution

## Troubleshooting

### Issue: "No package CSV uploaded"
**Solution**: Upload CSV file first (Step 1)

### Issue: Package check times out
**Solution**: Reduce packages in CSV or increase timeout in patch_service.py

### Issue: Install/Update fails
**Solution**: Check job logs for Ansible errors (SSH keys, permissions, package availability)

### Issue: CSV upload fails
**Solution**: Verify CSV format matches exactly:
```
package_name,required_version
vim,8.0
```

## Summary

This feature provides a **controlled, human-in-the-loop** approach to package management:
- ✅ Define what you want to check (CSV)
- ✅ Check actual status on servers
- ✅ Review results before taking action
- ✅ Selectively install or update
- ✅ Track via standard Jobs workflow

Perfect for compliance scenarios where you need to verify specific packages meet version requirements!
