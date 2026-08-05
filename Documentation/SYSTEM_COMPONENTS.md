# System Components Explained

**Date:** January 7, 2026  
**Document Purpose:** Deep dive into each component's role and responsibilities

---

## 🧩 Component Overview

This document breaks down each component of the Infrastructure Automation Platform, explaining what it does, what it doesn't do, and how it fits into the overall architecture.

---

## 🖥️ 1️⃣ Frontend (React / Vite – Windows)

**What it is:**
- The UI you see in the browser
- Runs on Windows
- Built with React + Vite
- Compiled JavaScript running in browser

**What it does:**
- ✅ Shows login page, dashboard, forms
- ✅ Takes user input (server details, playbook upload, run button)
- ✅ Sends requests to backend APIs
- ✅ Displays job status & results
- ✅ Manages local state (authentication tokens)
- ✅ Provides responsive, interactive UI

**What it does NOT do:**
- ❌ Does not run Ansible
- ❌ Does not talk to database
- ❌ Does not run background jobs
- ❌ Does not store sensitive data permanently
- ❌ Does not execute server commands

**Analogy:**
> 🧑‍💻 **Frontend = Customer at a counter**  
> Only talks to the shop counter, not to the storeroom or workers.

**Technology Stack:**
- React 18.2
- TypeScript 5.3
- Vite 5.0 (build tool)
- Zustand (state management)
- TailwindCSS (styling)
- Axios (HTTP client)

---

## 🌐 2️⃣ Backend (Flask API – Linux VM)

**What it is:**
- Central brain of the system
- Runs on Linux VM
- Listens on port 5000
- Built with Flask (Python)

**What it does:**
- ✅ Exposes REST APIs (`/login`, `/jobs`, `/servers`, etc.)
- ✅ Authenticates users (JWT tokens)
- ✅ Validates all requests
- ✅ Enforces role-based access control
- ✅ Writes & reads data from database
- ✅ Triggers background jobs via Celery
- ✅ Returns JSON responses to frontend
- ✅ Handles file uploads (playbooks)
- ✅ Encrypts sensitive data (SSH keys)

**What it does NOT do:**
- ❌ Does not execute Ansible directly (delegates to Celery)
- ❌ Does not block waiting for long tasks
- ❌ Does not render HTML (API only)
- ❌ Does not connect to managed servers directly

**Analogy:**
> 🏪 **Backend = Shop counter / manager**  
> Takes order → Writes order details → Delegates heavy work to staff → Updates customer with status

**Technology Stack:**
- Flask 3.0
- SQLAlchemy 2.0 (ORM)
- Flask-JWT-Extended (authentication)
- Marshmallow (validation)
- Bcrypt (password hashing)
- Python 3.10+

**Key Endpoints:**
```
POST   /api/auth/login          - User authentication
GET    /api/auth/me             - Get current user
POST   /api/servers             - Create server
GET    /api/servers             - List servers
POST   /api/playbooks/upload    - Upload playbook
POST   /api/jobs                - Create job
GET    /api/jobs/:id            - Get job status
GET    /api/jobs/:id/logs       - Get job logs
```

---

## 🧵 3️⃣ Celery (Background Worker – Linux VM)

**What it is:**
- Asynchronous task worker
- Runs alongside Flask (separate process)
- Handles long-running jobs
- Multiple workers can run in parallel

**What it does:**
- ✅ Picks up tasks sent by Flask via Redis
- ✅ Runs Ansible playbooks
- ✅ Processes job execution
- ✅ Handles log processing
- ✅ Updates job status in database
- ✅ Runs independently of user requests
- ✅ Can handle multiple jobs simultaneously
- ✅ Retries failed tasks (configurable)

**Why Celery is needed:**

**Without Celery:**
- ❌ Flask would freeze while Ansible runs (could be 10+ minutes)
- ❌ UI would hang and appear broken
- ❌ Users couldn't submit multiple jobs
- ❌ One long task blocks everything

**With Celery:**
- ✅ Flask returns immediately
- ✅ User can submit more jobs
- ✅ Jobs run in background
- ✅ Can scale with more workers

**Analogy:**
> 👷 **Celery = Worker staff**  
> Does the heavy lifting → Works in background → Reports progress back

**Technology Stack:**
- Celery 5.3
- Python 3.10+
- Ansible Runner 2.3

**How it works:**
```
1. Flask creates task: execute_playbook(job_id=123)
2. Task sent to Redis queue
3. Celery worker picks up task
4. Worker calls ansible_runner.run()
5. Worker updates database with status
6. Worker marks task complete
```

---

## 📦 4️⃣ Redis (Message Queue – Linux VM)

**What it is:**
- In-memory message broker
- Very fast (microsecond latency)
- Used by Celery for task queuing
- Simple key-value store

**What it does:**
- ✅ Acts as a queue between Flask and Celery
- ✅ Stores pending tasks
- ✅ Sends tasks from Flask → Celery
- ✅ Stores task results/status (temporarily)
- ✅ Provides pub/sub for real-time updates
- ✅ Caches frequently accessed data

**What it does NOT do:**
- ❌ Does not store permanent data
- ❌ Does not know business logic
- ❌ Does not validate data
- ❌ Does not replace database

**Why Redis is needed:**

**Without Redis:**
- Flask and Celery can't communicate reliably
- Tasks could be lost
- No queue management
- Can't track task status

**Analogy:**
> 📬 **Redis = Task inbox**  
> Flask drops job request → Celery picks it up → Simple, fast, reliable

**Technology Stack:**
- Redis 6.0+
- In-memory storage
- Persistence optional (RDB/AOF)

**Data stored (temporary):**
```
celery-task-meta-abc123: { status: "running", result: null }
celery:queue: [task1, task2, task3]
celery:results: { task1: "success", task2: "pending" }
```

---

## 🗄️ 5️⃣ Database (MySQL 8.4.9)

**What it is:**
- Permanent storage
- Accessed only by backend
- Uses SQLAlchemy ORM
- Relational database

**What it stores:**
- **Users & roles** (authentication, permissions)
- **Servers & inventory** (hostnames, IPs, SSH credentials)
- **Playbook metadata** (names, paths, descriptions)
- **Job records** (status, start/end times, results)
- **Execution logs** (line-by-line output)
- **Audit logs** (who did what, when)
- **Tickets** (support requests, optional)

**What it does NOT do:**
- ❌ Does not run Ansible
- ❌ Does not talk to frontend directly
- ❌ Does not execute jobs
- ❌ Does not connect to managed servers

**Analogy:**
> 📚 **Database = Storeroom / records**  
> Everything is saved here → Backend decides what to read/write → Source of truth

**Technology Stack:**
- MySQL Community 8.4.9 (service: `mysqld`)
- SQLAlchemy ORM
- PyMySQL driver

**Schema (7 tables):**

1. **users** - Authentication and user management
2. **servers** - Infrastructure inventory
3. **playbooks** - Ansible playbook metadata
4. **jobs** - Job execution tracking
5. **job_logs** - Line-by-line execution logs
6. **audit_logs** - Complete audit trail
7. **tickets** - Support ticket system (optional)

**Example queries:**
```sql
-- Get all running jobs
SELECT * FROM jobs WHERE status = 'running';

-- Get recent logs for a job
SELECT * FROM job_logs WHERE job_id = 123 ORDER BY created_at DESC LIMIT 100;

-- Get user's job history
SELECT * FROM jobs WHERE triggered_by = 1 ORDER BY created_at DESC;
```

---

## ⚙️ 6️⃣ Ansible (Automation Engine – Linux VM)

**What it is:**
- Infrastructure automation tool
- Executed by Celery workers
- Runs playbooks on managed servers
- Agentless (uses SSH)

**What it does:**
- ✅ Connects to target servers via SSH
- ✅ Executes automation tasks (deploy, configure, update)
- ✅ Generates execution logs
- ✅ Reports success/failure with details
- ✅ Runs idempotently (safe to re-run)
- ✅ Supports modules (apt, yum, copy, service, etc.)

**What it does NOT do:**
- ❌ Does not have a persistent UI
- ❌ Does not store data (we use database for that)
- ❌ Does not track jobs (Celery does that)
- ❌ Does not handle authentication (backend does)

**Analogy:**
> 🔧 **Ansible = The actual tool**  
> Screwdriver in the worker's hand → Does the real work

**Technology Stack:**
- Ansible Core 2.15+
- Ansible Runner 2.3 (Python API)
- SSH for connectivity

**How Celery uses Ansible:**
```python
import ansible_runner

result = ansible_runner.run(
    playbook='deploy-webapp.yml',
    inventory={'all': {'hosts': ['192.168.1.10']}},
    private_data_dir='/var/lib/ansible-runner',
)

print(result.status)  # 'successful' or 'failed'
print(result.rc)      # Return code
print(result.stdout)  # Execution output
```

---

## 🔄 How All Components Work Together

### Complete Flow: User Runs a Playbook

```
1. User (Browser - Windows)
   👤 Clicks "Run Playbook" button
   ↓

2. Frontend (React - Windows)
   🖥️ Sends HTTP POST request
   POST http://192.168.1.100:5000/api/jobs
   Body: { playbook_id: 1, server_id: 2 }
   ↓

3. Backend (Flask - Linux VM)
   🌐 Receives request
   • Validates JWT token → ✅
   • Checks user has "operator" role → ✅
   • Validates server & playbook exist → ✅
   • Creates job record in database
   • Sends task to Redis queue
   • Returns: { job_id: 123, status: "pending" }
   ↓

4. Database (MySQL - Linux VM)
   🗄️ Stores job record
   INSERT INTO jobs (playbook_id, server_id, status, triggered_by)
   VALUES (1, 2, 'pending', 1)
   → job_id = 123
   ↓

5. Redis (Message Broker - Linux VM)
   📦 Stores task in queue
   LPUSH celery:queue "execute_playbook(job_id=123)"
   ↓

6. Celery Worker (Background - Linux VM)
   🧵 Picks up task from Redis
   • BRPOP celery:queue → Got task!
   • Updates job: UPDATE jobs SET status='running' WHERE id=123
   • Calls Ansible Runner API
   ↓

7. Ansible Engine (Linux VM)
   ⚙️ Executes playbook
   • Reads playbook: /playbooks/deploy-webapp.yml
   • Connects to server: ssh ansible@192.168.1.10
   • Runs tasks:
     TASK [Update apt cache] ******************
     ok: [192.168.1.10]
     
     TASK [Install nginx] *********************
     changed: [192.168.1.10]
   ↓

8. Managed Server (192.168.1.10)
   🖥️ Executes commands
   • Receives SSH connection
   • Runs: apt-get update
   • Runs: apt-get install nginx
   • Returns output to Ansible
   ↓

9. Celery Worker (Linux VM)
   🧵 Processes results
   • Receives Ansible output
   • Inserts logs into database:
     INSERT INTO job_logs (job_id, message, timestamp)
     VALUES (123, 'TASK [Install nginx]', '2026-01-07 10:05:23')
   • Updates job status:
     UPDATE jobs SET status='success', completed_at=NOW()
     WHERE id=123
   ↓

10. Database (MySQL - Linux VM)
    🗄️ Stores results
    • job_logs table: 50 lines of execution logs
    • jobs table: status='success', duration=180s
    ↓

11. Frontend (React - Windows)
    🖥️ Displays results
    • Polls every 2 seconds: GET /api/jobs/123
    • Receives: { status: "success", duration: 180 }
    • Updates UI: ✅ Deployment successful (3min)
    • Fetches logs: GET /api/jobs/123/logs
    • Displays in terminal viewer
```

---

## 🔑 Key Design Principles

### ✅ 1. Separation of Responsibilities

**Each component has one clear job:**

| Component | Primary Responsibility |
|-----------|----------------------|
| Frontend | User interaction & display |
| Backend | API & coordination |
| Celery | Heavy processing |
| Redis | Task queuing |
| Database | Data persistence |
| Ansible | Automation execution |

**Why this matters:**
- Easy to debug (know where to look)
- Easy to scale (add more of one component)
- Easy to maintain (change one without affecting others)

### ✅ 2. OS Independence

**Frontend OS ≠ Backend OS → Totally fine:**

```
Windows (Frontend)
   ↓ HTTP (OS-agnostic)
Linux (Backend)
```

**Why this works:**
- Communication is network-based (HTTP/REST)
- OS doesn't matter for API calls
- Can run on different clouds, different data centers
- Can even split across continents

### ✅ 3. Scalability

**You can add more resources without changing code:**

**Scale Frontend:**
- Add CDN for static files
- Multiple frontend servers behind load balancer
- Browser caching

**Scale Backend:**
- Add more Flask instances
- Use load balancer (Nginx/HAProxy)
- Horizontal scaling

**Scale Celery:**
- Add more worker processes
- Add more worker machines
- Prioritize queues

**Scale Database:**
- Read replicas
- Vertical scaling (more RAM/CPU)
- Sharding (for very large scale)

**Scale Redis:**
- Redis Cluster for high availability
- Sentinel for failover
- Persistence for durability

### ✅ 4. Asynchronous Processing

**Long tasks don't block the system:**

**Synchronous (BAD):**
```
User → Backend → Wait 10 minutes → Response
        ↓
    BLOCKED
```

**Asynchronous (GOOD):**
```
User → Backend → Immediate Response (job_id)
       ↓
       Celery (background processing)
       ↓
User polls for status
```

**Benefits:**
- User doesn't wait
- Can submit multiple jobs
- System stays responsive
- Better user experience

---

## 🧠 One-Line Summary for Each Component

| Component | One-Line Role |
|-----------|--------------|
| **Frontend** | UI & user interaction |
| **Backend (Flask)** | API & coordination |
| **Database** | Permanent data storage |
| **Redis** | Task queue / message broker |
| **Celery** | Background execution engine |
| **Ansible** | Actual infrastructure automation |

---

## 📊 Component Communication Matrix

| From → To | Protocol | Purpose | Example |
|-----------|----------|---------|---------|
| Frontend → Backend | HTTP/REST | API calls | `POST /api/jobs` |
| Backend → Database | SQL | Data storage | `INSERT INTO jobs` |
| Backend → Redis | Redis Protocol | Task queuing | `LPUSH task_queue` |
| Celery → Redis | Redis Protocol | Get tasks | `BRPOP task_queue` |
| Celery → Database | SQL | Update status | `UPDATE jobs SET status` |
| Celery → Ansible | Python API | Execute playbooks | `ansible_runner.run()` |
| Ansible → Servers | SSH | Run commands | `ssh user@server` |
| Frontend → Browser | LocalStorage | Token storage | `localStorage.setItem()` |

---

## 🚦 Why This Architecture Works

### 1. **Reliability**
- ✅ If Celery crashes → Flask still works
- ✅ If Redis goes down → Can restart without data loss
- ✅ Database has all permanent records
- ✅ Can restart any component independently

### 2. **Performance**
- ✅ Frontend doesn't wait for slow operations
- ✅ Redis is in-memory (microsecond latency)
- ✅ Multiple workers handle jobs in parallel
- ✅ Database queries are optimized with indexes

### 3. **Maintainability**
- ✅ Each component is independent
- ✅ Can update/restart one without affecting others
- ✅ Clear boundaries between services
- ✅ Easy to find and fix bugs

### 4. **Security**
- ✅ Database never exposed to internet
- ✅ Frontend never has DB credentials
- ✅ Backend validates everything
- ✅ JWT ensures authenticated requests
- ✅ SSH keys encrypted in database
- ✅ Role-based access control

---

## 🎯 Summary

This architecture follows industry best practices:

- **3-tier architecture** (Presentation, Application, Data)
- **Microservices principles** (separation of concerns)
- **Asynchronous processing** (for long-running tasks)
- **API-first design** (frontend and backend decoupled)
- **Security by design** (defense in depth)

Each component does one thing well, and together they create a robust, scalable infrastructure automation platform.

---

**Document Version:** 1.0  
**Last Updated:** January 7, 2026  
**Status:** Component Deep Dive Complete
