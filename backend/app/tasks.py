"""
Celery Tasks
Defines async tasks for job execution
"""
from celery import Task
from app.extensions import celery, db
from app.models import Job, Playbook, Server
from app.services.job_service import job_service
from app.playbooks.run import ansible_runner_instance
from app.utils.log_parser import log_parser
from datetime import datetime


class DatabaseTask(Task):
    """Base task class that handles database session management"""
    
    def after_return(self, *args, **kwargs):
        """Clean up database session after task execution"""
        db.session.remove()


@celery.task(base=DatabaseTask, bind=True, name='app.tasks.execute_playbook_task')
def execute_playbook_task(self, job_id):
    """
    Execute Ansible playbook asynchronously
    
    Args:
        job_id: Job database ID
    
    Returns:
        Dictionary with execution result
    """
    try:
        # Get job details
        job = Job.query.get(job_id)
        if not job:
            return {'status': 'error', 'message': f'Job {job_id} not found'}
        
        # Get related objects
        playbook = Playbook.query.get(job.playbook_id)
        server = Server.query.get(job.server_id)
        
        if not playbook or not server:
            job_service.update_job_status(
                job_id, 
                'failed', 
                error_message='Playbook or server not found'
            )
            return {'status': 'error', 'message': 'Playbook or server not found'}
        
        # Update job status to running
        job_service.update_job_status(
            job_id, 
            'running',
            celery_task_id=self.request.id
        )
        
        # Prepare inventory
        inventory = ansible_runner_instance.get_inventory_string(
            hostname=server.hostname,
            ip_address=server.ip_address,
            ssh_user=server.ssh_user,
            ssh_port=server.ssh_port
        )
        
        # Merge extra vars
        extra_vars = {}
        if playbook.variables:
            extra_vars.update(playbook.variables)
        if job.extra_vars:
            extra_vars.update(job.extra_vars)
        
        # Get SSH key path if exists
        private_key_path = server.ssh_key_path if server.ssh_key_path else None
        
        # Execute playbook
        runner = ansible_runner_instance.run_playbook(
            playbook_path=playbook.file_path,
            inventory=inventory,
            extra_vars=extra_vars,
            private_key_path=private_key_path
        )
        
        # Parse output
        parsed_output = ansible_runner_instance.parse_runner_output(runner)
        
        # Process stdout logs
        logs_to_insert = []
        if parsed_output.get('stdout'):
            parsed_logs = log_parser.parse_output(parsed_output['stdout'])
            for log_entry in parsed_logs:
                logs_to_insert.append({
                    'line_number': log_entry['line_number'],
                    'content': log_entry['content'],
                    'log_level': log_entry['log_level']
                })
        
        # Insert logs in bulk
        if logs_to_insert:
            job_service.add_job_logs_bulk(job_id, logs_to_insert)
        
        # Determine final status
        if runner.status == 'successful':
            final_status = 'success'
            error_message = None
        elif runner.status == 'failed':
            final_status = 'failed'
            error_message = f"Playbook execution failed with return code {runner.rc}"
        else:
            final_status = 'failed'
            error_message = f"Unknown status: {runner.status}"
        
        # Update job status
        job_service.update_job_status(
            job_id,
            final_status,
            error_message=error_message
        )
        
        return {
            'status': final_status,
            'job_id': job.job_id,
            'rc': runner.rc,
            'stats': parsed_output.get('stats', {}),
            'total_logs': len(logs_to_insert)
        }
    
    except Exception as e:
        # Handle any unexpected errors
        error_message = f"Task execution error: {str(e)}"
        
        try:
            job_service.update_job_status(
                job_id,
                'failed',
                error_message=error_message
            )
            
            # Add error log
            job_service.add_job_log(
                job_id,
                1,
                error_message,
                log_level='ERROR'
            )
        except Exception:
            pass  # Avoid nested exception handling
        
        return {
            'status': 'error',
            'message': error_message
        }


@celery.task(base=DatabaseTask, name='app.tasks.cleanup_old_logs')
def cleanup_old_logs():
    """
    Periodic task to clean up old job logs
    Can be configured to run via Celery Beat
    
    Returns:
        Cleanup statistics
    """
    from app.models import JobLog
    from datetime import timedelta
    
    try:
        # Delete logs older than 90 days
        cutoff_date = datetime.utcnow() - timedelta(days=90)
        
        deleted_count = JobLog.query.filter(
            JobLog.timestamp < cutoff_date
        ).delete()
        
        db.session.commit()
        
        return {
            'status': 'success',
            'deleted_logs': deleted_count,
            'cutoff_date': cutoff_date.isoformat()
        }
    
    except Exception as e:
        db.session.rollback()
        return {
            'status': 'error',
            'message': str(e)
        }


@celery.task(base=DatabaseTask, name='app.tasks.generate_job_report')
def generate_job_report(start_date=None, end_date=None):
    """
    Generate job execution report for a date range
    
    Args:
        start_date: Start date (ISO format)
        end_date: End date (ISO format)
    
    Returns:
        Report data
    """
    from app.models import Job
    from datetime import datetime
    
    try:
        query = Job.query
        
        if start_date:
            query = query.filter(Job.created_at >= datetime.fromisoformat(start_date))
        
        if end_date:
            query = query.filter(Job.created_at <= datetime.fromisoformat(end_date))
        
        jobs = query.all()
        
        report = {
            'total_jobs': len(jobs),
            'by_status': {},
            'by_playbook': {},
            'by_user': {},
            'average_duration': 0
        }
        
        durations = []
        
        for job in jobs:
            # Count by status
            report['by_status'][job.status] = report['by_status'].get(job.status, 0) + 1
            
            # Count by playbook
            playbook_name = job.playbook.name if job.playbook else 'Unknown'
            report['by_playbook'][playbook_name] = report['by_playbook'].get(playbook_name, 0) + 1
            
            # Count by user
            username = job.user.username if job.user else 'Unknown'
            report['by_user'][username] = report['by_user'].get(username, 0) + 1
            
            # Calculate duration
            if job.started_at and job.completed_at:
                duration = (job.completed_at - job.started_at).total_seconds()
                durations.append(duration)
        
        if durations:
            report['average_duration'] = sum(durations) / len(durations)
        
        return report
    
    except Exception as e:
        return {
            'status': 'error',
            'message': str(e)
        }
