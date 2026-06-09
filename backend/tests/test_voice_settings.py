import pytest
import uuid
import json
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import status
from httpx import AsyncClient, ASGITransport
from main import app
from database import get_db
from middleware.auth_middleware import get_current_user
from models import User, UserSubscription, SubscriptionTier, VoiceSettings

@pytest.mark.asyncio
async def test_list_voice_options_filtering(client: AsyncClient, db_session):
    user_id = uuid.uuid4()
    other_user_id = uuid.uuid4()
    
    current_user = User(
        id=user_id,
        username="voice_user",
        email="voice@example.com",
        hashed_password="somepassword",
        role="client",
    )
    db_session.add(current_user)
    await db_session.commit()
    await db_session.refresh(current_user)
    db_session.expunge(current_user)

    app.dependency_overrides[get_current_user] = lambda: current_user

    # Mock responses for ElevenLabs APIs
    mock_voices_response = {
        "voices": [
            # 1. Matching user_id clone (non-Arabic) -> Should be included because always return user's cloned voices
            {
                "voice_id": "user_clone_non_arabic",
                "name": "My Clone Non-Arabic",
                "category": "cloned",
                "language": "en",
                "labels": {"user_id": str(user_id)}
            },
            # 2. Matching user_id clone (Arabic) -> Should be included
            {
                "voice_id": "user_clone_arabic",
                "name": "My Clone Arabic",
                "category": "cloned",
                "language": "ar",
                "labels": {"user_id": str(user_id)}
            },
            # 3. Mismatching user_id clone -> Should be filtered out
            {
                "voice_id": "other_clone",
                "name": "Other Clone",
                "category": "cloned",
                "language": "ar",
                "labels": {"user_id": str(other_user_id)}
            },
            # 4. Public/shared Arabic voice -> Should be included
            {
                "voice_id": "public_arabic",
                "name": "Public Arabic",
                "category": "premade",
                "language": "ar",
                "labels": {}
            },
            # 5. Public/shared English voice -> Should be filtered out (not Arabic, no matching user_id)
            {
                "voice_id": "public_english",
                "name": "Public English",
                "category": "premade",
                "language": "en",
                "labels": {}
            }
        ]
    }

    mock_shared_response = {
        "voices": []
    }

    # Mock httpx responses
    mock_resp_account = MagicMock()
    mock_resp_account.status_code = 200
    mock_resp_account.json.return_value = mock_voices_response

    mock_resp_library = MagicMock()
    mock_resp_library.status_code = 200
    mock_resp_library.json.return_value = mock_shared_response

    mock_client = MagicMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.get = AsyncMock(side_effect=[mock_resp_account, mock_resp_library])

    with patch("routers.voice_settings.env_settings.ELEVENLABS_API_KEY", "fake_key"), \
         patch("httpx.AsyncClient", return_value=mock_client):
         
         response = await client.get("/api/voice-settings/voices")
         assert response.status_code == 200
         data = response.json()
         
         el_voices = data["elevenlabs"]
         voice_ids = [v["voice_id"] for v in el_voices]
         
         # "user_clone_non_arabic" must be present (user's cloned voice, bypasses Arabic check)
         assert "user_clone_non_arabic" in voice_ids
         # "user_clone_arabic" must be present
         assert "user_clone_arabic" in voice_ids
         # "public_arabic" must be present
         assert "public_arabic" in voice_ids
         # "other_clone" must NOT be present (wrong user_id)
         assert "other_clone" not in voice_ids
         # "public_english" must NOT be present (not Arabic, not user cloned)
         assert "public_english" not in voice_ids

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_voice_cloning_subscription_checks(client: AsyncClient, db_session):
    with patch("routers.voice_settings.env_settings.ELEVENLABS_API_KEY", "fake_key"):
        user_id = uuid.uuid4()
        
        current_user = User(
            id=user_id,
            username="voice_user_unpaid",
            email="voice_unpaid@example.com",
            hashed_password="somepassword",
            role="client",
        )
        db_session.add(current_user)
        
        settings = VoiceSettings(
            user_id=user_id,
            voice_mode="off",
            tts_provider="openai",
            preferred_voice="nova"
        )
        db_session.add(settings)
        await db_session.commit()
        await db_session.refresh(current_user)

        app.dependency_overrides[get_current_user] = lambda: current_user

        # 1. Test clone voice fails (402 Payment Required) for unpaid user
        res_clone = await client.post(
            "/api/voice-settings/clone",
            data={"name": "Test Clone", "description": "unpaid user test"},
            files=[("files", ("sample.wav", b"dummy audio content", "audio/wav"))]
        )
        assert res_clone.status_code == status.HTTP_402_PAYMENT_REQUIRED
        assert "Voice cloning is available on paid plans only" in res_clone.text

        # 2. Test update voice settings checks block paid features
        res_update_el = await client.put(
            "/api/voice-settings/",
            json={"tts_provider": "elevenlabs"}
        )
        assert res_update_el.status_code == status.HTTP_402_PAYMENT_REQUIRED
        assert "ElevenLabs TTS is available on paid plans only" in res_update_el.text

        res_update_voice = await client.put(
            "/api/voice-settings/",
            json={"preferred_voice": "el_some_voice_id"}
        )
        assert res_update_voice.status_code == status.HTTP_402_PAYMENT_REQUIRED
        assert "ElevenLabs voices are available on paid plans only" in res_update_voice.text

        # Now assign paid subscription
        tier = SubscriptionTier(
            id=uuid.uuid4(),
            name="Premium Pro",
            price_monthly=19.99,
            features={"voice_cloning": True}
        )
        db_session.add(tier)
        await db_session.flush()

        sub = UserSubscription(
            user_id=user_id,
            tier_id=tier.id,
            status="active"
        )
        db_session.add(sub)
        await db_session.commit()

        # Verify that updating voice settings now succeeds
        res_update_success = await client.put(
            "/api/voice-settings/",
            json={"tts_provider": "elevenlabs", "preferred_voice": "el_some_voice_id"}
        )
        assert res_update_success.status_code == 200
        assert res_update_success.json()["status"] == "updated"

        # Verify that clone voice proceeds to ElevenLabs call instead of blocking at subscription check
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"voice_id": "new_cloned_voice_id"}
        
        mock_client = MagicMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None
        mock_client.post = AsyncMock(return_value=mock_resp)

        with patch("httpx.AsyncClient", return_value=mock_client):
             
             res_clone_success = await client.post(
                 "/api/voice-settings/clone",
                 data={"name": "Test Clone", "description": "paid user test"},
                 files=[("files", ("sample.wav", b"dummy audio content", "audio/wav"))]
             )
             assert res_clone_success.status_code == 200
             data = res_clone_success.json()
             assert data["success"] is True
             assert data["voice_id"] == "new_cloned_voice_id"

    app.dependency_overrides.clear()
