from __future__ import annotations

from collections import defaultdict
from typing import Any


# Estimated USD rates per 1M tokens. Keep this list small and explicit; unknown
# models still show token usage but cost is marked as estimated=false.
MODEL_PRICING_PER_1M: dict[str, dict[str, float]] = {
    "gpt-5.5": {"input": 5.00, "output": 30.00},
    "gpt-5.5-pro": {"input": 30.00, "output": 180.00},
    "gpt-5.4": {"input": 2.50, "output": 15.00},
    "gpt-5.4-mini": {"input": 0.75, "output": 4.50},
    "gpt-5.4-nano": {"input": 0.20, "output": 1.25},
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
}


def _usage_value(obj: Any, key: str, fallback: int = 0) -> int:
    value = None
    if isinstance(obj, dict):
        value = obj.get(key)
    else:
        value = getattr(obj, key, None)
    try:
        return int(value or fallback)
    except (TypeError, ValueError):
        return fallback


def normalise_model(model: str | None) -> str:
    raw = (model or "").strip()
    if not raw:
        return "unknown"
    lowered = raw.lower()
    for known in sorted(MODEL_PRICING_PER_1M, key=len, reverse=True):
        if lowered == known or lowered.startswith(f"{known}-"):
            return known
    return raw


def estimate_cost_usd(
    model: str | None,
    input_tokens: int,
    output_tokens: int,
) -> tuple[float, bool]:
    pricing = MODEL_PRICING_PER_1M.get(normalise_model(model))
    if not pricing:
        return 0.0, False
    cost = (
        (input_tokens / 1_000_000) * pricing["input"]
        + (output_tokens / 1_000_000) * pricing["output"]
    )
    return round(cost, 8), True


def usage_call_from_response(
    *,
    label: str,
    model: str | None,
    response: Any,
) -> dict[str, Any] | None:
    usage = getattr(response, "usage", None)
    if usage is None:
        return None

    input_tokens = _usage_value(usage, "prompt_tokens") or _usage_value(
        usage, "input_tokens"
    )
    output_tokens = _usage_value(usage, "completion_tokens") or _usage_value(
        usage, "output_tokens"
    )
    total_tokens = _usage_value(usage, "total_tokens", input_tokens + output_tokens)
    cost_usd, cost_estimated = estimate_cost_usd(model, input_tokens, output_tokens)
    return {
        "label": label,
        "model": model or "unknown",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
        "cost_usd": cost_usd,
        "cost_estimated": cost_estimated,
    }


def append_usage_call(trace: dict, call: dict[str, Any] | None) -> None:
    if not call:
        return

    usage = trace.setdefault(
        "usage",
        {
            "calls": [],
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "cost_estimated": True,
            "models": {},
        },
    )
    usage["calls"].append(call)
    usage["input_tokens"] = int(usage.get("input_tokens") or 0) + int(
        call.get("input_tokens") or 0
    )
    usage["output_tokens"] = int(usage.get("output_tokens") or 0) + int(
        call.get("output_tokens") or 0
    )
    usage["total_tokens"] = int(usage.get("total_tokens") or 0) + int(
        call.get("total_tokens") or 0
    )
    usage["cost_usd"] = round(
        float(usage.get("cost_usd") or 0.0) + float(call.get("cost_usd") or 0.0),
        8,
    )
    usage["cost_estimated"] = bool(usage.get("cost_estimated", True)) and bool(
        call.get("cost_estimated")
    )

    model_key = normalise_model(call.get("model"))
    models = usage.setdefault("models", {})
    model_stats = models.setdefault(
        model_key,
        {
            "calls": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "cost_estimated": True,
        },
    )
    model_stats["calls"] += 1
    model_stats["input_tokens"] += int(call.get("input_tokens") or 0)
    model_stats["output_tokens"] += int(call.get("output_tokens") or 0)
    model_stats["total_tokens"] += int(call.get("total_tokens") or 0)
    model_stats["cost_usd"] = round(
        float(model_stats.get("cost_usd") or 0.0) + float(call.get("cost_usd") or 0.0),
        8,
    )
    model_stats["cost_estimated"] = bool(
        model_stats.get("cost_estimated", True)
    ) and bool(call.get("cost_estimated"))


def append_response_usage(
    trace: dict,
    *,
    label: str,
    model: str | None,
    response: Any,
) -> None:
    append_usage_call(
        trace,
        usage_call_from_response(label=label, model=model, response=response),
    )


def usage_summary_from_trace(trace: dict | None) -> dict[str, Any]:
    usage = (trace or {}).get("usage") or {}
    calls = usage.get("calls") or []
    if not isinstance(calls, list):
        calls = []

    summary = {
        "calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "cost_usd": 0.0,
        "cost_estimated": True,
        "models": defaultdict(
            lambda: {
                "calls": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "cost_usd": 0.0,
                "cost_estimated": True,
            }
        ),
    }
    for call in calls:
        if not isinstance(call, dict):
            continue
        model_key = normalise_model(call.get("model"))
        input_tokens = int(call.get("input_tokens") or 0)
        output_tokens = int(call.get("output_tokens") or 0)
        total_tokens = int(call.get("total_tokens") or input_tokens + output_tokens)
        cost_usd = float(call.get("cost_usd") or 0.0)
        cost_estimated = bool(call.get("cost_estimated", False))
        summary["calls"] += 1
        summary["input_tokens"] += input_tokens
        summary["output_tokens"] += output_tokens
        summary["total_tokens"] += total_tokens
        summary["cost_usd"] = round(summary["cost_usd"] + cost_usd, 8)
        summary["cost_estimated"] = summary["cost_estimated"] and cost_estimated
        model_stats = summary["models"][model_key]
        model_stats["calls"] += 1
        model_stats["input_tokens"] += input_tokens
        model_stats["output_tokens"] += output_tokens
        model_stats["total_tokens"] += total_tokens
        model_stats["cost_usd"] = round(model_stats["cost_usd"] + cost_usd, 8)
        model_stats["cost_estimated"] = model_stats["cost_estimated"] and cost_estimated

    summary["models"] = dict(summary["models"])
    return summary
