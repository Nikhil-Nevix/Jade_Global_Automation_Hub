# InfraAnsible Project - Deployment Plan to New Linux VM
**Project Start Date:** April 6, 2026  
**Environment Type:** Production with Security Hardening  
**Team:** Nikhil (Developer), Abhishek & Rohit (Linux Admin)

---

## 📋 CURRENT PROJECT STATUS (as of March 30, 2026)

### ✅ Development Status: COMPLETED
The application has been fully developed and tested on the development machine with the following features:

**Completed Development Work:**
- ✅ Full-stack application (Flask backend + React frontend)
- ✅ User authentication & RBAC system (Admin, Developer, Viewer roles)
- ✅ Server management module
- ✅ Playbook management (single file & ZIP folder upload)
- ✅ Interactive playbook system with user prompts
- ✅ Multi-server parallel execution
- ✅ Real-time job execution logs via WebSocket
- ✅ PDF export functionality
- ✅ Analytics dashboard with charts and metrics
- ✅ Notification system (email & in-app)
- ✅ Audit logging system
- ✅ Database schema with all tables and relationships
- ✅ Celery task queue for async jobs
- ✅ Security features (path traversal protection, file validation)

**Application Health Score: 95/100** (per audit report)

### 🔄 Deployment Status: PENDING
- **New Linux VM:** Not yet provisioned
- **Project Start Date:** April 6, 2026
- **All deployment tasks:** Status = "Pending" (awaiting project start)

### 📦 Ready for Deployment:
- Source code available in Git repository
- Database schema file: `backend/schema.sql`
- Requirements: `backend/requirements.txt`, `frontend/package.json`
- Configuration templates: `.env.example` files
- Documentation: Complete user & technical docs

---

## Project Plan

| Sr.No | Main Task | Sub Task | Owner | Start Date | End Date | Status | Comment |
|-------|-----------|----------|-------|------------|----------|---------|---------|
| **1** | **Linux VM Setup & Preparation** | | | **06-Apr-2026** | **08-Apr-2026** | **Pending** | **New VM not yet provisioned** |
| 1.1 | | Provision new Linux VM (CentOS/RHEL/Ubuntu) | Linux Admin (Abhishek) | 06-Apr-2026 | 06-Apr-2026 | Pending | Allocate resources: 4GB RAM, 40GB disk, 2 CPU |
| 1.2 | | Configure hostname, network, and static IP | Linux Admin (Rohit) | 06-Apr-2026 | 06-Apr-2026 | Pending | Set production IP address |
| 1.3 | | Update OS packages and security patches | Linux Admin (Abhishek) | 06-Apr-2026 | 06-Apr-2026 | Pending | yum/apt update & upgrade |
| 1.4 | | Configure firewall (firewalld/ufw) | Linux Admin (Rohit) | 07-Apr-2026 | 07-Apr-2026 | Pending | Open ports: 80, 443, 5000, 5174 (temp) |
| 1.5 | | Set up SELinux/AppArmor policies | Linux Admin (Abhishek) | 07-Apr-2026 | 07-Apr-2026 | Pending | Enforce security policies |
| 1.6 | | Create service user accounts | Linux Admin (Rohit) | 07-Apr-2026 | 07-Apr-2026 | Pending | Create ansible_user, app_user |
| 1.7 | | Configure SSH hardening | Linux Admin (Abhishek) | 07-Apr-2026 | 07-Apr-2026 | Pending | Disable root login, key-only auth |
| 1.8 | | Set up log rotation and monitoring | Linux Admin (Rohit) | 08-Apr-2026 | 08-Apr-2026 | Pending | Configure logrotate, rsyslog |
| **2** | **Database Installation & Configuration** | | | **08-Apr-2026** | **09-Apr-2026** | **Pending** | **Schema ready, needs new VM** |
| 2.1 | | Install MySQL Community 8.4.9 | Linux Admin (Abhishek) | 08-Apr-2026 | 08-Apr-2026 | Pending | Installed: mysql-community-server 8.4.9 (service: mysqld) |
| 2.2 | | Run mysql_secure_installation | Linux Admin (Abhishek) | 08-Apr-2026 | 08-Apr-2026 | Pending | Remove test DB, set root password |
| 2.3 | | Create database 'infra_automation' | Linux Admin (Rohit) | 08-Apr-2026 | 08-Apr-2026 | Pending | CREATE DATABASE infra_automation; |
| 2.4 | | Create database user with privileges | Linux Admin (Rohit) | 08-Apr-2026 | 08-Apr-2026 | Pending | GRANT ALL ON infra_automation.* |
| 2.5 | | Configure MySQL for remote access (if needed) | Linux Admin (Abhishek) | 09-Apr-2026 | 09-Apr-2026 | Pending | bind-address in /etc/my.cnf |
| 2.6 | | Set up automated database backups | Linux Admin (Rohit) | 09-Apr-2026 | 09-Apr-2026 | Pending | Create cron job for mysqldump |
| 2.7 | | Optimize database configuration | Linux Admin (Abhishek) | 09-Apr-2026 | 09-Apr-2026 | Pending | Tune InnoDB settings for performance |
| 2.8 | | Enable database audit logging | Linux Admin (Rohit) | 09-Apr-2026 | 09-Apr-2026 | Pending | Enable general_log for production |
| **3** | **Redis Installation & Configuration** | | | **09-Apr-2026** | **10-Apr-2026** | **Pending** | **Needs new VM installation** |
| 3.1 | | Install Redis 6.0+ from repository | Linux Admin (Abhishek) | 09-Apr-2026 | 09-Apr-2026 | Pending | yum/apt install redis |
| 3.2 | | Configure Redis for production | Linux Admin (Rohit) | 09-Apr-2026 | 09-Apr-2026 | Pending | Set maxmemory, persistence, bind |
| 3.3 | | Set Redis password authentication | Linux Admin (Abhishek) | 09-Apr-2026 | 09-Apr-2026 | Pending | requirepass in redis.conf |
| 3.4 | | Enable Redis systemd service | Linux Admin (Rohit) | 10-Apr-2026 | 10-Apr-2026 | Pending | systemctl enable redis |
| 3.5 | | Configure Redis persistence (AOF/RDB) | Linux Admin (Abhishek) | 10-Apr-2026 | 10-Apr-2026 | Pending | Balance between speed and durability |
| **4** | **Python Environment Setup** | | | **10-Apr-2026** | **11-Apr-2026** | **Pending** | **Needs new VM installation** |
| 4.1 | | Install Python 3.11+ | Linux Admin (Abhishek) | 10-Apr-2026 | 10-Apr-2026 | Pending | From repos or compile source |
| 4.2 | | Install pip and virtualenv | Linux Admin (Abhishek) | 10-Apr-2026 | 10-Apr-2026 | Pending | python3-pip, python3-venv |
| 4.3 | | Install system dependencies | Linux Admin (Rohit) | 10-Apr-2026 | 10-Apr-2026 | Pending | gcc, python3-devel, mysql-devel |
| 4.4 | | Create application directory structure | Linux Admin (Rohit) | 11-Apr-2026 | 11-Apr-2026 | Pending | /opt/infraansible/{backend,frontend} |
| 4.5 | | Set correct ownership and permissions | Linux Admin (Abhishek) | 11-Apr-2026 | 11-Apr-2026 | Pending | chown app_user:app_user |
| **5** | **Node.js & npm Installation** | | | **11-Apr-2026** | **11-Apr-2026** | **Pending** | **Needs new VM installation** |
| 5.1 | | Install Node.js 18+ LTS | Linux Admin (Rohit) | 11-Apr-2026 | 11-Apr-2026 | Pending | Use NodeSource repository |
| 5.2 | | Install npm and verify versions | Linux Admin (Rohit) | 11-Apr-2026 | 11-Apr-2026 | Pending | node -v, npm -v |
| 5.3 | | Install build tools (gcc, make) | Linux Admin (Abhishek) | 11-Apr-2026 | 11-Apr-2026 | Pending | For native npm modules |
| **6** | **Ansible Installation** | | | **11-Apr-2026** | **12-Apr-2026** | **Pending** | **Needs new VM installation** |
| 6.1 | | Install Ansible 8.7.0 via pip | Developer (Nikhil) | 11-Apr-2026 | 11-Apr-2026 | Pending | In virtualenv |
| 6.2 | | Install ansible-runner 2.3.4 | Developer (Nikhil) | 11-Apr-2026 | 11-Apr-2026 | Pending | Required for backend |
| 6.3 | | Configure Ansible defaults | Developer (Nikhil) | 12-Apr-2026 | 12-Apr-2026 | Pending | /etc/ansible/ansible.cfg |
| 6.4 | | Set up SSH key management | Linux Admin (Abhishek) | 12-Apr-2026 | 12-Apr-2026 | Pending | Generate keys for ansible_user |
| 6.5 | | Test Ansible connectivity | Developer (Nikhil) | 12-Apr-2026 | 12-Apr-2026 | Pending | ansible all -m ping |
| **7** | **Code Deployment - Backend** | | | **12-Apr-2026** | **14-Apr-2026** | **Pending** | **Code ready, awaiting new VM** |
| 7.1 | | Transfer backend code to VM | Developer (Nikhil) | 12-Apr-2026 | 12-Apr-2026 | Pending | Use git clone or scp - Code available in repo |
| 7.2 | | Create Python virtual environment | Developer (Nikhil) | 12-Apr-2026 | 12-Apr-2026 | Pending | python3 -m venv venv |
| 7.3 | | Install backend dependencies | Developer (Nikhil) | 13-Apr-2026 | 13-Apr-2026 | Pending | pip install -r requirements.txt |
| 7.4 | | Configure .env file for production | Developer (Nikhil) | 13-Apr-2026 | 13-Apr-2026 | Pending | DB credentials, JWT secret, Redis URL |
| 7.5 | | Run database migrations | Developer (Nikhil) | 13-Apr-2026 | 13-Apr-2026 | Pending | flask db upgrade |
| 7.6 | | Import database schema | Developer (Nikhil) | 13-Apr-2026 | 13-Apr-2026 | Pending | mysql < schema.sql - Schema available |
| 7.7 | | Create initial admin user | Developer (Nikhil) | 14-Apr-2026 | 14-Apr-2026 | Pending | Run user creation script |
| 7.8 | | Configure application logs directory | Linux Admin (Rohit) | 14-Apr-2026 | 14-Apr-2026 | Pending | /var/log/infraansible/ |
| **8** | **Code Deployment - Frontend** | | | **14-Apr-2026** | **15-Apr-2026** | **Pending** | **Code ready, awaiting new VM** |
| 8.1 | | Transfer frontend code to VM | Developer (Nikhil) | 14-Apr-2026 | 14-Apr-2026 | Pending | Use git clone or scp - Code available in repo |
| 8.2 | | Install npm dependencies | Developer (Nikhil) | 14-Apr-2026 | 14-Apr-2026 | Pending | npm install |
| 8.3 | | Configure .env for production | Developer (Nikhil) | 14-Apr-2026 | 14-Apr-2026 | Pending | API URL, production settings |
| 8.4 | | Build production frontend | Developer (Nikhil) | 15-Apr-2026 | 15-Apr-2026 | Pending | npm run build |
| 8.5 | | Configure build output location | Developer (Nikhil) | 15-Apr-2026 | 15-Apr-2026 | Pending | dist/ folder for nginx |
| **9** | **Web Server Configuration (Nginx)** | | | **15-Apr-2026** | **16-Apr-2026** | **Pending** | **Needs new VM setup** |
| 9.1 | | Install Nginx 1.20+ | Linux Admin (Abhishek) | 15-Apr-2026 | 15-Apr-2026 | Not Started | yum/apt install nginx |
| 9.2 | | Configure Nginx reverse proxy for backend | Linux Admin (Abhishek) | 15-Apr-2026 | 15-Apr-2026 | Not Started | Proxy /api to localhost:5000 |
| 9.3 | | Configure Nginx to serve frontend | Linux Admin (Abhishek) | 15-Apr-2026 | 15-Apr-2026 | Not Started | Serve from dist/ folder |
| 9.4 | | Enable gzip compression | Linux Admin (Rohit) | 16-Apr-2026 | 16-Apr-2026 | Not Started | For static assets |
| 9.5 | | Configure CORS headers | Linux Admin (Rohit) | 16-Apr-2026 | 16-Apr-2026 | Not Started | If needed for API |
| 9.6 | | Set up access and error logs | Linux Admin (Abhishek) | 16-Apr-2026 | 16-Apr-2026 | Not Started | /var/log/nginx/ |
| 9.7 | | Configure client_max_body_size | Linux Admin (Rohit) | 16-Apr-2026 | 16-Apr-2026 | Not Started | For ZIP uploads (20MB+) |
| **10** | **SSL/TLS Certificate Setup** | | | **16-Apr-2026** | **17-Apr-2026** | **Not Started** | **HTTPS configuration** |
| 10.1 | | Install Certbot for Let's Encrypt | Linux Admin (Abhishek) | 16-Apr-2026 | 16-Apr-2026 | Not Started | Or use company CA |
| 10.2 | | Generate SSL certificate | Linux Admin (Abhishek) | 16-Apr-2026 | 16-Apr-2026 | Not Started | certbot --nginx |
| 10.3 | | Configure Nginx SSL settings | Linux Admin (Rohit) | 17-Apr-2026 | 17-Apr-2026 | Not Started | TLS 1.2+, strong ciphers |
| 10.4 | | Set up auto-renewal for certificates | Linux Admin (Abhishek) | 17-Apr-2026 | 17-Apr-2026 | Not Started | Cron job for renewal |
| 10.5 | | Force HTTPS redirect | Linux Admin (Rohit) | 17-Apr-2026 | 17-Apr-2026 | Not Started | HTTP to HTTPS redirect |
| 10.6 | | Configure HSTS headers | Linux Admin (Rohit) | 17-Apr-2026 | 17-Apr-2026 | Not Started | Security headers |
| **11** | **Systemd Service Configuration** | | | **17-Apr-2026** | **18-Apr-2026** | **Not Started** | **Auto-start services** |
| 11.1 | | Create systemd service for Flask/Gunicorn | Linux Admin (Abhishek) | 17-Apr-2026 | 17-Apr-2026 | Not Started | /etc/systemd/system/infraansible-backend.service |
| 11.2 | | Create systemd service for Celery Worker | Linux Admin (Rohit) | 17-Apr-2026 | 17-Apr-2026 | Not Started | /etc/systemd/system/infraansible-celery.service |
| 11.3 | | Configure service dependencies | Linux Admin (Abhishek) | 18-Apr-2026 | 18-Apr-2026 | Not Started | After=redis.service mysqld.service |
| 11.4 | | Enable services on boot | Linux Admin (Rohit) | 18-Apr-2026 | 18-Apr-2026 | Not Started | systemctl enable all services |
| 11.5 | | Configure service restart policies | Linux Admin (Abhishek) | 18-Apr-2026 | 18-Apr-2026 | Not Started | Restart=always |
| 11.6 | | Set up service monitoring scripts | Linux Admin (Rohit) | 18-Apr-2026 | 18-Apr-2026 | Not Started | Health check scripts |
| **12** | **Application Configuration** | | | **18-Apr-2026** | **19-Apr-2026** | **Not Started** | **Fine-tuning** |
| 12.1 | | Configure Flask for production | Developer (Nikhil) | 18-Apr-2026 | 18-Apr-2026 | Not Started | Debug=False, secret keys |
| 12.2 | | Configure Gunicorn workers | Developer (Nikhil) | 18-Apr-2026 | 18-Apr-2026 | Not Started | Workers = (2 x CPU) + 1 |
| 12.3 | | Set up JWT token expiration | Developer (Nikhil) | 18-Apr-2026 | 18-Apr-2026 | Not Started | Secure token settings |
| 12.4 | | Configure CORS for frontend domain | Developer (Nikhil) | 19-Apr-2026 | 19-Apr-2026 | Not Started | Flask-CORS settings |
| 12.5 | | Set up file upload limits | Developer (Nikhil) | 19-Apr-2026 | 19-Apr-2026 | Not Started | Max 20MB for ZIP uploads |
| 12.6 | | Configure session management | Developer (Nikhil) | 19-Apr-2026 | 19-Apr-2026 | Not Started | Session timeout, storage |
| 12.7 | | Set up environment-specific configs | Developer (Nikhil) | 19-Apr-2026 | 19-Apr-2026 | Not Started | Production vs staging |
| **13** | **Security Hardening** | | | **19-Apr-2026** | **21-Apr-2026** | **Not Started** | **Production security** |
| 13.1 | | Implement rate limiting | Developer (Nikhil) | 19-Apr-2026 | 19-Apr-2026 | Not Started | Flask-Limiter for API |
| 13.2 | | Configure fail2ban for SSH | Linux Admin (Abhishek) | 19-Apr-2026 | 19-Apr-2026 | Not Started | Ban repeated login failures |
| 13.3 | | Set up audit logging (auditd) | Linux Admin (Rohit) | 20-Apr-2026 | 20-Apr-2026 | Not Started | Track system changes |
| 13.4 | | Harden file permissions | Linux Admin (Abhishek) | 20-Apr-2026 | 20-Apr-2026 | Not Started | Restrict sensitive files |
| 13.5 | | Configure security headers in Nginx | Linux Admin (Rohit) | 20-Apr-2026 | 20-Apr-2026 | Not Started | X-Frame-Options, CSP, etc. |
| 13.6 | | Disable unnecessary services | Linux Admin (Abhishek) | 20-Apr-2026 | 20-Apr-2026 | Not Started | Minimize attack surface |
| 13.7 | | Set up intrusion detection (optional) | Linux Admin (Rohit) | 21-Apr-2026 | 21-Apr-2026 | Not Started | AIDE or Tripwire |
| 13.8 | | Configure password policies | Linux Admin (Abhishek) | 21-Apr-2026 | 21-Apr-2026 | Not Started | PAM settings |
| 13.9 | | Review and apply CIS benchmarks | Linux Admin (Rohit) | 21-Apr-2026 | 21-Apr-2026 | Not Started | Security best practices |
| **14** | **Monitoring & Logging Setup** | | | **21-Apr-2026** | **22-Apr-2026** | **Not Started** | **Observability** |
| 14.1 | | Set up centralized logging | Linux Admin (Abhishek) | 21-Apr-2026 | 21-Apr-2026 | Not Started | rsyslog to central server |
| 14.2 | | Configure application logging | Developer (Nikhil) | 21-Apr-2026 | 21-Apr-2026 | Not Started | Python logging module |
| 14.3 | | Set up log rotation | Linux Admin (Rohit) | 22-Apr-2026 | 22-Apr-2026 | Not Started | Rotate daily, keep 30 days |
| 14.4 | | Install monitoring agent (optional) | Linux Admin (Abhishek) | 22-Apr-2026 | 22-Apr-2026 | Not Started | Prometheus node_exporter |
| 14.5 | | Configure disk space alerts | Linux Admin (Rohit) | 22-Apr-2026 | 22-Apr-2026 | Not Started | Alert at 80% usage |
| 14.6 | | Set up service health checks | Developer (Nikhil) | 22-Apr-2026 | 22-Apr-2026 | Not Started | /health endpoint |
| **15** | **Data Migration & Initialization** | | | **22-Apr-2026** | **23-Apr-2026** | **Not Started** | **Initial data setup** |
| 15.1 | | Create RBAC roles and permissions | Developer (Nikhil) | 22-Apr-2026 | 22-Apr-2026 | Not Started | Admin, Developer, Viewer roles |
| 15.2 | | Create default user accounts | Developer (Nikhil) | 22-Apr-2026 | 22-Apr-2026 | Not Started | Admin, test users |
| 15.3 | | Import initial server inventory | Developer (Nikhil) | 23-Apr-2026 | 23-Apr-2026 | Not Started | Production servers |
| 15.4 | | Upload sample playbooks | Developer (Nikhil) | 23-Apr-2026 | 23-Apr-2026 | Not Started | Test playbooks |
| 15.5 | | Configure notification settings | Developer (Nikhil) | 23-Apr-2026 | 23-Apr-2026 | Not Started | Email, Slack, etc. |
| **16** | **Testing & Validation** | | | **23-Apr-2026** | **25-Apr-2026** | **Not Started** | **Quality assurance** |
| 16.1 | | Test user authentication (login/logout) | Developer (Nikhil) | 23-Apr-2026 | 23-Apr-2026 | Not Started | All user roles |
| 16.2 | | Test RBAC permissions | Developer (Nikhil) | 23-Apr-2026 | 23-Apr-2026 | Not Started | Verify role restrictions |
| 16.3 | | Test server management (add/edit/delete) | Developer (Nikhil) | 24-Apr-2026 | 24-Apr-2026 | Not Started | CRUD operations |
| 16.4 | | Test playbook upload (single file) | Developer (Nikhil) | 24-Apr-2026 | 24-Apr-2026 | Not Started | YAML file upload |
| 16.5 | | Test playbook upload (ZIP folder) | Developer (Nikhil) | 24-Apr-2026 | 24-Apr-2026 | Not Started | Complex playbook structures |
| 16.6 | | Test playbook execution | Developer (Nikhil) | 24-Apr-2026 | 24-Apr-2026 | Not Started | Run against test server |
| 16.7 | | Test real-time execution logs | Developer (Nikhil) | 24-Apr-2026 | 24-Apr-2026 | Not Started | SocketIO streaming |
| 16.8 | | Test PDF export functionality | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | Export execution reports |
| 16.9 | | Test analytics dashboard | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | Charts and metrics |
| 16.10 | | Test notification system | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | Email/alerts on completion |
| 16.11 | | Test interactive playbook system | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | User prompts during execution |
| 16.12 | | Test multi-server execution | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | Parallel execution |
| 16.13 | | Load testing | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | Simulate concurrent users |
| **17** | **Performance Optimization** | | | **25-Apr-2026** | **26-Apr-2026** | **Not Started** | **Tuning** |
| 17.1 | | Optimize database queries | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | Add indexes, analyze slow queries |
| 17.2 | | Configure database connection pooling | Developer (Nikhil) | 25-Apr-2026 | 25-Apr-2026 | Not Started | SQLAlchemy pool settings |
| 17.3 | | Optimize frontend bundle size | Developer (Nikhil) | 26-Apr-2026 | 26-Apr-2026 | Not Started | Code splitting, tree shaking |
| 17.4 | | Configure Redis cache strategies | Developer (Nikhil) | 26-Apr-2026 | 26-Apr-2026 | Not Started | Cache frequently accessed data |
| 17.5 | | Optimize Nginx buffer sizes | Linux Admin (Abhishek) | 26-Apr-2026 | 26-Apr-2026 | Not Started | Tune for application needs |
| **18** | **Backup & Disaster Recovery** | | | **26-Apr-2026** | **27-Apr-2026** | **Not Started** | **Data protection** |
| 18.1 | | Set up automated database backups | Linux Admin (Rohit) | 26-Apr-2026 | 26-Apr-2026 | Not Started | Daily mysqldump to backup location |
| 18.2 | | Configure backup retention policy | Linux Admin (Rohit) | 26-Apr-2026 | 26-Apr-2026 | Not Started | Keep 30 days, archive monthly |
| 18.3 | | Set up playbook files backup | Linux Admin (Abhishek) | 26-Apr-2026 | 26-Apr-2026 | Not Started | Backup uploaded playbooks |
| 18.4 | | Test backup restoration process | Linux Admin (Rohit) | 27-Apr-2026 | 27-Apr-2026 | Not Started | Verify backup integrity |
| 18.5 | | Document disaster recovery procedures | Developer (Nikhil) | 27-Apr-2026 | 27-Apr-2026 | Not Started | Step-by-step recovery guide |
| 18.6 | | Set up offsite backup replication | Linux Admin (Abhishek) | 27-Apr-2026 | 27-Apr-2026 | Not Started | Copy to remote location |
| **19** | **Documentation** | | | **27-Apr-2026** | **28-Apr-2026** | **Not Started** | **Knowledge transfer** |
| 19.1 | | Document deployment architecture | Developer (Nikhil) | 27-Apr-2026 | 27-Apr-2026 | Not Started | System diagram |
| 19.2 | | Create operations manual | Linux Admin (Abhishek) | 27-Apr-2026 | 27-Apr-2026 | Not Started | Start/stop/restart procedures |
| 19.3 | | Document troubleshooting guide | Developer (Nikhil) | 28-Apr-2026 | 28-Apr-2026 | Not Started | Common issues & solutions |
| 19.4 | | Create user manual | Developer (Nikhil) | 28-Apr-2026 | 28-Apr-2026 | Not Started | End-user guide |
| 19.5 | | Document API endpoints | Developer (Nikhil) | 28-Apr-2026 | 28-Apr-2026 | Not Started | Update API_DOCS.md |
| 19.6 | | Create maintenance runbook | Linux Admin (Rohit) | 28-Apr-2026 | 28-Apr-2026 | Not Started | Routine maintenance tasks |
| **20** | **User Training & Handover** | | | **28-Apr-2026** | **29-Apr-2026** | **Not Started** | **Knowledge transfer** |
| 20.1 | | Conduct admin training session | Developer (Nikhil) | 28-Apr-2026 | 28-Apr-2026 | Not Started | Train administrators |
| 20.2 | | Conduct end-user training | Developer (Nikhil) | 28-Apr-2026 | 28-Apr-2026 | Not Started | Train regular users |
| 20.3 | | Review security procedures | Linux Admin (Abhishek) | 29-Apr-2026 | 29-Apr-2026 | Not Started | Security policies |
| 20.4 | | Handover credentials securely | Linux Admin (Rohit) | 29-Apr-2026 | 29-Apr-2026 | Not Started | Use password manager |
| **21** | **Go-Live Preparation** | | | **29-Apr-2026** | **30-Apr-2026** | **Not Started** | **Final checks** |
| 21.1 | | Final security audit | Linux Admin (Abhishek) | 29-Apr-2026 | 29-Apr-2026 | Not Started | Vulnerability scan |
| 21.2 | | Verify all services running | Linux Admin (Rohit) | 29-Apr-2026 | 29-Apr-2026 | Not Started | systemctl status all |
| 21.3 | | Verify monitoring and alerts | Developer (Nikhil) | 29-Apr-2026 | 29-Apr-2026 | Not Started | Test alert triggers |
| 21.4 | | Final backup before go-live | Linux Admin (Rohit) | 30-Apr-2026 | 30-Apr-2026 | Not Started | Complete system backup |
| 21.5 | | Update DNS records (if applicable) | Linux Admin (Abhishek) | 30-Apr-2026 | 30-Apr-2026 | Not Started | Point domain to new server |
| 21.6 | | Go-Live announcement | Developer (Nikhil) | 30-Apr-2026 | 30-Apr-2026 | Not Started | Notify stakeholders |
| **22** | **Post-Deployment Monitoring** | | | **30-Apr-2026** | **03-May-2026** | **Not Started** | **Stabilization period** |
| 22.1 | | Monitor application logs | Developer (Nikhil) | 30-Apr-2026 | 03-May-2026 | Not Started | Watch for errors |
| 22.2 | | Monitor system resources | Linux Admin (Abhishek) | 30-Apr-2026 | 03-May-2026 | Not Started | CPU, memory, disk usage |
| 22.3 | | Monitor database performance | Developer (Nikhil) | 30-Apr-2026 | 03-May-2026 | Not Started | Query performance |
| 22.4 | | Collect user feedback | Developer (Nikhil) | 30-Apr-2026 | 03-May-2026 | Not Started | Issues and improvements |
| 22.5 | | Address immediate issues | Developer (Nikhil) | 30-Apr-2026 | 03-May-2026 | Not Started | Quick fixes |
| 22.6 | | Project closure & lessons learned | All Team | 03-May-2026 | 03-May-2026 | Not Started | Review and document |

---

## Project Summary

**Total Duration:** April 6, 2026 - May 3, 2026 (27 days)  
**Total Tasks:** 22 Main Tasks, 153 Sub Tasks

### ⏸️ Current Status Overview (March 30, 2026):
- **Development Work:** ✅ COMPLETED (100%)
- **Deployment Work:** ⏳ PENDING (0% - awaiting VM provisioning)
- **Application Code:** ✅ Ready in Git repository
- **Documentation:** ✅ Complete
- **Team:** ✅ Assigned and ready
- **Project Start:** 📅 April 6, 2026 (7 days from now)

### Task Distribution by Status:
- **Completed:** 0 tasks (Development already done on current machine)
- **Pending:** 153 tasks (All deployment activities)
- **In Progress:** 0 tasks
- **Blocked:** 0 tasks

### Task Distribution by Owner:
- **Developer (Nikhil):** 60 tasks
- **Linux Admin (Abhishek):** 47 tasks  
- **Linux Admin (Rohit):** 43 tasks
- **All Team:** 3 tasks

### Key Milestones:
1. **Infrastructure Ready:** April 12, 2026
2. **Code Deployed:** April 15, 2026
3. **Services Configured:** April 19, 2026
4. **Security Hardened:** April 21, 2026
5. **Testing Complete:** April 25, 2026
6. **Documentation Done:** April 28, 2026
7. **Go-Live:** April 30, 2026
8. **Stabilization:** May 3, 2026

### Critical Dependencies:
- VM must be provisioned before any other work
- Database must be ready before code deployment
- Backend must be deployed before frontend
- All services must be tested before go-live

### Risk Factors:
- SSL certificate procurement delays
- Network/firewall configuration issues
- Permission and security policy conflicts
- Database migration issues
- Performance bottlenecks under load

---

## Technology Stack

### Backend:
- Python 3.11+
- Flask 3.0
- SQLAlchemy 2.0
- MariaDB/MySQL 8.0+
- Redis 6.0+
- Celery 5.3
- Ansible 8.7
- Gunicorn

### Frontend:
- React 18
- TypeScript 5.3
- Vite 6.4
- TailwindCSS
- Socket.IO

### Infrastructure:
- Linux (CentOS/RHEL/Ubuntu)
- Nginx 1.20+
- Systemd
- Let's Encrypt/SSL
- Firewalld/UFW

---

## Notes:
- All dates are estimates and may need adjustment based on actual progress
- Each task should be marked as "In Progress" when started and "Completed" when finished
- Blocked tasks should have comments explaining the blocker
- Daily standup recommended to track progress
- Security review required at each major phase
- Backup tested before any destructive operation

---

## 📊 Quick Status Reference

### Legend:
- **Pending** = Task scheduled but not yet started (project starts April 6, 2026)
- **In Progress** = Task currently being worked on
- **Completed** = Task finished and verified
- **Blocked** = Task cannot proceed due to dependencies

### How to Update This Plan:
1. When a task begins: Change status from "Pending" → "In Progress"
2. When a task completes: Change status to "Completed" and add completion notes in Comment
3. If blocked: Change status to "Blocked" and document the blocker in Comment
4. Update dates if timeline changes

### Next Steps:
1. **Week of April 6:** Linux admins provision and configure new VM (Tasks 1-6)
2. **Week of April 13:** Deploy application code and configure services (Tasks 7-12)
3. **Week of April 20:** Security hardening and testing (Tasks 13-17)
4. **Week of April 27:** Documentation, training, and go-live (Tasks 18-22)

---

**Document Version:** 1.1  
**Last Updated:** March 30, 2026  
**Updated By:** Nikhil (Developer)  
**Next Review Date:** April 6, 2026 (Project kickoff)
