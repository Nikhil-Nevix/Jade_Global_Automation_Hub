"""
Job Service
Handles job execution, tracking, and log management
"""
import uuid
from datetime import datetime
from app.extensions import db
from app.models import Job, JobLog, Ticket, AuditLog, Server, Playbook
from sqlalchemy import or_


class JobService:
    """Service for job execution and management"""
    
    @staticmethod
    def create_job(playbook_id, server_id, user_id, extra_vars=None):
        """
        Create a new job for execution
        
        Args:
            playbook_id: Playbook ID to execute
            server_id: Target server ID
            user_id: User ID creating the job
            extra_vars: Extra variables for playbook execution
        
        Returns:
            Created job object
        
        Raises:
            ValueError: If validation fails
        """
        # Validate playbook exists and is active
        playbook = Playbook.query.get(playbook_id)
        if not playbook or not playbook.is_active:
            raise ValueError(f"Playbook with ID {playbook_id} not found or inactive")
        
        # Validate server exists and is active
        server = Server.query.get(server_id)
        if not server or not server.is_active:
            raise ValueError(f"Server with ID {server_id} not found or inactive")
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Create job
        job = Job(
            job_id=job_id,
            playbook_id=playbook_id,
            server_id=server_id,
            user_id=user_id,
            status='pending',
            extra_vars=extra_vars or {}
        )
        
        db.session.add(job)
        db.session.commit()
        
        # Create audit log
        JobService._create_audit_log(
            user_id=user_id,
            action='CREATE',
            resource_id=job.id,
            details={
                'job_id': job_id,
                'playbook': playbook.name,
                'server': server.hostname
            }
        )
        
        return job
    
    @staticmethod
    def get_job(job_id):
        """
        Get job by internal ID
        
        Args:
            job_id: Job internal ID
        
        Returns:
            Job object or None
        """
        return Job.query.get(job_id)
    
    @staticmethod
    def get_job_by_uuid(job_uuid):
        """
        Get job by UUID
        
        Args:
            job_uuid: Job UUID string
        
        Returns:
            Job object or None
        """
        return Job.query.filter_by(job_id=job_uuid).first()
    
    @staticmethod
    def get_all_jobs(filters=None, page=1, per_page=20):
        """
        Get all jobs with optional filtering and pagination
        
        Args:
            filters: Dictionary with filter criteria
            page: Page number
            per_page: Items per page
        
        Returns:
            Paginated job query result
        """
        query = Job.query
        
        if filters:
            if filters.get('status'):
                query = query.filter_by(status=filters['status'])
            
            if filters.get('playbook_id'):
                query = query.filter_by(playbook_id=filters['playbook_id'])
            
            if filters.get('server_id'):
                query = query.filter_by(server_id=filters['server_id'])
            
            if filters.get('user_id'):
                query = query.filter_by(user_id=filters['user_id'])
        
        return query.order_by(Job.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
    
    @staticmethod
    def update_job_status(job_id, status, error_message=None, celery_task_id=None):
        """
        Update job status and related timestamps
        
        Args:
            job_id: Job ID
            status: New status
            error_message: Error message if failed
            celery_task_id: Celery task ID
        
        Returns:
            Updated job object
        
        Raises:
            ValueError: If job not found
        """
        job = Job.query.get(job_id)
        if not job:
            raise ValueError(f"Job with ID {job_id} not found")
        
        job.status = status
        
        if celery_task_id:
            job.celery_task_id = celery_task_id
        
        if error_message:
            job.error_message = error_message
        
        # Update timestamps based on status
        if status == 'running' and not job.started_at:
            job.started_at = datetime.utcnow()
        
        if status in ['success', 'failed', 'cancelled']:
            job.completed_at = datetime.utcnow()
        
        db.session.commit()
        
        return job
    
    @staticmethod
    def add_job_log(job_id, line_number, content, log_level='INFO'):
        """
        Add a log line to job
        
        Args:
            job_id: Job ID
            line_number: Line number
            content: Log content
            log_level: Log level
        
        Returns:
            Created log entry
        """
        log_entry = JobLog(
            job_id=job_id,
            line_number=line_number,
            content=content,
            log_level=log_level
        )
        
        db.session.add(log_entry)
        db.session.commit()
        
        return log_entry
    
    @staticmethod
    def add_job_logs_bulk(job_id, logs):
        """
        Add multiple log lines in bulk
        
        Args:
            job_id: Job ID
            logs: List of log dictionaries
        """
        log_entries = []
        for log in logs:
            log_entry = JobLog(
                job_id=job_id,
                line_number=log['line_number'],
                content=log['content'],
                log_level=log.get('log_level', 'INFO')
            )
            log_entries.append(log_entry)
        
        db.session.bulk_save_objects(log_entries)
        db.session.commit()
    
    @staticmethod
    def get_job_logs(job_id, start_line=None, limit=None):
        """
        Get job logs with optional pagination
        
        Args:
            job_id: Job ID
            start_line: Starting line number
            limit: Maximum number of lines
        
        Returns:
            List of log entries
        """
        query = JobLog.query.filter_by(job_id=job_id).order_by(JobLog.line_number)
        
        if start_line:
            query = query.filter(JobLog.line_number >= start_line)
        
        if limit:
            query = query.limit(limit)
        
        return query.all()
    
    @staticmethod
    def get_job_logs_count(job_id):
        """
        Get total log count for a job
        
        Args:
            job_id: Job ID
        
        Returns:
            Count of log entries
        """
        return JobLog.query.filter_by(job_id=job_id).count()
    
    @staticmethod
    def cancel_job(job_id, user_id):
        """
        Cancel and delete any job
        
        Args:
            job_id: Job ID
            user_id: User ID cancelling/deleting the job
        
        Returns:
            Deleted job object (for response)
        
        Raises:
            ValueError: If job not found
        """
        job = Job.query.get(job_id)
        if not job:
            raise ValueError(f"Job with ID {job_id} not found")
        
        # Allow deletion of jobs in any status
        
        # Store job info for audit log before deletion
        job_uuid = job.job_id
        
        # Create audit log before deletion
        JobService._create_audit_log(
            user_id=user_id,
            action='DELETE',
            resource_id=job.id,
            details={'job_id': job_uuid, 'reason': 'terminated_by_user'}
        )
        
        # Delete associated job logs first (foreign key constraint)
        from app.models import JobLog
        JobLog.query.filter_by(job_id=job.id).delete()
        
        # Delete the job
        db.session.delete(job)
        db.session.commit()
        
        return job
    
    @staticmethod
    def create_ticket_from_job(job_id, user_id, title, description=None, priority='medium'):
        """
        Create a support ticket from a failed job
        
        Args:
            job_id: Job ID
            user_id: User creating the ticket
            title: Ticket title
            description: Ticket description
            priority: Ticket priority
        
        Returns:
            Created ticket object
        
        Raises:
            ValueError: If job not found
        """
        job = Job.query.get(job_id)
        if not job:
            raise ValueError(f"Job with ID {job_id} not found")
        
        # Generate unique ticket ID
        ticket_id = str(uuid.uuid4())
        
        # Create ticket
        ticket = Ticket(
            ticket_id=ticket_id,
            job_id=job_id,
            created_by=user_id,
            title=title,
            description=description or f"Auto-generated ticket for failed job {job.job_id}",
            status='open',
            priority=priority
        )
        
        db.session.add(ticket)
        db.session.commit()
        
        # Create audit log
        JobService._create_audit_log(
            user_id=user_id,
            action='CREATE_TICKET',
            resource_id=job.id,
            details={'ticket_id': ticket_id, 'job_id': job.job_id}
        )
        
        return ticket
    
    @staticmethod
    def get_job_statistics(user_id=None):
        """
        Get job execution statistics
        
        Args:
            user_id: Optional user ID to filter by
        
        Returns:
            Dictionary with statistics
        """
        query = Job.query
        if user_id:
            query = query.filter_by(user_id=user_id)
        
        total = query.count()
        pending = query.filter_by(status='pending').count()
        running = query.filter_by(status='running').count()
        success = query.filter_by(status='success').count()
        failed = query.filter_by(status='failed').count()
        cancelled = query.filter_by(status='cancelled').count()
        
        return {
            'total': total,
            'pending': pending,
            'running': running,
            'success': success,
            'failed': failed,
            'cancelled': cancelled,
            'success_rate': round(((total - failed) / total * 100), 2) if total > 0 else 0
        }
    
    @staticmethod
    def _create_audit_log(user_id, action, resource_id, details=None):
        """
        Create audit log entry for job operations
        
        Args:
            user_id: User ID performing action
            action: Action type
            resource_id: Job ID
            details: Additional details
        """
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type='job',
            resource_id=resource_id,
            details=details
        )
        db.session.add(audit_log)
        db.session.commit()


# Singleton instance
job_service = JobService()
