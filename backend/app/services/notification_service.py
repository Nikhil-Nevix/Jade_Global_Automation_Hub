"""
Notification Service
Handles creation, delivery, and management of notifications across all channels
"""
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from app.extensions import db
from app.models import Notification, NotificationPreference, User
from app.services.email_service import send_notification_email
import logging

logger = logging.getLogger(__name__)

# Event type constants
EVENT_JOB_SUCCESS = 'job_success'
EVENT_JOB_FAILURE = 'job_failure'
EVENT_BATCH_COMPLETE = 'batch_complete'
EVENT_SERVER_FAILURE = 'server_failure'
EVENT_HIGH_CPU = 'high_cpu'
EVENT_USER_CHANGE = 'user_change'
EVENT_PLAYBOOK_UPDATE = 'playbook_update'
EVENT_SYSTEM_ALERT = 'system_alert'

# Severity constants
SEVERITY_INFO = 'info'
SEVERITY_WARNING = 'warning'
SEVERITY_ERROR = 'error'
SEVERITY_CRITICAL = 'critical'


class NotificationService:
    """Service for managing notifications"""
    
    @staticmethod
    def create_notification(
        user_id: int,
        title: str,
        message: str,
        event_type: str,
        severity: str = SEVERITY_INFO,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
        auto_dismiss_hours: Optional[int] = None
    ) -> Notification:
        """
        Create and deliver a notification through enabled channels
        
        Args:
            user_id: User ID to notify
            title: Notification title
            message: Notification message
            event_type: Type of event (job_success, job_failure, etc.)
            severity: Notification severity (info, warning, error, critical)
            related_entity_type: Type of related entity (job, server, etc.)
            related_entity_id: ID of related entity
            metadata: Additional context data
            auto_dismiss_hours: Hours until auto-dismiss (None = never)
        
        Returns:
            Notification object
        """
        try:
            # Get user preferences for this event type
            preference = NotificationPreference.query.filter_by(
                user_id=user_id,
                event_type=event_type
            ).first()
            
            # Default to in-app only if no preference exists
            if not preference:
                preference = NotificationService._create_default_preference(user_id, event_type)
            
            # Determine which channels to send through
            channels_sent = []
            
            # In-app notification (always create in database)
            if preference.in_app_enabled:
                channels_sent.append('in_app')
            
            # Calculate expiration time
            expires_at = None
            if auto_dismiss_hours:
                expires_at = datetime.utcnow() + timedelta(hours=auto_dismiss_hours)
            
            # Create notification record
            notification = Notification(
                user_id=user_id,
                title=title,
                message=message,
                severity=severity,
                event_type=event_type,
                related_entity_type=related_entity_type,
                related_entity_id=related_entity_id,
                channels_sent=channels_sent,
                extra_data=metadata or {},
                expires_at=expires_at
            )
            
            db.session.add(notification)
            db.session.commit()
            
            # Send email if enabled
            if preference.email_enabled:
                user = User.query.get(user_id)
                if user and user.email:
                    try:
                        send_notification_email(
                            to_email=user.email,
                            title=title,
                            message=message,
                            severity=severity,
                            event_type=event_type
                        )
                        channels_sent.append('email')
                        notification.channels_sent = channels_sent
                        db.session.commit()
                    except Exception as e:
                        logger.error(f"Failed to send email notification: {str(e)}")
            
            # Browser push notification (placeholder for future implementation)
            if preference.browser_push_enabled:
                # TODO: Implement browser push notifications
                # This requires service worker registration and push subscription
                channels_sent.append('browser_push')
                notification.channels_sent = channels_sent
                db.session.commit()
            
            logger.info(f"Notification created for user {user_id}: {title} via {channels_sent}")
            return notification
            
        except Exception as e:
            logger.error(f"Error creating notification: {str(e)}")
            db.session.rollback()
            raise
    
    @staticmethod
    def create_bulk_notifications(
        user_ids: List[int],
        title: str,
        message: str,
        event_type: str,
        severity: str = SEVERITY_INFO,
        **kwargs
    ) -> List[Notification]:
        """
        Create notifications for multiple users
        
        Args:
            user_ids: List of user IDs to notify
            title: Notification title
            message: Notification message
            event_type: Type of event
            severity: Notification severity
            **kwargs: Additional parameters for create_notification
        
        Returns:
            List of created notifications
        """
        notifications = []
        for user_id in user_ids:
            try:
                notification = NotificationService.create_notification(
                    user_id=user_id,
                    title=title,
                    message=message,
                    event_type=event_type,
                    severity=severity,
                    **kwargs
                )
                notifications.append(notification)
            except Exception as e:
                logger.error(f"Failed to create notification for user {user_id}: {str(e)}")
                continue
        
        return notifications
    
    @staticmethod
    def get_user_notifications(
        user_id: int,
        unread_only: bool = False,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> tuple[List[Notification], int]:
        """
        Get notifications for a user
        
        Args:
            user_id: User ID
            unread_only: Only return unread notifications
            limit: Maximum number of notifications to return
            offset: Offset for pagination
        
        Returns:
            Tuple of (notifications list, total count)
        """
        query = Notification.query.filter_by(user_id=user_id)
        
        if unread_only:
            query = query.filter_by(is_read=False)
        
        # Filter out expired notifications
        query = query.filter(
            db.or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.utcnow()
            )
        )
        
        total = query.count()
        
        query = query.order_by(Notification.created_at.desc())
        
        if limit:
            query = query.limit(limit).offset(offset)
        
        notifications = query.all()
        return notifications, total
    
    @staticmethod
    def mark_as_read(notification_id: int, user_id: int) -> bool:
        """
        Mark a notification as read
        
        Args:
            notification_id: Notification ID
            user_id: User ID (for security check)
        
        Returns:
            True if successful
        """
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=user_id
        ).first()
        
        if notification:
            notification.mark_as_read()
            db.session.commit()
            return True
        return False
    
    @staticmethod
    def mark_all_as_read(user_id: int) -> int:
        """
        Mark all notifications as read for a user
        
        Args:
            user_id: User ID
        
        Returns:
            Number of notifications marked as read
        """
        count = Notification.query.filter_by(
            user_id=user_id,
            is_read=False
        ).update({
            'is_read': True,
            'read_at': datetime.utcnow()
        })
        db.session.commit()
        return count
    
    @staticmethod
    def delete_notification(notification_id: int, user_id: int) -> bool:
        """
        Delete a notification
        
        Args:
            notification_id: Notification ID
            user_id: User ID (for security check)
        
        Returns:
            True if successful
        """
        notification = Notification.query.filter_by(
            id=notification_id,
            user_id=user_id
        ).first()
        
        if notification:
            db.session.delete(notification)
            db.session.commit()
            return True
        return False
    
    @staticmethod
    def delete_all_read(user_id: int) -> int:
        """
        Delete all read notifications for a user
        
        Args:
            user_id: User ID
        
        Returns:
            Number of notifications deleted
        """
        count = Notification.query.filter_by(
            user_id=user_id,
            is_read=True
        ).delete()
        db.session.commit()
        return count
    
    @staticmethod
    def get_unread_count(user_id: int) -> int:
        """
        Get count of unread notifications for a user
        
        Args:
            user_id: User ID
        
        Returns:
            Count of unread notifications
        """
        return Notification.query.filter_by(
            user_id=user_id,
            is_read=False
        ).filter(
            db.or_(
                Notification.expires_at.is_(None),
                Notification.expires_at > datetime.utcnow()
            )
        ).count()
    
    @staticmethod
    def get_user_preferences(user_id: int) -> List[NotificationPreference]:
        """
        Get all notification preferences for a user
        
        Args:
            user_id: User ID
        
        Returns:
            List of notification preferences
        """
        preferences = NotificationPreference.query.filter_by(user_id=user_id).all()
        
        # If no preferences exist, create defaults
        if not preferences:
            preferences = NotificationService._create_all_default_preferences(user_id)
        
        return preferences
    
    @staticmethod
    def update_preference(
        user_id: int,
        event_type: str,
        in_app_enabled: Optional[bool] = None,
        email_enabled: Optional[bool] = None,
        browser_push_enabled: Optional[bool] = None
    ) -> NotificationPreference:
        """
        Update notification preference for a user
        
        Args:
            user_id: User ID
            event_type: Event type
            in_app_enabled: Enable in-app notifications
            email_enabled: Enable email notifications
            browser_push_enabled: Enable browser push notifications
        
        Returns:
            Updated preference
        """
        preference = NotificationPreference.query.filter_by(
            user_id=user_id,
            event_type=event_type
        ).first()
        
        if not preference:
            preference = NotificationService._create_default_preference(user_id, event_type)
        
        if in_app_enabled is not None:
            preference.in_app_enabled = in_app_enabled
        if email_enabled is not None:
            preference.email_enabled = email_enabled
        if browser_push_enabled is not None:
            preference.browser_push_enabled = browser_push_enabled
        
        db.session.commit()
        return preference
    
    @staticmethod
    def _create_default_preference(user_id: int, event_type: str) -> NotificationPreference:
        """Create default preference for an event type"""
        # Critical events get email enabled by default
        critical_events = [EVENT_JOB_FAILURE, EVENT_BATCH_COMPLETE, EVENT_SERVER_FAILURE, EVENT_SYSTEM_ALERT]
        email_enabled = event_type in critical_events
        
        preference = NotificationPreference(
            user_id=user_id,
            event_type=event_type,
            in_app_enabled=True,
            email_enabled=email_enabled,
            browser_push_enabled=False
        )
        db.session.add(preference)
        db.session.commit()
        return preference
    
    @staticmethod
    def _create_all_default_preferences(user_id: int) -> List[NotificationPreference]:
        """Create all default preferences for a user"""
        event_types = [
            EVENT_JOB_SUCCESS,
            EVENT_JOB_FAILURE,
            EVENT_BATCH_COMPLETE,
            EVENT_SERVER_FAILURE,
            EVENT_HIGH_CPU,
            EVENT_USER_CHANGE,
            EVENT_PLAYBOOK_UPDATE,
            EVENT_SYSTEM_ALERT
        ]
        
        preferences = []
        for event_type in event_types:
            preference = NotificationService._create_default_preference(user_id, event_type)
            preferences.append(preference)
        
        return preferences
    
    @staticmethod
    def cleanup_expired_notifications() -> int:
        """
        Delete expired notifications
        
        Returns:
            Number of notifications deleted
        """
        count = Notification.query.filter(
            Notification.expires_at.isnot(None),
            Notification.expires_at <= datetime.utcnow()
        ).delete()
        db.session.commit()
        return count
