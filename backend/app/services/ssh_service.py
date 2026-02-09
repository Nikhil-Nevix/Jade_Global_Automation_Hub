"""
SSH Service
Handles SSH operations for reading/writing files to remote servers
"""
import paramiko
from flask import current_app
import os


class SSHService:
    """Service for SSH operations on remote servers"""
    
    def __init__(self):
        self.timeout = 30
    
    def _get_ssh_client(self, server):
        """
        Create and return SSH client connected to server
        
        Args:
            server: Server model instance
            
        Returns:
            paramiko.SSHClient: Connected SSH client
        """
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        
        try:
            # Connect using server credentials  
            if server.ssh_key_path:
                # Use SSH key authentication
                key = paramiko.RSAKey.from_private_key_file(server.ssh_key_path)
                client.connect(
                    hostname=server.ip_address,
                    port=server.ssh_port or 22,
                    username=server.ssh_user,
                    pkey=key,
                    timeout=self.timeout
                )
            else:
                # Fallback to password authentication (if Server model had password field)
                # For now, raise error since no password field exists
                raise Exception("SSH key path is required for server connection")
            
            return client
            
        except Exception as e:
            current_app.logger.error(f'SSH connection failed to {server.ip_address}: {str(e)}')
            raise Exception(f'Failed to connect to server: {str(e)}')
    
    def read_file(self, server, remote_path):
        """
        Read content of a file from remote server
        
        Args:
            server: Server model instance
            remote_path: Path to file on remote server
            
        Returns:
            str: Content of the file
        """
        client = None
        sftp = None
        
        try:
            client = self._get_ssh_client(server)
            sftp = client.open_sftp()
            
            # Read file
            with sftp.file(remote_path, 'r') as f:
                content = f.read().decode('utf-8')
            
            current_app.logger.info(f'Successfully read file {remote_path} from {server.ip_address}')
            return content
            
        except Exception as e:
            current_app.logger.error(f'Error reading file {remote_path} from {server.ip_address}: {str(e)}')
            raise Exception(f'Failed to read file: {str(e)}')
            
        finally:
            if sftp:
                sftp.close()
            if client:
                client.close()
    
    def write_file(self, server, remote_path, content):
        """
        Write content to a file on remote server
        
        Args:
            server: Server model instance
            remote_path: Path to file on remote server
            content: Content to write to file
        """
        client = None
        sftp = None
        
        try:
            client = self._get_ssh_client(server)
            sftp = client.open_sftp()
            
            # Ensure directory exists
            remote_dir = os.path.dirname(remote_path)
            try:
                sftp.stat(remote_dir)
            except FileNotFoundError:
                # Create directory if it doesn't exist
                stdin, stdout, stderr = client.exec_command(f'mkdir -p {remote_dir}')
                stdout.channel.recv_exit_status()  # Wait for command to complete
            
            # Write file
            with sftp.file(remote_path, 'w') as f:
                f.write(content.encode('utf-8') if isinstance(content, str) else content)
            
            current_app.logger.info(f'Successfully wrote file {remote_path} to {server.ip_address}')
            
        except Exception as e:
            current_app.logger.error(f'Error writing file {remote_path} to {server.ip_address}: {str(e)}')
            raise Exception(f'Failed to write file: {str(e)}')
            
        finally:
            if sftp:
                sftp.close()
            if client:
                client.close()
    
    def file_exists(self, server, remote_path):
        """
        Check if a file exists on remote server
        
        Args:
            server: Server model instance
            remote_path: Path to file on remote server
            
        Returns:
            bool: True if file exists, False otherwise
        """
        client = None
        sftp = None
        
        try:
            client = self._get_ssh_client(server)
            sftp = client.open_sftp()
            
            # Try to stat the file
            sftp.stat(remote_path)
            return True
            
        except FileNotFoundError:
            return False
            
        except Exception as e:
            current_app.logger.error(f'Error checking file existence {remote_path} on {server.ip_address}: {str(e)}')
            raise Exception(f'Failed to check file existence: {str(e)}')
            
        finally:
            if sftp:
                sftp.close()
            if client:
                client.close()
    
    def delete_file(self, server, remote_path):
        """
        Delete a file from remote server
        
        Args:
            server: Server model instance
            remote_path: Path to file on remote server
        """
        client = None
        sftp = None
        
        try:
            client = self._get_ssh_client(server)
            sftp = client.open_sftp()
            
            # Delete file
            sftp.remove(remote_path)
            
            current_app.logger.info(f'Successfully deleted file {remote_path} from {server.ip_address}')
            
        except Exception as e:
            current_app.logger.error(f'Error deleting file {remote_path} from {server.ip_address}: {str(e)}')
            raise Exception(f'Failed to delete file: {str(e)}')
            
        finally:
            if sftp:
                sftp.close()
            if client:
                client.close()
