"""
Application Configuration
Manages environment-based configuration for development, testing, and production
"""
import os
from datetime import timedelta


class Config:
    """Base configuration with default settings"""
    
    # Flask Core
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
    DEBUG = False
    TESTING = False
    
    # Database Configuration
    SQLALCHEMY_DATABASE_URI = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://infra_user:infra_pass123@localhost/infra_automation"   
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = False
    SQLALCHEMY_POOL_SIZE = 10
    SQLALCHEMY_POOL_RECYCLE = 3600
    SQLALCHEMY_POOL_PRE_PING = True
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    # Celery Configuration
    CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
    
    # File Storage (Linux-compatible paths)
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', '/var/lib/infra-automation/playbooks')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'yml', 'yaml'}
    
    # Ansible Runner Configuration
    ANSIBLE_RUNNER_DIR = os.getenv('ANSIBLE_RUNNER_DIR', '/var/lib/infra-automation/ansible-runner')
    ANSIBLE_RUNNER_ROTATE_ARTIFACTS = 50
    ANSIBLE_PRIVATE_KEY_DIR = os.getenv('ANSIBLE_PRIVATE_KEY_DIR', '/var/lib/infra-automation/keys')
    
    # Security
    BCRYPT_LOG_ROUNDS = 12
    PASSWORD_MIN_LENGTH = 8
    
    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
    CORS_SUPPORTS_CREDENTIALS = True
    
    # Pagination
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100
    
    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', '/var/log/infra-automation/app.log')


class DevelopmentConfig(Config):
    """Development environment configuration"""
    DEBUG = True
    SQLALCHEMY_ECHO = False
    UPLOAD_FOLDER = os.path.join(os.getcwd(), 'data', 'playbooks')
    ANSIBLE_RUNNER_DIR = os.path.join(os.getcwd(), 'data', 'ansible-runner')
    ANSIBLE_PRIVATE_KEY_DIR = os.path.join(os.getcwd(), 'data', 'keys')
    LOG_FILE = 'app.log'


class TestingConfig(Config):
    """Testing environment configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    CELERY_TASK_ALWAYS_EAGER = True
    CELERY_TASK_EAGER_PROPAGATES = True
    UPLOAD_FOLDER = '/tmp/test_playbooks'
    ANSIBLE_RUNNER_DIR = '/tmp/test_ansible_runner'
    ANSIBLE_PRIVATE_KEY_DIR = '/tmp/test_keys'


class ProductionConfig(Config):
    """Production environment configuration"""
    # Override with stricter production settings
    SQLALCHEMY_POOL_SIZE = 20
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=30)
    BCRYPT_LOG_ROUNDS = 14


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}


def get_config(env=None):
    """Get configuration based on environment"""
    if env is None:
        env = os.getenv('FLASK_ENV', 'development')
    return config.get(env, config['default'])
