"""
Marshmallow Schemas
Handles request validation and response serialization
"""
from marshmallow import Schema, fields, validate, validates, ValidationError, post_load
from app.extensions import ma
from app.models import User, Server, Playbook, Job, JobLog, Ticket, AuditLog


# ===== User Schemas =====

class UserSchema(ma.SQLAlchemyAutoSchema):
    """User serialization schema"""
    class Meta:
        model = User
        load_instance = True
        exclude = ('password_hash',)
        dump_only = ('id', 'created_at', 'updated_at', 'last_login')


class UserCreateSchema(Schema):
    """Schema for creating a new user"""
    username = fields.Str(required=True, validate=validate.Length(min=3, max=80))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=8), load_only=True)
    role = fields.Str(required=True, validate=validate.OneOf(['admin', 'operator', 'viewer']))


class UserUpdateSchema(Schema):
    """Schema for updating user details"""
    email = fields.Email()
    role = fields.Str(validate=validate.OneOf(['admin', 'operator', 'viewer']))
    is_active = fields.Bool()
    password = fields.Str(validate=validate.Length(min=8), load_only=True)


class UserLoginSchema(Schema):
    """Schema for user login"""
    username = fields.Str(required=True)
    password = fields.Str(required=True, load_only=True)


class TokenResponseSchema(Schema):
    """Schema for JWT token response"""
    access_token = fields.Str(required=True)
    refresh_token = fields.Str(required=True)
    user = fields.Nested(UserSchema)


# ===== Server Schemas =====

class ServerSchema(ma.SQLAlchemyAutoSchema):
    """Server serialization schema"""
    class Meta:
        model = Server
        load_instance = True
        dump_only = ('id', 'created_at', 'updated_at', 'last_monitored')
        include_fk = True


class ServerCreateSchema(Schema):
    """Schema for creating a new server"""
    hostname = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    ip_address = fields.Str(required=True)
    os_type = fields.Str(required=True, validate=validate.Length(max=50))
    os_version = fields.Str(validate=validate.Length(max=50))
    ssh_port = fields.Int(validate=validate.Range(min=1, max=65535))
    ssh_user = fields.Str(required=True, validate=validate.Length(max=50))
    ssh_key_path = fields.Str(validate=validate.Length(max=500))
    is_active = fields.Bool()


class ServerUpdateSchema(Schema):
    """Schema for updating server details"""
    hostname = fields.Str(validate=validate.Length(min=1, max=255))
    ip_address = fields.Str()
    os_type = fields.Str(validate=validate.Length(max=50))
    os_version = fields.Str(validate=validate.Length(max=50))
    ssh_port = fields.Int(validate=validate.Range(min=1, max=65535))
    ssh_user = fields.Str(validate=validate.Length(max=50))
    ssh_key_path = fields.Str(validate=validate.Length(max=500))
    is_active = fields.Bool()


# ===== Playbook Schemas =====

class PlaybookSchema(ma.SQLAlchemyAutoSchema):
    """Playbook serialization schema"""
    class Meta:
        model = Playbook
        load_instance = True
        dump_only = ('id', 'file_hash', 'created_at', 'updated_at')


class PlaybookCreateSchema(Schema):
    """Schema for playbook metadata during upload"""
    name = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str()


class PlaybookUpdateSchema(Schema):
    """Schema for updating playbook metadata"""
    description = fields.Str()
    tags = fields.Dict()
    variables = fields.Dict()
    is_active = fields.Bool()


# ===== Job Schemas =====

class JobLogSchema(ma.SQLAlchemyAutoSchema):
    """Job log serialization schema"""
    class Meta:
        model = JobLog
        load_instance = True
        dump_only = ('id', 'timestamp')


class JobSchema(ma.SQLAlchemyAutoSchema):
    """Job serialization schema"""
    playbook = fields.Nested(PlaybookSchema, only=('id', 'name'))
    server = fields.Nested(ServerSchema, only=('id', 'hostname', 'ip_address'))
    user = fields.Nested(UserSchema, only=('id', 'username'))
    
    class Meta:
        model = Job
        load_instance = True
        dump_only = ('id', 'job_id', 'celery_task_id', 'created_at', 'started_at', 'completed_at')


class JobCreateSchema(Schema):
    """Schema for creating a new job"""
    playbook_id = fields.Int(required=True)
    server_id = fields.Int(required=True)
    extra_vars = fields.Dict()


class JobStatusUpdateSchema(Schema):
    """Schema for updating job status"""
    status = fields.Str(required=True, validate=validate.OneOf(['pending', 'running', 'success', 'failed', 'cancelled']))
    error_message = fields.Str()


class JobListQuerySchema(Schema):
    """Schema for job list query parameters"""
    status = fields.Str(validate=validate.OneOf(['pending', 'running', 'success', 'failed', 'cancelled']))
    playbook_id = fields.Int()
    server_id = fields.Int()
    user_id = fields.Int()
    page = fields.Int(validate=validate.Range(min=1))
    per_page = fields.Int(validate=validate.Range(min=1, max=100))


# ===== Ticket Schemas =====

class TicketSchema(ma.SQLAlchemyAutoSchema):
    """Ticket serialization schema"""
    job = fields.Nested(JobSchema, only=('id', 'job_id', 'status'))
    created_by_user = fields.Nested(UserSchema, only=('id', 'username'))
    
    class Meta:
        model = Ticket
        load_instance = True
        dump_only = ('id', 'ticket_id', 'created_at', 'updated_at', 'resolved_at')


class TicketCreateSchema(Schema):
    """Schema for creating a support ticket"""
    job_id = fields.Int(required=True)
    title = fields.Str(required=True, validate=validate.Length(min=1, max=255))
    description = fields.Str()
    priority = fields.Str(validate=validate.OneOf(['low', 'medium', 'high', 'critical']))


class TicketUpdateSchema(Schema):
    """Schema for updating ticket"""
    status = fields.Str(validate=validate.OneOf(['open', 'in_progress', 'resolved', 'closed']))
    priority = fields.Str(validate=validate.OneOf(['low', 'medium', 'high', 'critical']))
    description = fields.Str()


# ===== Audit Log Schemas =====

class AuditLogSchema(ma.SQLAlchemyAutoSchema):
    """Audit log serialization schema"""
    user = fields.Nested(UserSchema, only=('id', 'username'))
    
    class Meta:
        model = AuditLog
        load_instance = True
        dump_only = ('id', 'timestamp')


class AuditLogQuerySchema(Schema):
    """Schema for audit log query parameters"""
    user_id = fields.Int()
    action = fields.Str()
    resource_type = fields.Str()
    resource_id = fields.Int()
    start_date = fields.DateTime()
    end_date = fields.DateTime()
    page = fields.Int(validate=validate.Range(min=1))
    per_page = fields.Int(validate=validate.Range(min=1, max=100))


# ===== Pagination Schema =====

class PaginationSchema(Schema):
    """Generic pagination metadata schema"""
    page = fields.Int(required=True)
    per_page = fields.Int(required=True)
    total = fields.Int(required=True)
    pages = fields.Int(required=True)


class PaginatedResponseSchema(Schema):
    """Generic paginated response wrapper"""
    items = fields.List(fields.Dict())
    pagination = fields.Nested(PaginationSchema)


# ===== Error Schema =====

class ErrorSchema(Schema):
    """Standard error response schema"""
    error = fields.Str(required=True)
    message = fields.Str(required=True)
    details = fields.Dict()


# Initialize schemas
user_schema = UserSchema()
users_schema = UserSchema(many=True)
user_create_schema = UserCreateSchema()
user_update_schema = UserUpdateSchema()
user_login_schema = UserLoginSchema()
token_response_schema = TokenResponseSchema()

server_schema = ServerSchema()
servers_schema = ServerSchema(many=True)
server_create_schema = ServerCreateSchema()
server_update_schema = ServerUpdateSchema()

playbook_schema = PlaybookSchema()
playbooks_schema = PlaybookSchema(many=True)
playbook_create_schema = PlaybookCreateSchema()
playbook_update_schema = PlaybookUpdateSchema()

job_schema = JobSchema()
jobs_schema = JobSchema(many=True)
job_create_schema = JobCreateSchema()
job_status_update_schema = JobStatusUpdateSchema()
job_list_query_schema = JobListQuerySchema()

job_log_schema = JobLogSchema()
job_logs_schema = JobLogSchema(many=True)

ticket_schema = TicketSchema()
tickets_schema = TicketSchema(many=True)
ticket_create_schema = TicketCreateSchema()
ticket_update_schema = TicketUpdateSchema()

audit_log_schema = AuditLogSchema()
audit_logs_schema = AuditLogSchema(many=True)
audit_log_query_schema = AuditLogQuerySchema()

error_schema = ErrorSchema()
