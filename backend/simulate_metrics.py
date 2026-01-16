"""
Test script to simulate server metrics updates
This simulates what would happen with real SSH monitoring
"""
from app import create_app
from app.models import Server
from app.extensions import db
from datetime import datetime
import random

app = create_app()

with app.app_context():
    # Get all active servers
    servers = Server.query.filter_by(is_active=True).all()
    
    print(f"Updating metrics for {len(servers)} servers...")
    
    for server in servers:
        # Simulate realistic metrics
        cpu_usage = round(random.uniform(15, 85), 2)
        memory_usage = round(random.uniform(30, 75), 2)
        disk_usage = round(random.uniform(20, 60), 2)
        
        server.cpu_usage = cpu_usage
        server.memory_usage = memory_usage
        server.disk_usage = disk_usage
        server.last_monitored = datetime.utcnow()
        
        print(f"  {server.hostname}: CPU={cpu_usage}%, MEM={memory_usage}%, DISK={disk_usage}%")
    
    db.session.commit()
    print("\n✓ Metrics updated successfully!")
