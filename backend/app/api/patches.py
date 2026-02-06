"""
Patch Management API endpoints
"""

import os
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import User, Server, Playbook, Job
from app.extensions import db
from app.services.patch_service import PatchService
from app.services.job_service import JobService
from app.services.auth_service import auth_service
import logging

patches_bp = Blueprint('patches', __name__, url_prefix='/api/patches')
logger = logging.getLogger(__name__)

# Configuration
UPLOAD_FOLDER = '/home/NikhilRokade/InfraAnsible/backend/data/patch_lists'
ALLOWED_EXTENSIONS = {'csv'}

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@patches_bp.route('/upload-csv', methods=['POST'])
@jwt_required()
def upload_csv():
    """
    Upload CSV file with package requirements (Global for all servers)
    
    Admin only - Saves CSV file for reuse across multiple servers
    """
    try:
        current_user_id = get_jwt_identity()
        user = auth_service.get_current_user(current_user_id)
        
        # Check permission - admin or super_admin only
        if not auth_service.check_permission(user, 'admin'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Only CSV files are allowed.'}), 400
        
        # Save file with fixed name (overwrites previous)
        filename = 'package_requirements.csv'
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        # Validate CSV format
        try:
            packages = PatchService.parse_package_csv(filepath)
            if not packages:
                os.remove(filepath)
                return jsonify({'error': 'CSV file is empty or invalid format'}), 400
        except Exception as e:
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'error': f'Invalid CSV format: {str(e)}'}), 400
        
        logger.info(f"User {user.username} uploaded package CSV with {len(packages)} packages")
        
        return jsonify({
            'success': True,
            'message': f'CSV uploaded successfully with {len(packages)} package(s)',
            'filename': filename,
            'packages_count': len(packages)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in upload_csv endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500


@patches_bp.route('/check/<int:server_id>', methods=['POST'])
@jwt_required()
def check_packages(server_id):
    """
    Check packages from uploaded CSV on a specific server (Synchronous)
    
    Admin only - Runs ansible commands and returns results immediately
    """
    try:
        current_user_id = get_jwt_identity()
        user = auth_service.get_current_user(current_user_id)
        
        # Check permission - admin or super_admin only
        if not auth_service.check_permission(user, 'admin'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        # Check if CSV file exists
        csv_filepath = os.path.join(UPLOAD_FOLDER, 'package_requirements.csv')
        if not os.path.exists(csv_filepath):
            return jsonify({'error': 'No package CSV uploaded. Please upload a CSV file first.'}), 400
        
        # Get server details
        server = Server.query.get(server_id)
        if not server:
            return jsonify({'error': 'Server not found'}), 404
        
        logger.info(f"User {user.username} checking packages for server {server.hostname}")
        
        # Call patch service to check packages (synchronous)
        result = PatchService.check_packages_from_csv(
            server_id=server.id,
            server_hostname=server.hostname,
            server_ip=server.ip_address,
            csv_file_path=csv_filepath
        )
        
        if not result['success']:
            return jsonify({
                'error': result.get('error', 'Failed to check packages'),
                'packages': []
            }), 500
        
        return jsonify({
            'success': True,
            'server': {
                'id': server.id,
                'hostname': server.hostname,
                'ip_address': server.ip_address
            },
            'packages': result['packages'],
            'total_count': result['total_count']
        }), 200
        
    except Exception as e:
        logger.error(f"Error in check_packages endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500


@patches_bp.route('/install', methods=['POST'])
@jwt_required()
def install_packages():
    """
    Install selected packages on a server (Asynchronous via Job)
    
    Admin only - Creates a job to install missing packages
    
    Request body:
    {
        "server_id": 1,
        "packages": ["vim", "nginx", "curl"]
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = auth_service.get_current_user(current_user_id)
        
        # Check permission - admin or super_admin only
        if not auth_service.check_permission(user, 'admin'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        server_id = data.get('server_id')
        packages = data.get('packages', [])
        
        if not server_id:
            return jsonify({'error': 'server_id is required'}), 400
        
        if not packages or len(packages) == 0:
            return jsonify({'error': 'At least one package must be selected'}), 400
        
        # Get server details
        server = Server.query.get(server_id)
        if not server:
            return jsonify({'error': 'Server not found'}), 404
        
        logger.info(f"User {user.username} installing {len(packages)} packages on server {server.hostname}")
        logger.info(f"Selected packages: {packages}")
        
        # Generate playbook for installation
        playbook_path = PatchService.generate_install_playbook(packages, server_id)
        
        # Create playbook record
        playbook_name = f"Package Installation - {server.hostname}"
        playbook = Playbook.query.filter_by(
            name=playbook_name,
            created_by=user.id
        ).first()
        
        if not playbook:
            playbook = Playbook(
                name=playbook_name,
                description=f"Auto-generated playbook for installing packages",
                file_path=playbook_path,
                created_by=user.id
            )
            db.session.add(playbook)
            db.session.commit()
        else:
            playbook.file_path = playbook_path
            db.session.commit()
        
        # Create job
        job = JobService.create_job(
            playbook_id=playbook.id,
            server_id=server.id,
            user_id=user.id,
            extra_vars={'packages': packages, 'action': 'install'}
        )
        
        if not job:
            return jsonify({'error': 'Failed to create job'}), 500
        
        # Execute job
        JobService.execute_job(job.id)
        
        return jsonify({
            'success': True,
            'message': f'Package installation job created for {len(packages)} package(s)',
            'job': {
                'id': job.id,
                'job_id': job.job_id,
                'status': job.status
            },
            'packages_count': len(packages)
        }), 201
        
    except Exception as e:
        logger.error(f"Error in install_packages endpoint: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@patches_bp.route('/update', methods=['POST'])
@jwt_required()
def update_packages():
    """
    Update selected packages on a server (Asynchronous via Job)
    
    Admin only - Creates a job to update outdated packages
    
    Request body:
    {
        "server_id": 1,
        "packages": ["vim", "nginx", "curl"]
    }
    """
    try:
        current_user_id = get_jwt_identity()
        user = auth_service.get_current_user(current_user_id)
        
        # Check permission - admin or super_admin only
        if not auth_service.check_permission(user, 'admin'):
            return jsonify({'error': 'Insufficient permissions'}), 403
        
        data = request.get_json()
        server_id = data.get('server_id')
        packages = data.get('packages', [])
        
        if not server_id:
            return jsonify({'error': 'server_id is required'}), 400
        
        if not packages or len(packages) == 0:
            return jsonify({'error': 'At least one package must be selected'}), 400
        
        # Get server details
        server = Server.query.get(server_id)
        if not server:
            return jsonify({'error': 'Server not found'}), 404
        
        logger.info(f"User {user.username} updating {len(packages)} packages on server {server.hostname}")
        logger.info(f"Selected packages: {packages}")
        
        # Generate playbook for update
        playbook_path = PatchService.generate_update_playbook(packages, server_id)
        
        # Create playbook record
        playbook_name = f"Package Update - {server.hostname}"
        playbook = Playbook.query.filter_by(
            name=playbook_name,
            created_by=user.id
        ).first()
        
        if not playbook:
            playbook = Playbook(
                name=playbook_name,
                description=f"Auto-generated playbook for updating packages",
                file_path=playbook_path,
                created_by=user.id
            )
            db.session.add(playbook)
            db.session.commit()
        else:
            playbook.file_path = playbook_path
            db.session.commit()
        
        # Create job
        job = JobService.create_job(
            playbook_id=playbook.id,
            server_id=server.id,
            user_id=user.id,
            extra_vars={'packages': packages, 'action': 'update'}
        )
        
        if not job:
            return jsonify({'error': 'Failed to create job'}), 500
        
        # Execute job
        JobService.execute_job(job.id)
        
        return jsonify({
            'success': True,
            'message': f'Package update job created for {len(packages)} package(s)',
            'job': {
                'id': job.id,
                'job_id': job.job_id,
                'status': job.status
            },
            'packages_count': len(packages)
        }), 201
        
    except Exception as e:
        logger.error(f"Error in update_packages endpoint: {str(e)}")
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
