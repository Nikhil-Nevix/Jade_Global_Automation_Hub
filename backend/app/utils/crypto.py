"""
Cryptography Utilities
Handles encryption/decryption of sensitive data (SSH keys, credentials)
"""
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os


class CryptoService:
    """Handles encryption and decryption operations"""
    
    def __init__(self, secret_key=None):
        """
        Initialize crypto service with a secret key
        
        Args:
            secret_key: Base secret key for encryption (from env)
        """
        if secret_key is None:
            secret_key = os.getenv('ENCRYPTION_KEY', 'default-encryption-key-change-in-production')
        
        self.secret_key = secret_key.encode()
        self._fernet = None
    
    def _get_fernet(self):
        """Get or create Fernet instance with derived key"""
        if self._fernet is None:
            # Derive a proper 32-byte key using PBKDF2
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=b'infra-automation-salt',  # In production, use unique salt per installation
                iterations=100000,
                backend=default_backend()
            )
            key = base64.urlsafe_b64encode(kdf.derive(self.secret_key))
            self._fernet = Fernet(key)
        return self._fernet
    
    def encrypt(self, plaintext):
        """
        Encrypt plaintext string
        
        Args:
            plaintext: String to encrypt
        
        Returns:
            Encrypted string (base64 encoded)
        """
        if not plaintext:
            return None
        
        fernet = self._get_fernet()
        encrypted = fernet.encrypt(plaintext.encode())
        return encrypted.decode()
    
    def decrypt(self, ciphertext):
        """
        Decrypt ciphertext string
        
        Args:
            ciphertext: Encrypted string to decrypt
        
        Returns:
            Decrypted plaintext string
        """
        if not ciphertext:
            return None
        
        fernet = self._get_fernet()
        try:
            decrypted = fernet.decrypt(ciphertext.encode())
            return decrypted.decode()
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")
    
    def encrypt_file(self, file_path, output_path=None):
        """
        Encrypt a file (useful for SSH keys)
        
        Args:
            file_path: Path to file to encrypt
            output_path: Optional output path (defaults to file_path + .enc)
        
        Returns:
            Path to encrypted file
        """
        if output_path is None:
            output_path = f"{file_path}.enc"
        
        with open(file_path, 'rb') as f:
            data = f.read()
        
        fernet = self._get_fernet()
        encrypted = fernet.encrypt(data)
        
        with open(output_path, 'wb') as f:
            f.write(encrypted)
        
        return output_path
    
    def decrypt_file(self, file_path, output_path=None):
        """
        Decrypt a file
        
        Args:
            file_path: Path to encrypted file
            output_path: Optional output path
        
        Returns:
            Path to decrypted file
        """
        if output_path is None:
            output_path = file_path.replace('.enc', '')
        
        with open(file_path, 'rb') as f:
            encrypted = f.read()
        
        fernet = self._get_fernet()
        try:
            decrypted = fernet.decrypt(encrypted)
        except Exception as e:
            raise ValueError(f"File decryption failed: {str(e)}")
        
        with open(output_path, 'wb') as f:
            f.write(decrypted)
        
        return output_path


# Global instance
crypto_service = CryptoService()
