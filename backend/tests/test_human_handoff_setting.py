from models import User
from services.ai_chat import _reply_image_url, _strip_sent_image_url, _tool_call_kwargs
from services.ai_prompts import build_system_prompt
from services.ai_tools import get_tools_for_intents


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


def test_prompt_override_replaces_intent_section_only():
    user = User(business_name="Demo Store", ai_persona="Helpful and concise.")

    prompt = build_system_prompt(
        user,
        intent="sales",
        prompt_overrides={"sales_prompt": "CUSTOM SALES RULE: ask about preferred flavor."},
    )

    assert "CUSTOM SALES RULE: ask about preferred flavor." in prompt
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
