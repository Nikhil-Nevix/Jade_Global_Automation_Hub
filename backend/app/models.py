"""
Database Models
Defines all SQLAlchemy models with relationships, indexes, and constraints

Schema Version: 1.0.0
Database Engine: MySQL 8
Character Set: utf8mb4
Collation: utf8mb4_unicode_ci
Storage Engine: InnoDB

See DATABASE_DESIGN.md for comprehensive documentation
"""
from datetime import datetime
from app.extensions import db
from sqlalchemy import Index, event, text
from sqlalchemy.orm import validates
import bcrypt


class User(db.Model):
    """User model for authentication and authorization"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum('super_admin', 'admin', 'user', name='user_roles'), nullable=False, default='user')
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    timezone = db.Column(db.String(50), default='UTC', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    jobs = db.relationship('Job', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    tickets = db.relationship('Ticket', back_populates='created_by_user', lazy='dynamic', cascade='all, delete-orphan')
    audit_logs = db.relationship('AuditLog', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    notifications = db.relationship('Notification', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    notification_preferences = db.relationship('NotificationPreference', back_populates='user', lazy='dynamic', cascade='all, delete-orphan')
    
    def set_password(self, password):
        """Hash and set password"""
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def check_password(self, password):
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
    
    @validates('email')
    def validate_email(self, key, email):
        """Basic email validation"""
        if '@' not in email:
            raise ValueError('Invalid email address')
        return email.lower()
    
    def __repr__(self):
        return f'<User {self.username} ({self.role})>'


class Server(db.Model):
    """Server inventory model"""
    __tablename__ = 'servers'
    
    id = db.Column(db.Integer, primary_key=True)
    hostname = db.Column(db.String(255), unique=True, nullable=False, index=True)
    ip_address = db.Column(db.String(45), nullable=False, index=True)  # IPv4 and IPv6 support
    os_type = db.Column(db.String(50), nullable=False)  # e.g., ubuntu, centos, rhel
    os_version = db.Column(db.String(50), nullable=True)
    ssh_port = db.Column(db.Integer, default=22, nullable=False)
    ssh_user = db.Column(db.String(50), nullable=False, default='root')
    ssh_key_path = db.Column(db.String(500), nullable=True)  # Path to private key
    tags = db.Column(db.JSON, nullable=True)  # Server tags for grouping (e.g., ["production", "web-server"])
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    cpu_usage = db.Column(db.Float, nullable=True, default=0.0)  # CPU usage percentage (0-100)
    memory_usage = db.Column(db.Float, nullable=True, default=0.0)  # Memory usage percentage (0-100)
    disk_usage = db.Column(db.Float, nullable=True, default=0.0)  # Disk usage percentage (0-100)
    last_monitored = db.Column(db.DateTime, nullable=True)  # Last time metrics were updated
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    jobs = db.relationship('Job', back_populates='server', lazy='dynamic')
    
    def __repr__(self):
        return f'<Server {self.hostname} ({self.ip_address})>'


class Playbook(db.Model):
    """Playbook metadata and file storage"""
    __tablename__ = 'playbooks'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), unique=True, nullable=False, index=True)
    description = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(500), nullable=False)  # Linux filesystem path (file or folder)
    is_folder = db.Column(db.Boolean, default=False, nullable=False)  # TRUE for folder structure, FALSE for single file
    main_playbook_file = db.Column(db.String(255), nullable=True)  # Relative path to main playbook within folder
    file_structure = db.Column(db.JSON, nullable=True)  # JSON tree of all files in folder
    file_count = db.Column(db.Integer, default=1, nullable=False)  # Total files in playbook
    total_size_kb = db.Column(db.Integer, default=0, nullable=False)  # Total size in KB
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    jobs = db.relationship('Job', back_populates='playbook', lazy='dynamic')
    
    def __repr__(self):
        return f'<Playbook {self.name}>'


class Job(db.Model):
    """Job execution tracking"""
    __tablename__ = 'jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    parent_job_id = db.Column(db.Integer, db.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=True, index=True)  # Parent batch job
    is_batch_job = db.Column(db.Boolean, default=False, nullable=False, index=True)  # True for parent jobs
    batch_config = db.Column(db.JSON, nullable=True)  # Batch settings: {concurrent_limit, stop_on_failure}
    job_id = db.Column(db.String(36), unique=True, nullable=False, index=True)  # UUID
    playbook_id = db.Column(db.Integer, db.ForeignKey('playbooks.id'), nullable=False, index=True)
    server_id = db.Column(db.Integer, db.ForeignKey('servers.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    status = db.Column(
        db.Enum('pending', 'running', 'success', 'failed', 'cancelled', name='job_status'),
        nullable=False,
        default='pending',
        index=True
    )
    celery_task_id = db.Column(db.String(255), nullable=True, index=True)
    extra_vars = db.Column(db.JSON, nullable=True)  # Runtime variables
    error_message = db.Column(db.Text, nullable=True)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    playbook = db.relationship('Playbook', back_populates='jobs')
    server = db.relationship('Server', back_populates='jobs')
    user = db.relationship('User', back_populates='jobs')
    logs = db.relationship('JobLog', back_populates='job', lazy='dynamic', cascade='all, delete-orphan')
    tickets = db.relationship('Ticket', back_populates='job', lazy='dynamic', cascade='all, delete-orphan')
    # Parent-child batch job relationships
    child_jobs = db.relationship('Job', back_populates='parent', lazy='dynamic', cascade='all, delete-orphan', foreign_keys=[parent_job_id])
    parent = db.relationship('Job', back_populates='child_jobs', remote_side=[id], foreign_keys=[parent_job_id])
    
    __table_args__ = (
        Index('idx_job_status_created', 'status', 'created_at'),
        Index('idx_job_user_status', 'user_id', 'status'),
    )
    
    def __repr__(self):
        return f'<Job {self.job_id} [{self.status}]>'


class JobLog(db.Model):
    """
    Line-by-line job execution logs
    
    Performance Notes:
    - High write volume during job execution (100-1000 logs/second)
    - Uses BIGINT for primary key (expects millions of rows)
    - Composite index (job_id, line_number) for ordered retrieval
    - Cascade delete when parent job is deleted
    - Consider partitioning by timestamp for scale
    - Retention: 90 days (archival recommended)
    """
    __tablename__ = 'job_logs'
    
    id = db.Column(db.BigInteger, primary_key=True)  # BIGINT for high volume
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False, index=True)
    line_number = db.Column(db.Integer, nullable=False)
    content = db.Column(db.Text, nullable=False)
    log_level = db.Column(db.String(20), nullable=True)  # INFO, WARNING, ERROR, DEBUG
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    job = db.relationship('Job', back_populates='logs')
    
    __table_args__ = (
        Index('idx_joblog_job_line', 'job_id', 'line_number'),
        Index('idx_joblog_timestamp', 'timestamp'),
    )
    
    def __repr__(self):
        return f'<JobLog Job:{self.job_id} Line:{self.line_number}>'


class Ticket(db.Model):
    """Support tickets created from failed jobs"""
    __tablename__ = 'tickets'
    
    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.String(36), unique=True, nullable=False, index=True)  # UUID
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.Enum('open', 'in_progress', 'resolved', 'closed', name='ticket_status'),
        nullable=False,
        default='open',
        index=True
    )
    priority = db.Column(db.Enum('low', 'medium', 'high', 'critical', name='ticket_priority'), nullable=False, default='medium')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    job = db.relationship('Job', back_populates='tickets')
    created_by_user = db.relationship('User', back_populates='tickets')
    
    __table_args__ = (
        Index('idx_ticket_status_priority', 'status', 'priority'),
    )
    
    def __repr__(self):
        return f'<Ticket {self.ticket_id} [{self.status}]>'


class AuditLog(db.Model):
    """
    Audit trail for all significant actions
    
    Compliance Features:
    - Immutable records (no updates/deletes)
    - Captures user actions and system events
    - Retention: Minimum 1 year for compliance
    - Uses BIGINT for long-term scaling
    - user_id nullable for system-initiated actions
    """
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.BigInteger, primary_key=True)  # BIGINT for long-term retention
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)  # Nullable for system actions
    action = db.Column(db.String(100), nullable=False, index=True)  # CREATE, UPDATE, DELETE, LOGIN, etc.
    resource_type = db.Column(db.String(50), nullable=False, index=True)  # user, server, playbook, job
    resource_id = db.Column(db.Integer, nullable=True)
    details = db.Column(db.JSON, nullable=True)  # Additional context
    ip_address = db.Column(db.String(45), nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    user = db.relationship('User', back_populates='audit_logs')
    
    __table_args__ = (
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_action_timestamp', 'action', 'timestamp'),
    )
    
    def __repr__(self):
        return f'<AuditLog {self.action} on {self.resource_type}>'


class PlaybookAuditLog(db.Model):
    """
    Detailed audit trail for playbook changes
    
    Features:
    - Tracks all playbook modifications (create, update, delete)
    - Stores complete old and new content for diff comparison
    - Preserves history even after playbook deletion
    - Links to user who made the change
    """
    __tablename__ = 'playbook_audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    playbook_id = db.Column(db.Integer, nullable=False, index=True)  # Not FK to preserve deleted playbook history
    playbook_name = db.Column(db.String(255), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    action = db.Column(
        db.Enum('created', 'updated', 'deleted', 'uploaded', 'replaced', name='playbook_action'),
        nullable=False,
        index=True
    )
    old_content = db.Column(db.Text, nullable=True)
    new_content = db.Column(db.Text, nullable=True)
    changes_description = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    user = db.relationship('User', backref='playbook_audit_logs')
    
    __table_args__ = (
        Index('idx_playbook_audit_playbook_id', 'playbook_id'),
        Index('idx_playbook_audit_action', 'action'),
        Index('idx_playbook_audit_created_at', 'created_at'),
    )
    
    def __repr__(self):
        return f'<PlaybookAuditLog {self.action} on {self.playbook_name}>'


# Event listeners for automatic timestamp updates
@event.listens_for(User, 'before_update')
@event.listens_for(Server, 'before_update')
@event.listens_for(Playbook, 'before_update')
@event.listens_for(Ticket, 'before_update')
def receive_before_update(mapper, connection, target):
    """Automatically update updated_at timestamp"""
    target.updated_at = datetime.utcnow()


class Notification(db.Model):
    """Notification model for user notifications"""
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    severity = db.Column(db.Enum('info', 'warning', 'error', 'critical', name='notification_severity'), default='info', nullable=False)
    event_type = db.Column(db.String(100), nullable=False, index=True)  # job_success, job_failure, etc.
    related_entity_type = db.Column(db.String(50), nullable=True)  # job, server, user, playbook, system
    related_entity_id = db.Column(db.Integer, nullable=True)
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)
    read_at = db.Column(db.DateTime, nullable=True)
    channels_sent = db.Column(db.JSON, nullable=True)  # ["in_app", "email", "browser_push"]
    extra_data = db.Column('metadata', db.JSON, nullable=True)  # Additional context (renamed from metadata)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=True)  # Auto-dismiss timestamp
    
    # Relationships
    user = db.relationship('User', back_populates='notifications')
    
    __table_args__ = (
        Index('idx_user_notifications', 'user_id', 'created_at'),
        Index('idx_unread_notifications', 'user_id', 'is_read'),
    )
    
    def mark_as_read(self):
        """Mark notification as read"""
        if not self.is_read:
            self.is_read = True
            self.read_at = datetime.utcnow()
    
    def to_dict(self):
        """Convert notification to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'message': self.message,
            'severity': self.severity,
            'event_type': self.event_type,
            'related_entity_type': self.related_entity_type,
            'related_entity_id': self.related_entity_id,
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'channels_sent': self.channels_sent or [],
            'metadata': self.extra_data or {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }


class NotificationPreference(db.Model):
    """User notification preferences per event type"""
    __tablename__ = 'notification_preferences'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    event_type = db.Column(db.String(100), nullable=False)
    in_app_enabled = db.Column(db.Boolean, default=True, nullable=False)
    email_enabled = db.Column(db.Boolean, default=False, nullable=False)
    browser_push_enabled = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = db.relationship('User', back_populates='notification_preferences')
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'event_type', name='unique_user_event'),
    )
    
    def to_dict(self):
        """Convert preference to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'event_type': self.event_type,
            'in_app_enabled': self.in_app_enabled,
            'email_enabled': self.email_enabled,
            'browser_push_enabled': self.browser_push_enabled,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
