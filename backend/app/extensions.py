"""
Flask Extensions Initialization
Centralizes extension instances for the application
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_marshmallow import Marshmallow
from celery import Celery
import redis

# Initialize extensions without app binding
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
ma = Marshmallow()

# Redis client for direct access if needed
redis_client = None

# Celery instance
celery = Celery()


def init_extensions(app):
    """
    Initialize Flask extensions with app context
    
    Args:
        app: Flask application instance
    """
    # Database
    db.init_app(app)
    migrate.init_app(app, db)
    
    # JWT Authentication
    jwt.init_app(app)
    
    # CORS - Allow all methods and headers for preflight requests
    cors.init_app(
        app,
        resources={r"/*": {
            "origins": app.config['CORS_ORIGINS'],
            "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": app.config['CORS_SUPPORTS_CREDENTIALS'],
            "expose_headers": ["Content-Type", "Authorization"]
        }}
    )
    
    # Marshmallow
    ma.init_app(app)
    
    # Redis client
    global redis_client
    redis_client = redis.from_url(app.config['CELERY_BROKER_URL'])
    
    # Celery configuration (use new-style lowercase keys)
    celery.conf.update(
        broker_url=app.config['CELERY_BROKER_URL'],
        result_backend=app.config['CELERY_RESULT_BACKEND'],
        task_serializer='json',
        result_serializer='json',
        accept_content=['json'],
        timezone='UTC',
        enable_utc=True,
        task_track_started=True,
        task_time_limit=3600,
        broker_connection_retry_on_startup=True,
    )
    
    # Update celery with Flask app context
    celery.Task = create_context_task(app)


def create_context_task(app):
    """
    Create a Celery task class that pushes Flask app context
    
    Args:
        app: Flask application instance
    
    Returns:
        ContextTask class
    """
    TaskBase = celery.Task
    
    class ContextTask(TaskBase):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    
    return ContextTask
