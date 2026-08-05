from datetime import datetime, date
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# ─── Auth ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: "UserOut"


class AccessTokenResponse(BaseModel):
    access_token: str


# ─── User ───────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str
    role: str
    domain: str
    is_active: bool
    timezone: str
    last_login: Optional[datetime] = None
    created_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str = "user"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(default=None, min_length=8)


class TimezoneUpdate(BaseModel):
    timezone: str = Field(max_length=50)


# ─── Tag ────────────────────────────────────────────────────────────────────

class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)


class TagUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=100)
    description: Optional[str] = None
    category: Optional[str] = Field(default=None, max_length=50)


class TagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime
    server_count: Optional[int] = None


# ─── Server ─────────────────────────────────────────────────────────────────

class ServerCreate(BaseModel):
    ip_address: str = Field(max_length=45)
    hostname: Optional[str] = Field(default=None, max_length=255)
    os_type: Optional[str] = Field(default=None, max_length=50)
    os_version: Optional[str] = Field(default=None, max_length=50)
    ssh_port: int = 22
    ssh_user: str = "root"
    ssh_key_path: Optional[str] = None
    location: Optional[str] = Field(default=None, max_length=100)
    tag_ids: List[int] = Field(default_factory=list)


class ServerUpdate(BaseModel):
    hostname: Optional[str] = None
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    ssh_port: Optional[int] = None
    ssh_user: Optional[str] = None
    ssh_key_path: Optional[str] = None
    location: Optional[str] = None
    is_active: Optional[bool] = None
    tag_ids: Optional[List[int]] = None


class ServerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    hostname: Optional[str] = None
    ip_address: str
    os_type: Optional[str] = None
    os_version: Optional[str] = None
    ssh_port: int
    ssh_user: str
    location: Optional[str] = None
    is_active: bool
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    last_monitored: Optional[datetime] = None
    created_at: datetime
    tags: List[TagOut] = Field(default_factory=list)


# ─── Playbook ───────────────────────────────────────────────────────────────

class PlaybookUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class PlaybookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str] = None
    file_path: str
    is_folder: bool
    main_playbook_file: Optional[str] = None
    file_structure: Optional[Any] = None
    file_count: int
    total_size_kb: int
    is_active: bool
    created_at: datetime


# ─── Job ────────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    playbook_id: int
    server_ids: List[int] = Field(default_factory=list)
    extra_vars: Optional[dict] = None
    batch_config: Optional[dict] = None


class JobLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    line_number: int
    content: str
    log_level: Optional[str] = None
    timestamp: datetime


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    job_id: str
    parent_job_id: Optional[int] = None
    is_batch_job: bool
    playbook_id: int
    server_id: int
    user_id: int
    status: str
    error_message: Optional[str] = None
    csv_minio_path: Optional[str] = None
    result_summary: Optional[Any] = None
    report_files: Optional[Any] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


# ─── Vulnerability ──────────────────────────────────────────────────────────

class ScanTriggerRequest(BaseModel):
    """On-demand scan: select tags, specific servers, and/or raw IPs (all combinable)."""
    tag_ids: List[int] = Field(default_factory=list)
    server_ids: List[int] = Field(default_factory=list)
    ip_addresses: List[str] = Field(default_factory=list)
    playbook_id: Optional[int] = None


class ScanRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    run_id: str
    trigger_type: str
    triggered_by: Optional[int] = None
    server_count: int
    status: str
    minio_path: Optional[str] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime


class VulnerabilityFindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scan_run_id: int
    ip: Optional[str] = None
    network: Optional[str] = None
    dns: Optional[str] = None
    netbios: Optional[str] = None
    os: Optional[str] = None
    title: Optional[str] = None
    severity: Optional[str] = None
    cve_id: Optional[str] = None
    vendor_reference: Optional[str] = None
    threat: Optional[str] = None
    impact: Optional[str] = None
    solution: Optional[str] = None
    results: Optional[str] = None
    qds: Optional[float] = None
    asset_group: Optional[str] = None
    server_role: Optional[str] = None
    last_scan_date: Optional[date] = None
    scan_status: Optional[str] = None
    os_family: Optional[str] = None


# ─── Notification ─────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    type: str
    event_type: Optional[str] = None
    title: str
    message: Optional[str] = None
    severity: str
    is_read: bool
    read_at: Optional[datetime] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[int] = None
    extra_data: Optional[Any] = None
    channels_sent: Optional[Any] = None
    created_at: datetime
    expires_at: Optional[datetime] = None


class NotificationPreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    event_type: str
    in_app_enabled: bool
    email_enabled: bool
    browser_push_enabled: bool


class NotificationPreferenceUpdate(BaseModel):
    in_app_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    browser_push_enabled: Optional[bool] = None


# ─── Ticket ─────────────────────────────────────────────────────────────────

class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    job_id: Optional[int] = None
    priority: str = "medium"


class TicketUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ticket_id: str
    job_id: Optional[int] = None
    created_by: int
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None


# ─── Playbook audit ─────────────────────────────────────────────────────────

class PlaybookAuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    playbook_id: int
    playbook_name: Optional[str] = None
    user_id: Optional[int] = None
    action: str
    old_content: Optional[str] = None
    new_content: Optional[str] = None
    changes_description: Optional[str] = None
    created_at: datetime


# ─── Playbook file editing ──────────────────────────────────────────────────

class PlaybookContentUpdate(BaseModel):
    content: str
    changes_description: Optional[str] = None


class PlaybookFileUpdate(BaseModel):
    content: str
    changes_description: Optional[str] = None


# ─── Server metrics ─────────────────────────────────────────────────────────

class ServerMetricsOut(BaseModel):
    server_id: int
    cpu_usage: Optional[float] = None
    memory_usage: Optional[float] = None
    disk_usage: Optional[float] = None
    last_monitored: Optional[datetime] = None


# ─── Generic ──────────────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str


class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    pages: int


class SupersetTokenResponse(BaseModel):
    token: str
    dashboard_id: str
    superset_domain: str


class SupersetCustomizeResponse(BaseModel):
    superset_domain: str
    username: str
    password: str
    dashboard_id: int
    edit_path: str


TokenResponse.model_rebuild()
