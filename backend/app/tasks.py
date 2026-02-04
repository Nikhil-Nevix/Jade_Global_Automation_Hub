"""
Celery Tasks
Defines async tasks for job execution
"""
import os
from celery import Task
from celery.exceptions import Terminated, SoftTimeLimitExceeded
from app.extensions import celery, db
from app.models import Job, Playbook, Server
from app.services.job_service import job_service
from app.services.notification_service import NotificationService, EVENT_JOB_SUCCESS, EVENT_JOB_FAILURE, SEVERITY_INFO, SEVERITY_ERROR
from app.playbooks.run import ansible_runner_instance
from app.utils.log_parser import log_parser
from datetime import datetime


@celery.task(bind=True, name='app.tasks.execute_playbook_task')
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
        
        # Prepare extra vars from job
        extra_vars = {}
        if job.extra_vars:
            extra_vars.update(job.extra_vars)
        
        # Get SSH key path if exists
        private_key_path = server.ssh_key_path if server.ssh_key_path else None
        
        # Construct playbook path and working directory
        if playbook.is_folder and playbook.main_playbook_file:
            # Folder playbook - set working directory to folder root
            working_dir = playbook.file_path
            playbook_path = os.path.join(playbook.file_path, playbook.main_playbook_file)
        else:
            # Single file playbook - no working directory needed
            working_dir = None
            playbook_path = playbook.file_path
        
        # Execute playbook
        runner = ansible_runner_instance.run_playbook(
            playbook_path=playbook_path,
            inventory=inventory,
            extra_vars=extra_vars,
            private_key_path=private_key_path,
            working_dir=working_dir
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
        
        # Send notification based on job result
        try:
            if final_status == 'success':
                NotificationService.create_notification(
                    user_id=job.user_id,
                    title=f"Job Completed Successfully",
                    message=f"Playbook '{playbook.name}' completed successfully on {server.hostname}",
                    event_type=EVENT_JOB_SUCCESS,
                    severity=SEVERITY_INFO,
                    related_entity_type='job',
                    related_entity_id=job.id,
                    metadata={'job_id': job.job_id, 'playbook': playbook.name, 'server': server.hostname},
                    auto_dismiss_hours=24
                )
            else:
                NotificationService.create_notification(
                    user_id=job.user_id,
                    title=f"Job Failed",
                    message=f"Playbook '{playbook.name}' failed on {server.hostname}: {error_message}",
                    event_type=EVENT_JOB_FAILURE,
                    severity=SEVERITY_ERROR,
                    related_entity_type='job',
                    related_entity_id=job.id,
                    metadata={'job_id': job.job_id, 'playbook': playbook.name, 'server': server.hostname, 'error': error_message},
                    auto_dismiss_hours=72
                )
        except Exception as e:
            # Don't fail the job if notification fails
            print(f"Failed to send notification: {str(e)}")
        
        return {
            'status': final_status,
            'job_id': job.job_id,
            'rc': runner.rc,
            'stats': parsed_output.get('stats', {}),
            'total_logs': len(logs_to_insert)
        }
    
    except Terminated:
        # Handle task termination (when user clicks stop)
        error_message = "Task was terminated by user"
        
        try:
            job_service.update_job_status(
                job_id,
                'cancelled',
                error_message=error_message
            )
            
            # Add termination log
            job_service.add_job_log(
                job_id,
                1,
                f"Job terminated by user request at {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}",
                log_level='WARNING'
            )
        except Exception:
            pass
        
        return {
            'status': 'cancelled',
            'message': error_message
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
    finally:
        # Cleanup database session
        try:
            db.session.remove()
        except Exception:
            pass


@celery.task(name='app.tasks.cleanup_old_logs')
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


@celery.task(name='app.tasks.generate_job_report')
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


@celery.task(bind=True, name='app.tasks.execute_batch_job_task')
def execute_batch_job_task(self, parent_job_id):
    """
    Execute a batch job across multiple servers
    
    This task coordinates the execution of child jobs based on the batch configuration.
    Supports parallel and sequential execution strategies with configurable concurrency.
    
    Args:
        parent_job_id: Parent batch job database ID
    
    Returns:
        Dictionary with batch execution result
    """
    from celery import group, chain
    from celery.result import allow_join_result
    
    try:
        # Get parent job
        parent_job = Job.query.get(parent_job_id)
        if not parent_job or not parent_job.is_batch_job:
            return {'status': 'error', 'message': f'Batch job {parent_job_id} not found'}
        
        # Get batch configuration
        batch_config = parent_job.batch_config or {}
        execution_strategy = batch_config.get('execution_strategy', 'parallel')
        concurrent_limit = batch_config.get('concurrent_limit', 5)
        stop_on_failure = batch_config.get('stop_on_failure', False)
        
        # Get all child jobs
        child_jobs = job_service.get_child_jobs(parent_job_id)
        if not child_jobs:
            job_service.update_job_status(
                parent_job_id,
                'failed',
                error_message='No child jobs found for batch execution'
            )
            return {'status': 'error', 'message': 'No child jobs found'}
        
        # Update parent to running
        parent_job.status = 'running'
        parent_job.started_at = datetime.utcnow()
        db.session.commit()
        
        # Execute based on strategy
        if execution_strategy == 'sequential':
            # Execute one by one
            results = []
            for child_job in child_jobs:
                try:
                    # Execute this child job synchronously
                    result = execute_playbook_task.apply(args=[child_job.id])
                    results.append(result.get())
                    
                    # Check if we should stop on failure
                    if stop_on_failure and result.get().get('status') == 'failed':
                        # Cancel remaining jobs
                        for remaining in child_jobs[len(results):]:
                            job_service.update_job_status(
                                remaining.id,
                                'cancelled',
                                error_message='Cancelled due to failure in batch execution'
                            )
                        break
                except Exception as e:
                    results.append({'status': 'error', 'message': str(e)})
                    if stop_on_failure:
                        break
            
        else:  # parallel execution
            # Create task groups with concurrency limit
            child_job_ids = [job.id for job in child_jobs]
            
            if concurrent_limit and concurrent_limit < len(child_job_ids):
                # Execute in batches
                results = []
                for i in range(0, len(child_job_ids), concurrent_limit):
                    batch = child_job_ids[i:i+concurrent_limit]
                    
                    # Create a group for this batch
                    job_group = group([execute_playbook_task.s(job_id) for job_id in batch])
                    batch_results = job_group.apply_async()
                    
                    # Wait for batch to complete
                    with allow_join_result():
                        batch_output = batch_results.get()
                        results.extend(batch_output)
                    
                    # Check if we should stop on failure
                    if stop_on_failure and any(r.get('status') == 'failed' for r in batch_output):
                        # Cancel remaining jobs
                        remaining_ids = child_job_ids[i+concurrent_limit:]
                        for job_id in remaining_ids:
                            job_service.update_job_status(
                                job_id,
                                'cancelled',
                                error_message='Cancelled due to failure in batch execution'
                            )
                        break
            else:
                # Execute all at once
                job_group = group([execute_playbook_task.s(job_id) for job_id in child_job_ids])
                group_results = job_group.apply_async()
                
                with allow_join_result():
                    results = group_results.get()
        
        # Update parent job status based on children
        job_service.update_batch_job_status(parent_job_id)
        
        # Calculate statistics
        success_count = sum(1 for r in results if r.get('status') == 'success')
        failed_count = sum(1 for r in results if r.get('status') == 'failed')
        
        # Send batch completion notification
        try:
            from app.services.notification_service import EVENT_BATCH_COMPLETE, SEVERITY_INFO, SEVERITY_WARNING
            
            # Refresh parent job to get updated status
            db.session.refresh(parent_job)
            
            # Determine severity based on results
            severity = SEVERITY_INFO if failed_count == 0 else SEVERITY_WARNING
            
            NotificationService.create_notification(
                user_id=parent_job.user_id,
                title=f"Batch Job Completed",
                message=f"Batch execution completed: {success_count} successful, {failed_count} failed out of {len(child_jobs)} servers",
                event_type=EVENT_BATCH_COMPLETE,
                severity=severity,
                related_entity_type='job',
                related_entity_id=parent_job.id,
                metadata={
                    'job_id': parent_job.job_id,
                    'total': len(child_jobs),
                    'success': success_count,
                    'failed': failed_count,
                    'execution_strategy': execution_strategy
                },
                auto_dismiss_hours=48
            )
        except Exception as e:
            print(f"Failed to send batch completion notification: {str(e)}")
        
        return {
            'status': 'completed',
            'parent_job_id': parent_job_id,
            'total_jobs': len(child_jobs),
            'executed': len(results),
            'success': success_count,
            'failed': failed_count,
            'execution_strategy': execution_strategy
        }
    
    except Terminated:
        # Handle task termination
        try:
            job_service.update_job_status(
                parent_job_id,
                'cancelled',
                error_message="Batch job was terminated by user"
            )
            # Cancel all pending child jobs
            child_jobs = job_service.get_child_jobs(parent_job_id)
            for child in child_jobs:
                if child.status in ['pending', 'running']:
                    job_service.update_job_status(
                        child.id,
                        'cancelled',
                        error_message="Cancelled due to parent batch job termination"
                    )
        except Exception:
            pass
        
        return {'status': 'cancelled', 'message': 'Batch job terminated by user'}
    
    except Exception as e:
        # Handle errors
        error_message = f"Batch execution error: {str(e)}"
        try:
            job_service.update_job_status(
                parent_job_id,
                'failed',
                error_message=error_message
            )
        except Exception:
            pass
        
        return {'status': 'error', 'message': error_message}
    
    finally:
        try:
            db.session.remove()
        except Exception:
            pass
