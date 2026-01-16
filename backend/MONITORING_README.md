# Server Monitoring Implementation

## Overview
Real-time CPU, Memory, and Disk usage monitoring for all servers in the inventory.

## What Changed

### Backend Changes

#### 1. Database Schema (`models.py`)
Added 4 new columns to the `servers` table:
- `cpu_usage` (Float): CPU usage percentage (0-100)
- `memory_usage` (Float): Memory usage percentage (0-100) 
- `disk_usage` (Float): Disk usage percentage (0-100)
- `last_monitored` (DateTime): Timestamp of last metrics update

#### 2. Monitoring Service (`services/monitor_service.py`)
New `ServerMonitor` class with methods:
- `get_cpu_usage(server)`: Fetches CPU usage via SSH
- `get_memory_usage(server)`: Fetches memory usage via SSH
- `get_disk_usage(server)`: Fetches disk usage via SSH
- `update_server_metrics(server)`: Updates all metrics for one server
- `update_all_servers()`: Bulk update for all active servers

**How it works:**
- Connects to servers via SSH using paramiko
- Runs system commands (top, free, df) to get metrics
- Parses output and stores in database
- Handles connection failures gracefully

#### 3. New API Endpoints (`api/servers.py`)
- `GET /servers/<id>/metrics` - Get metrics for a specific server
- `POST /servers/metrics/refresh` - Refresh metrics for all servers (requires operator+ role)

#### 4. Database Migration
File: `migrations/add_server_monitoring.sql`
- Adds the 4 new columns
- Sets default values to 0.0

### Frontend Changes

#### 1. TypeScript Types (`types/index.ts`)
Updated `Server` interface with new optional fields:
```typescript
cpu_usage?: number;
memory_usage?: number;
disk_usage?: number;
last_monitored?: string;
```

#### 2. API Client (`api/api.ts`)
Added two new methods to `serversApi`:
- `getMetrics(id)`: Get metrics for one server
- `refreshAllMetrics()`: Refresh all server metrics

#### 3. ServersPage Component
- **Display**: Changed from random mock data to real `server.cpu_usage` from database
- **New Button**: "Refresh Metrics" button (green) to manually update all servers
- **Loading State**: Shows spinner while refreshing
- **Display Logic**: Shows "N/A" if metrics haven't been collected yet

## How CPU Usage is Calculated

### Current Implementation (Simulated)
The `simulate_metrics.py` script generates **random realistic values** between:
- CPU: 15-85%
- Memory: 30-75%
- Disk: 20-60%

This is for **testing and demonstration** purposes.

### Real Implementation (Production-Ready)
The `ServerMonitor` class in `monitor_service.py` uses **SSH** to connect to servers and run:

**CPU Usage:**
```bash
top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\([0-9.]*\)%* id.*/\1/' | awk '{print 100 - $1}'
```
- Runs `top` for 1 iteration
- Extracts idle CPU percentage
- Returns: `100 - idle` = actual usage

**Memory Usage:**
```bash
free | grep Mem | awk '{print ($3/$2) * 100.0}'
```
- Uses `free` command
- Calculates: (used / total) × 100

**Disk Usage:**
```bash
df -h / | tail -1 | awk '{print $5}' | sed 's/%//'
```
- Checks root partition `/`
- Extracts usage percentage

## Usage Instructions

### 1. Testing with Simulated Data
```bash
cd /home/NikhilRokade/InfraAnsible/backend
source venv/bin/activate
python simulate_metrics.py
```

### 2. Using Real SSH Monitoring
Ensure servers have:
- SSH access configured
- Valid credentials in database (ssh_user, ssh_port, ssh_key_path)
- Linux/Unix OS with standard commands (top, free, df)

Then in the UI:
1. Go to **Servers** page
2. Click **"Refresh Metrics"** button (green, with spinning icon)
3. Wait for metrics to update (connects via SSH to each server)
4. View updated CPU percentages in the table

### 3. API Usage
```bash
# Get metrics for server ID 1
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/servers/1/metrics

# Refresh all servers
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/servers/metrics/refresh
```

## Dependencies

### Backend
- `paramiko` - SSH library for Python (already in requirements.txt)
- Network access from backend server to managed servers
- SSH credentials configured for each server

### Frontend
- No new dependencies
- Uses existing `serversApi` from `api/api.ts`

## Security Considerations

1. **SSH Keys**: Store private keys securely, use `ssh_key_path` in database
2. **Credentials**: Never expose passwords in API responses
3. **Permissions**: Only `operator` and `admin` roles can refresh metrics
4. **Timeouts**: SSH connections have 10-second timeout to prevent hanging
5. **Error Handling**: Failed connections don't crash the system

## Future Enhancements

1. **Background Jobs**: Use Celery to automatically refresh metrics every 5 minutes
2. **Historical Data**: Store metrics history in a time-series database
3. **Alerts**: Trigger notifications when CPU/Memory > 80%
4. **Dashboard Widgets**: Add real-time graphs using Chart.js
5. **Multi-Metric Display**: Show Memory and Disk in the table too (currently only CPU visible)
6. **Windows Support**: Add PowerShell commands for Windows servers

## Troubleshooting

### "N/A" showing in UI
- Run `python simulate_metrics.py` to populate initial data
- OR click "Refresh Metrics" button (if SSH is configured)

### SSH Connection Fails
- Check `ssh_user`, `ssh_port`, `ssh_key_path` in database
- Verify network connectivity to server
- Check server logs: `tail -f /var/log/auth.log`

### Metrics Not Updating
- Check backend logs for errors
- Verify paramiko is installed: `pip list | grep paramiko`
- Test SSH manually: `ssh user@server -p port -i key_file`

### Permission Denied on Refresh
- Ensure user role is `operator` or `admin`
- Re-login to get fresh JWT token with correct role

## Files Modified

### Backend
- `app/models.py` - Added 4 columns to Server model
- `app/schemas.py` - Updated ServerSchema to include new fields  
- `app/api/servers.py` - Added 2 new endpoints
- `app/services/monitor_service.py` - **NEW FILE** - Monitoring logic
- `migrations/add_server_monitoring.sql` - **NEW FILE** - Database migration
- `simulate_metrics.py` - **NEW FILE** - Test data generator

### Frontend
- `types/index.ts` - Updated Server interface
- `api/api.ts` - Added 2 new API methods
- `pages/ServersPage/ServersPage.tsx` - Updated to use real data + refresh button

## Summary

**Before**: CPU usage was `Math.floor(Math.random() * 100)` - completely fake

**After**: CPU usage comes from database, populated via:
- SSH monitoring (production)
- OR simulation script (testing)

The system is now **production-ready** for real server monitoring with just SSH configuration!
