import uuid

import pytest
from sqlalchemy import select

from models import ChatSession, Message, User
from services.answer_verifier import SAFE_TO_SEND, VerificationResult
from services.ai_chat import AI_PAUSED_REPLY, _verify_and_finalize, process_pending


def _user(**overrides):
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
async def test_process_pending_sends_ai_paused_reply_when_auto_reply_disabled(db_session):
    user = _user(ai_auto_reply_enabled=False)
    session_id = uuid.uuid4()
    session = ChatSession(
        id=session_id,
        user_id=user.id,
        channel="instagram",
        external_user_id="ig_123",
    )
    inbound = Message(
        session_id=session_id,
        role="user",
        content="hi",
        media_type="text",
        processed=False,
    )
    db_session.add_all([user, session, inbound])
    await db_session.commit()

    result = await process_pending(session_id, db_session)

    assert result["reply"] == AI_PAUSED_REPLY
    assert result["channel"] == "instagram"
    assert result["external_user_id"] == "ig_123"
    assert result["action"] == "ai_paused"

    await db_session.refresh(inbound)
    assert inbound.processed is True

    rows = (
        await db_session.execute(
            select(Message).where(
                Message.session_id == session_id,
                Message.role == "assistant",
            )
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].content == AI_PAUSED_REPLY


@pytest.mark.asyncio
async def test_verify_and_finalize_uses_draft_when_humanizer_returns_empty(
    db_session,
    monkeypatch,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.flush()

    async def fake_openai_key(_db):
        return "sk-test"

    async def fake_handoff_enabled(_db):
        return False

    async def fake_style_samples(*_args, **_kwargs):
        return []

    async def fake_prompt_overrides(*_args, **_kwargs):
        return {}

    async def fake_persona_config(*_args, **_kwargs):
        return {}

    async def fake_history(*_args, **_kwargs):
        return []

    class EmptyHumanizer:
        last_usage_call = None

        def __init__(self, *_args, **_kwargs):
            pass

        async def rewrite(self, *_args, **_kwargs):
            return ""

    class SafeVerifier:
        def __init__(self, *_args, **_kwargs):
            pass

        async def verify(self, *_args, **_kwargs):
            return VerificationResult(
                verdict=SAFE_TO_SEND,
                risk_score=0.0,
                reasons=[],
            )

        def drain_usage_calls(self):
            return []

        async def log_verification(self, **_kwargs):
            return None

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fake_openai_key)
    monkeypatch.setattr(
        "services.ai_chat.effective_human_handoff_enabled",
        fake_handoff_enabled,
    )
    monkeypatch.setattr("services.ai_chat.get_style_samples", fake_style_samples)
    monkeypatch.setattr(
        "services.ai_chat.get_client_prompt_overrides",
        fake_prompt_overrides,
    )
    monkeypatch.setattr(
        "services.ai_chat.get_effective_persona_config",
        fake_persona_config,
    )
    monkeypatch.setattr("services.ai_chat.get_session_history", fake_history)
    monkeypatch.setattr("services.ai_chat.HumanizerAgent", EmptyHumanizer)
    monkeypatch.setattr("services.ai_chat.AnswerVerifier", SafeVerifier)

    reply, action, result = await _verify_and_finalize(
        "Grounded answer",
        "customer question",
        {"get_business_info:{}": {"business_info": {"facts": ["x"]}}},
        user,
        session_id,
        db_session,
    )

    assert reply == "Grounded answer"
    assert action == "sent"
    assert result.verdict == SAFE_TO_SEND
