"""
Authentication Service
Handles user authentication, JWT token generation, and authorization
"""
from datetime import datetime
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity
from app.extensions import db
from app.models import User, AuditLog
from marshmallow import ValidationError


class AuthService:
    """Service for authentication operations"""
    
    @staticmethod
    def register_user(username, email, password, role='viewer'):
        """
        Register a new user
        
        Args:
            username: Unique username
            email: User email
            password: Plain text password
            role: User role (admin, operator, viewer)
        
        Returns:
            Created user object
        
        Raises:
            ValueError: If user already exists or validation fails
        """
        # Check if user exists
        if User.query.filter_by(username=username).first():
            raise ValueError(f"Username '{username}' already exists")
        
        if User.query.filter_by(email=email).first():
            raise ValueError(f"Email '{email}' already registered")
        
        # Create new user
        user = User(
            username=username,
            email=email,
            role=role,
            is_active=True
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        # Create audit log
        AuthService._create_audit_log(
            user_id=user.id,
            action='CREATE',
            resource_type='user',
            resource_id=user.id,
            details={'username': username, 'role': role}
        )
        
        return user
    
    @staticmethod
    def authenticate(username, password, ip_address=None, user_agent=None):
        """
        Authenticate user and generate tokens
        
        Args:
            username: Username
            password: Plain text password
            ip_address: Client IP address
            user_agent: Client user agent
        
        Returns:
            Dictionary with access_token, refresh_token, and user
        
        Raises:
            ValueError: If authentication fails
        """
        # Find user
        user = User.query.filter_by(username=username).first()
        
        if not user or not user.check_password(password):
            # Create failed login audit log
            AuthService._create_audit_log(
                user_id=None,
                action='LOGIN_FAILED',
                resource_type='user',
                details={'username': username, 'reason': 'invalid_credentials'},
                ip_address=ip_address,
                user_agent=user_agent
            )
            raise ValueError("Invalid username or password")
        
        if not user.is_active:
            raise ValueError("User account is disabled")
        
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Generate tokens
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'username': user.username,
                'role': user.role
            }
        )
        
        refresh_token = create_refresh_token(
            identity=str(user.id),
            additional_claims={
                'username': user.username,
                'role': user.role
            }
        )
        
        # Create successful login audit log
        AuthService._create_audit_log(
            user_id=user.id,
            action='LOGIN',
            resource_type='user',
            resource_id=user.id,
            details={'username': username},
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user
        }
    
    @staticmethod
    def refresh_access_token():
        """
        Generate new access token from refresh token
        
        Returns:
            New access token
        """
        current_user_id = get_jwt_identity()
        # Convert string ID back to integer for database query
        user = User.query.get(int(current_user_id))
        
        if not user or not user.is_active:
            raise ValueError("Invalid user or account disabled")
        
        access_token = create_access_token(
            identity=str(user.id),
            additional_claims={
                'username': user.username,
                'role': user.role
            }
        )
        
        return {'access_token': access_token}
    
    @staticmethod
    def get_current_user(user_id):
        """
        Get current user by ID
        
        Args:
            user_id: User ID from JWT (string)
        
        Returns:
            User object or None
        """
        # Convert string ID to integer for database query
        return User.query.get(int(user_id))
    
    @staticmethod
    def change_password(user_id, old_password, new_password):
        """
        Change user password
        
        Args:
            user_id: User ID
            old_password: Current password
            new_password: New password
        
        Raises:
            ValueError: If old password is incorrect
        """
        user = User.query.get(user_id)
        if not user:
            raise ValueError("User not found")
        
        if not user.check_password(old_password):
            raise ValueError("Current password is incorrect")
        
        user.set_password(new_password)
        db.session.commit()
        
        # Create audit log
        AuthService._create_audit_log(
            user_id=user.id,
            action='PASSWORD_CHANGE',
            resource_type='user',
            resource_id=user.id,
            details={'username': user.username}
        )
    
    @staticmethod
    def check_permission(user, required_role):
        """
        Check if user has required role permission
        
        Args:
            user: User object
            required_role: Required role level
        
        Returns:
            Boolean indicating if user has permission
        """
        role_hierarchy = {'viewer': 1, 'operator': 2, 'admin': 3}
        user_level = role_hierarchy.get(user.role, 0)
        required_level = role_hierarchy.get(required_role, 99)
        
        return user_level >= required_level
    
    @staticmethod
    def _create_audit_log(user_id, action, resource_type, resource_id=None, 
                         details=None, ip_address=None, user_agent=None):
        """
        Create audit log entry
        
        Args:
            user_id: User ID performing action
            action: Action type
            resource_type: Type of resource
            resource_id: ID of resource
            details: Additional details
            ip_address: Client IP
            user_agent: Client user agent
        """
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(audit_log)
        db.session.commit()


# Singleton instance
auth_service = AuthService()
