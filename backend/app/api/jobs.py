"""
Job API Endpoints
Handles job creation, monitoring, and log retrieval
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app.services.auth_service import auth_service
from app.services.job_service import job_service
from app.schemas import (
    job_schema, jobs_schema, job_create_schema,
    job_logs_schema, ticket_schema, ticket_create_schema,
    error_schema
)
# Import celery task
from app.tasks import execute_playbook_task

jobs_bp = Blueprint('jobs', __name__, url_prefix='/jobs')


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
        
        # Check permission
        if not auth_service.check_permission(current_user, 'operator'):
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
    Cancel a running or pending job (operator or admin only)
    
    Returns:
        Updated job
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission
        if not auth_service.check_permission(current_user, 'operator'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to cancel jobs'
            })), 403
        
        # Cancel job
        job = job_service.cancel_job(job_id, current_user_id)
        
        # TODO: Also revoke Celery task if running
        # from app.extensions import celery
        # if job.celery_task_id:
        #     celery.control.revoke(job.celery_task_id, terminate=True)
        
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


@jobs_bp.route('/statistics', methods=['GET'])
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
