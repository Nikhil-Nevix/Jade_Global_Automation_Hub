"""
User API Endpoints
Handles user management operations
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app.extensions import db
from app.services.auth_service import auth_service
from app.models import User
from app.schemas import (
    user_schema, users_schema, user_update_schema, error_schema
)

users_bp = Blueprint('users', __name__, url_prefix='/users')


@users_bp.route('', methods=['GET'])
@jwt_required()
def get_users():
    """
    Get all users (admin only)
    
    Query Parameters:
        role: str
        is_active: bool
        page: int
        per_page: int
    
    Returns:
        List of users with pagination
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission
        if not auth_service.check_permission(current_user, 'admin'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to view users'
            })), 403
        
        # Build query
        query = User.query
        
        # Apply filters
        if request.args.get('role'):
            query = query.filter_by(role=request.args.get('role'))
        
        if request.args.get('is_active'):
            is_active = request.args.get('is_active').lower() == 'true'
            query = query.filter_by(is_active=is_active)
        
        # Pagination
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        pagination = query.order_by(User.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        return jsonify({
            'items': users_schema.dump(pagination.items),
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
            'message': 'An error occurred while fetching users'
        })), 500


@users_bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """
    Get a specific user by ID (admin only, or self)
    
    Returns:
        User details
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission (admin or viewing own profile)
        if not auth_service.check_permission(current_user, 'admin') and current_user_id != user_id:
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to view this user'
            })), 403
        
        user = User.query.get(user_id)
        
        if not user:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'User with ID {user_id} not found'
            })), 404
        
        return jsonify(user_schema.dump(user)), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching user'
        })), 500


@users_bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """
    Update user details (admin only, or self for limited fields)
    
    Request Body:
        email: str
        role: str (admin only)
        is_active: bool (admin only)
    
    Returns:
        Updated user
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Get target user
        user = User.query.get(user_id)
        if not user:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'User with ID {user_id} not found'
            })), 404
        
        # Validate request
        data = user_update_schema.load(request.get_json())
        
        # Check permissions
        is_admin = auth_service.check_permission(current_user, 'admin')
        is_self = current_user_id == user_id
        
        if not is_admin and not is_self:
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to update this user'
            })), 403
        
        # Only admins can change role and is_active
        if not is_admin:
            if 'role' in data or 'is_active' in data:
                return jsonify(error_schema.dump({
                    'error': 'forbidden',
                    'message': 'Only admins can change role or active status'
                })), 403
        
        # Update fields
        if 'email' in data:
            # Check for duplicate email
            existing = User.query.filter_by(email=data['email']).first()
            if existing and existing.id != user_id:
                return jsonify(error_schema.dump({
                    'error': 'validation_error',
                    'message': 'Email already in use'
                })), 400
            user.email = data['email']
        
        if 'role' in data and is_admin:
            user.role = data['role']
        
        if 'is_active' in data and is_admin:
            user.is_active = data['is_active']
        
        if 'password' in data:
            user.set_password(data['password'])
        
        db.session.commit()
        
        return jsonify(user_schema.dump(user)), 200
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while updating user'
        })), 500


@users_bp.route('/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """
    Delete/deactivate user (admin only)
    
    Returns:
        Success message
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission
        if not auth_service.check_permission(current_user, 'admin'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to delete users'
            })), 403
        
        # Prevent self-deletion
        if current_user_id == user_id:
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Cannot delete your own account'
            })), 403
        
        # Get user
        user = User.query.get(user_id)
        if not user:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'User with ID {user_id} not found'
            })), 404
        
        # Soft delete (deactivate)
        user.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'User deactivated successfully'}), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while deleting user'
        })), 500
