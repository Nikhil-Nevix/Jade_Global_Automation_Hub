"""
Server Monitoring Service
Fetches real-time metrics from remote servers via SSH
"""
import paramiko
import re
from datetime import datetime
from typing import Dict, Optional
from app.models import Server
from app.extensions import db


class ServerMonitor:
    """Monitor server resources via SSH"""
    
    @staticmethod
    def get_cpu_usage(server: Server) -> Optional[float]:
        """
        Get CPU usage from remote server
        Returns percentage (0-100) or None if failed
        """
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Connect to server
            connect_kwargs = {
                'hostname': server.ip_address,
                'port': server.ssh_port,
                'username': server.ssh_user,
                'timeout': 10
            }
            
            if server.ssh_key_path:
                connect_kwargs['key_filename'] = server.ssh_key_path
            
            ssh.connect(**connect_kwargs)
            
            # Get CPU usage using top command (works on Linux)
            # Get 1 iteration of CPU stats
            stdin, stdout, stderr = ssh.exec_command(
                "top -bn1 | grep 'Cpu(s)' | sed 's/.*, *\\([0-9.]*\\)%* id.*/\\1/' | awk '{print 100 - $1}'"
            )
            
            output = stdout.read().decode().strip()
            ssh.close()
            
            if output:
                cpu_usage = float(output)
                return round(min(max(cpu_usage, 0), 100), 2)  # Clamp between 0-100
            
            return None
            
        except Exception as e:
            print(f"Error getting CPU usage for {server.hostname}: {str(e)}")
            return None
    
    @staticmethod
    def get_memory_usage(server: Server) -> Optional[float]:
        """
        Get memory usage from remote server
        Returns percentage (0-100) or None if failed
        """
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            connect_kwargs = {
                'hostname': server.ip_address,
                'port': server.ssh_port,
                'username': server.ssh_user,
                'timeout': 10
            }
            
            if server.ssh_key_path:
                connect_kwargs['key_filename'] = server.ssh_key_path
            
            ssh.connect(**connect_kwargs)
            
            # Get memory usage using free command
            stdin, stdout, stderr = ssh.exec_command(
                "free | grep Mem | awk '{print ($3/$2) * 100.0}'"
            )
            
            output = stdout.read().decode().strip()
            ssh.close()
            
            if output:
                mem_usage = float(output)
                return round(min(max(mem_usage, 0), 100), 2)
            
            return None
            
        except Exception as e:
            print(f"Error getting memory usage for {server.hostname}: {str(e)}")
            return None
    
    @staticmethod
    def get_disk_usage(server: Server) -> Optional[float]:
        """
        Get disk usage from remote server
        Returns percentage (0-100) or None if failed
        """
        try:
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            connect_kwargs = {
                'hostname': server.ip_address,
                'port': server.ssh_port,
                'username': server.ssh_user,
                'timeout': 10
            }
            
            if server.ssh_key_path:
                connect_kwargs['key_filename'] = server.ssh_key_path
            
            ssh.connect(**connect_kwargs)
            
            # Get root partition disk usage
            stdin, stdout, stderr = ssh.exec_command(
                "df -h / | tail -1 | awk '{print $5}' | sed 's/%//'"
            )
            
            output = stdout.read().decode().strip()
            ssh.close()
            
            if output:
                disk_usage = float(output)
                return round(min(max(disk_usage, 0), 100), 2)
            
            return None
            
        except Exception as e:
            print(f"Error getting disk usage for {server.hostname}: {str(e)}")
            return None
    
    @staticmethod
    def update_server_metrics(server: Server) -> Dict[str, Optional[float]]:
        """
        Update all metrics for a server
        Returns dict with cpu, memory, disk usage
        """
        metrics = {
            'cpu_usage': ServerMonitor.get_cpu_usage(server),
            'memory_usage': ServerMonitor.get_memory_usage(server),
            'disk_usage': ServerMonitor.get_disk_usage(server)
        }
        
        # Update database
        if metrics['cpu_usage'] is not None:
            server.cpu_usage = metrics['cpu_usage']
        if metrics['memory_usage'] is not None:
            server.memory_usage = metrics['memory_usage']
        if metrics['disk_usage'] is not None:
            server.disk_usage = metrics['disk_usage']
        
        server.last_monitored = datetime.utcnow()
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Error updating metrics in database: {str(e)}")
        
        return metrics
    
    @staticmethod
    def update_all_servers():
        """Update metrics for all active servers"""
        servers = Server.query.filter_by(is_active=True).all()
        results = {}
        
        for server in servers:
            print(f"Updating metrics for {server.hostname}...")
            results[server.hostname] = ServerMonitor.update_server_metrics(server)
        
        return results
