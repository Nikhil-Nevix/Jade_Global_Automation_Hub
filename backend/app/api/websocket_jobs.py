"""
WebSocket Handlers for Real-time Job Logs
Provides real-time streaming of job execution logs to connected clients
"""
from flask import request
from flask_socketio import emit, join_room, leave_room, rooms
from flask_jwt_extended import decode_token
from app.extensions import socketio
from app.models import Job
import logging

logger = logging.getLogger(__name__)


@socketio.on('connect')
def handle_connect(auth):
    """
    Handle client connection
    Optional JWT authentication via query params or auth dict
    """
    try:
        # Get token from auth dict or query parameters
        token = None
        if auth and isinstance(auth, dict):
            token = auth.get('token')
        
        if not token:
            # Try to get from query params
            token = request.args.get('token')
        
        if token:
            # Verify JWT token
            try:
                decoded = decode_token(token)
                user_id = decoded['sub']
                logger.info(f"WebSocket: User {user_id} connected")
                emit('connected', {'status': 'authenticated', 'user_id': user_id})
            except Exception as e:
                logger.warning(f"WebSocket: Invalid token: {str(e)}")
                emit('connected', {'status': 'connected', 'authenticated': False})
        else:
            # Allow unauthenticated connections (optional - can be disabled for security)
            logger.info("WebSocket: Unauthenticated connection")
            emit('connected', {'status': 'connected', 'authenticated': False})
            
    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")
        emit('error', {'message': 'Connection failed'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info("WebSocket: Client disconnected")


@socketio.on('subscribe_job')
def handle_subscribe_job(data):
    """
    Subscribe to real-time logs for a specific job
    
    Args:
        data: {'job_id': int} - Job ID to subscribe to
    """
    try:
        job_id = data.get('job_id')
        if not job_id:
            emit('error', {'message': 'job_id is required'})
            return
        
        # Check if job exists
        job = Job.query.get(job_id)
        if not job:
            emit('error', {'message': f'Job {job_id} not found'})
            return
        
        # Join room for this job
        room_name = f'job_{job_id}'
        join_room(room_name)
        
        logger.info(f"WebSocket: Client subscribed to job {job_id}")
        emit('subscribed', {
            'job_id': job_id,
            'job_status': job.status,
            'message': f'Subscribed to job {job.job_id}'
        })
        
    except Exception as e:
        logger.error(f"WebSocket subscribe error: {str(e)}")
        emit('error', {'message': f'Failed to subscribe: {str(e)}'})


@socketio.on('unsubscribe_job')
def handle_unsubscribe_job(data):
    """
    Unsubscribe from job logs
    
    Args:
        data: {'job_id': int} - Job ID to unsubscribe from
    """
    try:
        job_id = data.get('job_id')
        if not job_id:
            return
        
        room_name = f'job_{job_id}'
        leave_room(room_name)
        
        logger.info(f"WebSocket: Client unsubscribed from job {job_id}")
        emit('unsubscribed', {'job_id': job_id})
        
    except Exception as e:
        logger.error(f"WebSocket unsubscribe error: {str(e)}")


def emit_job_log(job_id, log_data):
    """
    Emit a log entry to all clients subscribed to a job
    
    Args:
        job_id: Job database ID
        log_data: Dictionary with log information {
            'line_number': int,
            'content': str,
            'timestamp': str,
            'log_level': str
        }
    """
    try:
        room_name = f'job_{job_id}'
        socketio.emit('job_log', log_data, room=room_name, namespace='/')
        logger.debug(f"Emitted log for job {job_id}: line {log_data.get('line_number')}")
    except Exception as e:
        logger.error(f"Error emitting job log: {str(e)}")


def emit_job_status(job_id, status, error_message=None):
    """
    Emit job status update to all clients subscribed to a job
    
    Args:
        job_id: Job database ID
        status: New job status
        error_message: Optional error message
    """
    try:
        room_name = f'job_{job_id}'
        data = {
            'job_id': job_id,
            'status': status
        }
        if error_message:
            data['error_message'] = error_message
            
        socketio.emit('job_status', data, room=room_name, namespace='/')
        logger.info(f"Emitted status update for job {job_id}: {status}")
    except Exception as e:
        logger.error(f"Error emitting job status: {str(e)}")
