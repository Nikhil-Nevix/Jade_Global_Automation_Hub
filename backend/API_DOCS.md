# API Documentation - Infra Automation Platform

## Base URL
```
http://localhost:5000
```

## Authentication

All endpoints (except `/auth/login` and `/health`) require JWT authentication.

**Header Format:**
```
Authorization: Bearer <access_token>
```

---

## 1. Authentication Endpoints

### POST /auth/login
Login and receive JWT tokens.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00",
    "last_login": "2024-01-01T12:00:00"
  }
}
```

### POST /auth/refresh
Refresh access token using refresh token.

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response (200):**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### POST /auth/register
Create a new user (admin only).

**Request:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "role": "operator"
}
```

**Response (201):**
```json
{
  "id": 2,
  "username": "newuser",
  "email": "newuser@example.com",
  "role": "operator",
  "is_active": true,
  "created_at": "2024-01-01T12:00:00"
}
```

---

## 2. Server Endpoints

### GET /servers
List all servers with optional filtering.

**Query Parameters:**
- `is_active` (bool): Filter by active status
- `environment` (string): Filter by environment (dev, staging, production)
- `os_type` (string): Filter by OS type
- `search` (string): Search in hostname, IP, description
- `page` (int): Page number (default: 1)
- `per_page` (int): Items per page (default: 20)

**Response (200):**
```json
{
  "items": [
    {
      "id": 1,
      "hostname": "web-server-01",
      "ip_address": "192.168.1.100",
      "os_type": "ubuntu",
      "os_version": "22.04",
      "ssh_port": 22,
      "ssh_user": "ubuntu",
      "environment": "production",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 1,
    "pages": 1
  }
}
```

### POST /servers
Create a new server (operator or admin).

**Request:**
```json
{
  "hostname": "web-server-02",
  "ip_address": "192.168.1.101",
  "os_type": "ubuntu",
  "os_version": "22.04",
  "ssh_user": "ubuntu",
  "ssh_port": 22,
  "ssh_key_path": "/path/to/key",
  "environment": "production",
  "tags": {
    "tier": "web",
    "region": "us-east"
  },
  "description": "Production web server"
}
```

**Response (201):**
```json
{
  "id": 2,
  "hostname": "web-server-02",
  "ip_address": "192.168.1.101",
  ...
}
```

### PUT /servers/:id
Update server details (operator or admin).

**Request:**
```json
{
  "description": "Updated description",
  "is_active": true
}
```

### DELETE /servers/:id
Delete server (admin only).

**Query Parameters:**
- `hard` (bool): If true, permanently delete (default: false)

---

## 3. Playbook Endpoints

### GET /playbooks
List all playbooks.

**Query Parameters:**
- `is_active` (bool): Filter by active status
- `search` (string): Search in name, description
- `page` (int): Page number
- `per_page` (int): Items per page

### POST /playbooks/upload
Upload a new playbook (operator or admin).

**Form Data:**
- `file` (file): YAML playbook file (required)
- `name` (string): Playbook name (required)
- `description` (string): Description
- `tags` (JSON string): Tags object
- `variables` (JSON string): Default variables

**Example using curl:**
```bash
curl -X POST http://localhost:5000/playbooks/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@playbook.yml" \
  -F "name=System Check" \
  -F "description=Checks system health" \
  -F 'tags={"category":"monitoring"}' \
  -F 'variables={"timeout":300}'
```

### GET /playbooks/:id/content
Get playbook file content.

**Response (200):**
```json
{
  "playbook_id": 1,
  "content": "---\n- name: Example\n  hosts: all\n  tasks:\n    ..."
}
```

---

## 4. Job Endpoints

### POST /jobs
Create and execute a new job (operator or admin).

**Request:**
```json
{
  "playbook_id": 1,
  "server_id": 2,
  "extra_vars": {
    "custom_var": "value"
  }
}
```

**Response (201):**
```json
{
  "id": 1,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "playbook": {
    "id": 1,
    "name": "System Check"
  },
  "server": {
    "id": 2,
    "hostname": "web-server-02"
  },
  "user": {
    "id": 1,
    "username": "admin"
  },
  "created_at": "2024-01-01T12:00:00"
}
```

### GET /jobs
List all jobs with filtering.

**Query Parameters:**
- `status` (string): pending, running, success, failed, cancelled
- `playbook_id` (int): Filter by playbook
- `server_id` (int): Filter by server
- `user_id` (int): Filter by user
- `page` (int): Page number
- `per_page` (int): Items per page

### GET /jobs/:id/logs
Get job execution logs (supports polling).

**Query Parameters:**
- `start_line` (int): Starting line number
- `limit` (int): Maximum number of lines

**Response (200):**
```json
{
  "job_id": 1,
  "logs": [
    {
      "id": 1,
      "line_number": 1,
      "content": "PLAY [System Health Check] ***",
      "log_level": "INFO",
      "timestamp": "2024-01-01T12:00:00"
    }
  ],
  "total_lines": 50,
  "returned_lines": 10
}
```

### POST /jobs/:id/ticket
Create a support ticket from a job.

**Request:**
```json
{
  "job_id": 1,
  "title": "Job failed on web-server-02",
  "description": "Detailed error description",
  "priority": "high"
}
```

### GET /jobs/statistics
Get job execution statistics.

**Query Parameters:**
- `user_id` (int): Optional user filter

**Response (200):**
```json
{
  "total": 100,
  "pending": 5,
  "running": 2,
  "success": 80,
  "failed": 10,
  "cancelled": 3,
  "success_rate": 80.0
}
```

---

## 5. User Endpoints

### GET /users
List all users (admin only).

**Query Parameters:**
- `role` (string): admin, operator, viewer
- `is_active` (bool): Filter by active status
- `page` (int): Page number
- `per_page` (int): Items per page

### GET /users/:id
Get user details (admin or self).

### PUT /users/:id
Update user (admin for all fields, user for own email/password).

**Request:**
```json
{
  "email": "newemail@example.com",
  "role": "operator",
  "is_active": true
}
```

### DELETE /users/:id
Deactivate user (admin only, cannot delete self).

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    "field": ["error detail"]
  }
}
```

**Common Error Codes:**
- `validation_error` (400): Request validation failed
- `unauthorized` (401): Missing or invalid token
- `forbidden` (403): Insufficient permissions
- `not_found` (404): Resource not found
- `internal_error` (500): Server error

---

## Role Permissions

| Endpoint | Viewer | Operator | Admin |
|----------|--------|----------|-------|
| GET /servers | ✓ | ✓ | ✓ |
| POST /servers | ✗ | ✓ | ✓ |
| PUT /servers | ✗ | ✓ | ✓ |
| DELETE /servers | ✗ | ✗ | ✓ |
| GET /playbooks | ✓ | ✓ | ✓ |
| POST /playbooks/upload | ✗ | ✓ | ✓ |
| GET /jobs | ✓ | ✓ | ✓ |
| POST /jobs | ✗ | ✓ | ✓ |
| GET /users | ✗ | ✗ | ✓ |
| POST /auth/register | ✗ | ✗ | ✓ |

---

## Health Check

### GET /health
Check API health status (no auth required).

**Response (200):**
```json
{
  "status": "healthy",
  "environment": "development",
  "version": "1.0.0"
}
```
