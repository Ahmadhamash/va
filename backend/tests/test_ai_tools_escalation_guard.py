from services.ai_tools import _is_benign_escalation_reason


def test_repeated_greetings_do_not_escalate():
    assert _is_benign_escalation_reason("repeated greetings") is True


def test_arabic_greeting_does_not_escalate():
    assert _is_benign_escalation_reason("الزبون يكرر مرحبا") is True


def test_real_complaint_still_escalates():
    assert _is_benign_escalation_reason(
        "customer says hello repeatedly",
        "angry complaint about a payment",
    ) is False
