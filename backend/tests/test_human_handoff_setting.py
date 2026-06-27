from models import User
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
