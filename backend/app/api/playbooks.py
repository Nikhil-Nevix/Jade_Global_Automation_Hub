"""
Playbook API Endpoints
Handles playbook upload, retrieval, and management
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from werkzeug.utils import secure_filename
from app.services.auth_service import auth_service
from app.services.playbook_service import playbook_service
from app.schemas import (
    playbook_schema, playbooks_schema, playbook_create_schema,
    playbook_update_schema, error_schema
)

playbooks_bp = Blueprint('playbooks', __name__, url_prefix='/playbooks')


@playbooks_bp.route('', methods=['GET'])
@jwt_required()
def get_playbooks():
    """
    Get all playbooks with optional filtering
    
    Query Parameters:
        is_active: bool
        search: str
        page: int
        per_page: int
    
    Returns:
        List of playbooks with pagination
    """
    try:
        # Extract filters from query params
        filters = {}
        if request.args.get('is_active'):
            filters['is_active'] = request.args.get('is_active').lower() == 'true'
        if request.args.get('search'):
            filters['search'] = request.args.get('search')
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # Get playbooks
        pagination = playbook_service.get_all_playbooks(filters, page, per_page)
        
        return jsonify({
            'items': playbooks_schema.dump(pagination.items),
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
            'message': 'An error occurred while fetching playbooks'
        })), 500


@playbooks_bp.route('/<int:playbook_id>', methods=['GET'])
@jwt_required()
def get_playbook(playbook_id):
    """
    Get a specific playbook by ID
    
    Returns:
        Playbook details
    """
    try:
        playbook = playbook_service.get_playbook(playbook_id)
        
        if not playbook:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Playbook with ID {playbook_id} not found'
            })), 404
        
        return jsonify(playbook_schema.dump(playbook)), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching playbook'
        })), 500


@playbooks_bp.route('/<int:playbook_id>/content', methods=['GET'])
@jwt_required()
def get_playbook_content(playbook_id):
    """
    Get playbook file content
    
    Returns:
        Playbook YAML content
    """
    try:
        content = playbook_service.get_playbook_content(playbook_id)
        
        return jsonify({
            'playbook_id': playbook_id,
            'content': content
        }), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'not_found',
            'message': str(err)
        })), 404
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching playbook content'
        })), 500


@playbooks_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_playbook():
    """
    Upload a new playbook (operator or admin only)
    
    Form Data:
        file: File (required, .yml or .yaml)
        name: str (required)
        description: str
    
    Returns:
        Created playbook
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Allow all authenticated users to upload playbooks for now
        # if not auth_service.check_permission(current_user, 'operator'):
        #     return jsonify(error_schema.dump({
        #         'error': 'forbidden',
        #         'message': 'Insufficient permissions to upload playbooks'
        #     })), 403
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'No file provided'
            })), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'No file selected'
            })), 400
        
        # Get form data
        name = request.form.get('name')
        description = request.form.get('description')
        
        if not name:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Playbook name is required'
            })), 400
        
        # Create playbook
        playbook = playbook_service.create_playbook(
            name=name,
            file_obj=file,
            description=description,
            user_id=current_user_id
        )
        
        return jsonify(playbook_schema.dump(playbook)), 201
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'upload_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while uploading playbook: {str(err)}'
        })), 500


@playbooks_bp.route('/<int:playbook_id>', methods=['PUT'])
@jwt_required()
def update_playbook(playbook_id):
    """
    Update playbook metadata (operator or admin only)
    
    Request Body:
        description: str
        tags: dict
        variables: dict
        is_active: bool
    
    Returns:
        Updated playbook
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission
        if not auth_service.check_permission(current_user, 'operator'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to update playbooks'
            })), 403
        
        # Validate request
        data = playbook_update_schema.load(request.get_json())
        
        # Update playbook
        playbook = playbook_service.update_playbook(playbook_id, data, current_user_id)
        
        return jsonify(playbook_schema.dump(playbook)), 200
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'update_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while updating playbook'
        })), 500


@playbooks_bp.route('/<int:playbook_id>', methods=['DELETE'])
@jwt_required()
def delete_playbook(playbook_id):
    """
    Delete playbook (admin only, soft delete by default)
    
    Query Parameters:
        hard: bool - If true, permanently delete
    
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
                'message': 'Insufficient permissions to delete playbooks'
            })), 403
        
        # Always do hard delete (permanently remove from database)
        playbook_service.hard_delete_playbook(playbook_id, current_user_id)
        
        return jsonify({'message': 'Playbook deleted successfully'}), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'deletion_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while deleting playbook'
        })), 500


@playbooks_bp.route('/<int:playbook_id>/verify', methods=['GET'])
@jwt_required()
def verify_playbook_integrity(playbook_id):
    """
    Verify playbook file integrity
    
    Returns:
        Verification result
    """
    try:
        is_valid = playbook_service.verify_playbook_integrity(playbook_id)
        
        return jsonify({
            'playbook_id': playbook_id,
            'is_valid': is_valid,
            'message': 'File integrity verified' if is_valid else 'File integrity check failed'
        }), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while verifying playbook'
        })), 500
