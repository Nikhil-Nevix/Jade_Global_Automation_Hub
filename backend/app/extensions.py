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
    
    # CORS
    cors.init_app(
        app,
        origins=app.config['CORS_ORIGINS'],
        supports_credentials=app.config['CORS_SUPPORTS_CREDENTIALS']
    )
    
    # Marshmallow
    ma.init_app(app)
    
    # Redis client
    global redis_client
    redis_client = redis.from_url(app.config['CELERY_BROKER_URL'])
    
    # Celery configuration
    celery.conf.update(
        broker_url=app.config['CELERY_BROKER_URL'],
        result_backend=app.config['CELERY_RESULT_BACKEND'],
        task_serializer=app.config['CELERY_TASK_SERIALIZER'],
        result_serializer=app.config['CELERY_RESULT_SERIALIZER'],
        accept_content=app.config['CELERY_ACCEPT_CONTENT'],
        timezone=app.config['CELERY_TIMEZONE'],
        enable_utc=app.config['CELERY_ENABLE_UTC'],
        task_track_started=app.config['CELERY_TASK_TRACK_STARTED'],
        task_time_limit=app.config['CELERY_TASK_TIME_LIMIT'],
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
