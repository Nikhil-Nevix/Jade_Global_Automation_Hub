"""
Flask Application Factory
Creates and configures the Flask application with all extensions and blueprints
"""
import os
import logging
from logging.handlers import RotatingFileHandler
from dotenv import load_dotenv
from flask import Flask, jsonify
from app.config import get_config
from app.extensions import init_extensions, db, jwt
from app.api import auth_bp, servers_bp, playbooks_bp, jobs_bp, users_bp

# Load environment variables from .env file
load_dotenv()


def create_app(config_name=None):
    """
    Application factory pattern
    
    Args:
        config_name: Configuration environment name (development, testing, production)
    
    Returns:
        Configured Flask application instance
    """
    # Create Flask app
    app = Flask(__name__)
    
    # Load configuration
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')
    
    config = get_config(config_name)
    app.config.from_object(config)
    
    # Initialize extensions
    init_extensions(app)
    
    # Register blueprints
    register_blueprints(app)
    
    # Register error handlers
    register_error_handlers(app)
    
    # Register JWT handlers
    register_jwt_handlers(app)
    
    # Setup logging
    setup_logging(app)
    
    # Register CLI commands
    register_cli_commands(app)
    
    # Health check endpoint
    @app.route('/health', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        return jsonify({
            'status': 'healthy',
            'environment': config_name,
            'version': '1.0.0'
        }), 200
    
    @app.route('/', methods=['GET'])
    def index():
        """Root endpoint"""
        return jsonify({
            'message': 'Infra Automation Platform API',
            'version': '1.0.0',
            'endpoints': {
                'auth': '/auth',
                'servers': '/servers',
                'playbooks': '/playbooks',
                'jobs': '/jobs',
                'users': '/users'
            }
        }), 200
    
    return app


def register_blueprints(app):
    """
    Register all API blueprints
    
    Args:
        app: Flask application instance
    """
    app.register_blueprint(auth_bp)
    app.register_blueprint(servers_bp)
    app.register_blueprint(playbooks_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(users_bp)


def register_error_handlers(app):
    """
    Register custom error handlers
    
    Args:
        app: Flask application instance
    """
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({
            'error': 'not_found',
            'message': 'The requested resource was not found'
        }), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({
            'error': 'method_not_allowed',
            'message': 'The method is not allowed for the requested URL'
        }), 405
    
    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f'Internal server error: {error}')
        return jsonify({
            'error': 'internal_server_error',
            'message': 'An internal server error occurred'
        }), 500
    
    @app.errorhandler(Exception)
    def handle_exception(error):
        app.logger.error(f'Unhandled exception: {error}', exc_info=True)
        return jsonify({
            'error': 'internal_server_error',
            'message': 'An unexpected error occurred'
        }), 500


def register_jwt_handlers(app):
    """
    Register JWT-specific handlers
    
    Args:
        app: Flask application instance
    """
    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': 'token_expired',
            'message': 'The token has expired'
        }), 401
    
    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        app.logger.error(f"Invalid token error: {error}")
        return jsonify({
            'error': 'invalid_token',
            'message': 'Token verification failed'
        }), 401
    
    @jwt.unauthorized_loader
    def unauthorized_callback(error):
        app.logger.error(f"Unauthorized error: {error}")
        return jsonify({
            'error': 'unauthorized',
            'message': 'Missing authorization token'
        }), 401
    
    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({
            'error': 'token_revoked',
            'message': 'The token has been revoked'
        }), 401


def setup_logging(app):
    """
    Setup application logging
    
    Args:
        app: Flask application instance
    """
    if not app.debug and not app.testing:
        # Create logs directory if it doesn't exist
        log_dir = os.path.dirname(app.config.get('LOG_FILE', 'app.log'))
        if log_dir and not os.path.exists(log_dir):
            try:
                os.makedirs(log_dir, exist_ok=True)
            except Exception:
                pass  # Fall back to current directory
        
        # Setup file handler
        log_file = app.config.get('LOG_FILE', 'app.log')
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10485760,  # 10MB
            backupCount=10
        )
        
        # Set log format
        formatter = logging.Formatter(
            '[%(asctime)s] %(levelname)s in %(module)s: %(message)s'
        )
        file_handler.setFormatter(formatter)
        
        # Set log level
        log_level = getattr(logging, app.config.get('LOG_LEVEL', 'INFO'))
        file_handler.setLevel(log_level)
        
        # Add handler to app logger
        app.logger.addHandler(file_handler)
        app.logger.setLevel(log_level)
        
        app.logger.info('Infra Automation Platform startup')


def register_cli_commands(app):
    """
    Register Flask CLI commands
    
    Args:
        app: Flask application instance
    """
    @app.cli.command()
    def init_db():
        """Initialize the database"""
        db.create_all()
        print('Database initialized successfully')
    
    @app.cli.command()
    def create_admin():
        """Create an admin user"""
        from app.services.auth_service import auth_service
        
        username = input('Enter admin username: ')
        email = input('Enter admin email: ')
        password = input('Enter admin password: ')
        
        try:
            user = auth_service.register_user(
                username=username,
                email=email,
                password=password,
                role='admin'
            )
            print(f'Admin user {user.username} created successfully')
        except Exception as e:
            print(f'Error creating admin user: {e}')
    
    @app.cli.command()
    def seed_data():
        """Seed database with sample data (development only)"""
        if app.config['DEBUG']:
            from app.services.auth_service import auth_service
            from app.services.server_service import server_service
            
            # Create test users
            try:
                admin = auth_service.register_user(
                    username='admin',
                    email='admin@example.com',
                    password='admin123',
                    role='admin'
                )
                print(f'Created admin user: {admin.username}')
                
                operator = auth_service.register_user(
                    username='operator',
                    email='operator@example.com',
                    password='operator123',
                    role='operator'
                )
                print(f'Created operator user: {operator.username}')
                
                viewer = auth_service.register_user(
                    username='viewer',
                    email='viewer@example.com',
                    password='viewer123',
                    role='viewer'
                )
                print(f'Created viewer user: {viewer.username}')
                
                # Create sample server
                server = server_service.create_server({
                    'hostname': 'test-server-01',
                    'ip_address': '192.168.1.100',
                    'os_type': 'ubuntu',
                    'os_version': '22.04',
                    'ssh_user': 'ubuntu',
                    'ssh_port': 22,
                    'environment': 'dev',
                    'description': 'Test server for development'
                }, admin.id)
                print(f'Created sample server: {server.hostname}')
                
                print('Sample data seeded successfully')
            except Exception as e:
                print(f'Error seeding data: {e}')
        else:
            print('Seed data is only available in development mode')
