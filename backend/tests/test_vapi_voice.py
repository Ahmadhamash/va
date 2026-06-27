import uuid

import pytest
from fastapi import status
from httpx import AsyncClient
from sqlalchemy import select

from main import app
from middleware.auth_middleware import get_current_user
from models import Item, User, VapiCallSettings, VoiceCall, VoiceToolCall
from services.vapi_voice import VapiCallContext, build_assistant_response


def _voice_context(assistant_id: str | None = None) -> VapiCallContext:
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        username="voice_prompt_client",
        email="voice-prompt-client@example.com",
        hashed_password="hashed",
        role="client",
        business_name="Voice Store",
    )
    settings = VapiCallSettings(
        user_id=user_id,
        public_id="voice_prompt_public",
        enabled=True,
        assistant_id=assistant_id,
        language="ar",
        dialect="Jordanian",
        model_provider="openai",
        model_name="gpt-4o",
        handoff_phone="",
        business_hours="",
    )
    return VapiCallContext(
        settings=settings,
        user=user,
        user_id=user_id,
        business_name=user.business_name,
        payment_methods={},
        voice_call=None,
        voice_call_id=None,
        chat_session_id=None,
        message={},
        call_id="call_prompt_test",
        prompt_overrides={
            "voice_prompt": "VOICE CUSTOM for {business_name} in {dialect}."
        },
    )


def test_vapi_assistant_id_receives_prompt_variable():
    response = build_assistant_response(_voice_context(assistant_id="asst_prompt"))

    variable_values = response["assistantOverrides"]["variableValues"]
    assert response["assistantId"] == "asst_prompt"
    assert variable_values["voice_prompt"] == "VOICE CUSTOM for Voice Store in Jordanian."


def test_vapi_inline_assistant_uses_prompt_override():
    response = build_assistant_response(_voice_context())

    system_message = response["assistant"]["model"]["messages"][0]["content"]
    assert system_message == "VOICE CUSTOM for Voice Store in Jordanian."


@pytest.mark.asyncio
async def test_call_settings_are_created_for_client(client: AsyncClient, db_session):
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        username="voice_calls_client",
        email="voice-calls-client@example.com",
        hashed_password="hashed",
        role="client",
        business_name="Amman Store",
    )
    db_session.add(user)
    await db_session.commit()

    current_user = User(
        id=user_id,
        username="voice_calls_client",
        email="voice-calls-client@example.com",
        hashed_password="hashed",
        role="client",
        business_name="Amman Store",
    )
    app.dependency_overrides[get_current_user] = lambda: current_user

    response = await client.get("/api/calls/settings")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["enabled"] is False
    assert data["public_id"]
    assert data["webhook_url"].endswith(f"/api/vapi/webhook/{data['public_id']}")

    update = await client.put(
        "/api/calls/settings",
        json={
            "enabled": True,
            "assistant_id": "asst_test",
            "phone_number_id": "phone_test",
            "dialect": "Jordanian / Levantine",
        },
    )
    assert update.status_code == status.HTTP_200_OK
    assert update.json()["enabled"] is True
    assert update.json()["assistant_id"] == "asst_test"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_vapi_tool_calls_are_scoped_by_webhook_owner(client: AsyncClient, db_session):
    owner_id = uuid.uuid4()
    other_id = uuid.uuid4()
    owner = User(
        id=owner_id,
        username="voice_owner",
        email="voice-owner@example.com",
        hashed_password="hashed",
        role="client",
        business_name="Owner Store",
    )
    other = User(
        id=other_id,
        username="voice_other",
        email="voice-other@example.com",
        hashed_password="hashed",
        role="client",
        business_name="Other Store",
    )
    db_session.add_all([owner, other])
    await db_session.flush()

    settings = VapiCallSettings(
        user_id=owner_id,
        public_id="voice_public_owner",
        enabled=True,
        assistant_id="asst_owner",
        phone_number_id="phone_owner",
    )
    db_session.add(settings)
    db_session.add_all(
        [
            Item(
                user_id=owner_id,
                name="Owner Red Shoes",
                category="shoes",
                price=42,
                currency="JOD",
                available=True,
            ),
            Item(
                user_id=other_id,
                name="Other Red Shoes",
                category="shoes",
                price=99,
                currency="JOD",
                available=True,
            ),
        ]
    )
    await db_session.commit()

    response = await client.post(
        "/api/vapi/webhook/voice_public_owner",
        json={
            "message": {
                "type": "tool-calls",
                "call": {
                    "id": "call_scope_test",
                    "assistantId": "asst_owner",
                    "phoneNumberId": "phone_owner",
                    "customer": {"number": "+962790000000"},
                },
                "toolCallList": [
                    {
                        "id": "tool_scope_1",
                        "name": "search_products",
                        "arguments": {
                            "tenant_id": str(other_id),
                            "query": "Red Shoes",
                            "max_results": 5,
                        },
                    }
                ],
            }
        },
    )

    assert response.status_code == status.HTTP_200_OK
    payload = response.json()
    result = payload["results"][0]["result"]
    names = [item["product_name"] for item in result["items"]]
    assert "Owner Red Shoes" in names
    assert "Other Red Shoes" not in names

    call = (
        await db_session.execute(
            select(VoiceCall).where(VoiceCall.vapi_call_id == "call_scope_test")
        )
    ).scalar_one()
    assert call.user_id == owner_id

    audit = (
        await db_session.execute(
            select(VoiceToolCall).where(VoiceToolCall.tool_call_id == "tool_scope_1")
        )
    ).scalar_one()
    assert audit.user_id == owner_id
