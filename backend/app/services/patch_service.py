"""
Patch Management Service
Handles checking and installing/updating packages from uploaded CSV file
"""

import re
import subprocess
import csv
import os
from typing import List, Dict, Optional
from flask import current_app


class PatchService:
    """Service for managing system packages based on CSV requirements"""

    @staticmethod
    def parse_package_csv(file_path: str) -> List[Dict[str, str]]:
        """
        Parse uploaded CSV file containing package requirements
        
        Expected CSV format:
        package_name,required_version
        vim,8.0
        nginx,1.20
        
        Args:
            file_path: Path to CSV file
            
        Returns:
            List of dicts with package_name and required_version
        """
        packages = []
        
        try:
            with open(file_path, 'r') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                    if 'package_name' in row and 'required_version' in row:
                        packages.append({
                            'package_name': row['package_name'].strip(),
                            'required_version': row['required_version'].strip()
                        })
            
            current_app.logger.info(f"Parsed {len(packages)} packages from CSV")
            return packages
            
        except Exception as e:
            current_app.logger.error(f"Error parsing CSV: {str(e)}")
            raise ValueError(f"Invalid CSV format: {str(e)}")
    
    @staticmethod
    def check_packages_from_csv(server_id: int, server_hostname: str, server_ip: str, csv_file_path: str) -> Dict:
        """
        Check specific packages from CSV file on a server using Ansible
        
        Args:
            server_id: Database ID of the server
            server_hostname: Hostname of the server
            server_ip: IP address of the server
            csv_file_path: Path to uploaded CSV file
            
        Returns:
            Dict containing package status results
        """
        try:
            # Parse CSV to get required packages
            required_packages = PatchService.parse_package_csv(csv_file_path)
            
            if not required_packages:
                return {
                    'success': False,
                    'error': 'No packages found in CSV file',
                    'packages': []
                }
            
            # Get package information for each required package
            results = []
            
            for pkg_req in required_packages:
                package_name = pkg_req['package_name']
                required_version = pkg_req['required_version']
                
                # Check if package is installed and get versions
                pkg_info = PatchService._check_single_package(server_ip, package_name)
                
                results.append({
                    'package_name': package_name,
                    'required_version': required_version,
                    'current_version': pkg_info.get('current_version'),
                    'latest_version': pkg_info.get('latest_version'),
                    'status': pkg_info.get('status'),  # 'installed', 'not_installed', 'update_available'
                    'repository': pkg_info.get('repository', 'unknown')
                })
            
            return {
                'success': True,
                'server_id': server_id,
                'server_hostname': server_hostname,
                'packages': results,
                'total_count': len(results)
            }
            
        except Exception as e:
            current_app.logger.error(f"Error checking packages for server {server_hostname}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'packages': []
            }
    
    @staticmethod
    def _check_single_package(server_ip: str, package_name: str) -> Dict:
        """
        Check status of a single package on the server
        
        Returns dict with: current_version, latest_version, status, repository
        """
        try:
            # Check if package is installed
            check_cmd = [
                'ansible',
                server_ip,
                '-i', f'{server_ip},',
                '-m', 'shell',
                '-a', f'rpm -q {package_name} --queryformat "%{{VERSION}}-%{{RELEASE}}" || echo "not_installed"',
                '-u', 'root',
                '--become',
            ]
            
            result = subprocess.run(check_cmd, capture_output=True, text=True, timeout=30)
            
            current_version = None
            status = 'not_installed'
            
            if 'not_installed' not in result.stdout and result.returncode == 0:
                # Package is installed, extract version
                version_match = re.search(r'(\S+)', result.stdout)
                if version_match:
                    current_version = version_match.group(1)
                    status = 'installed'
            
            # Check for available updates
            update_cmd = [
                'ansible',
                server_ip,
                '-i', f'{server_ip},',
                '-m', 'shell',
                '-a', f'yum list available {package_name} 2>/dev/null | grep {package_name} || echo "no_update"',
                '-u', 'root',
                '--become',
            ]
            
            update_result = subprocess.run(update_cmd, capture_output=True, text=True, timeout=30)
            
            latest_version = current_version
            repository = 'unknown'
            
            if 'no_update' not in update_result.stdout:
                # Parse yum list output
                match = re.search(rf'{package_name}\s+(\S+)\s+(\S+)', update_result.stdout)
                if match:
                    latest_version = match.group(1)
                    repository = match.group(2)
                    
                    if current_version and latest_version != current_version:
                        status = 'update_available'
            
            return {
                'current_version': current_version,
                'latest_version': latest_version,
                'status': status,
                'repository': repository
            }
            
        except Exception as e:
            current_app.logger.error(f"Error checking package {package_name}: {str(e)}")
            return {
                'current_version': None,
                'latest_version': None,
                'status': 'error',
                'repository': 'unknown'
            }

    @staticmethod
    def generate_install_playbook(packages: List[str], server_id: int) -> str:
        """
        Generate an Ansible playbook to install packages
        
        Args:
            packages: List of package names to install
            server_id: Database ID of the server
            
        Returns:
            Path to the generated playbook file
        """
        import yaml
        from datetime import datetime
        
        # Create playbook content
        playbook_content = [
            {
                'name': 'Install Selected Packages',
                'hosts': 'all',
                'become': True,
                'tasks': [
                    {
                        'name': f'Install package: {package}',
                        'yum': {
                            'name': package,
                            'state': 'present'
                        }
                    }
                    for package in packages
                ]
            }
        ]
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'package_install_server{server_id}_{timestamp}.yml'
        
        # Save to playbooks directory
        playbook_dir = current_app.config.get('PLAYBOOK_DIR', '/tmp')
        filepath = os.path.join(playbook_dir, filename)
        
        with open(filepath, 'w') as f:
            yaml.dump(playbook_content, f, default_flow_style=False, sort_keys=False)
        
        current_app.logger.info(f"Generated install playbook at {filepath}")
        return filepath

    @staticmethod
    def generate_update_playbook(packages: List[str], server_id: int) -> str:
        """
        Generate an Ansible playbook to update packages
        
        Args:
            packages: List of package names to update
            server_id: Database ID of the server
            
        Returns:
            Path to the generated playbook file
        """
        import yaml
        from datetime import datetime
        
        # Create playbook content
        playbook_content = [
            {
                'name': 'Update Selected Packages',
                'hosts': 'all',
                'become': True,
                'tasks': [
                    {
                        'name': f'Update package: {package}',
                        'yum': {
                            'name': package,
                            'state': 'latest'
                        }
                    }
                    for package in packages
                ]
            }
        ]
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'package_update_server{server_id}_{timestamp}.yml'
        
        # Save to playbooks directory
        playbook_dir = current_app.config.get('PLAYBOOK_DIR', '/tmp')
        filepath = os.path.join(playbook_dir, filename)
        
        with open(filepath, 'w') as f:
            yaml.dump(playbook_content, f, default_flow_style=False, sort_keys=False)
        
        current_app.logger.info(f"Generated update playbook at {filepath}")
        return filepath
