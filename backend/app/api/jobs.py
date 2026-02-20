"""
Job API Endpoints
Handles job creation, monitoring, and log retrieval
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app.extensions import db
from app.services.auth_service import auth_service
from app.services.job_service import job_service
from app.schemas import (
    job_schema, jobs_schema, job_create_schema,
    job_logs_schema, ticket_schema, ticket_create_schema,
    error_schema
)
# Import celery task
from app.tasks import execute_playbook_task

jobs_bp = Blueprint('jobs', __name__, url_prefix='/api/jobs')


@jobs_bp.route('', methods=['GET'])
@jwt_required()
def get_jobs():
    """
    Get all jobs with optional filtering
    
    Query Parameters:
        status: str
        playbook_id: int
        server_id: int
        user_id: int
        page: int
        per_page: int
    
    Returns:
        List of jobs with pagination
    """
    try:
        # Extract filters from query params
        filters = {}
        if request.args.get('status'):
            filters['status'] = request.args.get('status')
        if request.args.get('playbook_id'):
            filters['playbook_id'] = int(request.args.get('playbook_id'))
        if request.args.get('server_id'):
            filters['server_id'] = int(request.args.get('server_id'))
        if request.args.get('user_id'):
            filters['user_id'] = int(request.args.get('user_id'))
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # Get jobs
        pagination = job_service.get_all_jobs(filters, page, per_page)
        
        return jsonify({
            'items': jobs_schema.dump(pagination.items),
            'pagination': {
                'page': pagination.page,
                'per_page': pagination.per_page,
                'total': pagination.total,
                'pages': pagination.pages
            }
        }), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching jobs'
        })), 500


@jobs_bp.route('/<int:job_id>', methods=['GET'])
@jwt_required()
def get_job(job_id):
    """
    Get a specific job by ID
    
    Returns:
        Job details
    """
    try:
        job = job_service.get_job(job_id)
        
        if not job:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Job with ID {job_id} not found'
            })), 404
        
        return jsonify(job_schema.dump(job)), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching job'
        })), 500


@jobs_bp.route('', methods=['POST'])
@jwt_required()
def create_job():
    """
    Create and execute a new job (operator or admin only)
    
    Request Body:
        playbook_id: int (required)
        server_id: int (required)
        extra_vars: dict
    
    Returns:
        Created job
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission - allow user, admin, and super_admin to create jobs
        if not auth_service.check_permission(current_user, 'user'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to create jobs'
            })), 403
        
        # Validate request
        data = job_create_schema.load(request.get_json())
        
        # Create job
        job = job_service.create_job(
            playbook_id=data['playbook_id'],
            server_id=data['server_id'],
            user_id=current_user_id,
            extra_vars=data.get('extra_vars')
        )
        
        # Trigger async execution
        task = execute_playbook_task.delay(job.id)
        
        # Update job with celery task ID
        job_service.update_job_status(job.id, 'pending', celery_task_id=task.id)
        
        return jsonify(job_schema.dump(job)), 201
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'creation_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while creating job: {str(err)}'
        })), 500


@jobs_bp.route('/<int:job_id>/logs', methods=['GET'])
@jwt_required()
def get_job_logs(job_id):
    """
    Get job execution logs
    
    Query Parameters:
        start_line: int - Starting line number
        limit: int - Maximum number of lines
    
    Returns:
        Job logs
    """
    try:
        # Check if job exists
        job = job_service.get_job(job_id)
        if not job:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Job with ID {job_id} not found'
            })), 404
        
        # Get query params
        start_line = request.args.get('start_line', type=int)
        limit = request.args.get('limit', type=int)
        
        # Get logs
        logs = job_service.get_job_logs(job_id, start_line, limit)
        total_logs = job_service.get_job_logs_count(job_id)
        
        return jsonify({
            'job_id': job_id,
            'logs': job_logs_schema.dump(logs),
            'total_lines': total_logs,
            'returned_lines': len(logs)
        }), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching logs'
        })), 500


@jobs_bp.route('/<int:job_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_job(job_id):
    """
    Cancel a running, pending, or failed job (all users can cancel)
    
    Returns:
        Updated job
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # All authenticated users can cancel jobs
        # No permission check required
        
        # Cancel job
        job = job_service.cancel_job(job_id, current_user_id)
        
        # Revoke Celery task if running
        if job.celery_task_id:
            from app.extensions import celery
            celery.control.revoke(job.celery_task_id, terminate=True, signal='SIGKILL')
        
        return jsonify(job_schema.dump(job)), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'cancellation_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while cancelling job'
        })), 500


@jobs_bp.route('/<int:job_id>/ticket', methods=['POST'])
@jwt_required()
def create_ticket_from_job(job_id):
    """
    Create a support ticket from a job
    
    Request Body:
        title: str (required)
        description: str
        priority: str
    
    Returns:
        Created ticket
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        
        # Validate request
        data = ticket_create_schema.load(request.get_json())
        
        # Verify job_id matches
        if data['job_id'] != job_id:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Job ID in URL does not match request body'
            })), 400
        
        # Create ticket
        ticket = job_service.create_ticket_from_job(
            job_id=job_id,
            user_id=current_user_id,
            title=data['title'],
            description=data.get('description'),
            priority=data.get('priority', 'medium')
        )
        
        return jsonify(ticket_schema.dump(ticket)), 201
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'creation_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while creating ticket'
        })), 500


@jobs_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_job_statistics():
    """
    Get job execution statistics
    
    Query Parameters:
        user_id: int - Filter by user
    
    Returns:
        Job statistics
    """
    try:
        user_id = request.args.get('user_id', type=int)
        stats = job_service.get_job_statistics(user_id)
        
        return jsonify(stats), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching statistics'
        })), 500


@jobs_bp.route('/batch', methods=['POST'])
@jwt_required()
def create_batch_job():
    """
    Create and execute a batch job on multiple servers
    
    Request Body:
        playbook_id: int (required)
        server_ids: list[int] (required) - List of server IDs to execute on
        extra_vars: dict (optional) - Extra Ansible variables
        concurrent_limit: int (optional, default 5) - Max concurrent executions
        stop_on_failure: bool (optional, default False) - Stop all if one fails
        execution_strategy: str (optional, default 'parallel') - 'parallel' or 'sequential'
    
    Returns:
        Parent batch job with child jobs
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission - allow user, admin, and super_admin to create jobs
        if not auth_service.check_permission(current_user, 'user'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to create jobs'
            })), 403
        
        # Get request data
        data = request.get_json()
        
        # Validate required fields
        if not data.get('playbook_id'):
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'playbook_id is required'
            })), 400
        
        if not data.get('server_ids') or not isinstance(data['server_ids'], list):
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'server_ids must be a non-empty list'
            })), 400
        
        if len(data['server_ids']) < 2:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Batch jobs require at least 2 servers. Use regular job creation for single server execution.'
            })), 400
        
        # Extract parameters
        playbook_id = data['playbook_id']
        server_ids = data['server_ids']
        extra_vars = data.get('extra_vars')
        concurrent_limit = data.get('concurrent_limit', 5)
        stop_on_failure = data.get('stop_on_failure', False)
        execution_strategy = data.get('execution_strategy', 'parallel')
        
        # Validate execution strategy
        if execution_strategy not in ['parallel', 'sequential']:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'execution_strategy must be either "parallel" or "sequential"'
            })), 400
        
        # Create batch job
        batch_job = job_service.create_batch_job(
            playbook_id=playbook_id,
            server_ids=server_ids,
            user_id=current_user_id,
            extra_vars=extra_vars,
            concurrent_limit=concurrent_limit,
            stop_on_failure=stop_on_failure,
            execution_strategy=execution_strategy
        )
        
        return jsonify({
            'id': batch_job.id,
            'job_id': batch_job.job_id,
            'is_batch_job': batch_job.is_batch_job,
            'batch_config': batch_job.batch_config,
            'status': batch_job.status,
            'playbook_id': batch_job.playbook_id,
            'total_servers': len(server_ids),
            'created_at': batch_job.created_at.isoformat(),
            'message': f'Batch job created successfully. Executing on {len(server_ids)} servers.'
        }), 201
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'creation_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while creating batch job: {str(err)}'
        })), 500


@jobs_bp.route('/<int:job_id>/children', methods=['GET'])
@jwt_required()
def get_child_jobs(job_id):
    """
    Get all child jobs for a parent batch job
    
    Returns:
        List of child jobs with their status
    """
    try:
        # Check if job exists and is a batch job
        job = job_service.get_job(job_id)
        if not job:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Job with ID {job_id} not found'
            })), 404
        
        if not job.is_batch_job:
            return jsonify(error_schema.dump({
                'error': 'invalid_request',
                'message': 'This job is not a batch job'
            })), 400
        
        # Get child jobs
        child_jobs = job_service.get_child_jobs(job_id)
        
        return jsonify({
            'parent_job_id': job_id,
            'total_children': len(child_jobs),
            'children': jobs_schema.dump(child_jobs)
        }), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching child jobs'
        })), 500


@jobs_bp.route('/analytics/success-rate-trends', methods=['GET'])
@jwt_required()
def get_success_rate_trends():
    """
    Get job success rate trends over time
    
    Query Parameters:
        time_range: str - '7days', '30days', '3months', 'custom'
        start_date: str - Start date for custom range (ISO format)
        end_date: str - End date for custom range (ISO format)
        granularity: str - 'daily', 'weekly', 'monthly' (default: 'daily')
    
    Returns:
        Success rate trends data
    """
    try:
        time_range = request.args.get('time_range', '30days')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        granularity = request.args.get('granularity', 'daily')
        
        trends = job_service.get_success_rate_trends(time_range, start_date, end_date, granularity)
        
        return jsonify(trends), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while fetching success rate trends: {str(err)}'
        })), 500


@jobs_bp.route('/analytics/execution-time', methods=['GET'])
@jwt_required()
def get_execution_time_analytics():
    """
    Get average execution time per playbook
    
    Query Parameters:
        time_range: str - '7days', '30days', '3months', 'custom'
        start_date: str - Start date for custom range (ISO format)
        end_date: str - End date for custom range (ISO format)
    
    Returns:
        Execution time analytics data
    """
    try:
        time_range = request.args.get('time_range', '30days')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        analytics = job_service.get_execution_time_analytics(time_range, start_date, end_date)
        
        return jsonify(analytics), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while fetching execution time analytics: {str(err)}'
        })), 500


@jobs_bp.route('/analytics/failure-analysis', methods=['GET'])
@jwt_required()
def get_failure_analysis():
    """
    Get failed job analysis - which playbooks/servers fail most
    
    Query Parameters:
        time_range: str - '7days', '30days', '3months', 'custom'
        start_date: str - Start date for custom range (ISO format)
        end_date: str - End date for custom range (ISO format)
        group_by: str - 'playbook', 'server', 'both' (default: 'both')
    
    Returns:
        Failure analysis data
    """
    try:
        time_range = request.args.get('time_range', '30days')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        group_by = request.args.get('group_by', 'both')
        
        analysis = job_service.get_failure_analysis(time_range, start_date, end_date, group_by)
        
        return jsonify(analysis), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while fetching failure analysis: {str(err)}'
        })), 500


@jobs_bp.route('/analytics/export', methods=['GET'])
@jwt_required()
def export_analytics():
    """
    Export analytics data as PDF or CSV
    
    Query Parameters:
        format: str - 'pdf' or 'csv' (required)
        time_range: str - '7days', '30days', '3months', 'custom'
        start_date: str - Start date for custom range (ISO format)
        end_date: str - End date for custom range (ISO format)
    
    Returns:
        File download
    """
    try:
        export_format = request.args.get('format', 'csv').lower()
        time_range = request.args.get('time_range', '30days')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if export_format not in ['pdf', 'csv']:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Invalid export format. Use "pdf" or "csv"'
            })), 400
        
        file_data, filename, mimetype = job_service.export_analytics(
            export_format, time_range, start_date, end_date
        )
        
        from flask import send_file
        import io
        
        return send_file(
            io.BytesIO(file_data),
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while exporting analytics: {str(err)}'
        })), 500


@jobs_bp.route('/<int:job_id>/rpm-csv', methods=['GET'])
@jwt_required()
def get_rpm_csv(job_id):
    """
    Fetch and return RPM upgrade CSV file from remote server
    
    Downloads the rpm_upgrades_with_lag.csv file from the server
    where the job was executed.
    
    Args:
        job_id: Job database ID
    
    Returns:
        JSON with CSV data parsed into rows, or error
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Get job
        from app.models import Job
        job = Job.query.get(job_id)
        if not job:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Job {job_id} not found'
            })), 404
        
        # Get server
        if not job.server:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': 'Server information not found for this job'
            })), 404
        
        # Fetch CSV file from remote server
        from app.services.ssh_service import SSHService
        ssh_service = SSHService()
        
        csv_path = '/var/tmp/rpm_upgrades_with_lag.csv'
        
        # Check if file exists
        if not ssh_service.file_exists(job.server, csv_path):
            return jsonify(error_schema.dump({
                'error': 'file_not_found',
                'message': f'CSV file not found at {csv_path} on server {job.server.hostname}'
            })), 404
        
        # Read CSV content
        csv_content = ssh_service.read_file(job.server, csv_path)
        
        # Parse CSV into structured data
        import csv
        import io
        
        csv_reader = csv.reader(io.StringIO(csv_content))
        rows = list(csv_reader)
        
        if not rows:
            return jsonify(error_schema.dump({
                'error': 'empty_file',
                'message': 'CSV file is empty'
            })), 400
        
        # First row is header, rest are data
        headers = rows[0] if rows else []
        data_rows = rows[1:] if len(rows) > 1 else []
        
        return jsonify({
            'success': True,
            'filename': 'rpm_upgrades_with_lag.csv',
            'headers': headers,
            'data': data_rows,
            'total_rows': len(data_rows)
        }), 200
        
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'Failed to fetch CSV: {str(err)}'
        })), 500


@jobs_bp.route('/<int:job_id>/generated-files', methods=['GET'])
@jwt_required()
def get_generated_files(job_id):
    """
    Detect and return list of files generated by a playbook execution
    
    Parses job logs to find file paths (typically in /tmp/ directory)
    
    Args:
        job_id: Job database ID
    
    Returns:
        JSON with list of generated files with metadata
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Get job
        from app.models import Job, JobLog
        job = Job.query.get(job_id)
        if not job:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Job {job_id} not found'
            })), 404
        
        # Get job logs
        logs = JobLog.query.filter_by(job_id=job_id).order_by(JobLog.line_number).all()
        log_content = '\n'.join([log.content for log in logs])
        
        # Parse logs to find generated file paths
        import re
        import os
        
        # Common patterns for file generation in Ansible/playbook logs
        file_patterns = [
            r'/tmp/[^\s\'"]+\.csv',  # CSV files in /tmp
            r'/tmp/[^\s\'"]+\.txt',  # Text files in /tmp
            r'/tmp/[^\s\'"]+\.json', # JSON files in /tmp
            r'/tmp/[^\s\'"]+\.xml',  # XML files in /tmp
            r'/tmp/[^\s\'"]+\.log',  # Log files in /tmp
            r'/tmp/[^\s\'"]+\.xlsx', # Excel files in /tmp
            r'/tmp/[^\s\'"]+\.pdf',  # PDF files in /tmp
            r'/var/tmp/[^\s\'"]+\.csv',  # CSV in /var/tmp
            r'/var/tmp/[^\s\'"]+\.txt',  # Text in /var/tmp
        ]
        
        found_files = set()
        for pattern in file_patterns:
            matches = re.findall(pattern, log_content, re.IGNORECASE)
            found_files.update(matches)
        
        # Only show files explicitly mentioned in this job's logs
        if not found_files:
            return jsonify({
                'success': True,
                'files': [],
                'message': 'No generated files detected in job logs'
            }), 200
        
        # Get server to check which files actually exist
        if not job.server:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': 'Server information not found for this job'
            })), 404
        
        from app.services.ssh_service import SSHService
        ssh_service = SSHService()
        
        files_info = []
        for file_path in found_files:
            try:
                file_exists_on_server = False
                file_size = 0
                
                # Try SSH first (for remote servers)
                try:
                    if ssh_service.file_exists(job.server, file_path):
                        file_exists_on_server = True
                        # For SSH, try to get file size if local, otherwise estimate
                        if os.path.exists(file_path):
                            file_size = os.path.getsize(file_path)
                except Exception as ssh_error:
                    # SSH failed - fallback to local file check
                    # This handles cases where playbooks use delegate_to: localhost
                    pass
                
                # Fallback: Check local filesystem if SSH failed
                if not file_exists_on_server and os.path.exists(file_path):
                    file_exists_on_server = True
                    file_size = os.path.getsize(file_path)
                
                if file_exists_on_server:
                    # Extract filename and extension
                    filename = os.path.basename(file_path)
                    extension = os.path.splitext(filename)[1].lower()
                    
                    # Determine file type for icon/handling
                    file_type = 'other'
                    if extension == '.csv':
                        file_type = 'csv'
                    elif extension in ['.txt', '.log']:
                        file_type = 'text'
                    elif extension == '.json':
                        file_type = 'json'
                    elif extension in ['.xml', '.html']:
                        file_type = 'markup'
                    elif extension in ['.xlsx', '.xls']:
                        file_type = 'excel'
                    elif extension == '.pdf':
                        file_type = 'pdf'
                    
                    files_info.append({
                        'path': file_path,
                        'filename': filename,
                        'size': file_size,
                        'size_formatted': format_file_size(file_size),
                        'type': file_type,
                        'extension': extension
                    })
            except Exception as e:
                # Skip files that cause errors but continue processing others
                continue
        
        return jsonify({
            'success': True,
            'files': files_info,
            'total': len(files_info)
        }), 200
        
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'Failed to detect generated files: {str(err)}'
        })), 500


@jobs_bp.route('/<int:job_id>/download-file', methods=['GET'])
@jwt_required()
def download_generated_file(job_id):
    """
    Download or view a generated file from the server
    
    Args:
        job_id: Job database ID
        file_path: Query parameter - absolute path to file on server
        action: Query parameter - 'download' or 'view' (default: download)
    
    Returns:
        File content with appropriate headers
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Get job
        from app.models import Job
        job = Job.query.get(job_id)
        if not job:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Job {job_id} not found'
            })), 404
        
        # Get file path from query params
        file_path = request.args.get('file_path')
        if not file_path:
            return jsonify(error_schema.dump({
                'error': 'bad_request',
                'message': 'file_path query parameter is required'
            })), 400
        
        # Security: Only allow files in /tmp/ or /var/tmp/
        if not (file_path.startswith('/tmp/') or file_path.startswith('/var/tmp/')):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Access to files outside /tmp/ and /var/tmp/ is not allowed'
            })), 403
        
        # Get server
        if not job.server:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': 'Server information not found for this job'
            })), 404
        
        # Read file from server or local filesystem
        from app.services.ssh_service import SSHService
        ssh_service = SSHService()
        
        file_content = None
        file_exists_on_server = False
        
        # Try SSH first (for remote servers)
        try:
            if ssh_service.file_exists(job.server, file_path):
                file_content = ssh_service.read_file(job.server, file_path)
                file_exists_on_server = True
        except Exception as ssh_error:
            # SSH failed - will try local filesystem next
            pass
        
        # Fallback: Read from local filesystem if SSH failed
        if not file_exists_on_server:
            import os
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r') as f:
                        file_content = f.read()
                    file_exists_on_server = True
                except Exception as e:
                    # Try reading as binary
                    try:
                        with open(file_path, 'rb') as f:
                            file_content = f.read()
                        file_exists_on_server = True
                    except:
                        pass
        
        if not file_exists_on_server or file_content is None:
            return jsonify(error_schema.dump({
                'error': 'file_not_found',
                'message': f'File not found at {file_path}'
            })), 404
        
        # Ensure file_content is string for text processing
        if isinstance(file_content, bytes):
            try:
                file_content = file_content.decode('utf-8')
            except:
                # Keep as bytes for binary files
                pass
        
        # Determine action (download or view)
        action = request.args.get('action', 'download')
        
        import os
        filename = os.path.basename(file_path)
        extension = os.path.splitext(filename)[1].lower()
        
        # Determine content type
        content_types = {
            '.csv': 'text/csv',
            '.txt': 'text/plain',
            '.log': 'text/plain',
            '.json': 'application/json',
            '.xml': 'application/xml',
            '.html': 'text/html',
            '.pdf': 'application/pdf',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
        content_type = content_types.get(extension, 'application/octet-stream')
        
        if action == 'view':
            # For CSV files, parse and return structured data
            if extension == '.csv':
                import csv
                import io
                
                csv_reader = csv.reader(io.StringIO(file_content))
                rows = list(csv_reader)
                
                headers = rows[0] if rows else []
                data_rows = rows[1:] if len(rows) > 1 else []
                
                return jsonify({
                    'success': True,
                    'filename': filename,
                    'type': 'csv',
                    'headers': headers,
                    'data': data_rows,
                    'total_rows': len(data_rows)
                }), 200
            
            # For text/JSON files, return as text
            elif extension in ['.txt', '.log', '.json', '.xml']:
                return jsonify({
                    'success': True,
                    'filename': filename,
                    'type': 'text',
                    'content': file_content
                }), 200
            
            else:
                # Other file types must be downloaded
                return jsonify(error_schema.dump({
                    'error': 'unsupported',
                    'message': f'File type {extension} cannot be viewed inline. Please download instead.'
                })), 400
        
        else:
            # Download action - return file content
            from flask import Response
            response = Response(file_content, mimetype=content_type)
            response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'Failed to download file: {str(err)}'
        })), 500


def format_file_size(size_bytes):
    """Format file size in human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


@jobs_bp.route('/compliance/firmware-matrix', methods=['GET'])
@jwt_required()
def get_firmware_compliance_matrix():
    """
    Get firmware compliance matrix data across locations and vendors
    
    Query Parameters:
        job_ids: comma-separated list of job IDs to aggregate data from (optional)
        
    Returns:
        Firmware compliance matrix with percentages per location/vendor
    """
    try:
        job_ids_param = request.args.get('job_ids')
        
        # Parse job IDs or use recent jobs
        if job_ids_param:
            job_ids = [int(x.strip()) for x in job_ids_param.split(',')]
        else:
            # Default: get recent compliance jobs
            # You can customize this query based on playbook names
            from app.models import Job
            recent_jobs = Job.query.filter(
                Job.status == 'success'
            ).order_by(Job.created_at.desc()).limit(10).all()
            job_ids = [job.id for job in recent_jobs]
        
        # TODO: Implement actual CSV parsing logic here
        # For now, return mock data structure
        # In production, you would:
        # 1. Load CSV files from each job
        # 2. Parse vendor compliance data
        # 3. Aggregate by location
        # 4. Calculate percentages
        
        matrix_data = [
            {
                'location': 'Mumbai DC',
                'vendors': {
                    'Cisco': {'percentage': 92, 'status': 'compliant'},
                    'Fortinet': {'percentage': 78, 'status': 'warning'},
                    'Palo Alto': {'percentage': 88, 'status': 'warning'},
                    'HPE': {'percentage': 85, 'status': 'warning'}
                }
            },
            {
                'location': 'BLR DC',
                'vendors': {
                    'Cisco': {'percentage': 81, 'status': 'warning'},
                    'Fortinet': {'percentage': 74, 'status': 'warning'},
                    'Palo Alto': {'percentage': 90, 'status': 'compliant'},
                    'HPE': {'percentage': 72, 'status': 'warning'}
                }
            },
            {
                'location': 'US DC',
                'vendors': {
                    'Cisco': {'percentage': 88, 'status': 'warning'},
                    'Fortinet': {'percentage': 83, 'status': 'warning'},
                    'Palo Alto': {'percentage': 79, 'status': 'warning'},
                    'HPE': {'percentage': 70, 'status': 'critical'}
                }
            }
        ]
        
        return jsonify({
            'success': True,
            'data': matrix_data,
            'vendors': ['Cisco', 'Fortinet', 'Palo Alto', 'HPE']
        }), 200
        
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'Failed to get firmware compliance matrix: {str(err)}'
        })), 500

