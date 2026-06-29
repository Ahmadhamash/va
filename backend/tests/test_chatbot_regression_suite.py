import uuid
from dataclasses import dataclass
from types import SimpleNamespace

import pytest

from models import BusinessPolicy, ChatSession, Item, User
from routers.webhooks import _manychat_public_media_url, _manychat_response
from services.ai_chat import (
    _generate_reply,
    _prepare_image_attachment_reply,
    _reply_image_url,
    _try_static_catalog_reply,
)


SUPERMARKET_KHAIR = "\u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a \u0627\u0644\u062e\u064a\u0631"
SUPERMARKET_SALAM = "\u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a \u0627\u0644\u0633\u0644\u0627\u0645"
QMART = "\u0643\u064a\u0648 \u0645\u0627\u0631\u062a"
YASMEEN = "\u0627\u0644\u064a\u0627\u0633\u0645\u064a\u0646"
IRBID = "\u0625\u0631\u0628\u062f"
EAST_DISTRICT = "\u0627\u0644\u062d\u064a \u0627\u0644\u0634\u0631\u0642\u064a"
AMMAN = "\u0639\u0645\u0627\u0646"

TUT_BLACKBERRY = "\u062a\u0648\u062a - Blackberry"
MANGO = "\u0645\u0627\u0646\u062c\u0627 - Mango"
ICE_CREAM = "\u0622\u064a\u0633 \u0643\u0631\u064a\u0645"
BLACKBERRY_DESCRIPTION = "\u0622\u064a\u0633 \u0643\u0631\u064a\u0645 \u0628\u0646\u0643\u0647\u0629 \u0627\u0644\u062a\u0648\u062a"
MANGO_DESCRIPTION = "\u0622\u064a\u0633 \u0643\u0631\u064a\u0645 \u0628\u0637\u0639\u0645 \u0627\u0644\u0645\u0627\u0646\u062c\u0627"
BLACKBERRY_IMAGE = "/uploads/products/blackberry.jpg"

ROBOTIC_PHRASES = (
    "\u0625\u0630\u0627 \u0639\u0646\u062f\u0643 \u0623\u064a \u0627\u0633\u062a\u0641\u0633\u0627\u0631 \u062b\u0627\u0646\u064a",
    "\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u064a \u0645\u0633\u0627\u0639\u062f\u062a\u0643",
    "\u0639\u0630\u0631\u064b\u0627\u060c \u0644\u0627 \u0623\u0645\u0644\u0643 \u0645\u0639\u0644\u0648\u0645\u0627\u062a",
    "\u0639\u0630\u0631\u064b\u0627\u060c \u0645\u0627 \u0639\u0646\u062f\u064a \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u062d\u0627\u0644\u064a\u0629",
)


@dataclass(frozen=True)
class ChatScenario:
    name: str
    message: str
    contains: tuple[str, ...]
    forbidden: tuple[str, ...] = ()


SUPPORT_SCENARIOS = (
    ChatScenario(
        name="branch_followup_filters_neighborhood",
        message="\u0637\u064a\u0628 \u0639\u0646\u062f\u0643\u0645 \u0641\u0631\u0639 \u0641\u064a \u0627\u0644\u064a\u0627\u0633\u0645\u064a\u0646\u061f",
        contains=(SUPERMARKET_KHAIR, YASMEEN),
        forbidden=(QMART, IRBID, AMMAN, "Branch Name:", "City:"),
    ),
    ChatScenario(
        name="sell_in_city_typo_finds_irbid",
        message="\u0628\u062a\u0628\u064a\u0639\u0648 \u0641\u064a \u0627\u0631\u064a\u062f\u061f",
        contains=(QMART, IRBID),
        forbidden=(SUPERMARKET_KHAIR, YASMEEN, AMMAN, "Branch Name:", "City:"),
    ),
    ChatScenario(
        name="sales_points_overview_lists_clean_branches",
        message="\u0648\u064a\u0646 \u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064a\u0639\u061f",
        contains=(SUPERMARKET_KHAIR, QMART, SUPERMARKET_SALAM),
        forbidden=("Branch Name:", "City:"),
    ),
    ChatScenario(
        name="delivery_city_question_filters_irbid",
        message="\u0641\u064a \u062a\u0648\u0635\u064a\u0644 \u0641\u064a \u0627\u0631\u0628\u062f\u061f",
        contains=("\u062a\u0648\u0635\u064a\u0644 \u0625\u0631\u0628\u062f", "24-48"),
        forbidden=("\u062a\u0648\u0635\u064a\u0644 \u0639\u0645\u0627\u0646",),
    ),
)


class FailingOpenAIClient:
    def __init__(self):
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs):
        self.calls.append(kwargs)
        raise AssertionError("regression scenarios should not call OpenAI")


def _user(**overrides):
    data = {
        "id": uuid.uuid4(),
        "username": f"client_{uuid.uuid4().hex[:8]}",
        "email": f"client_{uuid.uuid4().hex[:8]}@example.com",
        "hashed_password": "hashed",
        "business_name": "Regression Store",
        "business_type": "food",
        "role": "client",
        "is_active": True,
    }
    data.update(overrides)
    return User(**data)


async def _seed_support_business(db_session):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    sales_points = BusinessPolicy(
        user_id=user.id,
        policy_type="sales_points",
        title="Sales points",
        content=(
            "Branches:\n"
            f"  - Branch Name: {SUPERMARKET_KHAIR}, City: {YASMEEN}\n"
            f"  - Branch Name: \u0633\u0648\u0628\u0631 \u0645\u0627\u0631\u0643\u062a {QMART}, City: {IRBID}, {EAST_DISTRICT}\n"
            f"  - Branch Name: {SUPERMARKET_SALAM}, City: {AMMAN}"
        ),
        is_active=True,
    )
    delivery = BusinessPolicy(
        user_id=user.id,
        policy_type="ordering",
        title="Delivery",
        content=(
            "\u062a\u0648\u0635\u064a\u0644 \u0625\u0631\u0628\u062f \u0645\u062a\u0627\u062d \u062e\u0644\u0627\u0644 24-48 \u0633\u0627\u0639\u0629\n"
            "\u062a\u0648\u0635\u064a\u0644 \u0639\u0645\u0627\u0646 \u0645\u062a\u0627\u062d \u0646\u0641\u0633 \u0627\u0644\u064a\u0648\u0645"
        ),
        is_active=True,
    )
    db_session.add_all([user, session, sales_points, delivery])
    await db_session.commit()
    await db_session.refresh(user)
    return user, session_id


async def _seed_catalog_business(db_session):
    user = _user()
    session_id = uuid.uuid4()
    session = ChatSession(id=session_id, user_id=user.id, channel="web")
    blackberry = Item(
        user_id=user.id,
        name=TUT_BLACKBERRY,
        description=BLACKBERRY_DESCRIPTION,
        category=ICE_CREAM,
        price=5,
        currency="JOD",
        available=True,
        image_url=BLACKBERRY_IMAGE,
    )
    mango = Item(
        user_id=user.id,
        name=MANGO,
        description=MANGO_DESCRIPTION,
        category=ICE_CREAM,
        price=5,
        currency="JOD",
        available=True,
        image_url="/uploads/products/mango.jpg",
    )
    db_session.add_all([user, session, blackberry, mango])
    await db_session.commit()
    await db_session.refresh(user)
    return user, session_id


def _assert_natural_reply(reply: str):
    for phrase in ROBOTIC_PHRASES:
        assert phrase not in reply


def _install_no_llm(monkeypatch):
    client = FailingOpenAIClient()

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
    return client


@pytest.mark.asyncio
@pytest.mark.parametrize("scenario", SUPPORT_SCENARIOS, ids=lambda scenario: scenario.name)
async def test_chatbot_support_regression_scenarios_skip_openai(
    db_session,
    monkeypatch,
    scenario,
):
    user, session_id = await _seed_support_business(db_session)

    async def fail_openai_key(_db):
        raise AssertionError("static support scenarios should not need OpenAI")

    monkeypatch.setattr("services.ai_chat.effective_openai_key", fail_openai_key)

    reply, _retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        scenario.message,
        db_session,
    )

    for expected in scenario.contains:
        assert expected in reply
    for forbidden in scenario.forbidden:
        assert forbidden not in reply
    _assert_natural_reply(reply)
    assert trace["static_fast_path"] is True
    assert trace["model"] == "deterministic"


@pytest.mark.asyncio
async def test_chatbot_catalog_price_regression_uses_static_catalog_path(
    db_session,
    monkeypatch,
):
    user, session_id = await _seed_catalog_business(db_session)
    client = _install_no_llm(monkeypatch)

    reply, retrieved_data, trace = await _generate_reply(
        user,
        session_id,
        "\u062a\u0648\u062a \u0643\u0645 \u0633\u0639\u0631\u0647\u061f",
        db_session,
    )

    assert TUT_BLACKBERRY in reply
    assert "5 \u062f\u064a\u0646\u0627\u0631" in reply
    assert any(key.startswith("get_catalog:") for key in retrieved_data)
    assert trace["static_catalog_fast_path"] is True
    assert client.calls == []
    _assert_natural_reply(reply)


def test_chatbot_catalog_detail_and_image_followup_stays_grounded():
    retrieved_data = {
        "get_catalog:regression": {
            "matched": True,
            "overview_only": False,
            "items": [
                {
                    "name": TUT_BLACKBERRY,
                    "description": BLACKBERRY_DESCRIPTION,
                    "category": ICE_CREAM,
                    "price": 5,
                    "currency": "JOD",
                    "available": True,
                    "image_url": BLACKBERRY_IMAGE,
                }
            ],
        }
    }
    history = [
        {
            "role": "assistant",
            "content": f"{TUT_BLACKBERRY} \u0633\u0639\u0631\u0647 5 \u062f\u064a\u0646\u0627\u0631.",
        }
    ]

    details_reply = _try_static_catalog_reply(
        "\u0627\u0639\u0637\u064a\u0646\u064a \u062a\u0641\u0627\u0635\u064a\u0644 \u0639\u0646\u0647\u0627 \u0643\u0645 \u0633\u0639\u0631\u0647\u0627",
        retrieved_data,
        history,
        current_turn_keys=["get_catalog:regression"],
    )
    assert details_reply is not None
    assert BLACKBERRY_DESCRIPTION in details_reply
    assert "5 \u062f\u064a\u0646\u0627\u0631" in details_reply
    _assert_natural_reply(details_reply)

    image_draft = _try_static_catalog_reply(
        "\u0628\u062f\u064a \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0634\u0648\u0641",
        retrieved_data,
        history,
        current_turn_keys=["get_catalog:regression"],
    )
    image_url = _reply_image_url(
        "\u0628\u062f\u064a \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0634\u0648\u0641",
        retrieved_data,
        image_draft or "",
    )
    final_reply = _prepare_image_attachment_reply(
        "\u0628\u062f\u064a \u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0634\u0648\u0641",
        retrieved_data,
        image_draft or "",
        image_url,
    )

    assert image_url == BLACKBERRY_IMAGE
    assert final_reply == f"\u0623\u0643\u064a\u062f\u060c \u0647\u0627\u064a \u0635\u0648\u0631\u0629 {TUT_BLACKBERRY}."
    assert "\u0645\u0634 \u0645\u0628\u064a\u0646" not in final_reply
    assert "\u0645\u0627 \u0639\u0646\u062f\u064a \u0635\u0648\u0631\u0629" not in final_reply
    _assert_natural_reply(final_reply)


@pytest.mark.parametrize("channel", ("messenger", "instagram"))
def test_chatbot_channel_payload_regression_for_product_images(monkeypatch, channel):
    monkeypatch.setattr("routers.webhooks.settings.DOMAIN", "assistant.example.com")

    public_url = _manychat_public_media_url(BLACKBERRY_IMAGE)
    caption = f"\u0623\u0643\u064a\u062f\u060c \u0647\u0627\u064a \u0635\u0648\u0631\u0629 {TUT_BLACKBERRY}."
    response = _manychat_response(caption, channel, image_url=public_url)

    messages = response["content"]["messages"]
    assert messages[0] == {"type": "text", "text": caption}
    assert messages[1]["type"] == "image"
    assert messages[1]["url"].startswith(
        "https://assistant.example.com/api/uploads/products/blackberry.jpg?"
    )
    assert "media_token=" in messages[1]["url"]
    if channel == "instagram":
        assert response["content"]["type"] == "instagram"
    else:
        assert "type" not in response["content"]
