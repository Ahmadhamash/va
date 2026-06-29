import hashlib
import hmac
from collections.abc import Mapping
from typing import Any


def configured_secret(credentials: Mapping[str, Any] | None, key: str) -> str | None:
    value = (credentials or {}).get(key)
    if value is None:
        return None
    secret = str(value).strip()
    return secret or None


def verify_shared_secret(expected_secret: str, supplied_secret: str | None) -> bool:
    supplied = (supplied_secret or "").strip()
    if not supplied:
        return False
    return hmac.compare_digest(supplied.encode("utf-8"), expected_secret.encode("utf-8"))


def verify_hmac_sha256_signature(
    secret: str, raw_body: bytes, signature_header: str | None
) -> bool:
    signature = (signature_header or "").strip()
    if not signature.startswith("sha256="):
        return False
    supplied = signature.split("=", 1)[1]
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, supplied)
