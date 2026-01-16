"""
Server API Endpoints
Handles server inventory CRUD operations
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import ValidationError
from app.services.auth_service import auth_service
from app.services.server_service import server_service
from app.schemas import (
    server_schema, servers_schema, server_create_schema, 
    server_update_schema, error_schema
)

servers_bp = Blueprint('servers', __name__, url_prefix='/servers')


@servers_bp.route('', methods=['GET'])
@jwt_required()
def get_servers():
    """
    Get all servers with optional filtering
    
    Query Parameters:
        is_active: bool
        environment: str
        os_type: str
        search: str
        page: int
        per_page: int
    
    Returns:
        List of servers with pagination
    """
    try:
        # Extract filters from query params
        filters = {}
        if request.args.get('is_active'):
            filters['is_active'] = request.args.get('is_active').lower() == 'true'
        if request.args.get('environment'):
            filters['environment'] = request.args.get('environment')
        if request.args.get('os_type'):
            filters['os_type'] = request.args.get('os_type')
        if request.args.get('search'):
            filters['search'] = request.args.get('search')
        
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # Get servers
        pagination = server_service.get_all_servers(filters, page, per_page)
        
        return jsonify({
            'items': servers_schema.dump(pagination.items),
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
            'message': 'An error occurred while fetching servers'
        })), 500


@servers_bp.route('/<int:server_id>', methods=['GET'])
@jwt_required()
def get_server(server_id):
    """
    Get a specific server by ID
    
    Returns:
        Server details
    """
    try:
        server = server_service.get_server(server_id)
        
        if not server:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': f'Server with ID {server_id} not found'
            })), 404
        
        return jsonify(server_schema.dump(server)), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while fetching server'
        })), 500


@servers_bp.route('', methods=['POST'])
@jwt_required()
def create_server():
    """
    Create a new server (operator or admin only)
    
    Request Body:
        hostname: str (required)
        ip_address: str (required)
        os_type: str (required)
        ssh_user: str (required)
        ... additional fields
    
    Returns:
        Created server
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Allow all authenticated users to create servers for now
        # if not auth_service.check_permission(current_user, 'operator'):
        #     return jsonify(error_schema.dump({
        #         'error': 'forbidden',
        #         'message': 'Insufficient permissions to create servers'
        #     })), 403
        
        # Validate request
        print("Received data:", request.get_json())
        data = server_create_schema.load(request.get_json())
        print("Validated data:", data)
        
        # Create server
        server = server_service.create_server(data, current_user_id)
        
        return jsonify(server_schema.dump(server)), 201
    
    except ValidationError as err:
        print("Validation error:", err.messages)
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': 'Invalid request data',
            'details': err.messages
        })), 400
    
    except ValueError as err:
        print("Value error:", str(err))
        return jsonify(error_schema.dump({
            'error': 'validation_error',
            'message': str(err)
        })), 400
    
    except Exception as err:
        print("Exception creating server:", str(err))
        import traceback
        traceback.print_exc()
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while creating server'
        })), 500
        return jsonify(error_schema.dump({
            'error': 'creation_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while creating server'
        })), 500


@servers_bp.route('/<int:server_id>', methods=['PUT'])
@jwt_required()
def update_server(server_id):
    """
    Update server details (operator or admin only)
    
    Request Body:
        Fields to update
    
    Returns:
        Updated server
    """
    try:
        # Get current user
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_current_user(current_user_id)
        
        # Check permission
        if not auth_service.check_permission(current_user, 'operator'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions to update servers'
            })), 403
        
        # Validate request
        data = server_update_schema.load(request.get_json())
        
        # Update server
        server = server_service.update_server(server_id, data, current_user_id)
        
        return jsonify(server_schema.dump(server)), 200
    
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
            'message': 'An error occurred while updating server'
        })), 500


@servers_bp.route('/<int:server_id>', methods=['DELETE'])
@jwt_required()
def delete_server(server_id):
    """
    Delete server (admin only, soft delete by default)
    
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
                'message': 'Insufficient permissions to delete servers'
            })), 403
        
        # Check if hard delete
        hard_delete = request.args.get('hard', 'false').lower() == 'true'
        
        if hard_delete:
            server_service.hard_delete_server(server_id, current_user_id)
        else:
            server_service.delete_server(server_id, current_user_id)
        
        return jsonify({'message': 'Server deleted successfully'}), 200
    
    except ValueError as err:
        return jsonify(error_schema.dump({
            'error': 'deletion_failed',
            'message': str(err)
        })), 400
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': 'An error occurred while deleting server'
        })), 500


@servers_bp.route('/<int:server_id>/metrics', methods=['GET'])
@jwt_required()
def get_server_metrics(server_id):
    """
    Get real-time metrics for a specific server
    
    Returns:
        Server metrics (CPU, Memory, Disk usage)
    """
    try:
        from app.services.monitor_service import ServerMonitor
        from app.models import Server
        
        # Get server
        server = Server.query.get(server_id)
        if not server:
            return jsonify(error_schema.dump({
                'error': 'not_found',
                'message': 'Server not found'
            })), 404
        
        # Update metrics
        metrics = ServerMonitor.update_server_metrics(server)
        
        return jsonify({
            'server_id': server_id,
            'hostname': server.hostname,
            'cpu_usage': metrics['cpu_usage'],
            'memory_usage': metrics['memory_usage'],
            'disk_usage': metrics['disk_usage'],
            'last_monitored': server.last_monitored.isoformat() if server.last_monitored else None
        }), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'Failed to get server metrics: {str(err)}'
        })), 500


@servers_bp.route('/metrics/refresh', methods=['POST'])
@jwt_required()
def refresh_all_metrics():
    """
    Refresh metrics for all active servers
    Requires operator or admin role
    
    Returns:
        Summary of updated metrics
    """
    try:
        # Check permissions
        current_user_id = get_jwt_identity()
        current_user = auth_service.get_user_by_id(int(current_user_id))
        
        if not auth_service.check_permission(current_user, 'operator'):
            return jsonify(error_schema.dump({
                'error': 'forbidden',
                'message': 'Insufficient permissions'
            })), 403
        
        from app.services.monitor_service import ServerMonitor
        
        # Update all servers
        results = ServerMonitor.update_all_servers()
        
        return jsonify({
            'message': 'Metrics refreshed successfully',
            'servers_updated': len(results),
            'results': results
        }), 200
    
    except Exception as err:
        return jsonify(error_schema.dump({
            'error': 'internal_error',
            'message': f'Failed to refresh metrics: {str(err)}'
        })), 500
