# Version 2 — Feature Overview

### Jade Global Automation Hub — *InfraAnsible Vulnerability Edition*

> Version 2 builds directly on the Version 1 foundation. It keeps **all** existing
> platform capabilities and layers a significantly richer set of **risk analytics**
> onto the Vulnerability Dashboard — turning it from a findings viewer into an
> executive-grade security posture dashboard.
>
> For the base platform, see [Version1.md](Version1.md).

---

## Part A — Inherited from Version 1 (unchanged)

All Version 1 features remain fully intact:

- **Authentication & Authorization** — JWT, RBAC (`user` → `super_admin`), domain-scoped multi-tenancy.
- **User Management** — user CRUD, roles, profile/settings.
- **Server Management** — server inventory + tagging.
- **Playbook Management** — file / folder / ZIP upload, versioning metadata.
- **Job Execution & Monitoring** — Celery-backed Ansible runs, real-time Socket.IO log streaming, job history, batch jobs.
- **Vulnerability Management** — scheduled + on-demand scans, CSV ingestion via MinIO.
- **Vulnerability Dashboard (base)** — severity summary cards, QDS Distribution chart, historical scan selector, Recent Scans table, embedded Superset analytics.
- **Notifications** — notification centre + per-user preferences.
- **Audit & Logging** — audit logs + playbook audit logs.

---

## Part B — New in Version 2

Eight new analytics features were added to the **existing** Vulnerability Dashboard
page (no new page), backed by new data, API endpoints, and an enrichment pipeline.

### 1. True Risk Score
A severity-weighted refinement of the raw QDS score, giving a more realistic
prioritisation signal.

> `True Risk Score = min(QDS × weight, 100)`
>
> | Severity | Weight |
> |----------|--------|
> | Critical | 1.25 |
> | High | 1.10 |
> | Medium | 0.90 |
> | Low | 0.65 |
> | Info | 0.40 |

Surfaced as an **"Avg Risk"** summary card and computed automatically during scan ingestion.

### 2. Location-wise Asset Scan Totals
A breakdown table showing, per physical/cloud location, the number of assets and
their vulnerability counts by severity (Critical / High / Medium / Low). Covers 7
locations: **New York HQ, Chicago DC, Austin Dev, AWS East, Azure West, London
Office, Singapore DC**.

### 3. SLA Compliance
Tracks whether findings are being remediated within their SLA windows, rendered as
per-severity progress bars (green / amber / red).

> | Severity | SLA (from first detection) |
> |----------|---------------------------|
> | Critical | 2 days |
> | High | 5 days |
> | Medium | 10 days |
> | Low | 15 days |

### 4. 12-Month Critical + High Trend
A line chart plotting **Critical** and **High** finding counts across the last 12
scan runs, so posture improvement (or regression) over time is visible at a glance.
Backed by generated historical scan data.

### 5. Asset Criticality Heat Map
A **P1–P4 priority tier × severity** grid with colour-intensity cells that highlight
where the most severe findings concentrate.

> | Tier | Meaning |
> |------|---------|
> | P1 | Production / critical / core |
> | P2 | Database / DR / DMZ / security |
> | P3 | Staging / UAT |
> | P4 | Dev / QA / Test |

### 6. Asset Ownership Tagging
Findings are attributed to owning teams — **Application, Infrastructure, Database,
Finance, HR, Analytics, IT Operations** — so remediation can be routed to the right
group.

### 7. Internet-Facing Assets View
A dedicated panel highlighting externally-reachable servers:
- Total internet-facing IP count
- Critical + High finding count among them
- A table of the top high-risk internet-facing servers (IP, owner, criticality tier, C/H counts).

### 8. Internet-Facing Summary Card
An additional summary card alongside the existing severity cards, giving an at-a-glance
count of internet-facing assets.

---

## Part C — Under the Hood (V2 changes)

### Data Model — 6 new columns on `vulnerability_findings`
| Column | Purpose |
|--------|---------|
| `true_risk_score` | Severity-weighted risk metric |
| `location` | Asset location |
| `asset_criticality` | Priority tier (P1–P4) |
| `asset_owner` | Owning team |
| `internet_facing` | Yes / No exposure flag |
| `first_detected` | Date the finding was first seen (SLA baseline) |

Delivered via an Alembic migration, with the CSV parser extended to map these fields.

### Enrichment Pipeline
The scan-ingestion pipeline auto-computes **True Risk Score** for every finding that
has a QDS but no score, so the metric is always populated.

### New API Endpoints
| Endpoint | Returns |
|----------|---------|
| `GET /vulnerability/location-stats` | Per-location asset + severity totals |
| `GET /vulnerability/sla-compliance` | Within-SLA vs breached counts per severity |
| `GET /vulnerability/trend` | 12-month Critical/High trend series |
| `GET /vulnerability/heatmap` | P1–P4 × severity counts |
| `GET /vulnerability/internet-facing` | Internet-facing totals + top assets |

Plus `GET /vulnerability/stats` was extended with `avg_true_risk_score` and
`internet_facing_count`.

### Deployment / Configuration
- CORS and Superset embed **allowed-domains** + **CSP `frame-ancestors`** widened to
  cover the dev frontend origins (e.g. `localhost:5173` / `:5174`), fixing embed
  loading across ports.

---

## Summary

| Area | Version 1 | Version 2 |
|------|-----------|-----------|
| Platform (auth, users, servers, playbooks, jobs, notifications, audit) | ✅ | ✅ (unchanged) |
| Vulnerability scans + CSV ingestion | ✅ | ✅ |
| Dashboard: severity cards, QDS chart, scan selector, Superset embed | ✅ | ✅ |
| True Risk Score | — | ✅ |
| Location-wise totals | — | ✅ |
| SLA compliance | — | ✅ |
| 12-month trend chart | — | ✅ |
| Asset criticality heat map | — | ✅ |
| Asset ownership tagging | — | ✅ |
| Internet-facing assets view | — | ✅ |

*Version 2 is a superset of Version 1 — every prior capability is retained, with the
Vulnerability Dashboard substantially enhanced for risk-based prioritisation.*
