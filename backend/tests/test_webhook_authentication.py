import hashlib
import hmac
import json
import uuid

import pytest

from main import app
from middleware.auth_middleware import get_current_user
from models import ChannelIntegration, User


def _client_user(**overrides):
    data = {
        "id": uuid.uuid4(),
        "username": f"webhook_auth_{uuid.uuid4().hex[:8]}",
        "email": f"webhook_auth_{uuid.uuid4().hex[:8]}@example.com",
        "hashed_password": "hashed",
        "business_name": "Webhook Auth Store",
        "role": "client",
        "is_active": True,
    }
    data.update(overrides)
    return User(**data)


async def _create_webhook_integration(db_session, credentials: dict) -> tuple[User, str]:
    user = _client_user()
    public_id = f"webhook_auth_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials=credentials,
        is_active=True,
    )
    db_session.add_all([user, integration])
    await db_session.commit()
    return user, public_id


@pytest.mark.asyncio
async def test_generic_webhook_rejects_missing_configured_secret(
    client, db_session, monkeypatch
):
    _, public_id = await _create_webhook_integration(db_session, {})

    async def fake_sync_reply(*_args, **_kwargs):
        raise AssertionError("sync_reply must not run for unauthenticated webhooks")

    monkeypatch.setattr("routers.webhooks.sync_reply", fake_sync_reply)

    response = await client.post(
        f"/api/webhooks/generic/{public_id}",
        json={"sender_id": "customer", "message": "hi"},
        headers={"X-Webhook-Secret": "anything"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Webhook authentication is not configured"


@pytest.mark.asyncio
async def test_generic_webhook_requires_matching_secret(client, db_session, monkeypatch):
    _, public_id = await _create_webhook_integration(
        db_session, {"webhook_secret": "test-secret"}
    )

    async def fake_sync_reply(_integration, sender_id, text, _db, **_kwargs):
        assert sender_id == "customer"
        assert text == "hi"
        return "authenticated reply"

    monkeypatch.setattr("routers.webhooks.sync_reply", fake_sync_reply)

    missing = await client.post(
        f"/api/webhooks/generic/{public_id}",
        json={"sender_id": "customer", "message": "hi"},
    )
    wrong = await client.post(
        f"/api/webhooks/generic/{public_id}",
        json={"sender_id": "customer", "message": "hi"},
        headers={"X-Webhook-Secret": "wrong"},
    )
    valid = await client.post(
        f"/api/webhooks/generic/{public_id}",
        json={"sender_id": "customer", "message": "hi"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert missing.status_code == 403
    assert wrong.status_code == 403
    assert valid.status_code == 200
    assert valid.json() == {"reply": "authenticated reply"}


@pytest.mark.asyncio
async def test_manychat_rejects_body_secret_without_header(
    client, db_session, monkeypatch
):
    _, public_id = await _create_webhook_integration(
        db_session, {"webhook_secret": "test-secret"}
    )

    async def fake_sync_reply_result(*_args, **_kwargs):
        raise AssertionError("ManyChat reply must not run without header auth")

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}",
        json={
            "subscriber_id": "sub_123",
            "text": "hi",
            "webhook_secret": "test-secret",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Invalid secret"


@pytest.mark.asyncio
async def test_openwa_rejects_missing_configured_signature_secret(
    client, db_session, monkeypatch
):
    _, public_id = await _create_webhook_integration(db_session, {"webhook_secret": "x"})
    monkeypatch.setattr("routers.webhooks.settings.OPENWA_WEBHOOK_SECRET", "legacy-global")

    payload = {"event": "message.received", "data": {"chatId": "123@c.us", "body": "hi"}}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    digest = hmac.new(b"legacy-global", raw, hashlib.sha256).hexdigest()

    response = await client.post(
        f"/api/webhooks/openwa/{public_id}",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "X-OpenWA-Signature": f"sha256={digest}",
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Webhook authentication is not configured"


@pytest.mark.asyncio
async def test_openwa_accepts_valid_per_integration_hmac_signature(
    client, db_session, monkeypatch
):
    _, public_id = await _create_webhook_integration(
        db_session,
        {
            "webhook_secret": "generic-secret",
            "openwa_webhook_secret": "openwa-secret",
            "openwa_session_id": "session-1",
        },
    )

    observed = {}

    async def fake_sync_reply(_integration, sender_id, text, _db, **kwargs):
        observed["sender_id"] = sender_id
        observed["text"] = text
        observed["channel"] = kwargs.get("channel")
        return "hello from ai"

    async def fake_send_openwa_reply(credentials, session_id, chat_id, reply):
        observed["send"] = {
            "session_id": session_id,
            "chat_id": chat_id,
            "reply": reply,
            "secret": credentials["openwa_webhook_secret"],
        }

    monkeypatch.setattr("routers.webhooks.sync_reply", fake_sync_reply)
    monkeypatch.setattr("routers.webhooks._send_openwa_reply", fake_send_openwa_reply)

    payload = {
        "event": "message.received",
        "sessionId": "session-1",
        "data": {
            "fromMe": False,
            "isGroup": False,
            "chatId": "123@c.us",
            "body": "hi",
        },
    }
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    digest = hmac.new(b"openwa-secret", raw, hashlib.sha256).hexdigest()

    response = await client.post(
        f"/api/webhooks/openwa/{public_id}",
        content=raw,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": f"sha256={digest}",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert observed == {
        "sender_id": "123@c.us",
        "text": "hi",
        "channel": "whatsapp",
        "send": {
            "session_id": "session-1",
            "chat_id": "123@c.us",
            "reply": "hello from ai",
            "secret": "openwa-secret",
        },
    }


@pytest.mark.asyncio
async def test_channel_create_generates_blank_webhook_secret(client, db_session):
    user = _client_user()
    db_session.add(user)
    await db_session.flush()
    app.dependency_overrides[get_current_user] = lambda: user

    try:
        response = await client.post(
            "/api/channels",
            json={"platform": "webhook", "credentials": {"webhook_secret": ""}},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["setup_values"]["webhook_secret"]
        assert data["endpoints"]["note"].endswith("configured X-Webhook-Secret header.")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
