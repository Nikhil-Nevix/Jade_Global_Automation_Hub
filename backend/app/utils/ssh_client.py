"""SSH/SCP helper to retrieve files from remote target servers (paramiko)."""
import os
import paramiko
from typing import Optional


def fetch_remote_file(
    *, ip_address: str, ssh_user: str, ssh_port: int,
    remote_path: str, local_path: str, ssh_key_path: Optional[str] = None,
) -> str:
    """Download a file from a remote server via SFTP. Returns local_path."""
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        connect_kwargs = {
            "hostname": ip_address,
            "port": ssh_port,
            "username": ssh_user,
            "timeout": 30,
        }
        if ssh_key_path and os.path.exists(ssh_key_path):
            connect_kwargs["key_filename"] = ssh_key_path
        client.connect(**connect_kwargs)
        sftp = client.open_sftp()
        try:
            sftp.get(remote_path, local_path)
        finally:
            sftp.close()
        return local_path
    finally:
        client.close()


def _connect(*, ip_address: str, ssh_user: str, ssh_port: int, ssh_key_path: Optional[str]) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    connect_kwargs = {"hostname": ip_address, "port": ssh_port, "username": ssh_user, "timeout": 30}
    if ssh_key_path and os.path.exists(ssh_key_path):
        connect_kwargs["key_filename"] = ssh_key_path
    client.connect(**connect_kwargs)
    return client


def read_remote_file(
    *, ip_address: str, ssh_user: str, ssh_port: int,
    remote_path: str, ssh_key_path: Optional[str] = None,
) -> str:
    """Read a text file from a remote server via SFTP and return its contents.

    Used by the interactive-playbook flow to fetch available_patches_<job>.txt.
    """
    client = _connect(ip_address=ip_address, ssh_user=ssh_user, ssh_port=ssh_port, ssh_key_path=ssh_key_path)
    try:
        sftp = client.open_sftp()
        try:
            with sftp.open(remote_path, "r") as fh:
                return fh.read().decode("utf-8", errors="replace")
        finally:
            sftp.close()
    finally:
        client.close()


def write_remote_file(
    *, ip_address: str, ssh_user: str, ssh_port: int,
    remote_path: str, content: str, ssh_key_path: Optional[str] = None,
) -> None:
    """Write a text file to a remote server via SFTP.

    Used by the interactive-playbook flow to drop selected_patches_<job>.txt,
    unblocking the waiting playbook.
    """
    client = _connect(ip_address=ip_address, ssh_user=ssh_user, ssh_port=ssh_port, ssh_key_path=ssh_key_path)
    try:
        sftp = client.open_sftp()
        try:
            with sftp.open(remote_path, "w") as fh:
                fh.write(content)
        finally:
            sftp.close()
    finally:
        client.close()


def resolve_csv_file(
    *, csv_path: str, ip_address: str, ssh_user: str, ssh_port: int,
    ssh_key_path: Optional[str], local_dir: str,
) -> str:
    """
    Resolve a CSV path that may be local (controller VM) or remote (target server).
    Returns a local filesystem path to the CSV.
    """
    if os.path.isfile(csv_path):
        return csv_path
    # Not present locally — assume it lives on the target server, fetch via SFTP.
    local_path = os.path.join(local_dir, os.path.basename(csv_path))
    return fetch_remote_file(
        ip_address=ip_address, ssh_user=ssh_user, ssh_port=ssh_port,
        remote_path=csv_path, local_path=local_path, ssh_key_path=ssh_key_path,
    )
