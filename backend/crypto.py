import base64
import hashlib
import json
import logging

from cryptography.fernet import Fernet
from sqlalchemy.types import TypeDecorator, Text

from config import settings

logger = logging.getLogger("crypto")

# Derive a 32-byte URL-safe base64-encoded key from SECRET_KEY for Fernet
_secret_key = settings.SECRET_KEY.encode('utf-8')
_fernet_key = base64.urlsafe_b64encode(hashlib.sha256(_secret_key).digest())
fernet = Fernet(_fernet_key)

class EncryptedString(TypeDecorator):
    """Encrypts string fields in the database."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect) -> str | None:
        if not value:
            return value
        return fernet.encrypt(value.encode('utf-8')).decode('utf-8')

    def process_result_value(self, value: str | None, dialect) -> str | None:
        if not value:
            return value
        try:
            return fernet.decrypt(value.encode('utf-8')).decode('utf-8')
        except Exception:
            # Fallback for existing plaintext data
            return value

class EncryptedJSONB(TypeDecorator):
    """Encrypts JSON dictionaries. Stored as Text in DB, behaves as dict in app."""
    impl = Text
    cache_ok = True

    def process_bind_param(self, value: dict | None, dialect) -> str | None:
        if value is None:
            return None
        json_str = json.dumps(value)
        return fernet.encrypt(json_str.encode('utf-8')).decode('utf-8')

    def process_result_value(self, value: str | None, dialect) -> dict | None:
        if value is None:
            return None
        try:
            decrypted = fernet.decrypt(value.encode('utf-8')).decode('utf-8')
            return json.loads(decrypted)
        except Exception:
            # Fallback for existing plaintext JSON
            try:
                return json.loads(value)
            except Exception:
                return {}
