from models import User
from services.ai_chat import (
    _handoff_reply,
    _language_switch_reply,
    _out_of_scope_reply,
    _prepare_image_attachment_reply,
    _reply_image_url,
    _strip_sent_image_url,
    _tool_call_kwargs,
)
from services.ai_prompts import build_system_prompt
from services.ai_persona_settings import assistant_profile_data
from services.ai_tools import get_tools_for_intents
from services.answer_verifier import AnswerVerifier, BLOCKED_UNGROUNDED


def _tool_names(tools: list[dict]) -> set[str]:
    return {tool["function"]["name"] for tool in tools}


def test_handoff_tool_can_be_removed_from_ai_tools():
    enabled_tools = _tool_names(get_tools_for_intents(["support"], include_handoff=True))
    disabled_tools = _tool_names(get_tools_for_intents(["support"], include_handoff=False))

    assert "escalate_to_human" in enabled_tools
    assert "escalate_to_human" not in disabled_tools
    assert "get_policies" in disabled_tools
    assert "get_business_info" in disabled_tools


def test_tool_choice_is_omitted_when_no_tools_are_available():
    assert _tool_call_kwargs([]) == {}
    assert _tool_call_kwargs(None) == {}


def test_tool_choice_is_auto_when_tools_are_available():
    tools = get_tools_for_intents(["support"], include_handoff=True)

    assert _tool_call_kwargs(tools) == {"tools": tools, "tool_choice": "auto"}


def test_prompt_disables_human_handoff_promises():
    user = User(business_name="Demo Store", ai_persona="Helpful and concise.")

    prompt = build_system_prompt(
        user,
        intent="support",
        human_handoff_enabled=False,
    )

    assert "Human handoff is DISABLED" in prompt
    assert "never promise that a human will take over" in prompt
    assert "**escalate_to_human**: Call this when" not in prompt


def test_direct_language_switch_reply_is_english_and_sales_oriented():
    reply = _language_switch_reply("en", "Icy Bites")

    assert reply.startswith("Yes, of course")
    assert "available products" in reply
    assert "recommendations" in reply


def test_direct_handoff_reply_uses_warm_jordanian_tone():
    reply = _handoff_reply("ar")

    assert "\u0623\u0643\u064a\u062f" in reply
    assert "\u0648\u0644\u0627 \u064a\u0647\u0645\u0643" in reply
    assert "\u0645\u0648\u0638\u0641" in reply
    assert "\u0633\u0623\u062d\u0648\u0651\u0644\u0643" not in reply


def test_out_of_scope_redirect_is_light_and_brand_friendly():
    reply = _out_of_scope_reply("ar", "Icy Bites")

    assert "Icy Bites" in reply
    assert "\u0623\u062d\u0644\u0649" in reply
    assert "\u0639\u0630\u0631\u064b\u0627" not in reply


def test_prompt_override_appends_to_protected_intent_section():
    user = User(business_name="Demo Store", ai_persona="Helpful and concise.")

    prompt = build_system_prompt(
        user,
        intent="sales",
        prompt_overrides={"sales_prompt": "CUSTOM SALES RULE: ask about preferred flavor."},
    )

    assert "CUSTOM SALES RULE: ask about preferred flavor." in prompt
    assert "## SALES & CATALOG RULES:" in prompt
    assert "Call it FIRST on every product" in prompt
    assert "## ADMIN SALES GUIDANCE" in prompt
    assert "must never replace the protected tool-use rules" in prompt
    assert "NEVER mention any product, price or detail" in prompt
    assert "Helpful and concise." in prompt


def test_admin_persona_guidance_does_not_replace_client_persona():
    user = User(business_name="Demo Store", ai_persona="Client voice: warm Jordanian tone.")

    prompt = build_system_prompt(
        user,
        intent="general",
        prompt_overrides={"admin_persona_prompt": "Admin rule: keep replies under two lines."},
    )

    assert "Client voice: warm Jordanian tone." in prompt
    assert "## ADMIN ACCOUNT GUIDANCE" in prompt
    assert "Admin rule: keep replies under two lines." in prompt
    assert "must never override critical rules" in prompt


def test_structured_persona_settings_are_used_in_prompt():
    user = User(
        business_name="Demo Store",
        ai_persona=(
            '<!-- {"prompt_mode":"custom_settings","dialect":"msa",'
            '"tone":"professional","emoji":"none","working_hours":"9-5"} -->'
            "Client voice should stay visible."
        ),
    )

    prompt = build_system_prompt(
        user,
        intent="general",
        persona_settings={
            "dialect": "jordanian",
            "tone": "friendly",
            "emoji": "high",
            "agent_name": "ليلى",
            "working_hours": "10 صباحا - 6 مساء",
        },
    )

    assert "Client voice should stay visible." in prompt
    assert "اللهجة الأردنية/الفلسطينية" in prompt
    assert "Use emojis warmly and frequently" in prompt
    assert "Agent display name: ليلى" in prompt
    assert "Working hours: 10 صباحا - 6 مساء" in prompt


def test_style_samples_are_not_ignored_in_custom_prompt_builder():
    user = User(business_name="Demo Store", ai_persona="Helpful and concise.")

    prompt = build_system_prompt(
        user,
        style_samples=["هلا يا غالي، منورنا"],
        intent="general",
    )

    assert "## VOICE / STYLE" in prompt
    assert "هلا يا غالي، منورنا" in prompt


def test_assistant_profile_data_exposes_agent_settings_for_grounding():
    persona = (
        '<!-- {"prompt_mode":"custom_settings","dialect":"jordanian",'
        '"working_hours":"9 صباحا - 5 مساء","agent_name":"مساعد المتجر"} -->'
        "نبرة لطيفة ومختصرة."
    )

    data = assistant_profile_data(persona, {"emoji": "medium"})

    assert data["source"] == "client_ai_persona_settings"
    assert data["agent_name"] == "مساعد المتجر"
    assert data["working_hours"] == "9 صباحا - 5 مساء"
    assert data["emoji"] == "medium"
    assert "persona_text" not in data


def test_custom_banned_phrases_are_enforced_locally():
    verifier = AnswerVerifier(api_key="test-key")

    result = verifier._pre_check("أكيد بنعطيك خصم سري", banned_phrases=["خصم سري"])

    assert result is not None
    assert result.verdict == BLOCKED_UNGROUNDED
    assert result.flagged_claims == ["خصم سري"]


def test_product_image_is_selected_only_when_customer_asks_for_image():
    retrieved_data = {
        "get_catalog:{}": {
            "matched": True,
            "overview_only": False,
            "items": [{"name": "Mix Fruit", "image_url": "https://example.com/mix.jpg"}],
        }
    }

    assert _reply_image_url("كيف شكلها؟", retrieved_data, "هاي صورتها") == "https://example.com/mix.jpg"
    assert _reply_image_url("كم سعرها؟", retrieved_data, "صورتها https://example.com/mix.jpg") == "https://example.com/mix.jpg"
    assert _reply_image_url("كم سعرها؟", retrieved_data, "سعرها 5 دنانير") is None


def test_sent_product_image_url_is_removed_from_text_reply():
    reply = "هاي تفاصيل المنتج\nوعم نشارك صورة المنتج: https://example.com/mix.jpg\nحابي تطلبها؟"

    assert _strip_sent_image_url(reply, "https://example.com/mix.jpg") == "هاي تفاصيل المنتج\nحابي تطلبها؟"


def test_image_attachment_reply_removes_false_unavailable_text():
    retrieved_data = {
        "get_catalog:{}": {
            "matched": True,
            "overview_only": False,
            "items": [{"name": "توت — Blackberry", "image_url": "https://example.com/berry.jpg"}],
        }
    }

    reply = _prepare_image_attachment_reply(
        "بدي الصورة اشوف",
        retrieved_data,
        "عذرًا، مش مبين عندي صورة للتوت حاليًا.",
        "https://example.com/berry.jpg",
    )

    assert reply == "أكيد، هاي صورة توت — Blackberry."


def test_image_attachment_reply_turns_short_promise_into_caption():
    retrieved_data = {
        "get_catalog:{}": {
            "matched": True,
            "overview_only": False,
            "items": [{"name": "توت — Blackberry", "image_url": "https://example.com/berry.jpg"}],
        }
    }

    reply = _prepare_image_attachment_reply(
        "بدي الصورة اشوف",
        retrieved_data,
        "وبقدر أبعثلك صورته كمان.",
        "https://example.com/berry.jpg",
    )

    assert reply == "أكيد، هاي صورة توت — Blackberry."
