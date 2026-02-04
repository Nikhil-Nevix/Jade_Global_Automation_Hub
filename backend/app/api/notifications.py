"""
Notifications API endpoints
Handles notification management and SSE streaming
"""
from flask import Blueprint, request, jsonify, Response, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.extensions import db
from app.services.auth_service import auth_service
from app.services.notification_service import NotificationService
from app.models import Notification, NotificationPreference
import json
import time
from queue import Queue
import logging

logger = logging.getLogger(__name__)

notifications_bp = Blueprint('notifications', __name__, url_prefix='/api/notifications')

# SSE clients tracking
sse_clients = {}  # {user_id: Queue}


@notifications_bp.route('', methods=['GET'])
@jwt_required()
def get_notifications():
    """
    Get notifications for current user with pagination
    Query params: unread_only, limit, offset
    """
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        unread_only = request.args.get('unread_only', 'false').lower() == 'true'
        limit = request.args.get('limit', 50, type=int)
        offset = request.args.get('offset', 0, type=int)
        
        notifications, total = NotificationService.get_user_notifications(
            user_id=current_user.id,
            unread_only=unread_only,
            limit=limit,
            offset=offset
        )
        
        return jsonify({
            'notifications': [n.to_dict() for n in notifications],
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching notifications: {str(e)}")
        return jsonify({'error': 'Failed to fetch notifications'}), 500


@notifications_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def get_unread_count():
    """Get count of unread notifications"""
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        count = NotificationService.get_unread_count(current_user.id)
        return jsonify({'count': count}), 200
    except Exception as e:
        logger.error(f"Error fetching unread count: {str(e)}")
        return jsonify({'error': 'Failed to fetch unread count'}), 500


@notifications_bp.route('/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(notification_id):
    """Mark a notification as read"""
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        success = NotificationService.mark_as_read(notification_id, current_user.id)
        if success:
            return jsonify({'message': 'Notification marked as read'}), 200
        return jsonify({'error': 'Notification not found'}), 404
    except Exception as e:
        logger.error(f"Error marking notification as read: {str(e)}")
        return jsonify({'error': 'Failed to mark notification as read'}), 500


@notifications_bp.route('/mark-all-read', methods=['PUT'])
@jwt_required()
def mark_all_as_read():
    """Mark all notifications as read"""
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        count = NotificationService.mark_all_as_read(current_user.id)
        return jsonify({'message': f'{count} notifications marked as read'}), 200
    except Exception as e:
        logger.error(f"Error marking all as read: {str(e)}")
        return jsonify({'error': 'Failed to mark all as read'}), 500


@notifications_bp.route('/<int:notification_id>', methods=['DELETE'])
@jwt_required()
def delete_notification(notification_id):
    """Delete a notification"""
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        success = NotificationService.delete_notification(notification_id, current_user.id)
        if success:
            return jsonify({'message': 'Notification deleted'}), 200
        return jsonify({'error': 'Notification not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting notification: {str(e)}")
        return jsonify({'error': 'Failed to delete notification'}), 500


@notifications_bp.route('/delete-all-read', methods=['DELETE'])
@jwt_required()
def delete_all_read():
    """Delete all read notifications"""
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        count = NotificationService.delete_all_read(current_user.id)
        return jsonify({'message': f'{count} notifications deleted'}), 200
    except Exception as e:
        logger.error(f"Error deleting read notifications: {str(e)}")
        return jsonify({'error': 'Failed to delete notifications'}), 500


@notifications_bp.route('/preferences', methods=['GET'])
@jwt_required()
def get_preferences():
    """Get notification preferences for current user"""
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        preferences = NotificationService.get_user_preferences(current_user.id)
        return jsonify({
            'preferences': [p.to_dict() for p in preferences]
        }), 200
    except Exception as e:
        logger.error(f"Error fetching preferences: {str(e)}")
        return jsonify({'error': 'Failed to fetch preferences'}), 500


@notifications_bp.route('/preferences/<event_type>', methods=['PUT'])
@jwt_required()
def update_preference(event_type):
    """Update notification preference for an event type"""
    try:
        current_user = auth_service.get_current_user(get_jwt_identity())
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        preference = NotificationService.update_preference(
            user_id=current_user.id,
            event_type=event_type,
            in_app_enabled=data.get('in_app_enabled'),
            email_enabled=data.get('email_enabled'),
            browser_push_enabled=data.get('browser_push_enabled')
        )
        
        return jsonify({
            'message': 'Preference updated',
            'preference': preference.to_dict()
        }), 200
        
    except Exception as e:
        logger.error(f"Error updating preference: {str(e)}")
        return jsonify({'error': 'Failed to update preference'}), 500


@notifications_bp.route('/stream', methods=['GET'])
@jwt_required()
def notification_stream():
    """
    Server-Sent Events endpoint for real-time notifications
    Maintains a persistent connection and pushes new notifications
    """
    current_user = auth_service.get_current_user(get_jwt_identity())
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    def generate():
        # Create a queue for this user
        client_queue = Queue()
        sse_clients[current_user.id] = client_queue
        
        logger.info(f"SSE connection established for user {current_user.id}")
        
        try:
            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected', 'message': 'Connected to notification stream'})}\n\n"
            
            # Keep connection alive and send notifications
            while True:
                try:
                    # Wait for notification with timeout (for heartbeat)
                    if not client_queue.empty():
                        notification = client_queue.get(timeout=30)
                        yield f"data: {json.dumps(notification)}\n\n"
                    else:
                        # Send heartbeat to keep connection alive
                        yield f": heartbeat\n\n"
                        time.sleep(30)
                        
                except Exception as e:
                    logger.error(f"Error in SSE stream: {str(e)}")
                    break
                    
        finally:
            # Clean up when connection closes
            if current_user.id in sse_clients:
                del sse_clients[current_user.id]
            logger.info(f"SSE connection closed for user {current_user.id}")
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive'
        }
    )


def push_notification_to_user(user_id: int, notification: Notification):
    """
    Push a notification to a user's SSE stream
    
    Args:
        user_id: User ID
        notification: Notification object
    """
    if user_id in sse_clients:
        try:
            notification_data = {
                'type': 'notification',
                'data': notification.to_dict()
            }
            sse_clients[user_id].put(notification_data)
            logger.info(f"Pushed notification to user {user_id} via SSE")
        except Exception as e:
            logger.error(f"Failed to push notification via SSE: {str(e)}")
