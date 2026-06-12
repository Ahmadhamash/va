import uuid

import pytest
from sqlalchemy import select

from config import settings
from main import app
from middleware.auth_middleware import get_current_admin
from models import ChannelIntegration, User


def _client_user(**overrides):
    data = {
        "id": uuid.uuid4(),
        "username": f"client_{uuid.uuid4().hex[:8]}",
        "email": f"client_{uuid.uuid4().hex[:8]}@example.com",
        "hashed_password": "hashed",
        "business_name": "Client Store",
        "role": "client",
        "is_active": True,
    }
    data.update(overrides)
    return User(**data)


@pytest.mark.asyncio
async def test_manychat_webhook_returns_dynamic_block(client, db_session, monkeypatch):
    user = _client_user()
    integration_id = uuid.uuid4()
    public_id = f"manychat_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        id=integration_id,
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials={"webhook_secret": "test-secret"},
        is_active=True,
    )
    db_session.add_all([user, integration])
    await db_session.commit()

    observed = {}

    async def fake_sync_reply(integration_arg, sender_id, text, db):
        observed.update(
            {
                "integration_id": integration_arg.id,
                "sender_id": sender_id,
                "text": text,
            }
        )
        return "Hello from AI"

    monkeypatch.setattr("routers.webhooks.sync_reply", fake_sync_reply)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}",
        json={"text": "  hi there  ", "subscriber_id": "sub_123"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "version": "v2",
        "content": {
            "messages": [
                {
                    "type": "text",
                    "text": "Hello from AI",
                }
            ]
        },
    }
    assert observed == {
        "integration_id": integration_id,
        "sender_id": "sub_123",
        "text": "hi there",
    }


@pytest.mark.asyncio
async def test_manychat_webhook_ignores_empty_text(client, db_session, monkeypatch):
    user = _client_user()
    public_id = f"manychat_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials={"webhook_secret": "test-secret"},
        is_active=True,
    )
    db_session.add_all([user, integration])
    await db_session.commit()

    async def fake_sync_reply(*_args, **_kwargs):
        raise AssertionError("sync_reply should not run for empty ManyChat pings")

    monkeypatch.setattr("routers.webhooks.sync_reply", fake_sync_reply)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}",
        json={"text": "   ", "subscriber_id": "sub_123"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "version": "v2",
        "content": {
            "messages": [],
        },
    }


@pytest.mark.asyncio
async def test_admin_generates_manychat_https_webhook(client, db_session, monkeypatch):
    admin = User(
        id=uuid.uuid4(),
        username="admin",
        email="admin@example.com",
        hashed_password="hashed",
        role="admin",
        is_active=True,
    )
    user = _client_user()
    user_id = user.id
    db_session.add_all([admin, user])
    await db_session.commit()

    app.dependency_overrides[get_current_admin] = lambda: admin
    monkeypatch.setattr(settings, "DOMAIN", "assistant.example.com")

    response = await client.post(f"/api/admin/clients/{user_id}/manychat-webhook")

    assert response.status_code == 200
    webhook_url = response.json()["webhook_url"]
    assert webhook_url.startswith("https://assistant.example.com/api/webhooks/manychat/")

    result = await db_session.execute(
        select(ChannelIntegration).where(
            ChannelIntegration.user_id == user_id,
            ChannelIntegration.platform == "webhook",
        )
    )
    integration = result.scalar_one()
    assert integration.public_id in webhook_url
    assert integration.credentials["webhook_secret"]
