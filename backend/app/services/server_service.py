"""
Server Service
Handles server inventory CRUD operations
"""
from app.extensions import db
from app.models import Server, AuditLog
from sqlalchemy import or_


class ServerService:
    """Service for server inventory operations"""
    
    @staticmethod
    def create_server(data, user_id):
        """
        Create a new server entry
        
        Args:
            data: Dictionary with server data
            user_id: ID of user creating the server
        
        Returns:
            Created server object
        
        Raises:
            ValueError: If server already exists
        """
        # Check for duplicate hostname or IP
        existing = Server.query.filter(
            or_(
                Server.hostname == data.get('hostname'),
                Server.ip_address == data.get('ip_address')
            )
        ).first()
        
        if existing:
            raise ValueError(f"Server with hostname '{data.get('hostname')}' or IP '{data.get('ip_address')}' already exists")
        
        # Create server
        server = Server(**data)
        db.session.add(server)
        db.session.commit()
        
        # Create audit log
        ServerService._create_audit_log(
            user_id=user_id,
            action='CREATE',
            resource_id=server.id,
            details={'hostname': server.hostname, 'ip': server.ip_address}
        )
        
        return server
    
    @staticmethod
    def get_server(server_id):
        """
        Get server by ID
        
        Args:
            server_id: Server ID
        
        Returns:
            Server object or None
        """
        return Server.query.get(server_id)
    
    @staticmethod
    def get_all_servers(filters=None, page=1, per_page=20):
        """
        Get all servers with optional filtering and pagination
        
        Args:
            filters: Dictionary with filter criteria
            page: Page number
            per_page: Items per page
        
        Returns:
            Paginated server query result
        """
        query = Server.query
        
        if filters:
            if filters.get('is_active') is not None:
                query = query.filter_by(is_active=filters['is_active'])
            
            if filters.get('environment'):
                query = query.filter_by(environment=filters['environment'])
            
            if filters.get('os_type'):
                query = query.filter_by(os_type=filters['os_type'])
            
            if filters.get('search'):
                search_term = f"%{filters['search']}%"
                query = query.filter(
                    or_(
                        Server.hostname.ilike(search_term),
                        Server.ip_address.ilike(search_term),
                        Server.description.ilike(search_term)
                    )
                )
        
        return query.order_by(Server.created_at.desc()).paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
    
    @staticmethod
    def update_server(server_id, data, user_id):
        """
        Update server details
        
        Args:
            server_id: Server ID
            data: Dictionary with updated data
            user_id: ID of user updating the server
        
        Returns:
            Updated server object
        
        Raises:
            ValueError: If server not found
        """
        server = Server.query.get(server_id)
        if not server:
            raise ValueError(f"Server with ID {server_id} not found")
        
        # Check for duplicate hostname or IP if they're being changed
        if 'hostname' in data and data['hostname'] != server.hostname:
            existing = Server.query.filter_by(hostname=data['hostname']).first()
            if existing:
                raise ValueError(f"Server with hostname '{data['hostname']}' already exists")
        
        if 'ip_address' in data and data['ip_address'] != server.ip_address:
            existing = Server.query.filter_by(ip_address=data['ip_address']).first()
            if existing:
                raise ValueError(f"Server with IP '{data['ip_address']}' already exists")
        
        # Track changes for audit
        changes = {}
        for key, value in data.items():
            if hasattr(server, key) and getattr(server, key) != value:
                changes[key] = {'old': getattr(server, key), 'new': value}
                setattr(server, key, value)
        
        db.session.commit()
        
        # Create audit log
        if changes:
            ServerService._create_audit_log(
                user_id=user_id,
                action='UPDATE',
                resource_id=server.id,
                details={'hostname': server.hostname, 'changes': changes}
            )
        
        return server
    
    @staticmethod
    def delete_server(server_id, user_id):
        """
        Delete server (soft delete by setting is_active=False)
        
        Args:
            server_id: Server ID
            user_id: ID of user deleting the server
        
        Raises:
            ValueError: If server not found
        """
        server = Server.query.get(server_id)
        if not server:
            raise ValueError(f"Server with ID {server_id} not found")
        
        # Soft delete
        server.is_active = False
        db.session.commit()
        
        # Create audit log
        ServerService._create_audit_log(
            user_id=user_id,
            action='DELETE',
            resource_id=server.id,
            details={'hostname': server.hostname, 'ip': server.ip_address}
        )
    
    @staticmethod
    def hard_delete_server(server_id, user_id):
        """
        Permanently delete server from database
        
        Args:
            server_id: Server ID
            user_id: ID of user deleting the server
        
        Raises:
            ValueError: If server not found or has associated jobs
        """
        server = Server.query.get(server_id)
        if not server:
            raise ValueError(f"Server with ID {server_id} not found")
        
        # Check for associated jobs
        if server.jobs.count() > 0:
            raise ValueError(f"Cannot delete server with existing jobs. Delete jobs first or use soft delete.")
        
        hostname = server.hostname
        ip = server.ip_address
        
        db.session.delete(server)
        db.session.commit()
        
        # Create audit log
        ServerService._create_audit_log(
            user_id=user_id,
            action='HARD_DELETE',
            resource_id=server_id,
            details={'hostname': hostname, 'ip': ip}
        )
    
    @staticmethod
    def get_server_by_hostname(hostname):
        """
        Get server by hostname
        
        Args:
            hostname: Server hostname
        
        Returns:
            Server object or None
        """
        return Server.query.filter_by(hostname=hostname).first()
    
    @staticmethod
    def get_servers_by_tags(tags):
        """
        Get servers matching specific tags
        
        Args:
            tags: Dictionary of tags to match
        
        Returns:
            List of matching servers
        """
        servers = []
        all_servers = Server.query.filter_by(is_active=True).all()
        
        for server in all_servers:
            if server.tags and all(
                server.tags.get(k) == v for k, v in tags.items()
            ):
                servers.append(server)
        
        return servers
    
    @staticmethod
    def _create_audit_log(user_id, action, resource_id, details=None):
        """
        Create audit log entry for server operations
        
        Args:
            user_id: User ID performing action
            action: Action type
            resource_id: Server ID
            details: Additional details
        """
        audit_log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type='server',
            resource_id=resource_id,
            details=details
        )
        db.session.add(audit_log)
        db.session.commit()


# Singleton instance
server_service = ServerService()
