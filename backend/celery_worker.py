"""
Celery Configuration Module
Standalone Celery app configuration for running workers
"""
from app import create_app
from app.extensions import celery

# Create Flask app for context
flask_app = create_app()

# Configure Celery with Flask app context
celery.conf.update(flask_app.config)

# Make sure tasks are discovered
celery.autodiscover_tasks(['app'])


class ContextTask(celery.Task):
    """Celery task that runs within Flask application context"""
    
    def __call__(self, *args, **kwargs):
        with flask_app.app_context():
            return self.run(*args, **kwargs)


# Set the base task class
celery.Task = ContextTask

if __name__ == '__main__':
    celery.start()
