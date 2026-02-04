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
        Cancel a job and mark it as cancelled
        
        Args:
            job_id: Job ID
            user_id: User ID cancelling the job
        
        Returns:
            Cancelled job object
        
        Raises:
            ValueError: If job not found
        """
        job = Job.query.get(job_id)
        if not job:
            raise ValueError(f"Job with ID {job_id} not found")
        
        # Update job status to cancelled
        job.status = 'cancelled'
        job.error_message = "Job cancelled by user"
        
        # Set completed_at if not already set
        if not job.completed_at:
            from datetime import datetime
            job.completed_at = datetime.utcnow()
        
        # Create audit log
        JobService._create_audit_log(
            user_id=user_id,
            action='CANCEL',
            resource_id=job.id,
            details={'job_id': job.job_id, 'reason': 'cancelled_by_user'}
        )
        
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
    def create_batch_job(playbook_id, server_ids, user_id, extra_vars=None, 
                        concurrent_limit=5, stop_on_failure=False, execution_strategy='parallel'):
        """
        Create a batch job to execute a playbook on multiple servers
        
        Args:
            playbook_id: Playbook ID to execute
            server_ids: List of server IDs to execute on
            user_id: User ID creating the job
            extra_vars: Extra variables for playbook execution
            concurrent_limit: Maximum number of concurrent executions
            stop_on_failure: Whether to stop all executions if one fails
            execution_strategy: 'parallel' or 'sequential'
        
        Returns:
            Parent batch job object
        
        Raises:
            ValueError: If validation fails
        """
        # Validate playbook exists and is active
        playbook = Playbook.query.get(playbook_id)
        if not playbook or not playbook.is_active:
            raise ValueError(f"Playbook with ID {playbook_id} not found or inactive")
        
        # Validate all servers exist and are active
        servers = Server.query.filter(Server.id.in_(server_ids), Server.is_active == True).all()
        if len(servers) != len(server_ids):
            raise ValueError("One or more servers not found or inactive")
        
        # Generate unique job ID for parent
        parent_job_id = str(uuid.uuid4())
        
        # Create parent batch job (no server_id for parent, it's just a container)
        # We'll use the first server as placeholder for the parent job
        parent_job = Job(
            job_id=parent_job_id,
            playbook_id=playbook_id,
            server_id=servers[0].id,  # Placeholder server
            user_id=user_id,
            status='pending',
            is_batch_job=True,
            batch_config={
                'concurrent_limit': concurrent_limit,
                'stop_on_failure': stop_on_failure,
                'execution_strategy': execution_strategy,
                'total_servers': len(server_ids),
                'server_ids': server_ids
            },
            extra_vars=extra_vars or {}
        )
        
        db.session.add(parent_job)
        db.session.flush()  # Get parent job ID
        
        # Create child jobs for each server
        child_jobs = []
        for server in servers:
            child_job_id = str(uuid.uuid4())
            child_job = Job(
                job_id=child_job_id,
                playbook_id=playbook_id,
                server_id=server.id,
                user_id=user_id,
                status='pending',
                parent_job_id=parent_job.id,
                is_batch_job=False,
                extra_vars=extra_vars or {}
            )
            db.session.add(child_job)
            child_jobs.append(child_job)
        
        db.session.commit()
        
        # Create audit log
        JobService._create_audit_log(
            user_id=user_id,
            action='CREATE',
            resource_id=parent_job.id,
            details={
                'job_id': parent_job_id,
                'playbook': playbook.name,
                'total_servers': len(server_ids),
                'server_names': [s.hostname for s in servers],
                'execution_strategy': execution_strategy,
                'concurrent_limit': concurrent_limit,
                'stop_on_failure': stop_on_failure
            }
        )
        
        # Trigger async execution
        from app.tasks import execute_batch_job_task
        task = execute_batch_job_task.delay(parent_job.id)
        
        # Update parent job with celery task ID
        parent_job.celery_task_id = task.id
        parent_job.status = 'running'
        db.session.commit()
        
        return parent_job
    
    @staticmethod
    def get_child_jobs(parent_job_id):
        """
        Get all child jobs for a parent batch job
        
        Args:
            parent_job_id: Parent job ID
        
        Returns:
            List of child job objects
        """
        return Job.query.filter_by(parent_job_id=parent_job_id).all()
    
    @staticmethod
    def update_batch_job_status(parent_job_id):
        """
        Update batch job status based on child job statuses
        
        Args:
            parent_job_id: Parent job ID
        
        Returns:
            Updated parent job
        """
        parent_job = Job.query.get(parent_job_id)
        if not parent_job or not parent_job.is_batch_job:
            raise ValueError("Invalid batch job ID")
        
        child_jobs = JobService.get_child_jobs(parent_job_id)
        
        # Count statuses
        total = len(child_jobs)
        completed = sum(1 for j in child_jobs if j.status in ['success', 'failed', 'cancelled'])
        success_count = sum(1 for j in child_jobs if j.status == 'success')
        failed_count = sum(1 for j in child_jobs if j.status == 'failed')
        running_count = sum(1 for j in child_jobs if j.status == 'running')
        
        # Update parent status
        if completed == total:
            # All children completed
            if failed_count == 0:
                parent_job.status = 'success'
            elif success_count == 0:
                parent_job.status = 'failed'
            else:
                # Mixed results - consider it failed if any failed
                parent_job.status = 'failed'
            parent_job.completed_at = datetime.utcnow()
        elif running_count > 0:
            parent_job.status = 'running'
            if not parent_job.started_at:
                parent_job.started_at = datetime.utcnow()
        
        db.session.commit()
        return parent_job
    
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

    @staticmethod
    def get_success_rate_trends(time_range='30days', start_date=None, end_date=None, granularity='daily'):
        """
        Get job success rate trends over time
        
        Args:
            time_range: Time range filter ('7days', '30days', '3months', 'custom')
            start_date: Start date for custom range
            end_date: End date for custom range
            granularity: Grouping level ('daily', 'weekly', 'monthly')
        
        Returns:
            List of success rate data points over time
        """
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        # Calculate date range
        end = datetime.utcnow()
        if time_range == 'custom' and start_date and end_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        elif time_range == '7days':
            start = end - timedelta(days=7)
        elif time_range == '3months':
            start = end - timedelta(days=90)
        else:  # 30days default
            start = end - timedelta(days=30)
        
        # Query jobs within date range
        jobs = Job.query.filter(
            Job.created_at >= start,
            Job.created_at <= end
        ).all()
        
        # Group by granularity and calculate success rate
        trends = {}
        for job in jobs:
            if granularity == 'daily':
                key = job.created_at.strftime('%Y-%m-%d')
            elif granularity == 'weekly':
                key = job.created_at.strftime('%Y-W%U')
            else:  # monthly
                key = job.created_at.strftime('%Y-%m')
            
            if key not in trends:
                trends[key] = {'total': 0, 'success': 0, 'failed': 0}
            
            trends[key]['total'] += 1
            if job.status == 'success':
                trends[key]['success'] += 1
            elif job.status == 'failed':
                trends[key]['failed'] += 1
        
        # Calculate success rate for each period
        result = []
        for period, data in sorted(trends.items()):
            success_rate = (data['success'] / data['total'] * 100) if data['total'] > 0 else 0
            result.append({
                'period': period,
                'total_jobs': data['total'],
                'successful_jobs': data['success'],
                'failed_jobs': data['failed'],
                'success_rate': round(success_rate, 2)
            })
        
        return {
            'time_range': time_range,
            'granularity': granularity,
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
            'trends': result
        }

    @staticmethod
    def get_execution_time_analytics(time_range='30days', start_date=None, end_date=None):
        """
        Get average execution time per playbook
        
        Args:
            time_range: Time range filter
            start_date: Start date for custom range
            end_date: End date for custom range
        
        Returns:
            Execution time analytics by playbook
        """
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        # Calculate date range
        end = datetime.utcnow()
        if time_range == 'custom' and start_date and end_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        elif time_range == '7days':
            start = end - timedelta(days=7)
        elif time_range == '3months':
            start = end - timedelta(days=90)
        else:  # 30days default
            start = end - timedelta(days=30)
        
        # Query completed jobs with execution time
        query = db.session.query(
            Playbook.name,
            Playbook.id,
            func.count(Job.id).label('total_executions'),
            func.avg(
                func.unix_timestamp(Job.completed_at) - func.unix_timestamp(Job.started_at)
            ).label('avg_duration_seconds'),
            func.min(
                func.unix_timestamp(Job.completed_at) - func.unix_timestamp(Job.started_at)
            ).label('min_duration_seconds'),
            func.max(
                func.unix_timestamp(Job.completed_at) - func.unix_timestamp(Job.started_at)
            ).label('max_duration_seconds')
        ).join(
            Playbook, Job.playbook_id == Playbook.id
        ).filter(
            Job.created_at >= start,
            Job.created_at <= end,
            Job.status.in_(['success', 'failed']),
            Job.started_at.isnot(None),
            Job.completed_at.isnot(None)
        ).group_by(
            Playbook.id, Playbook.name
        ).all()
        
        result = []
        for row in query:
            result.append({
                'playbook_name': row.name,
                'playbook_id': row.id,
                'total_executions': row.total_executions,
                'avg_duration_seconds': round(float(row.avg_duration_seconds or 0), 2),
                'min_duration_seconds': int(row.min_duration_seconds or 0),
                'max_duration_seconds': int(row.max_duration_seconds or 0),
                'avg_duration_formatted': JobService._format_duration(row.avg_duration_seconds)
            })
        
        # Sort by total executions
        result.sort(key=lambda x: x['total_executions'], reverse=True)
        
        return {
            'time_range': time_range,
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
            'playbooks': result
        }

    @staticmethod
    def get_failure_analysis(time_range='30days', start_date=None, end_date=None, group_by='both'):
        """
        Get failed job analysis
        
        Args:
            time_range: Time range filter
            start_date: Start date for custom range
            end_date: End date for custom range
            group_by: 'playbook', 'server', or 'both'
        
        Returns:
            Failure analysis data
        """
        from datetime import datetime, timedelta
        from sqlalchemy import func
        
        # Calculate date range
        end = datetime.utcnow()
        if time_range == 'custom' and start_date and end_date:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        elif time_range == '7days':
            start = end - timedelta(days=7)
        elif time_range == '3months':
            start = end - timedelta(days=90)
        else:  # 30days default
            start = end - timedelta(days=30)
        
        result = {}
        
        # Analyze by playbook
        if group_by in ['playbook', 'both']:
            playbook_failures = db.session.query(
                Playbook.name,
                Playbook.id,
                func.count(Job.id).label('failure_count'),
                func.count(func.distinct(Job.server_id)).label('affected_servers')
            ).join(
                Playbook, Job.playbook_id == Playbook.id
            ).filter(
                Job.created_at >= start,
                Job.created_at <= end,
                Job.status == 'failed'
            ).group_by(
                Playbook.id, Playbook.name
            ).order_by(
                func.count(Job.id).desc()
            ).all()
            
            result['by_playbook'] = [
                {
                    'playbook_name': row.name,
                    'playbook_id': row.id,
                    'failure_count': row.failure_count,
                    'affected_servers': row.affected_servers
                }
                for row in playbook_failures
            ]
        
        # Analyze by server
        if group_by in ['server', 'both']:
            server_failures = db.session.query(
                Server.hostname,
                Server.id,
                func.count(Job.id).label('failure_count'),
                func.count(func.distinct(Job.playbook_id)).label('affected_playbooks')
            ).join(
                Server, Job.server_id == Server.id
            ).filter(
                Job.created_at >= start,
                Job.created_at <= end,
                Job.status == 'failed'
            ).group_by(
                Server.id, Server.hostname
            ).order_by(
                func.count(Job.id).desc()
            ).all()
            
            result['by_server'] = [
                {
                    'server_hostname': row.hostname,
                    'server_id': row.id,
                    'failure_count': row.failure_count,
                    'affected_playbooks': row.affected_playbooks
                }
                for row in server_failures
            ]
        
        # Overall failure statistics
        total_jobs = Job.query.filter(
            Job.created_at >= start,
            Job.created_at <= end
        ).count()
        
        failed_jobs = Job.query.filter(
            Job.created_at >= start,
            Job.created_at <= end,
            Job.status == 'failed'
        ).count()
        
        result['summary'] = {
            'time_range': time_range,
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
            'total_jobs': total_jobs,
            'total_failures': failed_jobs,
            'failure_rate': round((failed_jobs / total_jobs * 100), 2) if total_jobs > 0 else 0
        }
        
        return result

    @staticmethod
    def export_analytics(export_format, time_range='30days', start_date=None, end_date=None):
        """
        Export analytics data as PDF or CSV
        
        Args:
            export_format: 'pdf' or 'csv'
            time_range: Time range filter
            start_date: Start date for custom range
            end_date: End date for custom range
        
        Returns:
            Tuple of (file_data, filename, mimetype)
        """
        from datetime import datetime
        import csv
        import io
        
        # Get all analytics data
        success_trends = JobService.get_success_rate_trends(time_range, start_date, end_date)
        execution_times = JobService.get_execution_time_analytics(time_range, start_date, end_date)
        failure_analysis = JobService.get_failure_analysis(time_range, start_date, end_date)
        
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        
        if export_format == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Write header
            writer.writerow(['Analytics Report'])
            writer.writerow(['Generated:', datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')])
            writer.writerow(['Time Range:', time_range])
            writer.writerow([])
            
            # Success Rate Trends
            writer.writerow(['SUCCESS RATE TRENDS'])
            writer.writerow(['Period', 'Total Jobs', 'Successful', 'Failed', 'Success Rate (%)'])
            for trend in success_trends['trends']:
                writer.writerow([
                    trend['period'],
                    trend['total_jobs'],
                    trend['successful_jobs'],
                    trend['failed_jobs'],
                    trend['success_rate']
                ])
            writer.writerow([])
            
            # Execution Time Analysis
            writer.writerow(['EXECUTION TIME BY PLAYBOOK'])
            writer.writerow(['Playbook Name', 'Total Executions', 'Avg Duration (s)', 'Min Duration (s)', 'Max Duration (s)'])
            for playbook in execution_times['playbooks']:
                writer.writerow([
                    playbook['playbook_name'],
                    playbook['total_executions'],
                    playbook['avg_duration_seconds'],
                    playbook['min_duration_seconds'],
                    playbook['max_duration_seconds']
                ])
            writer.writerow([])
            
            # Failure Analysis
            writer.writerow(['FAILURE ANALYSIS'])
            writer.writerow(['Summary'])
            writer.writerow(['Total Jobs', failure_analysis['summary']['total_jobs']])
            writer.writerow(['Total Failures', failure_analysis['summary']['total_failures']])
            writer.writerow(['Failure Rate (%)', failure_analysis['summary']['failure_rate']])
            writer.writerow([])
            
            if 'by_playbook' in failure_analysis:
                writer.writerow(['Failures by Playbook'])
                writer.writerow(['Playbook Name', 'Failure Count', 'Affected Servers'])
                for item in failure_analysis['by_playbook']:
                    writer.writerow([
                        item['playbook_name'],
                        item['failure_count'],
                        item['affected_servers']
                    ])
                writer.writerow([])
            
            if 'by_server' in failure_analysis:
                writer.writerow(['Failures by Server'])
                writer.writerow(['Server Hostname', 'Failure Count', 'Affected Playbooks'])
                for item in failure_analysis['by_server']:
                    writer.writerow([
                        item['server_hostname'],
                        item['failure_count'],
                        item['affected_playbooks']
                    ])
            
            csv_data = output.getvalue().encode('utf-8')
            filename = f'analytics_report_{timestamp}.csv'
            mimetype = 'text/csv'
            
            return csv_data, filename, mimetype
        
        elif export_format == 'pdf':
            from reportlab.lib.pagesizes import A4
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib import colors
            from reportlab.lib.units import inch
            from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
            from reportlab.pdfgen import canvas
            import matplotlib
            matplotlib.use('Agg')
            import matplotlib.pyplot as plt
            import os
            
            buffer = io.BytesIO()
            
            # Custom page template with header and footer
            def add_page_decorations(canvas_obj, doc):
                canvas_obj.saveState()
                page_width, page_height = A4
                
                # Header
                header_height = 50
                canvas_obj.setFillColor(colors.HexColor('#003057'))  # Jade Global blue
                canvas_obj.rect(0, page_height - header_height, page_width, header_height, fill=1)
                
                # Header text
                canvas_obj.setFillColor(colors.white)
                canvas_obj.setFont('Helvetica-Bold', 14)
                canvas_obj.drawString(30, page_height - 30, "Jade Global Automation Hub")
                
                # Logo (if exists)
                logo_path = '/home/NikhilRokade/InfraAnsible/frontend/src/assets/JadeLogo-bg.png'
                if os.path.exists(logo_path):
                    try:
                        canvas_obj.drawImage(logo_path, page_width - 100, page_height - 45, 
                                           width=70, height=35, mask='auto', preserveAspectRatio=True)
                    except:
                        pass  # If logo fails to load, continue without it
                
                # Footer
                canvas_obj.setFillColor(colors.HexColor('#003057'))
                canvas_obj.setFont('Helvetica', 9)
                footer_text = f"Page {doc.page}"
                canvas_obj.drawCentredString(page_width / 2, 30, footer_text)
                
                canvas_obj.restoreState()
            
            doc = SimpleDocTemplate(
                buffer, 
                pagesize=A4,
                topMargin=70,
                bottomMargin=50,
                leftMargin=50,
                rightMargin=50
            )
            
            elements = []
            styles = getSampleStyleSheet()
            
            # Define custom styles
            cover_title_style = ParagraphStyle(
                'CoverTitle',
                parent=styles['Heading1'],
                fontSize=36,
                textColor=colors.HexColor('#003057'),
                spaceAfter=20,
                alignment=TA_CENTER,
                fontName='Helvetica-Bold'
            )
            
            cover_subtitle_style = ParagraphStyle(
                'CoverSubtitle',
                parent=styles['Normal'],
                fontSize=18,
                textColor=colors.HexColor('#555555'),
                spaceAfter=30,
                alignment=TA_CENTER
            )
            
            section_heading_style = ParagraphStyle(
                'SectionHeading',
                parent=styles['Heading1'],
                fontSize=18,
                textColor=colors.HexColor('#003057'),
                spaceAfter=15,
                spaceBefore=10,
                fontName='Helvetica-Bold'
            )
            
            # ===== COVER PAGE =====
            elements.append(Spacer(1, 2*inch))
            
            # Logo on cover
            logo_path = '/home/NikhilRokade/InfraAnsible/frontend/src/assets/JadeLogo-bg.png'
            if os.path.exists(logo_path):
                try:
                    logo = Image(logo_path, width=3*inch, height=1.5*inch)
                    logo.hAlign = 'CENTER'
                    elements.append(logo)
                    elements.append(Spacer(1, 0.5*inch))
                except:
                    pass
            
            elements.append(Paragraph('Jade Global', cover_title_style))
            elements.append(Paragraph('Automation Analytics Report', cover_subtitle_style))
            elements.append(Spacer(1, 1*inch))
            
            # Cover metadata
            cover_meta_style = ParagraphStyle(
                'CoverMeta',
                parent=styles['Normal'],
                fontSize=12,
                textColor=colors.HexColor('#666666'),
                alignment=TA_CENTER,
                spaceAfter=8
            )
            elements.append(Paragraph(f'<b>Generated:</b> {datetime.utcnow().strftime("%B %d, %Y at %H:%M UTC")}', cover_meta_style))
            elements.append(Paragraph(f'<b>Time Range:</b> {time_range.replace("days", " days").replace("months", " months")}', cover_meta_style))
            
            elements.append(PageBreak())
            
            # ===== SUCCESS RATE TRENDS SECTION =====
            elements.append(Paragraph('Success Rate Trends', section_heading_style))
            elements.append(Spacer(1, 0.2*inch))
            
            # Create bar chart for success rate trends
            if success_trends['trends']:
                fig, ax = plt.subplots(figsize=(7, 4))
                periods = [t['period'] for t in success_trends['trends']]
                success_rates = [t['success_rate'] for t in success_trends['trends']]
                
                bars = ax.bar(range(len(periods)), success_rates, color='#003057', alpha=0.8)
                ax.set_xlabel('Period', fontsize=11, fontweight='bold')
                ax.set_ylabel('Success Rate (%)', fontsize=11, fontweight='bold')
                ax.set_title('Success Rate Trends Over Time', fontsize=13, fontweight='bold', pad=15)
                ax.set_xticks(range(len(periods)))
                ax.set_xticklabels(periods, rotation=45, ha='right', fontsize=9)
                ax.set_ylim(0, 105)
                ax.grid(axis='y', alpha=0.3, linestyle='--')
                
                # Add value labels on bars
                for i, bar in enumerate(bars):
                    height = bar.get_height()
                    ax.text(bar.get_x() + bar.get_width()/2., height + 1,
                           f'{success_rates[i]:.1f}%',
                           ha='center', va='bottom', fontsize=9, fontweight='bold')
                
                plt.tight_layout()
                chart_buffer = io.BytesIO()
                plt.savefig(chart_buffer, format='png', dpi=150, bbox_inches='tight')
                plt.close()
                chart_buffer.seek(0)
                
                chart_img = Image(chart_buffer, width=6.5*inch, height=3.5*inch)
                elements.append(chart_img)
                elements.append(Spacer(1, 0.3*inch))
            
            # Success trends data table (summary)
            trend_data = [['Period', 'Total Jobs', 'Successful', 'Failed', 'Success Rate']]
            for trend in success_trends['trends']:
                trend_data.append([
                    trend['period'],
                    str(trend['total_jobs']),
                    str(trend['successful_jobs']),
                    str(trend['failed_jobs']),
                    f"{trend['success_rate']}%"
                ])
            
            trend_table = Table(trend_data, colWidths=[1.6*inch, 1.2*inch, 1.2*inch, 1.2*inch, 1.3*inch])
            trend_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003057')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7FAFC')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E0'))
            ]))
            elements.append(trend_table)
            elements.append(PageBreak())
            
            # ===== EXECUTION TIME ANALYSIS SECTION =====
            elements.append(Paragraph('Average Execution Time by Playbook', section_heading_style))
            elements.append(Spacer(1, 0.2*inch))
            
            # Execution time table
            exec_data = [['Playbook Name', 'Total Runs', 'Avg Time', 'Min Time', 'Max Time']]
            for playbook in execution_times['playbooks'][:15]:  # Top 15
                exec_data.append([
                    playbook['playbook_name'][:35],
                    str(playbook['total_executions']),
                    JobService._format_duration(playbook['avg_duration_seconds']),
                    JobService._format_duration(playbook['min_duration_seconds']),
                    JobService._format_duration(playbook['max_duration_seconds'])
                ])
            
            exec_table = Table(exec_data, colWidths=[2.8*inch, 1*inch, 1*inch, 1*inch, 1*inch])
            exec_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003057')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('TOPPADDING', (0, 0), (-1, 0), 10),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7FAFC')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E0'))
            ]))
            elements.append(exec_table)
            
            if len(execution_times['playbooks']) > 15:
                note_style = ParagraphStyle(
                    'Note',
                    parent=styles['Normal'],
                    fontSize=9,
                    textColor=colors.HexColor('#718096'),
                    alignment=TA_LEFT,
                    spaceAfter=10
                )
                elements.append(Spacer(1, 0.1*inch))
                elements.append(Paragraph(f'<i>Showing top 15 of {len(execution_times["playbooks"])} playbooks</i>', note_style))
            
            elements.append(PageBreak())
            
            # ===== FAILURE ANALYSIS SECTION =====
            elements.append(Paragraph('Failure Analysis', section_heading_style))
            elements.append(Spacer(1, 0.2*inch))
            
            # Summary cards
            summary = failure_analysis['summary']
            summary_data = [
                ['Metric', 'Value'],
                ['Total Jobs Analyzed', str(summary['total_jobs'])],
                ['Total Failures', str(summary['total_failures'])],
                ['Overall Failure Rate', f"{summary['failure_rate']}%"]
            ]
            summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003057')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('BACKGROUND', (0, 1), (0, -1), colors.HexColor('#EDF2F7')),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('ALIGN', (1, 0), (1, -1), 'CENTER'),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E0'))
            ]))
            elements.append(summary_table)
            elements.append(Spacer(1, 0.3*inch))
            
            # Pie chart for failure distribution
            if 'by_playbook' in failure_analysis and failure_analysis['by_playbook']:
                fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(7, 3.5))
                
                # Failures by playbook (pie chart)
                playbook_data = failure_analysis['by_playbook'][:8]  # Top 8
                playbook_names = [p['playbook_name'][:20] for p in playbook_data]
                playbook_counts = [p['failure_count'] for p in playbook_data]
                
                colors_pie = ['#003057', '#2C5282', '#3182CE', '#4299E1', '#63B3ED', '#90CDF4', '#BEE3F8', '#E6F4FF']
                wedges, texts, autotexts = ax1.pie(playbook_counts, labels=playbook_names, autopct='%1.1f%%',
                                                     colors=colors_pie, startangle=90, textprops={'fontsize': 8})
                ax1.set_title('Top Failing Playbooks', fontsize=11, fontweight='bold', pad=10)
                
                # Failures by server (pie chart)
                if 'by_server' in failure_analysis and failure_analysis['by_server']:
                    server_data = failure_analysis['by_server'][:8]  # Top 8
                    server_names = [s['server_hostname'][:15] for s in server_data]
                    server_counts = [s['failure_count'] for s in server_data]
                    
                    wedges2, texts2, autotexts2 = ax2.pie(server_counts, labels=server_names, autopct='%1.1f%%',
                                                           colors=colors_pie, startangle=90, textprops={'fontsize': 8})
                    ax2.set_title('Top Failing Servers', fontsize=11, fontweight='bold', pad=10)
                else:
                    ax2.text(0.5, 0.5, 'No server data available', ha='center', va='center',
                            transform=ax2.transAxes, fontsize=10)
                    ax2.axis('off')
                
                plt.tight_layout()
                chart_buffer2 = io.BytesIO()
                plt.savefig(chart_buffer2, format='png', dpi=150, bbox_inches='tight')
                plt.close()
                chart_buffer2.seek(0)
                
                chart_img2 = Image(chart_buffer2, width=6.5*inch, height=3*inch)
                elements.append(chart_img2)
                elements.append(Spacer(1, 0.3*inch))
            
            # Detailed failure tables
            if 'by_playbook' in failure_analysis and failure_analysis['by_playbook']:
                elements.append(Paragraph('Failures by Playbook (Detailed)', styles['Heading3']))
                elements.append(Spacer(1, 0.1*inch))
                
                playbook_fail_data = [['Playbook Name', 'Failure Count', 'Affected Servers']]
                for item in failure_analysis['by_playbook'][:10]:
                    playbook_fail_data.append([
                        item['playbook_name'][:40],
                        str(item['failure_count']),
                        str(item['affected_servers'])
                    ])
                
                playbook_fail_table = Table(playbook_fail_data, colWidths=[4*inch, 1.5*inch, 1.5*inch])
                playbook_fail_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003057')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                    ('TOPPADDING', (0, 0), (-1, 0), 10),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7FAFC')]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E0'))
                ]))
                elements.append(playbook_fail_table)
                elements.append(Spacer(1, 0.3*inch))
            
            if 'by_server' in failure_analysis and failure_analysis['by_server']:
                elements.append(Paragraph('Failures by Server (Detailed)', styles['Heading3']))
                elements.append(Spacer(1, 0.1*inch))
                
                server_fail_data = [['Server Hostname', 'Failure Count', 'Affected Playbooks']]
                for item in failure_analysis['by_server'][:10]:
                    server_fail_data.append([
                        item['server_hostname'][:40],
                        str(item['failure_count']),
                        str(item['affected_playbooks'])
                    ])
                
                server_fail_table = Table(server_fail_data, colWidths=[4*inch, 1.5*inch, 1.5*inch])
                server_fail_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#003057')),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('ALIGN', (0, 1), (0, -1), 'LEFT'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 10),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                    ('TOPPADDING', (0, 0), (-1, 0), 10),
                    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F7FAFC')]),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E0'))
                ]))
                elements.append(server_fail_table)
            
            # Build PDF with custom page decorations
            doc.build(elements, onFirstPage=add_page_decorations, onLaterPages=add_page_decorations)
            pdf_data = buffer.getvalue()
            buffer.close()
            
            filename = f'jade_global_analytics_{timestamp}.pdf'
            mimetype = 'application/pdf'
            
            return pdf_data, filename, mimetype

    @staticmethod
    def _format_duration(seconds):
        """Format duration in seconds to human readable format"""
        if not seconds:
            return "0s"
        
        seconds = int(seconds)
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        secs = seconds % 60
        
        if hours > 0:
            return f"{hours}h {minutes}m {secs}s"
        elif minutes > 0:
            return f"{minutes}m {secs}s"
        else:
            return f"{secs}s"


# Singleton instance
job_service = JobService()
