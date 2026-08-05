# Version 1 — Feature Overview

### Jade Global Automation Hub — *InfraAnsible Vulnerability Edition*

> Version 1 is the foundational release: an enterprise infrastructure-automation
> platform with integrated vulnerability management. It combines Ansible-based
> playbook execution, server fleet management, and a Qualys-style vulnerability
> dashboard with embedded Superset analytics.

---

## 1. Platform Architecture

The application runs as a multi-process stack on a single VM:

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | React + Vite + TypeScript + Tailwind | Single-page web UI |
| **Backend** | FastAPI (async) + SQLAlchemy | REST API + WebSocket |
| **Database** | PostgreSQL (asyncpg) | Primary datastore |
| **Task queue** | Celery + Redis | Playbook execution & scan ingestion |
| **Object storage** | MinIO | Raw scan CSV storage |
| **Analytics** | Apache Superset (embedded) | Interactive dashboards |
| **Real-time** | Socket.IO (Redis-backed) | Live job log streaming |

---

## 2. Authentication & Authorization

- **JWT-based auth** — access + refresh tokens, with token refresh and change-password flows.
- **Role-Based Access Control (RBAC)** — roles from `user` up to `super_admin`.
- **Multi-tenancy** — accounts are scoped to a **domain**, auto-detected from the user's email at signup.
- **Session management** — secure login/logout with the auth state persisted client-side.

## 3. User Management

- Create, view, and manage users.
- Role assignment and promotion (e.g. promoting the first admin to `super_admin`).
- Per-user profile and settings.

## 4. Server Management

- Register and manage servers across the estate (IP, DNS, OS, roles, metadata).
- **Tagging system** — group servers under tags for bulk operations and targeted scans.
- Server inventory browsing and filtering.

## 5. Playbook Management

- **Upload Ansible playbooks** — single files or folders.
- **ZIP upload** — bundle and upload multi-file playbooks.
- Playbook versioning metadata (file hash, size, file count, active status).
- Playbook library browsing and organisation.

## 6. Job Execution & Monitoring

- **Run playbooks** against selected servers or tags.
- **Asynchronous execution** via Celery workers (Ansible Runner).
- **Real-time log streaming** — live job output over Socket.IO as the playbook runs.
- **Job history & details** — status tracking (pending / running / completed / failed), per-job logs, and cancellation.
- **Batch jobs** — run across multiple servers in one operation.

## 7. Vulnerability Management

The core security feature set of Version 1.

- **Scheduled scans** — an hourly scan runs automatically (Celery beat).
- **On-demand scans** — trigger a scan from the dashboard by selecting server tags and/or entering IP addresses.
- **CSV ingestion pipeline** — scan results (Qualys-style CSV) are parsed, stored in MinIO, and loaded into the database.
- **Rich finding model** — each finding captures IP, network, DNS, NetBIOS, OS/OS family, title, severity, CVE ID, vendor reference, threat, impact, solution, results, **QDS (Qualys Detection Score)**, asset group, server role, scan status, and scan date.

### Vulnerability Dashboard (V1)

- **Severity summary cards** — Total, Critical, High, Medium, Low counts.
- **QDS Distribution chart** — distinct servers bucketed by Qualys Detection Score range.
- **Historical scan selector** — switch the whole dashboard between scan runs (grouped by date).
- **Recent Scans table** — run history with status, server count, completion time, and CSV download.
- **Embedded Superset analytics** — an interactive Superset dashboard embedded directly in the page via guest-token authentication, with per-customer private dashboards and an in-app "Customize" editor bridge.

## 8. Notifications

- In-app notification centre (read / unread / mark-all-read).
- **Notification preferences** — per-user configuration of what triggers alerts.
- Unread-count badges.

## 9. Audit & Logging

- **Audit logs** — a record of significant actions across the platform.
- **Playbook audit logs** — dedicated tracking of playbook execution history and changes.

---

## 10. Data Model (V1)

Core tables: `users`, `tags`, `servers`, `playbooks`, `jobs`, `job_logs`,
`notifications`, `notification_preferences`, `audit_logs`, `playbook_audit_logs`,
`scan_runs`, `vulnerability_findings`.

---

*Version 1 establishes the platform foundation. See [Version2.md](Version2.md) for
the analytics enhancements layered on top.*
