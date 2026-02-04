"""
File Manager Utility
Handles ZIP extraction, folder management, and file operations for playbook uploads

Features:
- ZIP file extraction with security validation
- File structure analysis and tree generation
- Individual file operations (read, write, delete)
- Folder size calculation
- Path sanitization and security checks
"""
import os
import zipfile
import shutil
import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from werkzeug.utils import secure_filename


# Security configuration
ALLOWED_EXTENSIONS = {'.yml', '.yaml', '.j2', '.py', '.sh', '.cfg', '.ini', '.json', '.xml', '.conf', '.txt', '.md'}
BLOCKED_EXTENSIONS = {'.exe', '.dll', '.bin', '.so', '.bat', '.cmd', '.msi', '.app', '.deb', '.rpm'}
MAX_FILE_SIZE_MB = 10
MAX_ZIP_SIZE_MB = 20
MAX_EXTRACTED_SIZE_MB = 200  # Prevent ZIP bombs
MAX_FOLDER_DEPTH = 10


class FileManagerError(Exception):
    """Custom exception for file manager errors"""
    pass


def sanitize_path(path: str) -> str:
    """
    Sanitize file path to prevent directory traversal attacks
    
    Args:
        path: File path to sanitize
        
    Returns:
        Sanitized path
        
    Raises:
        FileManagerError: If path contains malicious patterns
    """
    # Remove any absolute path indicators
    path = path.lstrip('/')
    
    # Check for path traversal patterns
    if '..' in path or path.startswith('/'):
        raise FileManagerError(f"Invalid path: {path}")
    
    # Normalize path
    normalized = os.path.normpath(path)
    
    # Double-check for traversal
    if normalized.startswith('..') or normalized.startswith('/'):
        raise FileManagerError(f"Path traversal detected: {path}")
    
    return normalized


def validate_filename(filename: str) -> Tuple[bool, str]:
    """
    Validate filename and extension
    
    Args:
        filename: Name of file to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Get file extension
    ext = os.path.splitext(filename)[1].lower()
    
    # Check blocked extensions
    if ext in BLOCKED_EXTENSIONS:
        return False, f"File type '{ext}' is not allowed for security reasons"
    
    # Check allowed extensions (if extension exists)
    if ext and ext not in ALLOWED_EXTENSIONS:
        return False, f"File type '{ext}' is not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
    
    return True, ""


def get_folder_size(folder_path: str) -> int:
    """
    Calculate total size of folder in KB
    
    Args:
        folder_path: Path to folder
        
    Returns:
        Total size in KB
    """
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(folder_path):
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            if os.path.exists(file_path):
                total_size += os.path.getsize(file_path)
    
    return total_size // 1024  # Convert to KB


def count_files(folder_path: str) -> int:
    """
    Count total files in folder
    
    Args:
        folder_path: Path to folder
        
    Returns:
        Number of files
    """
    count = 0
    for _, _, filenames in os.walk(folder_path):
        count += len(filenames)
    return count


def generate_file_tree(folder_path: str, base_path: str = None) -> Dict:
    """
    Generate JSON tree structure of folder contents
    
    Args:
        folder_path: Path to folder
        base_path: Base path to calculate relative paths
        
    Returns:
        Nested dictionary representing file tree
    """
    if base_path is None:
        base_path = folder_path
    
    tree = {
        'name': os.path.basename(folder_path) or os.path.basename(base_path),
        'type': 'folder',
        'path': os.path.relpath(folder_path, base_path) if folder_path != base_path else '',
        'children': []
    }
    
    try:
        items = sorted(os.listdir(folder_path))
        
        for item in items:
            item_path = os.path.join(folder_path, item)
            relative_path = os.path.relpath(item_path, base_path)
            
            if os.path.isdir(item_path):
                # Recursively add subdirectories
                subtree = generate_file_tree(item_path, base_path)
                tree['children'].append(subtree)
            else:
                # Add file
                file_size = os.path.getsize(item_path)
                tree['children'].append({
                    'name': item,
                    'type': 'file',
                    'path': relative_path,
                    'size': file_size,
                    'extension': os.path.splitext(item)[1]
                })
    except PermissionError:
        pass  # Skip directories we can't read
    
    return tree


def find_yaml_files(folder_path: str) -> List[str]:
    """
    Find all YAML/YML playbook files in folder (excludes role/vars files)
    
    Args:
        folder_path: Path to folder
        
    Returns:
        List of relative paths to YAML playbook files
    """
    yaml_files = []
    
    # Directories to exclude (not playbook files)
    exclude_dirs = ['roles', 'group_vars', 'host_vars', 'vars', 'defaults', 'handlers', 'tasks', 'meta', 'tests']
    
    for root, _, files in os.walk(folder_path):
        # Get relative directory path
        rel_dir = os.path.relpath(root, folder_path)
        
        # Skip if current directory is in exclude list or is inside an excluded directory
        skip_dir = False
        for exclude in exclude_dirs:
            if rel_dir == exclude or rel_dir.startswith(exclude + os.sep) or os.sep + exclude + os.sep in rel_dir:
                skip_dir = True
                break
        
        if skip_dir:
            continue
        
        # Add YAML files from this directory
        for file in files:
            if file.endswith(('.yml', '.yaml')):
                full_path = os.path.join(root, file)
                relative_path = os.path.relpath(full_path, folder_path)
                yaml_files.append(relative_path)
    
    return sorted(yaml_files)


def get_all_files(folder_path: str) -> List[str]:
    """
    Get list of all files in folder (not just YAML)
    
    Args:
        folder_path: Path to folder
        
    Returns:
        List of relative paths to all files
    """
    all_files = []
    
    for root, _, files in os.walk(folder_path):
        for file in files:
            full_path = os.path.join(root, file)
            relative_path = os.path.relpath(full_path, folder_path)
            all_files.append(relative_path)
    
    return sorted(all_files)


def auto_detect_main_playbook(yaml_files: List[str]) -> Optional[str]:
    """
    Auto-detect main playbook file from list of YAML files
    
    Priority:
    1. site.yml or site.yaml
    2. main.yml or main.yaml
    3. playbook.yml or playbook.yaml
    4. First .yml/.yaml file in root directory
    
    Args:
        yaml_files: List of relative paths to YAML files
        
    Returns:
        Path to main playbook or None
    """
    if not yaml_files:
        return None
    
    # Priority filenames
    priority_names = ['site.yml', 'site.yaml', 'main.yml', 'main.yaml', 'playbook.yml', 'playbook.yaml']
    
    # Check for priority names
    for priority in priority_names:
        if priority in yaml_files:
            return priority
    
    # Return first file in root directory
    root_files = [f for f in yaml_files if '/' not in f and '\\' not in f]
    if root_files:
        return root_files[0]
    
    # Fallback to first file
    return yaml_files[0]


def extract_zip(zip_path: str, extract_to: str, max_size_mb: int = MAX_EXTRACTED_SIZE_MB) -> Tuple[bool, str]:
    """
    Extract ZIP file with security validation and auto-flatten single root folder
    
    Args:
        zip_path: Path to ZIP file
        extract_to: Directory to extract to
        max_size_mb: Maximum allowed extracted size in MB
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        # Verify ZIP file
        if not zipfile.is_zipfile(zip_path):
            return False, "Invalid ZIP file"
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Check total extracted size (ZIP bomb protection)
            total_size = sum(info.file_size for info in zip_ref.filelist)
            max_size_bytes = max_size_mb * 1024 * 1024
            
            if total_size > max_size_bytes:
                return False, f"ZIP file too large when extracted ({total_size // 1024 // 1024}MB). Max: {max_size_mb}MB"
            
            # Validate each file
            for info in zip_ref.filelist:
                # Skip directories
                if info.is_dir():
                    continue
                
                # Sanitize filename
                try:
                    sanitized = sanitize_path(info.filename)
                except FileManagerError as e:
                    return False, str(e)
                
                # Validate filename
                is_valid, error_msg = validate_filename(info.filename)
                if not is_valid:
                    return False, f"{info.filename}: {error_msg}"
                
                # Check file size
                if info.file_size > MAX_FILE_SIZE_MB * 1024 * 1024:
                    return False, f"{info.filename} exceeds {MAX_FILE_SIZE_MB}MB limit"
                
                # Check folder depth
                depth = sanitized.count(os.sep)
                if depth > MAX_FOLDER_DEPTH:
                    return False, f"{info.filename} exceeds maximum folder depth ({MAX_FOLDER_DEPTH})"
            
            # Extract all files
            zip_ref.extractall(extract_to)
        
        # Auto-flatten if ZIP has single root folder
        # This handles cases where user zipped "folder/" instead of "folder/*"
        items = os.listdir(extract_to)
        if len(items) == 1:
            single_item = os.path.join(extract_to, items[0])
            if os.path.isdir(single_item):
                # Move everything from the nested folder to extract_to
                import shutil
                temp_dir = extract_to + '_temp'
                shutil.move(single_item, temp_dir)
                shutil.rmtree(extract_to)
                shutil.move(temp_dir, extract_to)
        
        return True, "Extraction successful"
        
    except zipfile.BadZipFile:
        return False, "Corrupted ZIP file"
    except Exception as e:
        return False, f"Extraction failed: {str(e)}"


def read_file_content(file_path: str) -> Tuple[bool, str, str]:
    """
    Read file content
    
    Args:
        file_path: Path to file
        
    Returns:
        Tuple of (success, content, error_message)
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return True, content, ""
    except UnicodeDecodeError:
        # Try binary mode for non-text files
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            return True, f"[Binary file - {len(content)} bytes]", ""
        except Exception as e:
            return False, "", f"Error reading file: {str(e)}"
    except Exception as e:
        return False, "", f"Error reading file: {str(e)}"


def write_file_content(file_path: str, content: str) -> Tuple[bool, str]:
    """
    Write content to file
    
    Args:
        file_path: Path to file
        content: Content to write
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        # Create parent directories if needed
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return True, ""
    except Exception as e:
        return False, f"Error writing file: {str(e)}"


def delete_folder(folder_path: str) -> Tuple[bool, str]:
    """
    Delete folder and all contents
    
    Args:
        folder_path: Path to folder
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        if os.path.exists(folder_path):
            shutil.rmtree(folder_path)
        return True, ""
    except Exception as e:
        return False, f"Error deleting folder: {str(e)}"


def create_zip_from_folder(folder_path: str, zip_path: str) -> Tuple[bool, str]:
    """
    Create ZIP file from folder
    
    Args:
        folder_path: Path to folder to compress
        zip_path: Path where ZIP file should be created
        
    Returns:
        Tuple of (success, error_message)
    """
    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, folder_path)
                    zipf.write(file_path, arcname)
        
        return True, ""
    except Exception as e:
        return False, f"Error creating ZIP: {str(e)}"
