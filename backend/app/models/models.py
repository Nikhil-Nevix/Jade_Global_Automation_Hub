from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Integer, String, Boolean, Float, Text, DateTime,
    ForeignKey, JSON, BigInteger, Date, Enum, Index, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


# ─── Association table ──────────────────────────────────────────────────────

from sqlalchemy import Table, Column

server_tags = Table(
    "server_tags",
    Base.metadata,
    Column("server_id", Integer, ForeignKey("servers.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


# ─── User ────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        Enum("super_admin", "admin", "user", name="user_roles"),
        nullable=False,
        default="user",
    )
    domain: Mapped[str] = mapped_column(String(50), nullable=False, default="unknown")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="user", lazy="select")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="user", lazy="select", cascade="all, delete-orphan")
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user", lazy="select")
    notification_preferences: Mapped[List["NotificationPreference"]] = relationship("NotificationPreference", back_populates="user", lazy="select", cascade="all, delete-orphan")
    tickets: Mapped[List["Ticket"]] = relationship("Ticket", back_populates="creator", lazy="select", foreign_keys="Ticket.created_by")

    def __repr__(self) -> str:
        return f"<User {self.username} ({self.role})>"


# ─── Tag ─────────────────────────────────────────────────────────────────────

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Groups auto-derived tags for environment-specific reporting: 'environment' | 'role' | 'location'.
    # NULL for manually-created ad-hoc tags.
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    servers: Mapped[List["Server"]] = relationship("Server", secondary=server_tags, back_populates="tags", lazy="select")

    def __repr__(self) -> str:
        return f"<Tag {self.name}>"


# ─── Server ──────────────────────────────────────────────────────────────────

class Server(Base):
    __tablename__ = "servers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hostname: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    ip_address: Mapped[str] = mapped_column(String(45), unique=True, nullable=False, index=True)
    os_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    os_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ssh_port: Mapped[int] = mapped_column(Integer, nullable=False, default=22)
    ssh_user: Mapped[str] = mapped_column(String(50), nullable=False, default="root")
    ssh_key_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    tags_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # legacy field
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    cpu_usage: Mapped[float] = mapped_column(Float, nullable=True, default=0.0)
    memory_usage: Mapped[float] = mapped_column(Float, nullable=True, default=0.0)
    disk_usage: Mapped[float] = mapped_column(Float, nullable=True, default=0.0)
    last_monitored: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    tags: Mapped[List["Tag"]] = relationship("Tag", secondary=server_tags, back_populates="servers", lazy="select")
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="server", lazy="select")

    def __repr__(self) -> str:
        return f"<Server {self.hostname or self.ip_address}>"


# ─── Playbook ─────────────────────────────────────────────────────────────────

class Playbook(Base):
    __tablename__ = "playbooks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    is_folder: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    main_playbook_file: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_structure: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    total_size_kb: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="playbook", lazy="select")

    def __repr__(self) -> str:
        return f"<Playbook {self.name}>"


# ─── Job ──────────────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        Index("idx_job_status_created", "status", "created_at"),
        Index("idx_job_user_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    parent_job_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True)
    is_batch_job: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    batch_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    playbook_id: Mapped[int] = mapped_column(Integer, ForeignKey("playbooks.id"), nullable=False, index=True)
    server_id: Mapped[int] = mapped_column(Integer, ForeignKey("servers.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        Enum("pending", "running", "success", "failed", "cancelled", name="job_status"),
        nullable=False,
        default="pending",
        index=True,
    )
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    extra_vars: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    patch_report: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    report_files: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    result_summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    csv_minio_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    playbook: Mapped["Playbook"] = relationship("Playbook", back_populates="jobs")
    server: Mapped["Server"] = relationship("Server", back_populates="jobs")
    user: Mapped["User"] = relationship("User", back_populates="jobs")
    logs: Mapped[List["JobLog"]] = relationship("JobLog", back_populates="job", lazy="select", cascade="all, delete-orphan")
    child_jobs: Mapped[List["Job"]] = relationship(
        "Job",
        back_populates="parent",
        lazy="select",
        cascade="all, delete-orphan",
        foreign_keys=[parent_job_id],
    )
    parent: Mapped[Optional["Job"]] = relationship(
        "Job",
        back_populates="child_jobs",
        remote_side=[id],
        foreign_keys=[parent_job_id],
    )

    def __repr__(self) -> str:
        return f"<Job {self.job_id} [{self.status}]>"


# ─── JobLog ───────────────────────────────────────────────────────────────────

class JobLog(Base):
    __tablename__ = "job_logs"
    __table_args__ = (
        Index("idx_job_logs_job_line", "job_id", "line_number"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    log_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    job: Mapped["Job"] = relationship("Job", back_populates="logs")


# ─── Ticket ───────────────────────────────────────────────────────────────────

class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    job_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("jobs.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("open", "in_progress", "resolved", "closed", name="ticket_status"),
        nullable=False,
        default="open",
        index=True,
    )
    priority: Mapped[str] = mapped_column(
        Enum("low", "medium", "high", "critical", name="ticket_priority"),
        nullable=False,
        default="medium",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    creator: Mapped["User"] = relationship("User", back_populates="tickets", foreign_keys=[created_by])
    job: Mapped[Optional["Job"]] = relationship("Job")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "ticket_id": self.ticket_id,
            "job_id": self.job_id,
            "created_by": self.created_by,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }

    def __repr__(self) -> str:
        return f"<Ticket {self.ticket_id} [{self.status}]>"


# ─── Notification ─────────────────────────────────────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    # event_type mirrors `type` but aligns with the notification-preference event
    # keys (job_success, job_failure, batch_complete, …) ported from InfraAnsible.
    event_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    related_entity_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    extra_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Which delivery channels this notification was sent through (in_app/email/browser_push).
    channels_sent: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="notifications")

    def mark_as_read(self) -> None:
        self.is_read = True
        self.read_at = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "type": self.type,
            "event_type": self.event_type,
            "title": self.title,
            "message": self.message,
            "severity": self.severity,
            "is_read": self.is_read,
            "read_at": self.read_at.isoformat() if self.read_at else None,
            "related_entity_type": self.related_entity_type,
            "related_entity_id": self.related_entity_id,
            "extra_data": self.extra_data,
            "channels_sent": self.channels_sent,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint("user_id", "event_type", name="uq_user_event_pref"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    email_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    browser_push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped["User"] = relationship("User", back_populates="notification_preferences")


# ─── AuditLog ─────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")


# ─── PlaybookAuditLog ─────────────────────────────────────────────────────────

class PlaybookAuditLog(Base):
    __tablename__ = "playbook_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Not a hard FK on playbook_name/playbook_id so audit history survives playbook deletion.
    playbook_id: Mapped[int] = mapped_column(Integer, ForeignKey("playbooks.id", ondelete="CASCADE"), nullable=False, index=True)
    playbook_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # created|updated|deleted|uploaded|replaced
    old_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changes_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)


# ─── ScanRun ──────────────────────────────────────────────────────────────────

class ScanRun(Base):
    __tablename__ = "scan_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[str] = mapped_column(String(36), unique=True, nullable=False, index=True)
    trigger_type: Mapped[str] = mapped_column(String(20), nullable=False)  # scheduled | on_demand
    triggered_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    server_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    minio_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    findings: Mapped[List["VulnerabilityFinding"]] = relationship("VulnerabilityFinding", back_populates="scan_run", lazy="select", cascade="all, delete-orphan")
    triggered_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[triggered_by])

    def __repr__(self) -> str:
        return f"<ScanRun {self.run_id} [{self.status}]>"


# ─── VulnerabilityFinding ─────────────────────────────────────────────────────

class VulnerabilityFinding(Base):
    __tablename__ = "vulnerability_findings"
    __table_args__ = (
        Index("idx_vuln_scan_run", "scan_run_id"),
        Index("idx_vuln_severity", "severity"),
        Index("idx_vuln_cve_id", "cve_id"),
        Index("idx_vuln_ip", "ip"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    scan_run_id: Mapped[int] = mapped_column(Integer, ForeignKey("scan_runs.id", ondelete="CASCADE"), nullable=False)
    ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    network: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dns: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    netbios: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    os: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    severity: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    cve_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    vendor_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    threat: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    impact: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    results: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    qds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    asset_group: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    server_role: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_scan_date: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    scan_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    os_family: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # v2 columns
    true_risk_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    asset_criticality: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    asset_owner: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    internet_facing: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    first_detected: Mapped[Optional[datetime]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    scan_run: Mapped["ScanRun"] = relationship("ScanRun", back_populates="findings")
