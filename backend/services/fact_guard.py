"""Deterministic guardrails for Humanizer rewrites.

The Humanizer is allowed to change tone and wording, but it must not change
business facts. This module performs cheap local checks before the LLM verifier:
numbers, currencies, and catalog product names must survive the rewrite.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
import re
from typing import Any


_ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u0640]")
_PUNCT_RE = re.compile(r"[\s\-_.,:;!?؟،/\\|()\[\]{}]+")
_NUMBER_RE = re.compile(r"[\d\u0660-\u0669]+(?:[.,\u066b][\d\u0660-\u0669]+)?")

_DIGIT_TRANSLATION = str.maketrans(
    "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹",
    "01234567890123456789",
)

_CURRENCY_ALIASES = {
    "JOD": (
        "jod", "jd", "د.ا", "د.أ", "دينار", "دنانير",
        "اردني", "اردنية", "أردني", "أردنية",
    ),
    "USD": ("usd", "$", "dollar", "dollars", "دولار"),
    "EUR": ("eur", "€", "euro", "euros", "يورو"),
    "SAR": ("sar", "riyal", "riyals", "ريال", "ر.س", "سعودي"),
    "AED": ("aed", "dirham", "dirhams", "درهم", "د.إ", "اماراتي"),
    "ILS": ("ils", "nis", "shekel", "shekels", "شيكل", "شاقل"),
}


@dataclass
class FactGuardResult:
    safe: bool
    reasons: list[str] = field(default_factory=list)
    missing_numbers: list[str] = field(default_factory=list)
    added_numbers: list[str] = field(default_factory=list)
    missing_products: list[str] = field(default_factory=list)
    added_products: list[str] = field(default_factory=list)


def _normalise_text(text: str | None) -> str:
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
    return text.translate(_DIGIT_TRANSLATION)


def _compact_text(text: str | None) -> str:
    return _PUNCT_RE.sub("", _normalise_text(text))


def _normalise_number(raw: str) -> str:
    cleaned = raw.translate(_DIGIT_TRANSLATION).replace("\u066b", ".")
    cleaned = cleaned.replace(",", ".")
    if cleaned.startswith("0") and "." not in cleaned and len(cleaned) > 1:
        return cleaned
    try:
        value = Decimal(cleaned)
    except InvalidOperation:
        return cleaned
    normalised = format(value.normalize(), "f")
    if "." in normalised:
        normalised = normalised.rstrip("0").rstrip(".")
    return normalised or "0"


def _extract_numbers(text: str | None) -> set[str]:
    return {_normalise_number(m.group(0)) for m in _NUMBER_RE.finditer(text or "")}


def _extract_currencies(text: str | None) -> set[str]:
    normalised = _normalise_text(text)
    compact = _compact_text(text)
    found: set[str] = set()
    for canonical, aliases in _CURRENCY_ALIASES.items():
        for alias in aliases:
            alias_normalised = _normalise_text(alias)
            if not alias_normalised:
                continue
            if alias_normalised in normalised or _compact_text(alias) in compact:
                found.add(canonical)
                break
    return found


def _is_catalog_item_dict(value: dict[str, Any]) -> bool:
    if not value.get("name"):
        return False
    product_keys = {
        "price", "currency", "available", "category", "stock", "variants",
        "image_url", "warranty", "metadata",
    }
    return bool(product_keys & set(value.keys()))


def _extract_catalog_names(data: Any) -> set[str]:
    names: set[str] = set()
    if isinstance(data, list):
        for item in data:
            names.update(_extract_catalog_names(item))
        return names

    if not isinstance(data, dict):
        return names

    if _is_catalog_item_dict(data):
        name = str(data.get("name") or "").strip()
        if len(name) >= 2:
            names.add(name)

    for value in data.values():
        names.update(_extract_catalog_names(value))
    return names


def _names_present(text: str, names: set[str]) -> set[str]:
    compact = _compact_text(text)
    present: set[str] = set()
    for name in names:
        normalised_name = _compact_text(name)
        if len(normalised_name) >= 3 and normalised_name in compact:
            present.add(name)
    return present


def check_humanizer_preserved_facts(
    logic_draft: str,
    rewritten_text: str,
    retrieved_data: dict | None,
) -> FactGuardResult:
    draft_numbers = _extract_numbers(logic_draft)
    rewritten_numbers = _extract_numbers(rewritten_text)
    missing_numbers = sorted(draft_numbers - rewritten_numbers)
    added_numbers = sorted(rewritten_numbers - draft_numbers)

    draft_currencies = _extract_currencies(logic_draft)
    rewritten_currencies = _extract_currencies(rewritten_text)
    missing_currencies = sorted(draft_currencies - rewritten_currencies)
    added_currencies = sorted(rewritten_currencies - draft_currencies)

    catalog_names = _extract_catalog_names(retrieved_data or {})
    draft_products = _names_present(logic_draft, catalog_names)
    rewritten_products = _names_present(rewritten_text, catalog_names)
    missing_products = sorted(draft_products - rewritten_products)
    added_products = sorted(rewritten_products - draft_products)

    reasons: list[str] = []
    if missing_numbers:
        reasons.append("Humanizer removed numeric facts from the logic draft")
    if added_numbers:
        reasons.append("Humanizer introduced new numeric facts")
    if missing_currencies:
        reasons.append("Humanizer removed currency facts from the logic draft")
    if added_currencies:
        reasons.append("Humanizer introduced new currency facts")
    if missing_products:
        reasons.append("Humanizer removed catalog product names")
    if added_products:
        reasons.append("Humanizer introduced catalog product names not in the draft")

    return FactGuardResult(
        safe=not reasons,
        reasons=reasons,
        missing_numbers=missing_numbers + missing_currencies,
        added_numbers=added_numbers + added_currencies,
        missing_products=missing_products,
        added_products=added_products,
    )
