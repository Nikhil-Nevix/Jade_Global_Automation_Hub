"""
Application Entry Point
Runs the Flask development server
"""
import os
from app import create_app
from app.extensions import celery

# Create Flask app
app = create_app()

# Make celery app available
celery_app = celery

if __name__ == '__main__':
    # Get host and port from environment
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    # Run development server
    app.run(host=host, port=port, debug=debug)
