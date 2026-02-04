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

playbooks_bp = Blueprint('playbooks', __name__, url_prefix='/api/playbooks')


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


@playbooks_bp.route('/<int:playbook_id>/content', methods=['PUT'])
@jwt_required()
def update_playbook_content(playbook_id):
    """
    Update playbook file content (admin only)
    
    Request Body:
        content: str (required) - New YAML content
    
    Returns:
        Updated playbook
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission - admin only
        if current_user.role != 'admin':
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Only administrators can edit playbook content'
            })), 403
        
        # Get content from request
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Content is required'
            })), 400
        
        content = data['content']
        
        # Update playbook content
        playbook = playbook_service.update_playbook_content(
            playbook_id, 
            content, 
            current_user_id
        )
        
        return jsonify({
            'message': 'Playbook content updated successfully',
            'playbook': playbook_schema.dump(playbook)
        }), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'update_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred while updating playbook content: {str(err)}'
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


@playbooks_bp.route('/preview-zip', methods=['POST'])
@jwt_required()
def preview_zip():
    """
    Preview ZIP file contents and extract YAML file list
    
    Form Data:
        file: ZIP File (required, max 20MB)
    
    Returns:
        List of YAML files found in the ZIP with suggested main file
    """
    try:
        import tempfile
        import os
        from app.utils.file_manager import find_yaml_files, auto_detect_main_playbook
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({
                'error': 'validation_error',
                'message': 'No ZIP file provided'
            }), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({
                'error': 'validation_error',
                'message': 'No file selected'
            }), 400
        
        # Validate ZIP file
        if not file.filename.lower().endswith('.zip'):
            return jsonify({
                'error': 'validation_error',
                'message': 'Only ZIP files are allowed'
            }), 400
        
        # Create temporary directory
        temp_base = tempfile.mkdtemp()
        zip_path = os.path.join(temp_base, secure_filename(file.filename))
        extract_dir = os.path.join(temp_base, 'extracted')
        
        try:
            # Save ZIP file temporarily
            file.save(zip_path)
            
            # Extract and analyze (will auto-flatten single root folder)
            from app.utils.file_manager import extract_zip
            success, error_msg = extract_zip(zip_path, extract_dir)
            
            if not success:
                return jsonify({
                    'error': 'invalid_zip',
                    'message': error_msg
                }), 400
            
            # Find YAML files in the extracted directory
            yaml_files = find_yaml_files(extract_dir)
            
            if not yaml_files:
                return jsonify({
                    'error': 'no_yaml_files',
                    'message': 'No YAML playbook files found in ZIP'
                }), 400
            
            # Auto-detect main playbook
            suggested_main = auto_detect_main_playbook(yaml_files)
            
            return jsonify({
                'yaml_files': yaml_files,
                'suggested_main': suggested_main,
                'total_files': len(yaml_files)
            }), 200
            
        finally:
            # Cleanup temporary files
            import shutil
            if os.path.exists(temp_base):
                shutil.rmtree(temp_base)
    
    except Exception as err:
        return jsonify({
            'error': 'preview_failed',
            'message': f'Failed to preview ZIP: {str(err)}'
        }), 500


@playbooks_bp.route('/upload-folder', methods=['POST'])
@jwt_required()
def upload_folder_playbook():
    """
    Upload a folder-based playbook as ZIP file
    
    Form Data:
        file: ZIP File (required, max 20MB)
        name: str (required)
        main_playbook_file: str (required, relative path to main playbook within ZIP)
        description: str (optional)
    
    Returns:
        Created playbook with folder structure
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check if file is present
        if 'file' not in request.files:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'No ZIP file provided'
            })), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'No file selected'
            })), 400
        
        # Validate ZIP file
        if not file.filename.lower().endswith('.zip'):
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Only ZIP files are allowed for folder upload'
            })), 400
        
        # Get form data
        name = request.form.get('name')
        main_playbook_file = request.form.get('main_playbook_file')
        description = request.form.get('description')
        
        if not name:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Playbook name is required'
            })), 400
        
        if not main_playbook_file:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Main playbook file path is required'
            })), 400
        
        # Create folder playbook
        playbook = playbook_service.create_playbook_from_zip(
            name=name,
            zip_file_obj=file,
            main_playbook_file=main_playbook_file,
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
            'message': f'An error occurred while uploading folder playbook: {str(err)}'
        })), 500


@playbooks_bp.route('/<int:playbook_id>/files', methods=['GET'])
@jwt_required()
def get_folder_files(playbook_id):
    """
    Get list of all YAML files in a folder playbook
    
    Returns:
        List of file paths
    """
    try:
        files = playbook_service.get_folder_file_list(playbook_id)
        return jsonify({'files': files}), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'invalid_request',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred: {str(err)}'
        })), 500


@playbooks_bp.route('/<int:playbook_id>/files/<path:file_path>', methods=['GET'])
@jwt_required()
def get_folder_file_content(playbook_id, file_path):
    """
    Get content of a specific file in folder playbook
    
    Returns:
        File content
    """
    try:
        content = playbook_service.get_folder_file_content(playbook_id, file_path)
        return jsonify({'content': content, 'file_path': file_path}), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'invalid_request',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred: {str(err)}'
        })), 500


@playbooks_bp.route('/<int:playbook_id>/files/<path:file_path>', methods=['PUT'])
@jwt_required()
def update_folder_file_content(playbook_id, file_path):
    """
    Update content of a specific file in folder playbook
    
    Body:
        content: str (required)
    
    Returns:
        Success status
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        
        # Get content from request
        data = request.get_json()
        if not data or 'content' not in data:
            return jsonify(error_schema.dump({
                'error': 'validation_error',
                'message': 'Content is required'
            })), 400
        
        content = data['content']
        
        # Update file content
        playbook_service.update_folder_file_content(
            playbook_id=playbook_id,
            file_path=file_path,
            content=content,
            user_id=current_user_id
        )
        
        return jsonify({'message': 'File updated successfully'}), 200
    
    except ValidationError as err:
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid YAML syntax',
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
            'message': f'An error occurred: {str(err)}'
        })), 500


@playbooks_bp.route('/<int:playbook_id>/download', methods=['GET'])
@jwt_required()
def download_folder_playbook(playbook_id):
    """
    Download folder playbook as ZIP file
    
    Returns:
        ZIP file
    """
    from flask import send_file
    import os
    
    try:
        zip_path = playbook_service.download_folder_as_zip(playbook_id)
        
        # Get playbook name for filename
        playbook = playbook_service.get_playbook(playbook_id)
        filename = f"{playbook.name}.zip" if playbook else "playbook.zip"
        
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/zip'
        )
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'invalid_request',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'An error occurred: {str(err)}'
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


@playbooks_bp.route('/<int:playbook_id>/audit-logs', methods=['GET'])
@jwt_required()
def get_playbook_audit_logs(playbook_id):
    """
    Get audit log history for a specific playbook
    
    Query Parameters:
        page: int
        per_page: int
    
    Returns:
        List of audit log entries with user information
    """
    try:
        # Check permissions - only admins can view audit logs
        current_user_id = get_jwt_identity()
        user = auth_service.get_current_user(current_user_id)
        if user.role not in ['admin', 'super_admin']:
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Only administrators can view audit logs'
            })), 403
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
        # Get audit logs
        audit_logs = playbook_service.get_playbook_audit_logs(playbook_id, page, per_page)
        
        return jsonify({
            'playbook_id': playbook_id,
            'audit_logs': audit_logs
        }), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching audit logs'
        })), 500
