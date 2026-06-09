"""Deterministic supplemental tool planning for verifier repair.

When the verifier says a draft needs more data, we do one bounded repair pass.
This planner chooses safe DB-backed tools from the customer's text and intent;
it does not call any external service.
"""
from __future__ import annotations

from dataclasses import dataclass
import re


@dataclass(frozen=True)
class ToolCallPlan:
    name: str
    args: dict


_ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u0640]")
_ISO_DATE_RE = re.compile(r"\b20\d{2}-\d{2}-\d{2}\b")

_BROAD_CATALOG_TERMS = (
    "\u0634\u0648 \u0639\u0646\u062f\u0643\u0645", "\u0627\u064a\u0634 \u0639\u0646\u062f\u0643\u0645",
    "\u0645\u0627\u0630\u0627 \u062a\u0628\u064a\u0639", "\u0628\u062a\u0628\u064a\u0639\u0648",
    "\u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c", "\u0643\u062a\u0627\u0644\u0648\u062c",
    "\u0645\u0646\u062a\u062c\u0627\u062a\u0643\u0645", "what do you sell",
    "catalog", "products",
)
_OFFER_TERMS = (
    "\u0639\u0631\u0636", "\u0639\u0631\u0648\u0636", "\u062e\u0635\u0645",
    "\u062e\u0635\u0648\u0645\u0627\u062a", "\u062a\u062e\u0641\u064a\u0636",
    "offer", "offers", "discount", "discounts", "deal", "deals",
)
_PACKAGE_TERMS = (
    "\u0628\u0643\u062c", "\u0628\u0627\u0643\u062c", "\u062d\u0632\u0645\u0647",
    "\u0628\u0627\u0642\u0647", "\u0643\u0648\u0645\u0628\u0648",
    "bundle", "bundles", "package", "packages", "combo",
)
_PAYMENT_TERMS = (
    "\u062f\u0641\u0639", "\u0627\u062f\u0641\u0639", "\u0627\u0644\u062f\u0641\u0639",
    "\u062a\u0642\u0633\u064a\u0637", "\u0643\u0627\u0634", "\u0643\u0644\u064a\u0643",
    "payment", "pay", "cash", "installment", "installments",
)
_DELIVERY_TERMS = (
    "\u062a\u0648\u0635\u064a\u0644", "\u062f\u064a\u0644\u064a\u0641\u0631\u064a",
    "\u0634\u062d\u0646", "\u0627\u0633\u062a\u0644\u0627\u0645", "delivery",
    "shipping", "pickup",
)
_ORDER_TERMS = (
    "\u0637\u0644\u0628\u064a", "\u0627\u0644\u0637\u0644\u0628", "\u0627\u0648\u0631\u062f\u0631",
    "\u0623\u0648\u0631\u062f\u0631", "\u062a\u062a\u0628\u0639", "\u062a\u0627\u0628\u0639",
    "\u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628",
    "order", "track", "tracking", "order status",
)
_POLICY_TERMS = (
    "\u0627\u0631\u062c\u0627\u0639", "\u0625\u0631\u062c\u0627\u0639", "\u0627\u0631\u062c\u0639",
    "\u062a\u0631\u062c\u064a\u0639", "\u0627\u0633\u062a\u0631\u062c\u0627\u0639",
    "\u0627\u0633\u062a\u0628\u062f\u0627\u0644", "\u0627\u0644\u063a\u0627\u0621",
    "\u0625\u0644\u063a\u0627\u0621", "\u0636\u0645\u0627\u0646",
    "\u0633\u064a\u0627\u0633\u0647", "\u0633\u064a\u0627\u0633\u0627\u062a",
    "return", "refund", "exchange", "cancel", "warranty", "policy",
)


def _normalise(text: str) -> str:
    text = (text or "").strip().lower()
    text = _ARABIC_DIACRITICS_RE.sub("", text)
    for src, dst in {
        "\u0623": "\u0627",
        "\u0625": "\u0627",
        "\u0622": "\u0627",
        "\u0649": "\u064a",
        "\u0629": "\u0647",
    }.items():
        text = text.replace(src, dst)
    return text


def _has_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(_normalise(term) in text for term in terms)


def _catalog_query(customer_message: str) -> str:
    text = _normalise(customer_message)
    if _has_any(text, _BROAD_CATALOG_TERMS):
        return ""
    return customer_message.strip()


def _booking_args(customer_message: str) -> dict:
    match = _ISO_DATE_RE.search(customer_message or "")
    return {"target_date": match.group(0)} if match else {}


def _order_args(customer_message: str) -> dict:
    match = re.search(r"\b[A-Z0-9][A-Z0-9_-]{3,32}\b", customer_message or "", re.I)
    return {"order_reference": match.group(0)} if match else {}


def _dedupe(calls: list[ToolCallPlan]) -> list[ToolCallPlan]:
    seen: set[tuple[str, str]] = set()
    deduped: list[ToolCallPlan] = []
    for call in calls:
        key = (call.name, repr(sorted(call.args.items())))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(call)
    return deduped


def supplemental_tool_plan(customer_message: str, intent: str) -> list[ToolCallPlan]:
    text = _normalise(customer_message)
    calls: list[ToolCallPlan] = []

    if intent == "booking":
        calls.append(ToolCallPlan("get_available_slots", _booking_args(customer_message)))
        return calls

    if intent == "support":
        if _has_any(text, _ORDER_TERMS) and not _has_any(text, _POLICY_TERMS):
            calls.append(ToolCallPlan("get_order_status", _order_args(customer_message)))
        if _has_any(text, _DELIVERY_TERMS) or not _has_any(text, _POLICY_TERMS):
            calls.append(ToolCallPlan("get_delivery_info", {}))
        if _has_any(text, _POLICY_TERMS) or not _has_any(text, _DELIVERY_TERMS):
            calls.append(ToolCallPlan("get_policies", {}))
        if _has_any(text, _PAYMENT_TERMS):
            calls.append(ToolCallPlan("get_payment_methods", {}))
        return _dedupe(calls)

    if intent == "sales":
        calls.append(ToolCallPlan("get_catalog", {"query": _catalog_query(customer_message)}))
        if _has_any(text, _OFFER_TERMS):
            calls.append(ToolCallPlan("get_offers", {}))
        if _has_any(text, _PACKAGE_TERMS):
            calls.append(ToolCallPlan("get_packages", {}))
        if _has_any(text, _PAYMENT_TERMS):
            calls.append(ToolCallPlan("get_payment_methods", {}))
        return _dedupe(calls)

    if _has_any(text, _DELIVERY_TERMS + _POLICY_TERMS):
        return supplemental_tool_plan(customer_message, "support")
    if _has_any(text, _OFFER_TERMS + _PACKAGE_TERMS + _PAYMENT_TERMS):
        return supplemental_tool_plan(customer_message, "sales")

    return []
