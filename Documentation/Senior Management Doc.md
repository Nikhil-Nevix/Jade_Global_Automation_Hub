# InfraAnsible — Vulnerability Update
### Executive Presentation Document
##### Prepared for Senior Management | Jade Global

---

## Overview

**InfraAnsible** is an intelligent infrastructure automation and security visibility platform built for enterprise IT teams. It enables organizations to manage their server infrastructure, automate routine IT tasks, and — with this update — gain real-time, visual insight into the security vulnerabilities present across their entire server estate.

The **Vulnerability Update** is the next major evolution of the platform. It introduces an end-to-end vulnerability intelligence pipeline: automated data collection from servers, secure data storage, and an interactive analytics dashboard — all accessible in one unified application.

---

## The Business Problem

Modern enterprise environments run hundreds or thousands of servers. Each server may have dozens of known software vulnerabilities — unpatched packages, outdated libraries, and known CVEs (Common Vulnerabilities and Exposures) — that represent real risk to the business.

The challenge for most organizations:

- Vulnerability data is scattered across spreadsheets and exported reports
- Security teams spend hours manually compiling data to understand exposure
- Leadership has no real-time visibility into which servers are at risk
- There is no easy way to track whether vulnerabilities are getting better or worse over time
- Clients have no self-service window into their own environment's security posture

**InfraAnsible solves all of this** by automating the collection, storage, and visualization of vulnerability data — giving every stakeholder exactly the view they need, in real time.

---

## What the Vulnerability Update Delivers

### 1. Automated Vulnerability Data Collection
The platform runs automated scans across all managed servers **every hour**, without any manual intervention. It can also be triggered on-demand by an authorized user at any time. Each scan collects detailed information about:

- Which servers have known vulnerabilities
- The severity of each vulnerability (Low, Medium, High, Critical)
- The specific CVE identifier for every issue
- The software component affected and the version that fixes it
- The server's role, environment (Development, QA, UAT, Staging, Production), and operating system

### 2. Secure, Permanent Data Storage
All scan results are stored securely in two places:
- **Raw data files** are archived in a dedicated, enterprise-grade object storage system (MinIO) — ensuring an immutable audit trail of every scan ever performed
- **Structured data** is stored in a high-performance database (PostgreSQL) optimized for fast querying and reporting

Data is retained **indefinitely**, enabling long-term trend analysis and compliance reporting.

### 3. Interactive Vulnerability Dashboard
The centerpiece of this update is the **Vulnerability Dashboard** — a fully interactive, embedded analytics experience built on Apache Superset, one of the most widely used open-source business intelligence platforms.

Clients and internal stakeholders can:
- **Filter by any dimension** — date range, severity level, asset group, server role, operating system, scan status
- **See trends over time** — is the organization reducing its vulnerability count month over month?
- **Drill down by server** — which specific servers have the most critical CVEs?
- **View compliance status** — which servers have completed scans vs. partial scans?
- **Export and share** — charts and tables can be exported for use in reports and board presentations

The dashboard is embedded directly inside the application — **no separate login, no separate tool** to learn.

---

## Who Uses the Platform

The application supports three types of users, each with appropriate access and controls:

### Internal Team (`@jadeglobal.com`)
The Jade Global engineering and operations team. They have full access to all features — managing servers, uploading playbooks, running scans, managing users, and administering the system.

### Client IT Team (`@intuitivesurgicals.com`)
The Intuitive Surgical IT team. They have access to the full platform, including playbook execution, job monitoring, and the vulnerability dashboard.

### Client Stakeholders (`@client.com`)
External client users — such as security managers, compliance officers, or executive stakeholders — who need visibility into the vulnerability data without managing the underlying infrastructure. They access the platform through the same application, logging in with their client credentials, and are taken directly to the **Vulnerability Dashboard**.

### Role Hierarchy (applies to all user types)

| Role | What They Can Do |
|---|---|
| **Super Admin** | Full control over everything in the application |
| **Admin** | Manage users, upload and edit playbooks, manage server inventory |
| **User** | Execute scans, view results, explore the dashboard |

> Access is automatically determined by the user's email domain. A new user from `@client.com` is provisioned instantly upon first login — no manual setup required.

---

## Key Features at a Glance

| Feature | Description |
|---|---|
| **Automated Hourly Scanning** | Vulnerability data collected from all active servers every 60 minutes |
| **On-Demand Scanning** | Any authorized user can trigger an immediate scan on selected servers or groups |
| **Tag-Based Server Groups** | Servers are organized into logical groups (tags) — scan an entire group with one click |
| **Manual IP Input** | New servers can be added and scanned by simply entering their IP address |
| **Real-Time Execution Logs** | Watch playbook execution in real time, line by line, in the browser |
| **Interactive Dashboard** | Fully filterable, drill-down analytics dashboard with charts and tables |
| **Historical Trend Analysis** | Every scan stored permanently — compare today's posture to last month's |
| **Secure File Archive** | Every CSV scan report stored securely with a permanent download link |
| **Role-Based Access Control** | Every user sees exactly what they are authorized to see — nothing more |
| **Single Sign-On Experience** | One login for the full platform including the dashboard — no separate tools |

---

## The Technology Foundation

The Vulnerability Update is built on a modern, enterprise-grade technology stack chosen for **performance, scalability, and security**:

| Component | Technology | Why It Was Chosen |
|---|---|---|
| **Backend API** | FastAPI (Python) | One of the fastest Python frameworks available; built for high-throughput APIs |
| **Database** | PostgreSQL | Industry-standard relational database; trusted by Fortune 500 companies |
| **File Archive** | MinIO | S3-compatible object storage; can be deployed on-premise with no data leaving the organization |
| **Analytics Dashboard** | Apache Superset | Used by Airbnb, Twitter, Netflix; enterprise-grade BI with no per-seat licensing cost |
| **Frontend** | React + TypeScript | Modern, responsive web interface |
| **Task Automation** | Celery + Redis | Reliable background job processing for scheduled and on-demand scans |

> All components run **on-premise, on the organization's own infrastructure** — no data is sent to any third-party cloud service.

---

## Data Flow — Simplified

```
  Servers in your environment
          │
          │  (Automated every hour, or on-demand)
          ▼
  Ansible scans servers and collects vulnerability data
          │
          ▼
  Scan report (CSV) is securely stored and archived
          │
          ▼
  Data is processed and loaded into the analytics database
          │
          ▼
  Vulnerability Dashboard updates automatically
          │
          ▼
  Your team and your clients view insights in the browser
```

---

## Security & Compliance Highlights

- **On-premise deployment** — all data stays within the organization's own network
- **Role-based access control** — users only see what they are permitted to see
- **Permanent audit trail** — every scan is archived with a timestamp, trigger type, and operator identity
- **Encrypted passwords** — user credentials are stored using industry-standard bcrypt hashing
- **JWT authentication** — all API communication is secured with short-lived signed tokens
- **No shared credentials** — every user has their own account; access can be revoked instantly

---

## Business Value Summary

| Outcome | How InfraAnsible Delivers It |
|---|---|
| **Reduced manual effort** | Automated hourly scans replace manual report compilation |
| **Faster risk response** | Real-time dashboard surfaces critical CVEs immediately |
| **Executive visibility** | Non-technical stakeholders can explore data without IT assistance |
| **Audit readiness** | Permanent, timestamped scan archive supports compliance requirements |
| **Client transparency** | Clients get a self-service view of their own environment's security posture |
| **Cost efficiency** | Entire stack is open-source; no per-seat licensing fees for dashboard or database |
| **Scalability** | Architecture supports hundreds of servers with no redesign required |

---

## Rollout Plan

| Phase | What Happens |
|---|---|
| **Phase 1 — Foundation** | New backend (FastAPI + PostgreSQL), user management, server inventory with tags |
| **Phase 2 — Pipeline** | Vulnerability playbook integration, MinIO storage, CSV parsing into database |
| **Phase 3 — Dashboard** | Apache Superset setup, dashboard creation, embedding in the application |
| **Phase 4 — Testing & Hardening** | End-to-end testing, performance validation, security review |
| **Phase 5 — Go Live** | Production deployment, existing system replaced, client access provisioned |

> The existing application remains **fully operational** throughout development. The new system is built alongside it and only replaces it at go-live — zero downtime risk during development.

---

*Document prepared by Jade Global Engineering Team — InfraAnsible Vulnerability Update*
