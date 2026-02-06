"""API module initialization"""
from app.api.auth import auth_bp
from app.api.servers import servers_bp
from app.api.playbooks import playbooks_bp
from app.api.jobs import jobs_bp
from app.api.users import users_bp
from app.api.patches import patches_bp

__all__ = ['auth_bp', 'servers_bp', 'playbooks_bp', 'jobs_bp', 'users_bp', 'patches_bp']
