# InfraAnsible Architecture Diagrams

## System Architecture Diagram

This diagram shows all components and their connections in the InfraAnsible platform.

```mermaid
graph TB
    subgraph Frontend["🌐 FRONTEND - React + TypeScript :5173"]
        UI1[📊 Dashboard]
        UI2[📁 Playbook Manager]
        UI3[🖥️ Server Manager]
        UI4[▶️ Job Execution & Monitoring]
        UI5[📄 Report Viewer with Dropdown]
        UI6[🔔 Notifications Panel]
    end

    subgraph Backend["⚙️ BACKEND API - Flask + SocketIO :5000"]
        API1[🌍 REST API Endpoints]
        API2[⚡ WebSocket Server]
        API3[🔒 JWT Authentication]
        API4[🛡️ RBAC Engine]
    end

    subgraph Celery["🔄 CELERY WORKER - Async Processing"]
        C1[📋 Job Queue Manager]
        C2[⚙️ Ansible Runner Integration]
        C3[💻 SSH Connection Handler]
        C4[🔍 File Detection & Parsing]
    end

    Redis["🗄️ REDIS :6379<br/>Task Queue + Cache"]
    
    subgraph Database["💾 MariaDB :3306"]
        DB1[(users)]
        DB2[(servers)]
        DB3[(playbooks)]
        DB4[(jobs)]
        DB5[(job_logs)]
        DB6[(notifications)]
        DB7[(audit_logs)]
    end

    Ansible["🔧 ANSIBLE RUNNER<br/>Playbook Executor"]
    
    subgraph Servers["🖥️ TARGET INFRASTRUCTURE"]
        S1[Server 1<br/>192.168.x.1]
        S2[Server 2<br/>192.168.x.2]
        S3[Server 3<br/>192.168.x.3]
    end

    %% Connections
    Frontend <-->|HTTP/HTTPS + WebSocket| Backend
    Backend <-->|SQL Queries| Database
    Backend <-->|Task Submit/Results| Redis
    Backend -->|Queue Jobs| Celery
    Celery <-->|Job Queue| Redis
    Celery -->|Execute| Ansible
    Ansible -->|SSH :22| Servers
    Servers -.->|Generated Files| Ansible
    Ansible -.->|Live Logs| Celery
    Celery -.->|Real-time Updates| Backend
    Backend -.->|WebSocket Stream| Frontend

    style Frontend fill:#3B82F6,color:#fff
    style Backend fill:#10B981,color:#fff
    style Celery fill:#F59E0B,color:#fff
    style Redis fill:#EF4444,color:#fff
    style Database fill:#8B5CF6,color:#fff
    style Ansible fill:#14B8A6,color:#fff
    style Servers fill:#6B7280,color:#fff
```

---

## Workflow Sequence Diagram

This diagram shows the complete user journey from login to report download.

```mermaid
sequenceDiagram
    actor User
    participant Frontend as 🌐 React Frontend
    participant Backend as ⚙️ Flask Backend
    participant DB as 💾 MariaDB
    participant Redis as 🗄️ Redis
    participant Celery as 🔄 Celery Worker
    participant Ansible as 🔧 Ansible Runner
    participant Server as 🖥️ Remote Server

    Note over User,Server: 1️⃣ USER AUTHENTICATION
    User->>Frontend: Login (credentials)
    Frontend->>Backend: POST /api/auth/login
    Backend->>DB: Validate user
    DB-->>Backend: User data + role
    Backend-->>Frontend: JWT Token + User Profile
    Frontend-->>User: Dashboard (RBAC applied)

    Note over User,Server: 2️⃣ PLAYBOOK SELECTION & EXECUTION
    User->>Frontend: Select Playbook + Server
    Frontend->>Backend: POST /api/jobs (playbook_id, server_id)
    Backend->>DB: Create job record
    Backend->>Redis: Queue task
    Backend->>Celery: Submit async job
    Backend-->>Frontend: Job created (job_id)
    Frontend-->>User: "Job started" notification

    Note over User,Server: 3️⃣ REAL-TIME LOG STREAMING
    Frontend->>Backend: Connect WebSocket
    Backend-->>Frontend: WebSocket connected
    Celery->>Ansible: Execute playbook
    Ansible->>Server: SSH connect + run tasks
    Server-->>Ansible: Task output (live)
    Ansible-->>Celery: Stream logs
    Celery->>DB: Save logs to job_logs
    Celery->>Backend: Emit log events
    Backend->>Frontend: WebSocket: log updates
    Frontend-->>User: Display live console output

    Note over User,Server: 4️⃣ FILE GENERATION & DETECTION
    Server->>Server: Generate report files<br/>(CSV/PDF/TXT in /tmp)
    Server-->>Ansible: Files created
    Ansible-->>Celery: Log file paths
    Celery->>DB: Update job_logs (file mentions)
    Celery->>DB: Update job status = 'success'
    Celery->>DB: Create notification
    Backend->>Frontend: WebSocket: job complete
    Frontend-->>User: "Job completed" notification

    Note over User,Server: 5️⃣ REPORT VIEWING
    User->>Frontend: Click "View Report" button
    Frontend->>Backend: GET /api/jobs/{id}/generated-files
    Backend->>DB: Query job_logs for file patterns
    Backend->>Server: SSH: check file exists
    Backend-->>Frontend: File list (paths, sizes)
    Frontend->>Backend: GET /api/jobs/{id}/download-file?action=view
    Backend->>Server: SSH: read file content
    Server-->>Backend: File data (CSV parsed)
    Backend-->>Frontend: JSON (headers + data)
    Frontend-->>User: Display report in viewer<br/>with dropdown selector

    Note over User,Server: 6️⃣ REPORT DOWNLOAD
    User->>Frontend: Click "Download" button
    Frontend->>Backend: GET /api/jobs/{id}/download-file?action=download
    Backend->>Server: SSH: read file
    Server-->>Backend: File binary data
    Backend-->>Frontend: File stream
    Frontend-->>User: Browser download dialog

    Note over User,Server: ✅ WORKFLOW COMPLETE
```

---

## Component Details

### Frontend Layer (React 18 + TypeScript)
- **Technology Stack**: Vite, Tailwind CSS, Zustand, React Router, Lucide Icons
- **Port**: 5173
- **Features**:
  - Dashboard with job statistics and metrics
  - Playbook management (upload, edit, delete)
  - Server management (add, configure, test SSH)
  - Job execution and real-time monitoring
  - Report viewer with multi-file dropdown selector
  - Real-time notification panel
  - Role-based UI rendering (RBAC)

### Backend Layer (Flask + Flask-SocketIO)
- **Technology Stack**: Python 3.9+, Flask 2.x, SQLAlchemy, Flask-SocketIO, Paramiko
- **Port**: 5000
- **Features**:
  - RESTful API endpoints
  - WebSocket server for real-time log streaming
  - JWT authentication with secure token management
  - RBAC engine (Admin, Operator, Viewer roles)
  - File detection and parsing
  - SSH connection management

### Task Queue (Celery)
- **Technology Stack**: Celery, Redis as broker
- **Features**:
  - Async job processing
  - Ansible Runner integration
  - SSH connection pooling
  - Generated file detection from logs
  - Real-time log emission

### Message Broker & Cache (Redis)
- **Port**: 6379
- **Usage**:
  - Celery task queue
  - Celery result backend
  - Session caching
  - Temporary data storage

### Database (MariaDB/MySQL)
- **Port**: 3306
- **Tables**:
  - `users` - User accounts and authentication
  - `servers` - Managed server inventory
  - `playbooks` - Ansible playbook metadata
  - `jobs` - Job execution records
  - `job_logs` - Real-time log storage
  - `notifications` - User notifications
  - `audit_logs` - System audit trail

### Automation Engine (Ansible Runner)
- **Features**:
  - Playbook execution
  - Dynamic inventory management
  - Module loading and execution
  - Real-time output capture
  - Error handling and reporting

### Target Infrastructure
- **Connection**: SSH (Port 22)
- **Supported OS**: Linux (CentOS, RHEL, Ubuntu, etc.)
- **Features**:
  - Remote playbook execution
  - File generation (/tmp, /var/tmp)
  - System configuration management
  - Package management
  - Service control

---

## Data Flow Patterns

### 1. Authentication Flow
```
User → Frontend → Backend API → MariaDB → Backend API → Frontend → User
```

### 2. Job Execution Flow
```
User → Frontend → Backend API → Celery Worker → Redis → Ansible Runner → Remote Server
```

### 3. Real-time Monitoring Flow
```
Ansible Runner → Celery Worker → Backend API (WebSocket) → Frontend → User
```

### 4. Report Generation Flow
```
Remote Server (generates files) → Ansible Runner → Celery Worker → Backend API → Frontend (Report Viewer)
```

### 5. Notification Flow
```
Backend API → MariaDB (notifications) → Backend API → Frontend (Notification Panel) → User
```

---

## Key Features

1. **Real-time WebSocket Logging** - Live log streaming during playbook execution
2. **Role-Based Access Control (RBAC)** - Admin, Operator, and Viewer roles
3. **Auto-detect Generated Reports** - Automatically finds and displays CSV/PDF/TXT files
4. **Multi-Server SSH Management** - Secure SSH connections to multiple servers
5. **Async Job Queue Processing** - Non-blocking job execution with Celery
6. **Interactive Playbook Execution** - User input during playbook runs
7. **Audit Trail & History** - Complete audit logging of all actions
8. **Notification System** - Real-time alerts for job status changes
9. **Multi-file Report Viewer** - Dropdown selector for multiple generated files
10. **CSV Table Rendering** - In-browser CSV viewing with download option

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + TypeScript | User interface |
| Build Tool | Vite | Fast development and bundling |
| Styling | Tailwind CSS | Utility-first CSS framework |
| State Management | Zustand | Lightweight state management |
| Icons | Lucide React | Modern icon library |
| Backend | Flask 2.x | Python web framework |
| Real-time | Flask-SocketIO | WebSocket implementation |
| ORM | SQLAlchemy | Database abstraction |
| SSH | Paramiko | SSH client for Python |
| Task Queue | Celery | Async task processing |
| Message Broker | Redis | Task queue and caching |
| Database | MariaDB/MySQL | Relational database |
| Automation | Ansible Runner | Infrastructure automation |
| Authentication | JWT | Secure token-based auth |

---

## Deployment Architecture

```
[Development]
- Frontend: npm run dev (Vite Dev Server)
- Backend: python run.py (Flask Dev Server)
- Celery: celery worker (Single worker)
- Redis: Local instance
- MariaDB: Local database

[Production]
- Frontend: Nginx + Static files (Built with npm run build)
- Backend: Gunicorn + Flask + Nginx reverse proxy
- Celery: Multiple workers with supervisor/systemd
- Redis: Redis Cluster or Sentinel
- MariaDB: Master-Slave replication
```

---

## Security Features

1. **JWT Authentication** - Secure token-based authentication
2. **Password Hashing** - Bcrypt password hashing
3. **RBAC** - Role-based access control at API level
4. **SSH Key Management** - Secure SSH credential storage
5. **CORS Configuration** - Controlled cross-origin access
6. **Input Validation** - Marshmallow schema validation
7. **SQL Injection Protection** - SQLAlchemy ORM
8. **File Path Restrictions** - Limited file access to /tmp and /var/tmp
9. **Audit Logging** - Complete action tracking
10. **Session Management** - Redis-based session storage
