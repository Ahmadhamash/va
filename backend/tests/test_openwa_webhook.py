import hashlib
import hmac

from routers.webhooks import (
    _openwa_message,
    _openwa_text_chunks,
    _verify_openwa_signature,
)


def test_openwa_signature_validation():
    secret = "secret"
    raw = b'{"event":"message.received"}'
    digest = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()

    assert _verify_openwa_signature(secret, raw, f"sha256={digest}")
    assert not _verify_openwa_signature(secret, raw, "sha256=bad")
    assert not _verify_openwa_signature(None, raw, f"sha256={digest}")


def test_openwa_message_extracts_nested_data():
    payload = {"event": "message.received", "data": {"chatId": "123@c.us", "body": "hi"}}

    assert _openwa_message(payload) == {"chatId": "123@c.us", "body": "hi"}
    assert _openwa_message({"data": None}) == {}


def test_openwa_text_chunks_limit_messages():
    long_text = "x" * 20000
    chunks = _openwa_text_chunks(long_text)

    assert 1 < len(chunks) <= 4
    assert all(len(chunk) <= 3900 for chunk in chunks)
    assert chunks[-1].endswith("...")
