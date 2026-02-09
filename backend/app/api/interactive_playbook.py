"""
Interactive Playbook API
Handles real-time playbook execution with user interaction
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models import Job, Server
from app.extensions import db
from app.services.ssh_service import SSHService
import os

interactive_playbook_bp = Blueprint('interactive_playbook', __name__, url_prefix='/api/jobs')


@interactive_playbook_bp.route('/<job_id>/patches-ready', methods=['POST'])
def patches_ready(job_id):
    """
    Called by Ansible playbook when available_patches.txt is ready
    Triggers WebSocket event to show popup dialog in frontend
    """
    try:
        # Get job
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Get file path from request
        data = request.get_json() or {}
        file_path = data.get('file_path', f'/tmp/available_patches_{job_id}.txt')
        
        current_app.logger.info(f'Patches ready notification received for job {job_id}, file: {file_path}')
        
        # Emit WebSocket event to notify frontend
        from app.extensions import socketio
        socketio.emit('patches_ready', {
            'job_id': job_id,
            'file_path': file_path
        }, namespace='/')
        
        return jsonify({'message': 'Notification sent', 'job_id': job_id}), 200
        
    except Exception as e:
        current_app.logger.error(f'Error in patches-ready for job {job_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@interactive_playbook_bp.route('/<job_id>/available-patches', methods=['GET'])
@jwt_required()
def get_available_patches(job_id):
    """
    Fetch content of available_patches.txt from remote server
    Returns list of patches for user to select
    """
    try:
        # Get job
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Get server
        server = Server.query.get(job.server_id)
        if not server:
            return jsonify({'error': 'Server not found'}), 404
        
        # Get file path
        file_path = request.args.get('file_path', f'/tmp/available_patches_{job_id}.txt')
        
        # Read file from server via SSH
        ssh_service = SSHService()
        content = ssh_service.read_file(server, file_path)
        
        # Parse content (one patch per line)
        patches = [line.strip() for line in content.split('\n') if line.strip()]
        
        return jsonify({
            'job_id': job_id,
            'file_path': file_path,
            'patches': patches,
            'total': len(patches)
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error fetching patches for job {job_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@interactive_playbook_bp.route('/<job_id>/selected-patches', methods=['POST'])
@jwt_required()
def submit_selected_patches(job_id):
    """
    Write selected patches to selected_patches.txt on remote server
    This allows the waiting playbook to continue execution
    """
    try:
        # Get job
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Get server
        server = Server.query.get(job.server_id)
        if not server:
            return jsonify({'error': 'Server not found'}), 404
        
        # Get selected patches from request
        data = request.get_json()
        selected_patches = data.get('selected_patches', [])
        file_path = data.get('file_path', f'/tmp/selected_patches_{job_id}.txt')
        
        if not selected_patches:
            return jsonify({'error': 'No patches selected'}), 400
        
        # Create content (one patch per line)
        content = '\n'.join(selected_patches)
        
        # Write file to server via SSH
        ssh_service = SSHService()
        ssh_service.write_file(server, file_path, content)
        
        current_app.logger.info(f'Selected patches written for job {job_id}: {len(selected_patches)} patches')
        
        return jsonify({
            'message': 'Selected patches saved successfully',
            'job_id': job_id,
            'patches_count': len(selected_patches),
            'file_path': file_path
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error saving selected patches for job {job_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@interactive_playbook_bp.route('/<job_id>/patch-report', methods=['POST'])
def save_patch_report(job_id):
    """
    Called by Ansible playbook after patching with CSV report
    Saves patch report (Package,Old Version,New Version,Status) to job record
    """
    try:
        # Get job
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Get CSV data from request
        data = request.get_json() or {}
        csv_data = data.get('csv_data', '')
        
        if not csv_data:
            return jsonify({'error': 'No CSV data provided'}), 400
        
        # Save CSV to job record
        job.patch_report = csv_data
        db.session.commit()
        
        current_app.logger.info(f'Patch report saved for job {job_id}')
        
        return jsonify({
            'message': 'Patch report saved successfully',
            'job_id': job_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error saving patch report for job {job_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@interactive_playbook_bp.route('/<job_id>/patch-report', methods=['GET'])
@jwt_required()
def get_patch_report(job_id):
    """
    Download patch report CSV for a completed job
    Returns CSV file with package version comparison
    """
    try:
        # Get job
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Check if patch report exists
        if not job.patch_report:
            return jsonify({'error': 'No patch report available for this job'}), 404
        
        # Return CSV data
        from flask import make_response
        output = make_response(job.patch_report)
        output.headers["Content-Disposition"] = f"attachment; filename=patch_report_{job_id}.csv"
        output.headers["Content-type"] = "text/csv"
        
        return output
        
    except Exception as e:
        current_app.logger.error(f'Error fetching patch report for job {job_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500


@interactive_playbook_bp.route('/<job_id>/cancel', methods=['POST'])

@jwt_required()
def cancel_job_on_timeout(job_id):
    """
    Cancel job when user doesn't respond within timeout
    """
    try:
        from app.tasks import cancel_job
        
        # Get job
        job = Job.query.filter_by(job_id=job_id).first()
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        # Cancel the job
        cancel_job(job_id)
        
        # Update job status
        job.status = 'cancelled'
        db.session.commit()
        
        current_app.logger.info(f'Job {job_id} cancelled due to timeout')
        
        return jsonify({
            'message': 'Job cancelled successfully',
            'job_id': job_id
        }), 200
        
    except Exception as e:
        current_app.logger.error(f'Error cancelling job {job_id}: {str(e)}')
        return jsonify({'error': str(e)}), 500
