from types import SimpleNamespace

from services.ai_usage import (
    append_response_usage,
    estimate_cost_usd,
    usage_summary_from_trace,
)


def test_estimate_cost_for_known_model():
    cost, estimated = estimate_cost_usd("gpt-4o-mini", 1000, 500)

    assert estimated is True
    assert cost == 0.00045


def test_usage_trace_accumulates_calls_and_models():
    trace = {}
    response = SimpleNamespace(
        usage=SimpleNamespace(
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150,
        )
    )

    append_response_usage(
        trace,
        label="knowledge_agent",
        model="gpt-4o-mini",
        response=response,
    )
    append_response_usage(
        trace,
        label="humanizer",
        model="gpt-4o-mini",
        response=response,
    )

    summary = usage_summary_from_trace(trace)

    assert summary["calls"] == 2
    assert summary["input_tokens"] == 200
    assert summary["output_tokens"] == 100
    assert summary["total_tokens"] == 300
    assert summary["models"]["gpt-4o-mini"]["calls"] == 2
