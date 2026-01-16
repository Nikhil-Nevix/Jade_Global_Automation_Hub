"""
Playbook Service
Handles playbook management, upload, and storage
"""
import os
import hashlib
from werkzeug.utils import secure_filename
from app.extensions import db
from app.models import Playbook, AuditLog
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
        
        # Validate file
        if not file_obj or not PlaybookService._allowed_file(file_obj.filename):
            raise ValueError("Invalid file type. Only .yml and .yaml files are allowed")
        
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
        
        # Create audit log
        if user_id:
            PlaybookService._create_audit_log(
                user_id=user_id,
                action='CREATE',
                resource_id=playbook.id,
                details={'name': name, 'file_path': file_path}
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
        
        playbook.is_active = False
        db.session.commit()
        
        # Create audit log
        PlaybookService._create_audit_log(
            user_id=user_id,
            action='DELETE',
            resource_id=playbook.id,
            details={'name': playbook.name}
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
        
        # Set playbook_id to NULL for associated jobs (instead of blocking deletion)
        from app.models import Job
        Job.query.filter_by(playbook_id=playbook_id).update({'playbook_id': None})
        
        # Delete file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception as e:
                raise ValueError(f"Failed to delete playbook file: {str(e)}")
        
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


# Singleton instance
playbook_service = PlaybookService()
