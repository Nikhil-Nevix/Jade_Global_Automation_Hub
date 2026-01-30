"""
Playbook Service
Handles playbook management, upload, and storage
"""
import os
import hashlib
from werkzeug.utils import secure_filename
from flask import request
from app.extensions import db
from app.models import Playbook, AuditLog, PlaybookAuditLog
from app.config import get_config


class PlaybookService:
    """Service for playbook operations"""
    
    @staticmethod
    def create_playbook(name, file_obj, description=None, user_id=None):
        """
        Create a new playbook and save file
        
        Args:
            name: Playbook name
            file_obj: File object from upload
            description: Playbook description
            user_id: ID of user creating the playbook
        
        Returns:
            Created playbook object
        
        Raises:
            ValueError: If validation fails
        """
        # Check if playbook with same name exists
        existing = Playbook.query.filter_by(name=name).first()
        if existing:
            raise ValueError(f"Playbook with name '{name}' already exists")
        
        # Validate file exists
        if not file_obj:
            raise ValueError("No file provided")
        
        # Validate file type
        if not PlaybookService._allowed_file(file_obj.filename):
            raise ValueError("Invalid file type. Only .yml and .yaml files are allowed")
        
        # Validate file size (max 500 KB = 512,000 bytes)
        file_obj.seek(0, os.SEEK_END)
        file_size = file_obj.tell()
        file_obj.seek(0)  # Reset file pointer to beginning
        
        max_size_bytes = 500 * 1024  # 500 KB
        if file_size > max_size_bytes:
            file_size_kb = file_size / 1024
            raise ValueError(f"File size exceeds 500 KB limit. Your file is {file_size_kb:.2f} KB")
        
        # Validate file is not empty
        if file_size == 0:
            raise ValueError("File is empty. Please upload a valid YAML file")
        
        # Ensure upload directory exists
        config = get_config()
        upload_folder = config.UPLOAD_FOLDER
        os.makedirs(upload_folder, exist_ok=True)
        
        # Generate secure filename
        filename = secure_filename(file_obj.filename)
        # Add unique identifier to prevent collisions
        base_name, ext = os.path.splitext(filename)
        unique_filename = f"{base_name}_{PlaybookService._generate_unique_id()}{ext}"
        file_path = os.path.join(upload_folder, unique_filename)
        
        # Save file
        file_obj.save(file_path)
        
        # Set Linux file permissions (readable only by owner and group)
        try:
            os.chmod(file_path, 0o640)
        except Exception:
            pass  # Permissions may not work on all systems during development
        
        # Create playbook record
        playbook = Playbook(
            name=name,
            description=description,
            file_path=file_path,
            is_active=True
        )
        
        db.session.add(playbook)
        db.session.commit()
        
        # Read file content for audit log
        new_content = None
        try:
            with open(file_path, 'r') as f:
                new_content = f.read()
        except:
            pass
        
        # Create audit logs
        if user_id:
            PlaybookService._create_audit_log(
                user_id=user_id,
                action='CREATE',
                resource_id=playbook.id,
                details={'name': name, 'file_path': file_path}
            )
            
            # Create detailed playbook audit log
            PlaybookService._create_playbook_audit_log(
                playbook_id=playbook.id,
                playbook_name=name,
                user_id=user_id,
                action='created',
                old_content=None,
                new_content=new_content,
                changes_description=f'Playbook "{name}" created'
            )
        
        return playbook
    
    @staticmethod
    def get_playbook(playbook_id):
        """
        Get playbook by ID
        
        Args:
            playbook_id: Playbook ID
        
        Returns:
            Playbook object or None
        """
        return Playbook.query.get(playbook_id)
    
    @staticmethod
    def get_all_playbooks(filters=None, page=1, per_page=20):
        """
        Get all playbooks with optional filtering and pagination
        
        Args:
            filters: Dictionary with filter criteria
            page: Page number
            per_page: Items per page
        
        Returns:
            Paginated playbook query result
        """
        query = Playbook.query
        
        # Default to only active playbooks unless explicitly specified
        if filters is None or filters.get('is_active') is None:
            query = query.filter_by(is_active=True)
        elif filters.get('is_active') is not None:
            query = query.filter_by(is_active=filters['is_active'])
            
            if filters.get('search'):
                search_term = f"%{filters['search']}%"
                query = query.filter(
                    db.or_(
                        Playbook.name.ilike(search_term),
                        Playbook.description.ilike(search_term)
                    )
                )
        
        return query.order_by(Playbook.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
    
    @staticmethod
    def update_playbook(playbook_id, data, user_id):
        """
        Update playbook metadata
        
        Args:
            playbook_id: Playbook ID
            data: Dictionary with updated data
            user_id: ID of user updating the playbook
        
        Returns:
            Updated playbook object
        
        Raises:
            ValueError: If playbook not found
        """
        playbook = Playbook.query.get(playbook_id)
        if not playbook:
            raise ValueError(f"Playbook with ID {playbook_id} not found")
        
        # Track changes for audit
        changes = {}
        for key, value in data.items():
            if hasattr(playbook, key) and getattr(playbook, key) != value:
                changes[key] = {'old': getattr(playbook, key), 'new': value}
                setattr(playbook, key, value)
        
        db.session.commit()
        
        # Create audit log
        if changes:
            PlaybookService._create_audit_log(
                user_id=user_id,
                action='UPDATE',
                resource_id=playbook.id,
                details={'name': playbook.name, 'changes': changes}
            )
        
        return playbook
    
    @staticmethod
    def delete_playbook(playbook_id, user_id):
        """
        Delete playbook (soft delete)
        
        Args:
            playbook_id: Playbook ID
            user_id: ID of user deleting the playbook
        
        Raises:
            ValueError: If playbook not found
        """
        playbook = Playbook.query.get(playbook_id)
        if not playbook:
            raise ValueError(f"Playbook with ID {playbook_id} not found")
        
        # Read content before deletion for audit log
        old_content = None
        try:
            with open(playbook.file_path, 'r') as f:
                old_content = f.read()
        except:
            pass
        
        playbook.is_active = False
        db.session.commit()
        
        # Create audit logs
        PlaybookService._create_audit_log(
            user_id=user_id,
            action='DELETE',
            resource_id=playbook.id,
            details={'name': playbook.name}
        )
        
        # Create detailed playbook audit log
        PlaybookService._create_playbook_audit_log(
            playbook_id=playbook.id,
            playbook_name=playbook.name,
            user_id=user_id,
            action='deleted',
            old_content=old_content,
            new_content=None,
            changes_description=f'Playbook "{playbook.name}" deleted'
        )
    
    @staticmethod
    def hard_delete_playbook(playbook_id, user_id):
        """
        Permanently delete playbook and its file
        
        Args:
            playbook_id: Playbook ID
            user_id: ID of user deleting the playbook
        
        Raises:
            ValueError: If playbook not found
        """
        playbook = Playbook.query.get(playbook_id)
        if not playbook:
            raise ValueError(f"Playbook with ID {playbook_id} not found")
        
        name = playbook.name
        file_path = playbook.file_path
        
        # Delete associated jobs and job logs (cascade delete)
        from app.models import Job, JobLog
        
        # Get all jobs associated with this playbook
        jobs = Job.query.filter_by(playbook_id=playbook_id).all()
        
        # Delete job logs first, then jobs
        for job in jobs:
            JobLog.query.filter_by(job_id=job.id).delete()
            db.session.delete(job)
        
        # Delete file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                raise ValueError(f"Failed to delete playbook file: {str(e)}")
        
        # Delete the playbook
        db.session.delete(playbook)
        db.session.commit()
        
        # Create audit log
        PlaybookService._create_audit_log(
            user_id=user_id,
            action='HARD_DELETE',
            resource_id=playbook_id,
            details={'name': name, 'file_path': file_path}
        )
    
    @staticmethod
    def get_playbook_content(playbook_id):
        """
        Read and return playbook file content
        
        Args:
            playbook_id: Playbook ID
        
        Returns:
            File content as string
        
        Raises:
            ValueError: If playbook not found or file doesn't exist
        """
        playbook = Playbook.query.get(playbook_id)
        if not playbook:
            raise ValueError(f"Playbook with ID {playbook_id} not found")
        
        if not os.path.exists(playbook.file_path):
            raise ValueError(f"Playbook file not found: {playbook.file_path}")
        
        with open(playbook.file_path, 'r') as f:
            return f.read()
    
    @staticmethod
    def update_playbook_content(playbook_id, content, user_id=None):
        """
        Update playbook file content with YAML validation
        
        Args:
            playbook_id: Playbook ID
            content: New YAML content as string
            user_id: ID of user updating the playbook
        
        Returns:
            Updated playbook object
        
        Raises:
            ValueError: If playbook not found, file doesn't exist, or YAML is invalid
        """
        import yaml
        
        # Get playbook
        playbook = Playbook.query.get(playbook_id)
        if not playbook:
            raise ValueError(f"Playbook with ID {playbook_id} not found")
        
        if not os.path.exists(playbook.file_path):
            raise ValueError(f"Playbook file not found: {playbook.file_path}")
        
        # Validate YAML syntax
        try:
            yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML syntax: {str(e)}")
        
        # Backup original file
        backup_path = f"{playbook.file_path}.backup"
        old_content = None
        try:
            import shutil
            shutil.copy2(playbook.file_path, backup_path)
            # Read old content for audit log
            with open(playbook.file_path, 'r') as f:
                old_content = f.read()
        except Exception as e:
            raise ValueError(f"Failed to create backup: {str(e)}")
        
        # Write new content
        try:
            with open(playbook.file_path, 'w') as f:
                f.write(content)
            
            # Update file hash
            playbook.file_hash = PlaybookService._calculate_file_hash(playbook.file_path)
            playbook.updated_at = db.func.now()
            db.session.commit()
            
            # Create audit logs
            if user_id:
                PlaybookService._create_audit_log(
                    user_id=user_id,
                    action='UPDATE_CONTENT',
                    resource_id=playbook_id,
                    details=f"Updated content for playbook '{playbook.name}'"
                )
                
                # Create detailed playbook audit log
                PlaybookService._create_playbook_audit_log(
                    playbook_id=playbook.id,
                    playbook_name=playbook.name,
                    user_id=user_id,
                    action='updated',
                    old_content=old_content,
                    new_content=content,
                    changes_description=f'Playbook "{playbook.name}" content updated'
                )
            
            # Remove backup after successful update
            if os.path.exists(backup_path):
                os.remove(backup_path)
            
            return playbook
            
        except Exception as e:
            # Restore from backup if write failed
            if os.path.exists(backup_path):
                import shutil
                shutil.copy2(backup_path, playbook.file_path)
                os.remove(backup_path)
            raise ValueError(f"Failed to update playbook content: {str(e)}")
    
    @staticmethod
    def verify_playbook_integrity(playbook_id):
        """
        Verify playbook file integrity using stored hash
        
        Args:
            playbook_id: Playbook ID
        
        Returns:
            Boolean indicating if file is intact
        """
        playbook = Playbook.query.get(playbook_id)
        if not playbook or not os.path.exists(playbook.file_path):
            return False
        
        current_hash = PlaybookService._calculate_file_hash(playbook.file_path)
        return current_hash == playbook.file_hash
    
    @staticmethod
    def _allowed_file(filename):
        """
        Check if file extension is allowed
        
        Args:
            filename: File name
        
        Returns:
            Boolean
        """
        config = get_config()
        allowed_extensions = config.ALLOWED_EXTENSIONS
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in allowed_extensions
    
    @staticmethod
    def _calculate_file_hash(file_path):
        """
        Calculate SHA256 hash of file
        
        Args:
            file_path: Path to file
        
        Returns:
            Hex string of file hash
        """
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    @staticmethod
    def _generate_unique_id():
        """
        Generate unique identifier for filename
        
        Returns:
            Unique string
        """
        import uuid
        return str(uuid.uuid4())[:8]
    
    @staticmethod
    def _create_audit_log(user_id, action, resource_id, details=None):
        """
        Create audit log entry for playbook operations
        
        Args:
            user_id: User ID performing action
            action: Action type
            resource_id: Playbook ID
            details: Additional details
        """
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type='playbook',
            resource_id=resource_id,
            details=details
        )
        db.session.add(audit_log)
        db.session.commit()
    
    @staticmethod
    def _create_playbook_audit_log(playbook_id, playbook_name, user_id, action, old_content=None, new_content=None, changes_description=None):
        """
        Create detailed playbook audit log entry with content tracking
        
        Args:
            playbook_id: Playbook ID
            playbook_name: Playbook name
            user_id: User ID performing action
            action: Action type (created, updated, deleted, uploaded, replaced)
            old_content: Previous content (for updates/deletes)
            new_content: New content (for creates/updates)
            changes_description: Description of changes
        """
        # Get client IP address
        ip_address = None
        try:
            if request:
                ip_address = request.remote_addr
        except:
            pass
        
        audit_log = PlaybookAuditLog(
            playbook_id=playbook_id,
            playbook_name=playbook_name,
            user_id=user_id,
            action=action,
            old_content=old_content,
            new_content=new_content,
            changes_description=changes_description,
            ip_address=ip_address
        )
        db.session.add(audit_log)
        db.session.commit()
    
    @staticmethod
    def get_playbook_audit_logs(playbook_id, page=1, per_page=50):
        """
        Get audit log history for a specific playbook
        
        Args:
            playbook_id: Playbook ID
            page: Page number
            per_page: Items per page
        
        Returns:
            List of audit log entries with user information
        """
        from app.models import User
        
        # Query audit logs with user information
        audit_logs = PlaybookAuditLog.query\
            .filter_by(playbook_id=playbook_id)\
            .order_by(PlaybookAuditLog.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        # Format response
        result = []
        for log in audit_logs.items:
            user = User.query.get(log.user_id)
            result.append({
                'id': log.id,
                'playbook_id': log.playbook_id,
                'playbook_name': log.playbook_name,
                'action': log.action,
                'old_content': log.old_content,
                'new_content': log.new_content,
                'changes_description': log.changes_description,
                'ip_address': log.ip_address,
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'user': {
                    'id': user.id if user else None,
                    'username': user.username if user else 'Unknown',
                    'email': user.email if user else None
                }
            })
        
        return result


# Singleton instance
playbook_service = PlaybookService()
