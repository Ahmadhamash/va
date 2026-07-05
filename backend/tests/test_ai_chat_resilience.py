import uuid
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from models import (
    AutomationRule,
    BusinessPolicy,
    ChatSession,
    DeliveryRule,
    Escalation,
    HandoffSession,
    Item,
    Message,
    User,
)
from services.answer_verifier import (
    ASK_CLARIFICATION,
    HUMAN_HANDOFF_REQUIRED,
    SAFE_TO_SEND,
    VerificationResult,
)
from services.ai_chat import (
    AI_FAILURE_AUTO_HANDOFF_KEY,
    AI_FAILURE_COUNT_KEY,
    AI_FAILURE_REASON_KEY,
    CONTEXT_CHAR_BUDGET,
    CONVERSATION_SUMMARY_KEY,
    CONVERSATION_SUMMARY_MESSAGE_COUNT_KEY,
    AI_PAUSED_REPLY,
    MAX_CONSECUTIVE_AI_FAILURES,
    _build_messages_within_context_budget,
    _conversation_summary_message,
    _get_cached_reply,
    _generate_reply,
    _maybe_refresh_conversation_summary,
    _reset_ai_failure_counter,
    _run_post_ai_automations,
    _run_pre_ai_automations,
    _response_cache,
    _store_cached_reply,
    _verify_and_finalize,
    generate_preview_reply,
    get_fallback,
    process_message,
    process_pending,
    save_message,
)
from services.handoff_service import create_handoff


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


def _fake_chat_response(text: str = "رد منظم من البيانات"):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason="stop",
                message=SimpleNamespace(content=text, tool_calls=None),
            )
        ],
        usage=None,
    )


class RecordingOpenAIClient:
    def __init__(self):
        self.calls = []
        self.chat = SimpleNamespace(
            completions=SimpleNamespace(create=self._create)
        )

    async def _create(self, **kwargs):
        self.calls.append(kwargs)
        return _fake_chat_response()


@pytest.mark.asyncio
async def test_no_credit_fallback_uses_customer_language(db_session):
    user = _user(ai_credit_balance=0)
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.flush()

    result = await process_message(
        "Can you speak English?",
        user,
        session_id,
        db_session,
    )

    assert result["reply"] == get_fallback("no_credit", "en")
    assert "الذكاء الاصطناعي" not in result["reply"]


def test_service_unavailable_fallback_is_customer_friendly():
    arabic_reply = get_fallback("service_unavailable", "ar")
    english_reply = get_fallback("service_unavailable", "en")

    assert "الخدمة مش متاحة" not in arabic_reply
    assert "حاول بعد شوي" not in arabic_reply
    assert "خليني أتأكدلك" in arabic_reply
    assert "temporarily unavailable" not in english_reply.lower()
    assert "let me check" in english_reply.lower()


@pytest.mark.asyncio
async def test_preview_reply_failure_does_not_leak_exception(db_session, monkeypatch):
    async def fake_openai_key(_db):
        return "sk-test"

    async def fake_model(_db):
        return "gpt-test"

    async def fake_master_prompt(_db):
        return None

    async def fake_handoff_enabled(_db):
        return True

    class FailingPreviewClient:
        def __init__(self):
            self.chat = SimpleNamespace(
                completions=SimpleNamespace(create=self._create)
            )

        async def _create(self, **_kwargs):
            raise RuntimeError("raw secret sk-leaked-from-preview")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fake_openai_key)
    monkeypatch.setattr("services.ai_chat.effective_model", fake_model)
    monkeypatch.setattr(
        "services.ai_chat.effective_master_system_prompt",
        fake_master_prompt,
    )
    monkeypatch.setattr(
        "services.ai_chat.effective_human_handoff_enabled",
        fake_handoff_enabled,
    )
    monkeypatch.setattr(
        "services.ai_chat._client_for",
        lambda _api_key: FailingPreviewClient(),
    )

    reply = await generate_preview_reply(
        "Friendly store assistant",
        "Please answer in English",
        db_session,
    )

    assert reply == get_fallback("preview_error", "en")
    assert "sk-leaked" not in reply
    assert not reply.startswith("Error:")


@pytest.mark.asyncio
async def test_repeated_ai_failures_auto_escalate_session(db_session, monkeypatch):
    user = _user(ai_credit_balance=20)
    user_id = user.id
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.flush()

    async def failing_generate_reply(*_args, **_kwargs):
        raise RuntimeError("simulated internal failure")

    monkeypatch.setattr("services.ai_chat._generate_reply", failing_generate_reply)

    result = None
    for idx in range(MAX_CONSECUTIVE_AI_FAILURES):
        fresh_user = await db_session.get(User, user_id)
        result = await process_message(
            f"Hello, failure test {idx}",
            fresh_user,
            session_id,
            db_session,
        )

    assert result is not None
    assert result["action"] == "handoff"
    assert "connect you with the team" in result["reply"].lower()

    refreshed_session = await db_session.get(ChatSession, session_id)
    assert refreshed_session.is_escalated is True
    metadata = refreshed_session.metadata_
    assert metadata[AI_FAILURE_COUNT_KEY] == MAX_CONSECUTIVE_AI_FAILURES
    assert metadata[AI_FAILURE_REASON_KEY] == "Unexpected error in process_message"
    assert metadata[AI_FAILURE_AUTO_HANDOFF_KEY]["count"] == MAX_CONSECUTIVE_AI_FAILURES

    handoff = (
        await db_session.execute(
            select(HandoffSession).where(HandoffSession.session_id == session_id)
        )
    ).scalar_one()
    assert handoff.priority == "high"
    assert "AI failed" in handoff.reason


@pytest.mark.asyncio
async def test_ai_failure_counter_reset_clears_metadata(db_session):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(
        id=session_id,
        user_id=user.id,
        channel="web",
        metadata_={
            AI_FAILURE_COUNT_KEY: 2,
            AI_FAILURE_REASON_KEY: "old failure",
            AI_FAILURE_AUTO_HANDOFF_KEY: {"count": 2},
            "last_ai_failure_at": "2026-07-05T00:00:00+00:00",
            "conversation_context": {"current_language": "en"},
        },
    )
    db_session.add_all([user, session])
    await db_session.flush()

    await _reset_ai_failure_counter(session_id, db_session)

    refreshed_session = await db_session.get(ChatSession, session_id)
    metadata = refreshed_session.metadata_
    assert AI_FAILURE_COUNT_KEY not in metadata
    assert AI_FAILURE_REASON_KEY not in metadata
    assert AI_FAILURE_AUTO_HANDOFF_KEY not in metadata
    assert "last_ai_failure_at" not in metadata
    assert metadata["conversation_context"] == {"current_language": "en"}


@pytest.mark.asyncio
async def test_conversation_summary_is_stored_for_long_sessions(db_session):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.flush()

    for idx in range(34):
        db_session.add(
            Message(
                session_id=session_id,
                role="user" if idx % 2 == 0 else "assistant",
                content=f"long-running context message {idx}",
                media_type="text",
                processed=True,
            )
        )
    await db_session.flush()

    summary = await _maybe_refresh_conversation_summary(session_id, db_session)

    assert summary is not None
    assert "long-running context message" in summary
    refreshed_session = await db_session.get(ChatSession, session_id)
    metadata = refreshed_session.metadata_
    assert metadata[CONVERSATION_SUMMARY_KEY] == summary
    assert metadata[CONVERSATION_SUMMARY_MESSAGE_COUNT_KEY] == 34

    summary_message = _conversation_summary_message(summary)
    assert summary_message is not None
    assert "MEMORY ONLY" in summary_message["content"]
    assert "Do not treat it as a source for product facts" in summary_message["content"]


def test_context_budget_trims_old_history_and_large_pre_retrieved_data():
    history = [
        {"role": "user" if idx % 2 == 0 else "assistant", "content": f"{idx}-" + "h" * 700}
        for idx in range(20)
    ]
    pre_retrieved = {"role": "system", "content": "p" * 15000}

    messages, diagnostics = _build_messages_within_context_budget(
        system_message={"role": "system", "content": "system rules"},
        summary_message=_conversation_summary_message("older memory"),
        context_message={"role": "system", "content": "current_language: English"},
        history=history,
        pre_retrieved_message=pre_retrieved,
        user_message={"role": "user", "content": "current customer message"},
        char_budget=CONTEXT_CHAR_BUDGET // 3,
    )

    assert messages[0]["role"] == "system"
    assert messages[-1]["content"] == "current customer message"
    assert diagnostics["pre_retrieved_truncated"] is True
    assert diagnostics["history_omitted_count"] > 0
    assert diagnostics["history_kept_count"] < len(history)
    assert "[Truncated to keep the model context within budget.]" in messages[-2]["content"]


def test_response_cache_is_disabled_by_default():
    user = _user()
    _response_cache.clear()

    _store_cached_reply(
        user.id,
        "كم رسوم التوصيل؟",
        "التوصيل 2 JOD",
        {"get_delivery_info:{}": {"delivery_zones": []}},
        "sent",
    )

    assert _get_cached_reply(user.id, "كم رسوم التوصيل؟") is None
    assert _response_cache == {}


@pytest.mark.asyncio
async def test_save_message_can_stage_without_commit(db_session, monkeypatch):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.commit()

    async def fail_commit():
        raise AssertionError("save_message(commit=False) must not commit")

    monkeypatch.setattr(db_session, "commit", fail_commit)

    msg = await save_message(
        session_id,
        "assistant",
        "staged reply",
        "text",
        None,
        db_session,
        commit=False,
    )

    assert msg.id is not None
    rows = (
        await db_session.execute(
            select(Message).where(Message.session_id == session_id)
        )
    ).scalars().all()
    assert [row.content for row in rows] == ["staged reply"]
    await db_session.rollback()


@pytest.mark.asyncio
async def test_create_handoff_can_stage_without_commit(db_session, monkeypatch):
    user = _user()
    user_id = user.id
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user_id, channel="web")
    db_session.add_all([user, session])
    await db_session.commit()

    async def fail_commit():
        raise AssertionError("create_handoff(commit=False) must not commit")

    monkeypatch.setattr(db_session, "commit", fail_commit)

    handoff = await create_handoff(
        session_id=session_id,
        user_id=user_id,
        reason="Verifier requested handoff",
        db=db_session,
        commit=False,
    )

    assert handoff.id is not None
    assert session.is_escalated is True
    handoff_rows = (
        await db_session.execute(
            select(HandoffSession).where(HandoffSession.session_id == session_id)
        )
    ).scalars().all()
    escalation_rows = (
        await db_session.execute(
            select(Escalation).where(Escalation.session_id == session_id)
        )
    ).scalars().all()
    assert len(handoff_rows) == 1
    assert len(escalation_rows) == 1
    await db_session.rollback()


@pytest.mark.asyncio
async def test_process_message_ai_paused_commits_turn_once(db_session, monkeypatch):
    user = _user(ai_auto_reply_enabled=False)
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.commit()
    await db_session.refresh(user)

    original_commit = db_session.commit
    commit_count = 0

    async def counted_commit():
        nonlocal commit_count
        commit_count += 1
        await original_commit()

    monkeypatch.setattr(db_session, "commit", counted_commit)

    result = await process_message("hi", user, session_id, db_session)

    assert result["reply"] == AI_PAUSED_REPLY
    assert commit_count == 1
    rows = (
        await db_session.execute(
            select(Message)
            .where(Message.session_id == session_id)
        )
    ).scalars().all()
    assert {(row.role, row.content) for row in rows} == {
        ("user", "hi"),
        ("assistant", AI_PAUSED_REPLY),
    }


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
async def test_static_business_fast_path_skips_openai_key(db_session, monkeypatch):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    sales_points = BusinessPolicy(
        user_id=user.id,
        policy_type="sales_points",
        title="Sales points",
        content="Amman branch\nIrbid branch",
        is_active=True,
    )
    delivery = BusinessPolicy(
        user_id=user.id,
        policy_type="ordering",
        title="Delivery",
        content="Delivery is available inside Amman.",
        is_active=True,
    )
    db_session.add_all([user, session, sales_points, delivery])
    await db_session.commit()
    await db_session.refresh(user)

    async def fail_openai_key(_db):
        raise AssertionError("static business questions should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    reply, retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u0634\u0648 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064a\u0639 \u0648 \u0647\u0644 \u0641\u064a \u062a\u0648\u0635\u064a\u0644\u061f",
        db_session,
    )

    assert "Amman branch" in reply
    assert "Delivery is available" in reply
    assert "get_business_info:{}" in retrieved_data
    assert trace["static_fast_path"] is True
    assert trace["model"] == "deterministic"


@pytest.mark.asyncio
async def test_static_business_fast_path_filters_branch_by_requested_city(
    db_session,
    monkeypatch,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    sales_points = BusinessPolicy(
        user_id=user.id,
        policy_type="sales_points",
        title="Sales points",
        content=(
            "Branch:\n"
            "  - Branch Name: \u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a "
            "\u0643\u064a\u0648 \u0645\u0627\u0631\u062a, City: \u0625\u0631\u0628\u062f, "
            "\u0627\u0644\u062d\u064a \u0627\u0644\u0634\u0631\u0642\u064a\n"
            "  - Branch Name: \u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a "
            "\u062f\u064a\u0643\u0627\u0646 \u0627\u0644\u062d\u064a, City: "
            "\u0637\u0628\u0631\u0628\u0648\u0631"
        ),
        is_active=True,
    )
    db_session.add_all([user, session, sales_points])
    await db_session.commit()
    await db_session.refresh(user)

    async def fail_openai_key(_db):
        raise AssertionError("static city branch questions should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    reply, _retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u0637\u064a\u0628 \u0639\u0646\u062f\u0643\u0645 \u0641\u0631\u0639 \u0641\u064a \u0627\u0631\u0628\u062f\u061f",
        db_session,
    )

    assert "\u0643\u064a\u0648 \u0645\u0627\u0631\u062a" in reply
    assert "\u0627\u0644\u062d\u064a \u0627\u0644\u0634\u0631\u0642\u064a" in reply
    assert "\u0637\u0628\u0631\u0628\u0648\u0631" not in reply
    assert "Branch Name:" not in reply
    assert "City:" not in reply
    assert "\u0622\u0647" in reply
    assert trace["static_fast_path"] is True


@pytest.mark.asyncio
async def test_static_business_fast_path_understands_sell_in_city_question(
    db_session,
    monkeypatch,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    sales_points = BusinessPolicy(
        user_id=user.id,
        policy_type="sales_points",
        title="Sales points",
        content=(
            "Branch:\n"
            "  - Branch Name: \u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a "
            "\u0643\u064a\u0648 \u0645\u0627\u0631\u062a, City: \u0625\u0631\u0628\u062f, "
            "\u0627\u0644\u062d\u064a \u0627\u0644\u0634\u0631\u0642\u064a\n"
            "  - Branch Name: \u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a "
            "\u0627\u0644\u0633\u0644\u0627\u0645, City: \u0639\u0645\u0627\u0646"
        ),
        is_active=True,
    )
    db_session.add_all([user, session, sales_points])
    await db_session.commit()
    await db_session.refresh(user)

    async def fail_openai_key(_db):
        raise AssertionError("city sales point questions should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    reply, _retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u0628\u062a\u0628\u064a\u0639\u0648 \u0641\u064a \u0627\u0631\u0628\u062f\u061f",
        db_session,
    )

    assert "\u0643\u064a\u0648 \u0645\u0627\u0631\u062a" in reply
    assert "\u0627\u0644\u062d\u064a \u0627\u0644\u0634\u0631\u0642\u064a" in reply
    assert "\u0639\u0645\u0627\u0646" not in reply
    assert trace["static_fast_path"] is True


@pytest.mark.asyncio
async def test_static_business_fast_path_tolerates_city_typo_after_place_preposition(
    db_session,
    monkeypatch,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    sales_points = BusinessPolicy(
        user_id=user.id,
        policy_type="sales_points",
        title="Sales points",
        content=(
            "Branch:\n"
            "  - Branch Name: \u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a "
            "\u0643\u064a\u0648 \u0645\u0627\u0631\u062a, City: \u0625\u0631\u0628\u062f\n"
            "  - Branch Name: \u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a "
            "\u0627\u0644\u0633\u0644\u0627\u0645, City: \u0639\u0645\u0627\u0646"
        ),
        is_active=True,
    )
    db_session.add_all([user, session, sales_points])
    await db_session.commit()
    await db_session.refresh(user)

    async def fail_openai_key(_db):
        raise AssertionError("city typo branch questions should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    reply, _retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u0628\u062a\u0628\u064a\u0639\u0648 \u0641\u064a \u0627\u0631\u064a\u062f\u061f",
        db_session,
    )

    assert "\u0643\u064a\u0648 \u0645\u0627\u0631\u062a" in reply
    assert "\u0639\u0645\u0627\u0646" not in reply
    assert "\u0625\u0631\u0628\u062f" in reply
    assert trace["static_fast_path"] is True


@pytest.mark.asyncio
async def test_static_business_fast_path_filters_delivery_by_requested_city(
    db_session,
    monkeypatch,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    delivery = BusinessPolicy(
        user_id=user.id,
        policy_type="ordering",
        title="Delivery",
        content=(
            "\u062a\u0648\u0635\u064a\u0644 \u0625\u0631\u0628\u062f "
            "\u0645\u062a\u0627\u062d \u062e\u0644\u0627\u0644 24-48 "
            "\u0633\u0627\u0639\u0629\n"
            "\u062a\u0648\u0635\u064a\u0644 \u0639\u0645\u0627\u0646 "
            "\u0645\u062a\u0627\u062d \u0646\u0641\u0633 \u0627\u0644\u064a\u0648\u0645"
        ),
        is_active=True,
    )
    db_session.add_all([user, session, delivery])
    await db_session.commit()
    await db_session.refresh(user)

    async def fail_openai_key(_db):
        raise AssertionError("static city delivery questions should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    reply, _retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u0641\u064a \u062a\u0648\u0635\u064a\u0644 \u0641\u064a \u0627\u0631\u0628\u062f\u061f",
        db_session,
    )

    assert "\u062a\u0648\u0635\u064a\u0644 \u0625\u0631\u0628\u062f" in reply
    assert "24-48" in reply
    assert "\u0639\u0645\u0627\u0646" not in reply
    assert "\u0622\u0647" in reply
    assert trace["static_fast_path"] is True


@pytest.mark.asyncio
async def test_delivery_question_asks_for_area_when_no_delivery_facts(
    db_session,
    monkeypatch,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.commit()
    await db_session.refresh(user)

    async def fail_openai_key(_db):
        raise AssertionError("delivery area clarification should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    reply, _retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u0639\u0646\u062f\u0643\u0645 \u062a\u0648\u0635\u064a\u0644\u061f",
        db_session,
    )

    assert reply == "\u0623\u0643\u064a\u062f\u060c \u0644\u0623\u064a \u0645\u0646\u0637\u0642\u0629 \u0628\u062f\u0643 \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u061f"
    assert trace["static_fast_path"] is True


@pytest.mark.asyncio
async def test_delivery_area_followup_escalates_for_unconfirmed_area(
    db_session,
    monkeypatch,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    db_session.add_all([user, session])
    await db_session.commit()
    await db_session.refresh(user)

    async def fail_openai_key(_db):
        raise AssertionError("delivery follow-up should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    await _generate_reply(
        user,
        session_id,
        "\u0639\u0646\u062f\u0643\u0645 \u062a\u0648\u0635\u064a\u0644\u061f",
        db_session,
    )
    reply, _retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u0639\u0645\u0627\u0646 \u0637\u0628\u0631\u0628\u0648\u0631",
        db_session,
    )

    assert "\u0645\u0627 \u0639\u0646\u062f\u064a \u062a\u0623\u0643\u064a\u062f \u0644\u062a\u0648\u0635\u064a\u0644 \u0639\u0645\u0627\u0646 \u0637\u0628\u0631\u0628\u0648\u0631" in reply
    assert "\u0628\u062e\u0644\u064a \u0627\u0644\u0641\u0631\u064a\u0642 \u064a\u062a\u0623\u0643\u062f\u0644\u0643" in reply
    assert trace["finish_reason"] == "delivery_area_followup"


@pytest.mark.asyncio
async def test_mixed_delivery_and_price_question_uses_pre_llm_retrieval(
    db_session,
    monkeypatch,
):
    user = _user(business_type="food")
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    item = Item(
        user_id=user.id,
        name="البوكس العائلي",
        description="بوكس مناسب للجمعات",
        category="بوكسات",
        price=12,
        currency="JOD",
        available=True,
    )
    delivery = DeliveryRule(
        user_id=user.id,
        zone_name="Amman",
        delivery_fee=2,
        currency="JOD",
        estimated_days="same day",
        is_active=True,
    )
    db_session.add_all([user, session, item, delivery])
    await db_session.commit()
    await db_session.refresh(user)

    client = RecordingOpenAIClient()

    async def fake_openai_key(_db):
        return "sk-test"

    async def fake_model(_db):
        return "gpt-4o-mini"

    async def fake_master_prompt(_db):
        return ""

    async def fake_handoff_enabled(_db):
        return False

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fake_openai_key)
    monkeypatch.setattr("services.ai_chat.effective_model", fake_model)
    monkeypatch.setattr("services.ai_chat.effective_master_system_prompt", fake_master_prompt)
    monkeypatch.setattr("services.ai_chat.effective_human_handoff_enabled", fake_handoff_enabled)
    monkeypatch.setattr("services.ai_chat._client_for", lambda *_args, **_kwargs: client)

    reply, retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "عندكم توصيل وكم سعر البوكس؟",
        db_session,
    )

    assert "طلبك" in reply
    assert "البوكس العائلي" in reply
    assert "12 دينار" in reply
    assert "سعر التوصيل" in reply
    assert trace["static_fast_path"] is True
    assert trace["static_discovery_fast_path"] is True
    assert trace["retrieval"]["pre_llm"]["attempted"] is True
    assert any(key.startswith("get_catalog:") for key in retrieved_data)
    assert any(key.startswith("get_delivery_info:") for key in retrieved_data)
    assert any(
        call["source"] == "pre_llm_retrieval" and call["name"] == "get_catalog"
        for call in trace["tool_calls"]
    )
    assert client.calls == []


@pytest.mark.asyncio
async def test_pre_ai_automation_shadow_mode_does_not_hijack_price_question(
    db_session,
):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    rule = AutomationRule(
        user_id=user.id,
        name="Price keyword hijack",
        trigger_type="keyword_match",
        trigger_config={"keywords": ["سعر"], "match_mode": "any"},
        conditions=[],
        actions=[
            {
                "type": "send_message",
                "config": {"text": "رد ثابت عن السعر"},
            }
        ],
        is_active=True,
    )
    db_session.add_all([user, session, rule])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(session)

    reply, paused, results = await _run_pre_ai_automations(
        user=user,
        session=session,
        customer_message="كم سعر البوكس؟",
        db=db_session,
    )

    assert reply is None
    assert paused is False
    assert any(result["status"] == "would_execute" for result in results)
    assert all(result.get("dry_run") is True for result in results)

    rows = (
        await db_session.execute(
            select(Message).where(
                Message.session_id == session_id,
                Message.role == "assistant",
            )
        )
    ).scalars().all()
    assert rows == []


@pytest.mark.asyncio
async def test_post_ai_automation_stages_actions_without_commit(
    db_session,
    monkeypatch,
):
    user = _user()
    user_id = user.id
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user_id, channel="web")
    rule = AutomationRule(
        user_id=user_id,
        name="Low confidence notification",
        trigger_type="low_confidence",
        trigger_config={},
        conditions=[],
        actions=[
            {
                "type": "send_notification",
                "config": {"text": "Review this AI reply"},
            }
        ],
        is_active=True,
    )
    db_session.add_all([user, session, rule])
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(session)

    async def fail_commit():
        raise AssertionError("chat-triggered automations must not commit")

    monkeypatch.setattr(db_session, "commit", fail_commit)

    results = await _run_post_ai_automations(
        user=user,
        session=session,
        customer_message="Can you confirm this?",
        final_reply="I need to verify that.",
        action="blocked",
        result=VerificationResult(
            verdict=ASK_CLARIFICATION,
            risk_score=0.7,
            reasons=["needs verification"],
        ),
        retrieved_data={},
        db=db_session,
    )

    assert any(result["status"] == "executed" for result in results)
    rows = (
        await db_session.execute(
            select(Message).where(
                Message.session_id == session_id,
                Message.role == "system",
            )
        )
    ).scalars().all()
    assert [row.content for row in rows] == ["Review this AI reply"]
    await db_session.rollback()


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


@pytest.mark.asyncio
async def test_verify_and_finalize_handoff_disabled_uses_safe_response_not_draft(
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

    async def fake_prompt_overrides(*_args, **_kwargs):
        return {}

    async def fake_persona_config(*_args, **_kwargs):
        return {}

    class FailClosedVerifier:
        def __init__(self, *_args, **_kwargs):
            pass

        async def verify(self, *_args, **_kwargs):
            return VerificationResult(
                verdict=HUMAN_HANDOFF_REQUIRED,
                risk_score=1.0,
                reasons=["Verification service unavailable; fail-closed"],
                safe_response="لحظة من فضلك، خليني أتأكد من المعلومة وأرجعلك.",
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
    monkeypatch.setattr(
        "services.ai_chat.get_client_prompt_overrides",
        fake_prompt_overrides,
    )
    monkeypatch.setattr(
        "services.ai_chat.get_effective_persona_config",
        fake_persona_config,
    )
    monkeypatch.setattr("services.ai_chat.AnswerVerifier", FailClosedVerifier)

    reply, action, result = await _verify_and_finalize(
        "Unverified draft with price 999 JOD",
        "customer question",
        {},
        user,
        session_id,
        db_session,
    )

    assert reply == "لحظة من فضلك، خليني أتأكد من المعلومة وأرجعلك."
    assert "999 JOD" not in reply
    assert action == "modified"
    assert result.verdict == ASK_CLARIFICATION
