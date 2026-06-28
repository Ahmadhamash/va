import asyncio
import uuid

import pytest
from sqlalchemy import select

from config import settings
from main import app
from middleware.auth_middleware import get_current_admin, get_current_user
from models import ChannelIntegration, User, VoiceSettings


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

    async def fake_sync_reply_result(integration_arg, sender_id, text, db, **kwargs):
        observed.update(
            {
                "integration_id": integration_arg.id,
                "sender_id": sender_id,
                "text": text,
                "channel": kwargs.get("channel"),
                "generate_voice": kwargs.get("generate_voice"),
                "force_voice": kwargs.get("force_voice"),
                "voice_output_format": kwargs.get("voice_output_format"),
            }
        )
        return {"reply": "Hello from AI", "audio_url": None}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}",
        json={"text": "  hi there  ", "subscriber_id": "sub_123"},
        headers={"X-Webhook-Secret": "test-secret"},
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
        "channel": "messenger",
        "generate_voice": False,
        "force_voice": False,
        "voice_output_format": None,
    }


@pytest.mark.asyncio
async def test_manychat_webhook_returns_text_and_voice_dynamic_block(client, db_session, monkeypatch):
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

    observed = {}

    async def fake_sync_reply_result(*_args, **kwargs):
        observed.update(kwargs)
        return {"reply": "Voice reply", "audio_url": "user/reply.mp3"}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)
    monkeypatch.setattr(
        "routers.webhooks._manychat_public_media_url",
        lambda _path: "https://assistant.example.com/reply.mp3",
    )

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}?delivery=text_and_voice",
        json={"text": "hi", "subscriber_id": "sub_123"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json()["content"]["messages"] == [
        {"type": "text", "text": "Voice reply"},
        {"type": "audio", "url": "https://assistant.example.com/reply.mp3"},
    ]
    assert observed["generate_voice"] is True
    assert observed["force_voice"] is True
    assert observed["voice_output_format"] == "mp3"


@pytest.mark.asyncio
async def test_manychat_auto_follows_store_voice_setting(client, db_session, monkeypatch):
    user = _client_user()
    public_id = f"manychat_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials={"webhook_secret": "test-secret"},
        is_active=True,
    )
    voice_settings = VoiceSettings(user_id=user.id, voice_mode="text_and_voice")
    db_session.add_all([user, integration, voice_settings])
    await db_session.commit()

    observed = {}

    async def fake_sync_reply_result(*_args, **kwargs):
        observed.update(kwargs)
        return {"reply": "Auto reply", "audio_url": "user/auto.mp3"}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)
    monkeypatch.setattr(
        "routers.webhooks._manychat_public_media_url",
        lambda _path: "https://assistant.example.com/auto.mp3",
    )

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}?delivery=auto",
        json={"text": "hi", "subscriber_id": "sub_auto"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert [item["type"] for item in response.json()["content"]["messages"]] == [
        "text",
        "audio",
    ]
    assert observed["generate_voice"] is True
    assert observed["force_voice"] is False


@pytest.mark.asyncio
async def test_manychat_auto_text_only_when_voice_off(client, db_session, monkeypatch):
    user = _client_user()
    public_id = f"manychat_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials={"webhook_secret": "test-secret"},
        is_active=True,
    )
    voice_settings = VoiceSettings(user_id=user.id, voice_mode="off")
    db_session.add_all([user, integration, voice_settings])
    await db_session.commit()

    observed = {}

    async def fake_sync_reply_result(*_args, **kwargs):
        observed.update(kwargs)
        return {"reply": "Text only reply", "audio_url": None}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}?delivery=auto",
        json={"text": "hi", "subscriber_id": "sub_text"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json()["content"]["messages"] == [
        {"type": "text", "text": "Text only reply"},
    ]
    assert observed["generate_voice"] is False
    assert observed["force_voice"] is False
    assert observed["voice_output_format"] is None


@pytest.mark.asyncio
async def test_manychat_auto_voice_only_when_always_voice(client, db_session, monkeypatch):
    user = _client_user()
    public_id = f"manychat_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials={"webhook_secret": "test-secret"},
        is_active=True,
    )
    voice_settings = VoiceSettings(user_id=user.id, voice_mode="always_voice")
    db_session.add_all([user, integration, voice_settings])
    await db_session.commit()

    observed = {}

    async def fake_sync_reply_result(*_args, **kwargs):
        observed.update(kwargs)
        return {"reply": "Voice only reply", "audio_url": "user/voice.mp3"}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)
    monkeypatch.setattr(
        "routers.webhooks._manychat_public_media_url",
        lambda _path: "https://assistant.example.com/voice.mp3",
    )

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}?delivery=auto",
        json={"text": "hi", "subscriber_id": "sub_voice"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json()["content"]["messages"] == [
        {"type": "audio", "url": "https://assistant.example.com/voice.mp3"},
    ]
    assert observed["generate_voice"] is True
    assert observed["force_voice"] is False
    assert observed["voice_output_format"] == "mp3"


@pytest.mark.asyncio
async def test_manychat_auto_falls_back_to_text_when_voice_setting_missing(client, db_session, monkeypatch):
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

    observed = {}

    async def fake_sync_reply_result(*_args, **kwargs):
        observed.update(kwargs)
        return {"reply": "Fallback text reply", "audio_url": None}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}?delivery=auto",
        json={"text": "hi", "subscriber_id": "sub_fallback"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json()["content"]["messages"] == [
        {"type": "text", "text": "Fallback text reply"},
    ]
    assert observed["generate_voice"] is False


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

    async def fake_sync_reply_result(*_args, **_kwargs):
        raise AssertionError("sync_reply_result should not run for empty ManyChat pings")

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}",
        json={"text": "   ", "subscriber_id": "sub_123"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    messages = response.json()["content"]["messages"]
    assert len(messages) == 1
    assert messages[0]["type"] == "text"
    assert messages[0]["text"]


@pytest.mark.asyncio
async def test_manychat_webhook_returns_fallback_on_timeout(client, db_session, monkeypatch):
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

    async def slow_sync_reply_result(*_args, **_kwargs):
        await asyncio.sleep(1)
        return {"reply": "late", "audio_url": None}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", slow_sync_reply_result)
    monkeypatch.setattr("routers.webhooks.MANYCHAT_REPLY_TIMEOUT_SECONDS", 0.01)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}",
        json={"text": "hi", "subscriber_id": "sub_timeout"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    messages = response.json()["content"]["messages"]
    assert len(messages) == 1
    assert messages[0]["type"] == "text"
    assert messages[0]["text"]


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
    setup = response.json()
    webhook_url = setup["webhook_url"]
    assert webhook_url.startswith("https://assistant.example.com/api/webhooks/manychat/")
    assert setup["block_type"] == "dynamic_block"
    assert setup["response_format"] == "manychat_dynamic_block_v2"
    assert setup["channels"]["facebook"]["request_url"].endswith(
        "?platform=facebook&response=dynamic&delivery=auto"
    )
    assert setup["channels"]["instagram"]["request_url"].endswith(
        "?platform=instagram&response=dynamic&delivery=auto"
    )
    assert "text_external_request_url" not in setup["channels"]["facebook"]
    assert "voice_request_url" not in setup["channels"]["facebook"]
    assert "text_and_voice_request_url" not in setup["channels"]["facebook"]
    assert setup["channels"]["facebook"]["body"] == {
        "platform": "facebook",
        "subscriber_id": "{{user_id}}",
        "text": "{{last_input_text}}",
    }

    result = await db_session.execute(
        select(ChannelIntegration).where(
            ChannelIntegration.user_id == user_id,
            ChannelIntegration.platform == "webhook",
        )
    )
    integration = result.scalar_one()
    assert integration.public_id in webhook_url
    assert integration.credentials["webhook_secret"]


@pytest.mark.asyncio
async def test_voice_settings_api_saves_voice_mode(client, db_session, monkeypatch):
    user = _client_user()
    db_session.add(user)
    await db_session.commit()

    app.dependency_overrides[get_current_user] = lambda: user

    response = await client.put(
        "/api/voice-settings/",
        json={"voice_mode": "always_voice"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "updated"

    # Verify the saved setting is returned by the GET endpoint.
    get_response = await client.get("/api/voice-settings/")
    assert get_response.status_code == 200
    assert get_response.json()["voice_mode"] == "always_voice"

    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_manychat_auto_voice_when_voice_acts_as_text_for_text_input(
    client, db_session, monkeypatch
):
    """voice_when_voice means 'only if the user sends a voice note'.

    ManyChat forwards normal text messages, so the backend must fall back to
    text-only and NOT generate audio. This prevents store owners from being
    confused when they pick this option for ManyChat.
    """
    user = _client_user()
    public_id = f"manychat_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials={"webhook_secret": "test-secret"},
        is_active=True,
    )
    voice_settings = VoiceSettings(user_id=user.id, voice_mode="voice_when_voice")
    db_session.add_all([user, integration, voice_settings])
    await db_session.commit()

    observed = {}

    async def fake_sync_reply_result(*_args, **kwargs):
        observed.update(kwargs)
        return {"reply": "Text reply", "audio_url": None}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}?delivery=auto",
        json={"text": "hi", "subscriber_id": "sub_voice_when_voice"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert response.json()["content"]["messages"] == [
        {"type": "text", "text": "Text reply"},
    ]
    assert observed["generate_voice"] is False


@pytest.mark.asyncio
async def test_manychat_external_request_does_not_send_audio(
    client, db_session, monkeypatch
):
    """The old External Request URL returns flat JSON and cannot send audio.

    This reproduces the production bug where a store configured with the old
    External Request URL did not receive audio even though voice was enabled.
    """
    user = _client_user()
    public_id = f"manychat_{uuid.uuid4().hex}"
    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=public_id,
        credentials={"webhook_secret": "test-secret"},
        is_active=True,
    )
    voice_settings = VoiceSettings(user_id=user.id, voice_mode="text_and_voice")
    db_session.add_all([user, integration, voice_settings])
    await db_session.commit()

    observed = {}

    async def fake_sync_reply_result(*_args, **kwargs):
        observed.update(kwargs)
        # Real backend would not generate audio when generate_voice=False.
        return {"reply": "Reply without audio", "audio_url": None}

    monkeypatch.setattr("routers.webhooks.sync_reply_result", fake_sync_reply_result)

    response = await client.post(
        f"/api/webhooks/manychat/{public_id}?platform=facebook&response=external",
        json={"text": "hi", "subscriber_id": "sub_external"},
        headers={"X-Webhook-Secret": "test-secret"},
    )

    assert response.status_code == 200
    assert observed["generate_voice"] is False
    assert observed["voice_output_format"] is None
    data = response.json()
    assert data["reply"] == "Reply without audio"
    assert data["has_audio"] is False
    assert data["audio_url"] == ""
