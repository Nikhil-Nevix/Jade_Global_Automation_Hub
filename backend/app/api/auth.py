"""
Authentication API Endpoints
Handles login, token refresh, and user registration
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_cors import cross_origin
from marshmallow import ValidationError
from app.services.auth_service import auth_service
from app.schemas import (
    user_login_schema, token_response_schema, 
    user_create_schema, user_schema, error_schema
)

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/login', methods=['POST', 'OPTIONS'])
@cross_origin()
def login():
    """
    User login endpoint
    
    Request Body:
        username: str
        password: str
    
    Returns:
        access_token, refresh_token, and user info
    """
    # Handle preflight request
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Validate request
        data = user_login_schema.load(request.get_json())
        
        # Get client info
        ip_address = request.remote_addr
        
        # Authenticate
        result = auth_service.authenticate(
            username=data['username'],
            password=data['password'],
            ip_address=ip_address
        )
        
        return jsonify(token_response_schema.dump(result)), 200
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'authentication_failed',
            'message': str(err)
        })), 401
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred during login'
        })), 500


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """
    Refresh access token using refresh token
    
    Returns:
        New access token
    """
    try:
        result = auth_service.refresh_access_token()
        return jsonify(result), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'refresh_failed',
            'message': str(err)
        })), 401
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred during token refresh'
        })), 500


@auth_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    """
    Register a new user (admin only)
    
    Request Body:
        username: str
        email: str
        password: str
        role: str
    
    Returns:
        Created user info
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check if admin
        if not auth_service.check_permission(current_user, 'admin'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Only admins can create new users'
            })), 403
        
        # Validate request
        data = user_create_schema.load(request.get_json())
        
        # Register user
        user = auth_service.register_user(
            username=data['username'],
            email=data['email'],
            password=data['password'],
            role=data['role']
        )
        
        return jsonify(user_schema.dump(user)), 201
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'registration_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred during registration'
        })), 500


@auth_bp.route('/signup', methods=['POST', 'OPTIONS'])
@cross_origin()
def signup():
    """
    Public user registration (creates viewer role by default)
    
    Request Body:
        username: str
        email: str
        password: str
    
    Returns:
        Created user info
    """
    # Handle preflight request
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Get request data
        data = request.get_json()
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        # Validate required fields
        if not username or not email or not password:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Username, email, and password are required'
            })), 400
        
        # Validate password length
        if len(password) < 8:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Password must be at least 8 characters'
            })), 400
        
        # Register user with user role (default for self-registration)
        user = auth_service.register_user(
            username=username,
            email=email,
            password=password,
            role='user'  # Default role for self-registration
        )
        
        return jsonify({
            'message': 'Account created successfully',
            'user': user_schema.dump(user)
        }), 201
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'registration_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred during registration'
        })), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    """
    Get current user information
    
    Returns:
        Current user info
    """
    try:
        current_user_id = get_jwt_identity()
        user = auth_service.get_current_user(current_user_id)
        
        if not user:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': 'User not found'
            })), 404
        
        return jsonify(user_schema.dump(user)), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred'
        })), 500


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """
    Change user password
    
    Request Body:
        old_password: str
        new_password: str
    
    Returns:
        Success message
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        old_password = data.get('old_password')
        new_password = data.get('new_password')
        
        if not old_password or not new_password:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Both old_password and new_password are required'
            })), 400
        
        if len(new_password) < 8:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'New password must be at least 8 characters'
            })), 400
        
        auth_service.change_password(current_user_id, old_password, new_password)
        
        return jsonify({'message': 'Password changed successfully'}), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'change_password_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred during password change'
        })), 500
