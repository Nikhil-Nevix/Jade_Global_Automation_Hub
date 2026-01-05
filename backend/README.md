# Infra Automation Platform - Backend

Production-ready Flask backend for infrastructure automation using Ansible.

## 🏗️ Architecture

- **Framework**: Flask 3.0 with App Factory Pattern
- **Database**: MySQL 8 with SQLAlchemy ORM
- **Authentication**: JWT-based (access + refresh tokens)
- **Authorization**: Role-based (admin, operator, viewer)
- **Async Tasks**: Celery + Redis
- **Automation**: Ansible Runner
- **API Documentation**: RESTful JSON API

## 📁 Project Structure

```
backend/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── config.py             # Environment configurations
│   ├── extensions.py         # Flask extensions
│   ├── models.py             # SQLAlchemy models
│   ├── schemas.py            # Marshmallow schemas
│   ├── tasks.py              # Celery tasks
│   ├── utils/                # Utilities
│   │   ├── crypto.py         # Encryption/decryption
│   │   └── log_parser.py     # Ansible log parser
│   ├── services/             # Business logic layer
│   │   ├── auth_service.py
│   │   ├── server_service.py
│   │   ├── playbook_service.py
│   │   └── job_service.py
│   ├── api/                  # API endpoints
│   │   ├── auth.py
│   │   ├── servers.py
│   │   ├── playbooks.py
│   │   ├── jobs.py
│   │   └── users.py
│   └── playbooks/            # Ansible integration
│       └── run.py
├── run.py                    # Application entry point
├── requirements.txt          # Python dependencies
└── .env.example             # Environment variables template
```

## 🚀 Setup Instructions

### Prerequisites

- Python 3.10+
- MySQL 8.0+
- Redis 6.0+
- Linux environment (for production)

### 1. Clone and Navigate

```bash
cd backend
```

### 2. Create Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 5. Initialize Database

```bash
# Create MySQL database
mysql -u root -p
CREATE DATABASE infra_automation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;

# Run migrations
flask db upgrade

# Or initialize directly
flask init-db

# Create admin user
flask create-admin
```

### 6. Start Redis (for Celery)

```bash
redis-server
```

### 7. Start Celery Worker

```bash
celery -A run.celery_app worker --loglevel=info
```

### 8. Run Flask Application

```bash
# Development
python run.py

# Or using Flask CLI
flask run
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FLASK_ENV` | Environment (development/production) | development |
| `SECRET_KEY` | Flask secret key | - |
| `JWT_SECRET_KEY` | JWT signing key | - |
| `DATABASE_URL` | MySQL connection string | mysql+pymysql://... |
| `CELERY_BROKER_URL` | Redis broker URL | redis://localhost:6379/0 |
| `UPLOAD_FOLDER` | Playbook storage path | /var/lib/infra-automation/playbooks |
| `CORS_ORIGINS` | Allowed CORS origins | http://localhost:5173 |

### Database Models

- **User**: Authentication and authorization
- **Server**: Infrastructure inventory
- **Playbook**: Ansible playbook metadata
- **Job**: Execution tracking
- **JobLog**: Line-by-line execution logs
- **Ticket**: Support ticket system
- **AuditLog**: Audit trail

## 📡 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/register` - Create new user (admin only)
- `GET /auth/me` - Get current user info

### Servers
- `GET /servers` - List all servers
- `POST /servers` - Create server
- `GET /servers/:id` - Get server details
- `PUT /servers/:id` - Update server
- `DELETE /servers/:id` - Delete server

### Playbooks
- `GET /playbooks` - List all playbooks
- `POST /playbooks/upload` - Upload playbook
- `GET /playbooks/:id` - Get playbook details
- `PUT /playbooks/:id` - Update playbook metadata
- `DELETE /playbooks/:id` - Delete playbook

### Jobs
- `POST /jobs` - Create and execute job
- `GET /jobs` - List all jobs
- `GET /jobs/:id` - Get job details
- `GET /jobs/:id/logs` - Get job logs (streaming)
- `POST /jobs/:id/ticket` - Create ticket from job

### Users
- `GET /users` - List all users (admin only)
- `GET /users/:id` - Get user details
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user

## 🔐 Role-Based Access Control

| Role | Permissions |
|------|------------|
| **admin** | Full access to all resources |
| **operator** | Create/execute jobs, manage servers and playbooks |
| **viewer** | Read-only access |

## 🧪 Development Commands

```bash
# Initialize database
flask init-db

# Create admin user interactively
flask create-admin

# Seed sample data (development only)
flask seed-data

# Run tests (if implemented)
pytest

# Start Celery worker
celery -A run.celery_app worker --loglevel=info

# Start Celery beat (for scheduled tasks)
celery -A run.celery_app beat --loglevel=info
```

## 📦 Production Deployment

### Using Gunicorn

```bash
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

### Using Systemd (Linux)

Create `/etc/systemd/system/infra-automation.service`:

```ini
[Unit]
Description=Infra Automation Platform
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/infra-automation/backend
Environment="PATH=/opt/infra-automation/backend/venv/bin"
ExecStart=/opt/infra-automation/backend/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 run:app

[Install]
WantedBy=multi-user.target
```

### Celery Worker Service

Create `/etc/systemd/system/infra-automation-celery.service`:

```ini
[Unit]
Description=Infra Automation Celery Worker
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/infra-automation/backend
Environment="PATH=/opt/infra-automation/backend/venv/bin"
ExecStart=/opt/infra-automation/backend/venv/bin/celery -A run.celery_app worker --loglevel=info

[Install]
WantedBy=multi-user.target
```

## 🔒 Security Considerations

- Change all secret keys in production
- Use strong passwords for database and Redis
- Configure firewall rules
- Use SSL/TLS for all connections
- Regularly update dependencies
- Implement rate limiting
- Enable audit logging
- Secure SSH keys with proper permissions (chmod 600)

## 📝 License

Proprietary - Internal Use Only

## 👥 Support

For issues or questions, create a ticket through the platform or contact the DevOps team.
