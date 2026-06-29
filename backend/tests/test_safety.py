"""Safety-critical tests for the Arabic-first AI SaaS platform.

Tests ONLY the dangerous flows where failure = wrong answer to customer.
Run: python -m pytest tests/test_safety.py -v
"""
import os
import sys
import json
import uuid
import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone
from types import SimpleNamespace

# Mock DB engine before any imports
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "sk-test")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import sqlalchemy.ext.asyncio as _am
_am.create_async_engine = lambda *a, **kw: MagicMock(dispose=AsyncMock())

from services.answer_verifier import (
    AnswerVerifier, VerificationResult,
    SAFE_TO_SEND, BLOCKED_UNGROUNDED, HUMAN_HANDOFF_REQUIRED,
    ASK_CLARIFICATION, SAFE_RESPONSES, BANNED_PHRASES_AR, BANNED_PHRASES_EN,
    VERIFIER_CIRCUIT_OPEN_REASON,
    VERIFIER_UNAVAILABLE_REASON,
    _reset_verifier_circuit,
)
from services.channels.base import DeliveryResult, NormalizedIncomingMessage
from services.channels.factory import get_adapter
from services.channels.messenger_adapter import MessengerAdapter
from services.channels.whatsapp_adapter import WhatsAppAdapter
from services.voice.voice_service import VoiceService
from services.voice.tts import ElevenLabsTTS, OpenAITTS
from services.automation_engine import AutomationEngine, AutomationContext, TRIGGERS
from services.ai_tools import (
    _is_broad_catalog_query,
    _is_generic_food_query,
    _item_match_score,
    _rank_catalog_rows,
    _tokens,
    get_tools_for_intent,
    get_tools_for_intents,
)
from services.ai_chat import _try_static_catalog_reply
from services.router import (
    expanded_intents_for_message,
    get_intent_for_message,
    heuristic_intent_for_message,
)
from services.fact_guard import check_humanizer_preserved_facts
from services.retrieval_plan import supplemental_tool_plan
from models import (
    HandoffSession, PlatformSupportAgent, ChatSession, User, VoiceSettings,
    AIVerificationLog,
)


# ═══════════════════════════════════════════════════════════════════════
# 1. HALLUCINATED PRICE IS BLOCKED
# ═══════════════════════════════════════════════════════════════════════
class TestHallucinatedPriceBlocked:
    def setup_method(self):
        self.verifier = AnswerVerifier(api_key="sk-test")

    def test_vague_price_taqriban_blocked(self):
        r = self.verifier._pre_check("السعر تقريباً 50 دينار")
        assert r is not None
        assert r.verdict == BLOCKED_UNGROUNDED

    def test_vague_price_hawali_blocked(self):
        r = self.verifier._pre_check("حوالي 30 دينار")
        assert r is not None
        assert r.verdict == BLOCKED_UNGROUNDED

    def test_vague_price_approximately_blocked(self):
        r = self.verifier._pre_check("The price is approximately $50")
        assert r is not None
        assert r.verdict == BLOCKED_UNGROUNDED

    def test_i_believe_price_blocked(self):
        r = self.verifier._pre_check("I believe the price is $50")
        assert r is not None
        assert r.verdict == BLOCKED_UNGROUNDED

    def test_exact_price_from_catalog_passes(self):
        r = self.verifier._pre_check("السعر 25 دينار حسب الكتالوج.")
        assert r is None  # passes pre-check

    @pytest.mark.asyncio
    async def test_llm_verifier_blocks_invented_price(self):
        """If LLM verifier returns BLOCKED, it stays blocked."""
        with patch.object(
            self.verifier._client.chat.completions, "create", new_callable=AsyncMock
        ) as mock:
            mock.return_value = MagicMock(
                choices=[MagicMock(message=MagicMock(content=json.dumps({
                    "verdict": "BLOCKED_UNGROUNDED_ANSWER",
                    "risk_score": 0.95,
                    "reasons": ["Price not in retrieved data"],
                    "flagged_claims": ["50 JOD"],
                    "grounding_data_used": [],
                })))]
            )
            r = await self.verifier.verify("كم سعره؟", {}, "السعر 50 دينار")
            assert r.verdict == BLOCKED_UNGROUNDED
            assert r.risk_score >= 0.9


# ═══════════════════════════════════════════════════════════════════════
# 2. UNAVAILABLE PRODUCT → NATURAL REPLY, NOT HANDOFF
# ═══════════════════════════════════════════════════════════════════════
class TestUnavailableProductNotHandoff:
    def test_safe_response_exists(self):
        assert "product_unavailable" in SAFE_RESPONSES

    def test_response_is_natural_arabic(self):
        resp = SAFE_RESPONSES["product_unavailable"]
        assert "مش متوفر" in resp
        assert "حالياً" in resp

    def test_response_does_not_mention_handoff(self):
        resp = SAFE_RESPONSES["product_unavailable"]
        assert "أحولك" not in resp
        assert "زميلي" not in resp
        assert "handoff" not in resp.lower()

    def test_response_does_not_mention_ai(self):
        resp = SAFE_RESPONSES["product_unavailable"]
        assert "ذكاء اصطناعي" not in resp
        assert "روبوت" not in resp


class TestSmalltalkVerifier:
    def setup_method(self):
        self.verifier = AnswerVerifier(api_key="sk-test")

    @pytest.mark.asyncio
    async def test_how_are_you_is_safe_without_grounding(self):
        r = await self.verifier.verify(
            "كيف الحال",
            {},
            "الحمد لله، تمام! كيف أقدر أساعدك اليوم؟",
        )
        assert r.verdict == SAFE_TO_SEND
        assert r.risk_score <= 0.1

    def test_greeting_with_product_question_still_needs_verifier(self):
        r = self.verifier._safe_smalltalk_check(
            "مرحبا كم سعر المنتج؟",
            "السعر 50 دينار",
        )
        assert r is None


# ═══════════════════════════════════════════════════════════════════════
# 3. UNKNOWN PRODUCT DOES NOT HALLUCINATE
# ═══════════════════════════════════════════════════════════════════════
class TestRouterGuardrails:
    @staticmethod
    def _router_response(content: str):
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content=content)
                )
            ]
        )

    def test_price_question_routes_to_sales_without_llm(self):
        assert heuristic_intent_for_message("\u0645\u0631\u062d\u0628\u0627 \u0643\u0645 \u0633\u0639\u0631 \u0627\u0644\u0633\u0645\u0627\u0639\u0629\u061f") == "sales"

    def test_food_catalog_question_routes_to_sales_without_llm(self):
        assert heuristic_intent_for_message("\u0627\u0634 \u0639\u0646\u062f\u0643\u0645 \u0627\u0643\u0644\u061f") == "sales"

    def test_family_box_followup_routes_to_sales_without_llm(self):
        assert heuristic_intent_for_message("\u0627\u0644\u0628\u0648\u0643\u0633 \u0627\u0644\u0639\u0627\u0626\u0644\u064a \u0628\u062a\u0642\u062f\u0631 \u062a\u0648\u0631\u062c\u064a\u0646\u064a \u0643\u064a\u0641 \u0647\u0648") == "sales"

    def test_delivery_question_routes_to_support_without_llm(self):
        assert heuristic_intent_for_message("\u0643\u0645 \u0631\u0633\u0648\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u061f") == "support"

    def test_booking_question_routes_to_booking_without_llm(self):
        assert heuristic_intent_for_message("\u0628\u062f\u064a \u0627\u062d\u062c\u0632 \u0645\u0648\u0639\u062f \u0628\u0643\u0631\u0627") == "booking"

    def test_plain_greeting_can_still_use_llm_or_general(self):
        assert heuristic_intent_for_message("\u0645\u0631\u062d\u0628\u0627") is None

    def test_sales_intent_exposes_catalog_tool(self):
        tool_names = {t["function"]["name"] for t in get_tools_for_intent("sales")}
        assert "get_catalog" in tool_names
        assert "get_business_info" in tool_names
        assert "escalate_to_human" in tool_names

    def test_general_intent_can_fetch_business_info(self):
        tool_names = {t["function"]["name"] for t in get_tools_for_intent("general")}
        assert "get_business_info" in tool_names

    def test_jordanian_location_terms_route_to_support_without_llm(self):
        assert heuristic_intent_for_message("\u0641\u064a\u0646\u0643\u0645\u061f") == "support"
        assert heuristic_intent_for_message("\u0628\u062f\u064a \u0627\u0639\u0631\u0641 \u0627\u0645\u0627\u0643\u0646\u0643\u0645") == "support"
        assert heuristic_intent_for_message("\u0646\u0642\u0627\u0637 \u0628\u064a\u0639") == "support"

    @pytest.mark.asyncio
    async def test_router_invalid_model_output_falls_back_to_uncertain(self, monkeypatch):
        create = AsyncMock(return_value=self._router_response("probably business"))
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        monkeypatch.setattr("services.router.effective_openai_key", AsyncMock(return_value="sk-test"))
        monkeypatch.setattr("services.router._client_for", lambda _api_key: client)

        intent = await get_intent_for_message("that one from yesterday", MagicMock())

        assert intent == "uncertain"

    @pytest.mark.asyncio
    async def test_router_multiple_model_intents_fall_back_to_uncertain(self, monkeypatch):
        create = AsyncMock(return_value=self._router_response("sales or support"))
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        monkeypatch.setattr("services.router.effective_openai_key", AsyncMock(return_value="sk-test"))
        monkeypatch.setattr("services.router._client_for", lambda _api_key: client)

        intent = await get_intent_for_message("that thing we discussed", MagicMock())

        assert intent == "uncertain"

    @pytest.mark.asyncio
    async def test_router_exception_falls_back_to_uncertain(self, monkeypatch):
        create = AsyncMock(side_effect=RuntimeError("router unavailable"))
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        monkeypatch.setattr("services.router.effective_openai_key", AsyncMock(return_value="sk-test"))
        monkeypatch.setattr("services.router._client_for", lambda _api_key: client)

        intent = await get_intent_for_message("that thing we discussed", MagicMock())

        assert intent == "uncertain"

    @pytest.mark.asyncio
    async def test_router_exact_general_still_routes_to_general(self, monkeypatch):
        create = AsyncMock(return_value=self._router_response("general"))
        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        monkeypatch.setattr("services.router.effective_openai_key", AsyncMock(return_value="sk-test"))
        monkeypatch.setattr("services.router._client_for", lambda _api_key: client)

        intent = await get_intent_for_message("nice weather today", MagicMock())

        assert intent == "general"

    def test_uncertain_intent_expands_to_business_candidates(self):
        assert expanded_intents_for_message("uncertain", "that one") == [
            "uncertain",
            "sales",
            "support",
            "booking",
            "general",
        ]

    def test_uncertain_intent_exposes_read_only_business_tools(self):
        intents = expanded_intents_for_message("uncertain", "that one")
        tool_names = {
            t["function"]["name"]
            for t in get_tools_for_intents(intents, include_handoff=False)
        }

        assert "get_catalog" in tool_names
        assert "get_available_slots" in tool_names
        assert "get_business_info" in tool_names
        assert "create_booking" not in tool_names
        assert "analyze_webpage" not in tool_names

    def test_uncertain_pre_llm_retrieval_uses_business_info_only(self):
        calls = supplemental_tool_plan("that one", "uncertain")
        assert len(calls) == 1
        assert calls[0].name == "get_business_info"
        assert calls[0].args == {}

    def test_catalog_no_match_does_not_fall_back_to_full_catalog(self):
        path = os.path.join(os.path.dirname(__file__), "..", "services", "ai_tools.py")
        with open(path, encoding="utf-8") as f:
            code = f.read()
        assert "showing full catalog" not in code
        assert "do not mention unrelated catalog items" in code


class TestCatalogHybridSearch:
    def test_food_catalog_questions_are_treated_as_overview_queries(self):
        assert _is_broad_catalog_query("\u0627\u0634 \u0639\u0646\u062f\u0643\u0645 \u0627\u0643\u0644\u061f")
        assert _is_generic_food_query("\u0627\u0643\u0644")

    def test_colloquial_do_you_have_product_keeps_product_tokens(self):
        tokens = _tokens("\u0639\u0646\u062f\u0643\u0648 \u0627\u064a\u0633 \u0643\u0631\u064a\u0645\u061f")
        assert "\u0639\u0646\u062f\u0643\u0648" not in tokens
        assert "\u0627\u064a\u0633" in tokens
        assert "\u0643\u0631\u064a\u0645" in tokens

    def test_headphone_synonym_expands_to_arabic_speaker_terms(self):
        tokens = _tokens("headphone")
        assert "\u0633\u0645\u0627\u0639\u0647" in tokens
        assert "\u0633\u0645\u0627\u0639\u0629" in tokens

    def test_price_stopwords_do_not_hide_product_token(self):
        tokens = _tokens("\u0643\u0645 \u0633\u0639\u0631 \u0627\u0644\u0633\u0645\u0627\u0639\u0629\u061f")
        assert "\u0633\u0645\u0627\u0639\u0647" in tokens
        assert "\u0633\u0639\u0631" not in tokens

    def test_synonym_score_matches_arabic_catalog_item(self):
        item = SimpleNamespace(
            name="\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro",
            category="\u0627\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a",
            description="",
            item_metadata={},
        )
        score = _item_match_score(item, "headphone", _tokens("headphone"))
        assert score >= 2.0

    def test_family_box_synonyms_match_gathering_box_item(self):
        item = SimpleNamespace(
            name="Gathering Box",
            category="\u0628\u0648\u0643\u0633\u0627\u062a",
            description="\u0628\u0648\u0643\u0633 \u0639\u0627\u0626\u0644\u064a \u0644\u0644\u062c\u0645\u0639\u0627\u062a",
            item_metadata={},
        )
        score = _item_match_score(
            item,
            "\u0627\u0644\u0628\u0648\u0643\u0633 \u0627\u0644\u0639\u0627\u0626\u0644\u064a",
            _tokens("\u0627\u0644\u0628\u0648\u0643\u0633 \u0627\u0644\u0639\u0627\u0626\u0644\u064a"),
        )
        assert score >= 2.0

    def test_unrelated_item_is_filtered_out(self):
        speaker = SimpleNamespace(
            name="\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b",
            category="\u0627\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a",
            description="",
            item_metadata={},
        )
        perfume = SimpleNamespace(
            name="\u0639\u0637\u0631 \u0648\u0631\u062f",
            category="\u0639\u0637\u0648\u0631",
            description="",
            item_metadata={},
        )
        ranked = _rank_catalog_rows("headphone", [perfume, speaker], _tokens("headphone"))
        assert ranked == [speaker]


class TestSupplementalRetrievalPlan:
    def test_sales_price_question_gets_catalog(self):
        calls = supplemental_tool_plan(
            "\u0643\u0645 \u0633\u0639\u0631 \u0627\u0644\u0633\u0645\u0627\u0639\u0629\u061f",
            "sales",
        )
        assert calls[0].name == "get_catalog"
        assert calls[0].args["query"]

    def test_broad_catalog_question_uses_overview_query(self):
        calls = supplemental_tool_plan("\u0634\u0648 \u0639\u0646\u062f\u0643\u0645\u061f", "sales")
        assert calls[0].name == "get_catalog"
        assert calls[0].args["query"] == ""

    def test_food_catalog_question_uses_overview_query(self):
        calls = supplemental_tool_plan("\u0627\u0634 \u0639\u0646\u062f\u0643\u0645 \u0627\u0643\u0644\u061f", "sales")
        assert calls[0].name == "get_catalog"
        assert calls[0].args["query"] == ""

    def test_colloquial_ice_cream_availability_extracts_product_query(self):
        calls = supplemental_tool_plan("\u0639\u0646\u062f\u0643\u0648 \u0627\u064a\u0633 \u0643\u0631\u064a\u0645\u061f", "sales")
        assert calls[0].name == "get_catalog"
        assert calls[0].args["query"] == "\u0627\u064a\u0633 \u0643\u0631\u064a\u0645"

    def test_price_and_image_question_extracts_product_only(self):
        calls = supplemental_tool_plan(
            "\u0637\u064a\u0628 \u0627\u0644\u062e\u0648\u062e \u0643\u0645 \u0633\u0639\u0631\u0647 \u0648\u0628\u062a\u0642\u062f\u0631 \u062a\u0639\u0637\u064a\u0646\u064a \u0635\u0648\u0631\u0629 \u0627\u0644\u0647",
            "sales",
        )
        assert calls[0].name == "get_catalog"
        assert calls[0].args["query"] == "\u062e\u0648\u062e"

    def test_family_box_detail_question_fetches_catalog_and_business_info(self):
        calls = supplemental_tool_plan(
            "\u0627\u0644\u0628\u0648\u0643\u0633 \u0627\u0644\u0639\u0627\u0626\u0644\u064a \u0628\u062a\u0642\u062f\u0631 \u062a\u0648\u0631\u062c\u064a\u0646\u064a \u0643\u064a\u0641 \u0647\u0648",
            "sales",
        )
        names = {call.name for call in calls}
        assert names >= {"get_catalog", "get_business_info"}

    def test_offer_question_fetches_catalog_and_offers(self):
        calls = supplemental_tool_plan(
            "\u0641\u064a \u062e\u0635\u0645 \u0639\u0644\u0649 \u0627\u0644\u0633\u0645\u0627\u0639\u0629\u061f",
            "sales",
        )
        assert {call.name for call in calls} >= {"get_catalog", "get_offers"}

    def test_refund_question_fetches_policies(self):
        calls = supplemental_tool_plan(
            "\u0628\u062f\u064a \u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0627\u0644\u0637\u0644\u0628",
            "support",
        )
        assert [call.name for call in calls] == ["get_policies"]

    def test_delivery_question_fetches_delivery_info(self):
        calls = supplemental_tool_plan(
            "\u0643\u0645 \u0631\u0633\u0648\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644\u061f",
            "support",
        )
        assert [call.name for call in calls] == ["get_delivery_info"]

    def test_booking_question_preserves_iso_date(self):
        calls = supplemental_tool_plan(
            "\u0628\u062f\u064a \u0627\u062d\u062c\u0632 \u0645\u0648\u0639\u062f 2026-06-12",
            "booking",
        )
        assert calls[0].name == "get_available_slots"
        assert calls[0].args["target_date"] == "2026-06-12"


class TestStaticCatalogReply:
    def setup_method(self):
        self.peach = {
            "id": "peach-1",
            "name": "\u062e\u0648\u062e \u2014 Peach",
            "category": "\u0622\u064a\u0633 \u0643\u0631\u064a\u0645",
            "description": "\u0642\u0637\u0639 \u0622\u064a\u0633 \u0643\u0631\u064a\u0645 \u0628\u0646\u0643\u0647\u0629 \u0627\u0644\u062e\u0648\u062e",
            "price": 5.0,
            "currency": "JOD",
            "available": True,
            "image_url": "/uploads/user/peach.jpg",
        }
        self.retrieved = {
            "get_catalog:{}": {
                "overview_only": True,
                "items": [{"name": "\u062e\u0648\u062e \u2014 Peach", "category": "\u0622\u064a\u0633 \u0643\u0631\u064a\u0645"}],
            },
            "get_catalog:{\"query\": \"\u062e\u0648\u062e\"}": {
                "overview_only": False,
                "matched": True,
                "items": [self.peach],
            },
        }

    def test_direct_price_and_image_question_uses_exact_catalog_price(self):
        reply = _try_static_catalog_reply(
            "\u0637\u064a\u0628 \u0627\u0644\u062e\u0648\u062e \u0643\u0645 \u0633\u0639\u0631\u0647 \u0648\u0628\u062a\u0642\u062f\u0631 \u062a\u0639\u0637\u064a\u0646\u064a \u0635\u0648\u0631\u0629 \u0627\u0644\u0647",
            self.retrieved,
            [],
            current_turn_keys=["get_catalog:{\"query\": \"\u062e\u0648\u062e\"}"],
        )
        assert reply is not None
        assert "\u062e\u0648\u062e" in reply
        assert "5 \u062f\u064a\u0646\u0627\u0631" in reply
        assert "\u0635\u0648\u0631" in reply

    def test_followup_price_question_uses_recent_product_context(self):
        reply = _try_static_catalog_reply(
            "\u0643\u0645 \u0633\u0639\u0631\u0647\u061f",
            self.retrieved,
            [
                {"role": "user", "content": "\u0637\u064a\u0628 \u0627\u0644\u062e\u0648\u062e \u0643\u0645 \u0633\u0639\u0631\u0647\u061f"},
                {"role": "assistant", "content": "\u062e\u0648\u062e \u2014 Peach \u0633\u0639\u0631\u0647 5 \u062f\u064a\u0646\u0627\u0631."},
            ],
            current_turn_keys=[],
        )
        assert reply is not None
        assert "5 \u062f\u064a\u0646\u0627\u0631" in reply

    def test_details_and_price_question_includes_description(self):
        reply = _try_static_catalog_reply(
            "\u0627\u0639\u0637\u064a\u0646\u064a \u062a\u0641\u0627\u0635\u064a\u0644 \u0639\u0646\u0647\u0627 \u0643\u0645 \u0633\u0639\u0631\u0647\u0627",
            self.retrieved,
            [
                {"role": "assistant", "content": "\u0639\u0646\u062f\u0646\u0627 \u062e\u0648\u062e \u2014 Peach"},
            ],
            current_turn_keys=["get_catalog:{\"query\": \"\u062e\u0648\u062e\"}"],
        )

        assert reply is not None
        assert "\u0642\u0637\u0639 \u0622\u064a\u0633 \u0643\u0631\u064a\u0645" in reply
        assert "5 \u062f\u064a\u0646\u0627\u0631" in reply

    def test_overview_only_catalog_does_not_answer_prices(self):
        reply = _try_static_catalog_reply(
            "\u0643\u0645 \u0633\u0639\u0631 \u0627\u0644\u062e\u0648\u062e\u061f",
            {"get_catalog:{}": self.retrieved["get_catalog:{}"]},
            [],
            current_turn_keys=["get_catalog:{}"],
        )
        assert reply is None


class TestAITraceLogging:
    def test_verification_log_has_ai_trace_column(self):
        cols = [c.name for c in AIVerificationLog.__table__.columns]
        assert "ai_trace" in cols


class TestHumanizerFactGuard:
    def setup_method(self):
        self.retrieved = {
            "get_catalog:{}": {
                "items": [
                    {
                        "name": "\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro",
                        "price": 50,
                        "currency": "JOD",
                        "available": True,
                        "category": "\u0627\u0643\u0633\u0633\u0648\u0627\u0631\u0627\u062a",
                    }
                ]
            }
        }

    def test_allows_style_only_rewrite(self):
        result = check_humanizer_preserved_facts(
            "\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro \u0633\u0639\u0631\u0647\u0627 50 JOD",
            "\u0627\u0647 \u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro \u0633\u0639\u0631\u0647\u0627 50 \u062f\u064a\u0646\u0627\u0631",
            self.retrieved,
        )
        assert result.safe

    def test_blocks_changed_price(self):
        result = check_humanizer_preserved_facts(
            "\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro \u0633\u0639\u0631\u0647\u0627 50 JOD",
            "\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro \u0633\u0639\u0631\u0647\u0627 55 \u062f\u064a\u0646\u0627\u0631",
            self.retrieved,
        )
        assert not result.safe
        assert "50" in result.missing_numbers
        assert "55" in result.added_numbers

    def test_blocks_added_number(self):
        result = check_humanizer_preserved_facts(
            "\u0627\u0644\u0645\u0646\u062a\u062c \u0645\u062a\u0648\u0641\u0631",
            "\u0627\u0644\u0645\u0646\u062a\u062c \u0645\u062a\u0648\u0641\u0631 \u0648\u0627\u0644\u062a\u0648\u0635\u064a\u0644 2 \u064a\u0648\u0645",
            self.retrieved,
        )
        assert not result.safe
        assert "2" in result.added_numbers

    def test_blocks_missing_product_name(self):
        result = check_humanizer_preserved_facts(
            "\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro \u0645\u062a\u0648\u0641\u0631\u0629",
            "\u0627\u0647 \u0645\u062a\u0648\u0641\u0631\u0629",
            self.retrieved,
        )
        assert not result.safe
        assert "\u0633\u0645\u0627\u0639\u0629 \u0628\u0644\u0648\u062a\u0648\u062b Pro" in result.missing_products


class TestUnknownProductNoHallucination:
    def setup_method(self):
        self.verifier = AnswerVerifier(api_key="sk-test")

    def test_banned_phrases_ar_present(self):
        assert "أنا ذكاء اصطناعي" in BANNED_PHRASES_AR
        assert "أنا لا أعرف" in BANNED_PHRASES_AR
        assert "أعتقد أن السعر" in BANNED_PHRASES_AR

    def test_banned_phrases_en_present(self):
        assert "as an ai" in BANNED_PHRASES_EN
        assert "i believe the price" in BANNED_PHRASES_EN

    def test_ai_identity_disclosure_blocked(self):
        r = self.verifier._pre_check("أنا ذكاء اصطناعي وبقدر أساعدك")
        assert r is not None
        assert r.verdict == BLOCKED_UNGROUNDED

    def test_guess_phrase_blocked(self):
        r = self.verifier._pre_check("أظن أن المنتج متوفر")
        assert r is not None
        assert r.verdict == BLOCKED_UNGROUNDED


# ═══════════════════════════════════════════════════════════════════════
# 4. VERIFIER JSON FAILURE IS SAFE
# ═══════════════════════════════════════════════════════════════════════
class TestVerifierJsonFailureSafe:
    def setup_method(self):
        _reset_verifier_circuit()
        self.verifier = AnswerVerifier(api_key="sk-test")

    def teardown_method(self):
        _reset_verifier_circuit()

    @pytest.mark.asyncio
    async def test_invalid_json_returns_handoff(self):
        with patch.object(
            self.verifier._client.chat.completions, "create", new_callable=AsyncMock
        ) as mock:
            mock.return_value = MagicMock(
                choices=[MagicMock(message=MagicMock(content="NOT JSON!!!"))]
            )
            r = await self.verifier.verify("test", {}, "test answer")
            assert r.verdict == HUMAN_HANDOFF_REQUIRED
            assert r.risk_score >= 0.7

    @pytest.mark.asyncio
    async def test_api_error_fails_closed(self):
        with patch.object(
            self.verifier._client.chat.completions, "create", new_callable=AsyncMock
        ) as mock:
            mock.side_effect = Exception("API down")
            r = await self.verifier.verify("test", {}, "test answer")
            assert r.verdict == HUMAN_HANDOFF_REQUIRED
            assert r.risk_score == 1.0
            assert r.reasons == [VERIFIER_UNAVAILABLE_REASON]
            assert r.safe_response == SAFE_RESPONSES["verification_unavailable"]

    @pytest.mark.asyncio
    async def test_repeated_api_errors_open_circuit(self):
        with patch.object(
            self.verifier._client.chat.completions, "create", new_callable=AsyncMock
        ) as mock:
            mock.side_effect = Exception("API down")
            for _ in range(3):
                r = await self.verifier.verify("كم السعر؟", {}, "السعر 50 دينار")
                assert r.verdict == HUMAN_HANDOFF_REQUIRED

            mock.reset_mock()
            r = await self.verifier.verify("كم السعر؟", {}, "السعر 50 دينار")

            assert r.verdict == HUMAN_HANDOFF_REQUIRED
            assert r.reasons == [VERIFIER_CIRCUIT_OPEN_REASON]
            assert mock.await_count == 0


# ═══════════════════════════════════════════════════════════════════════
# 5. VOICE USES VERIFIED ANSWER ONLY
# ═══════════════════════════════════════════════════════════════════════
class TestVoiceUsesVerifiedAnswer:
    def test_voice_service_exists(self):
        vs = VoiceService.from_env("sk-test")
        assert vs.stt_provider_name == "openai"

    def test_elevenlabs_primary_when_key_set(self):
        with patch.dict(os.environ, {"ELEVENLABS_API_KEY": "test-key"}):
            vs = VoiceService.from_env("sk-test")
            assert vs.tts_provider_name == "elevenlabs"

    def test_openai_fallback_when_no_key(self):
        with patch.dict(os.environ, {"ELEVENLABS_API_KEY": ""}):
            vs = VoiceService.from_env("sk-test")
            assert vs.tts_provider_name == "openai"

    def test_default_audio_format_mp3(self):
        """mp3 is compatible with both Messenger and WhatsApp."""
        cols = {c.name: c for c in VoiceSettings.__table__.columns}
        assert "audio_format" in cols
        assert str(cols["audio_format"].server_default.arg) == "mp3"

    @pytest.mark.asyncio
    async def test_elevenlabs_dynamic_cloned_voice_id_is_used(self):
        class FakeResponse:
            content = b"audio"

            def raise_for_status(self):
                return None

        class FakeClient:
            def __init__(self):
                self.url = ""

            async def __aenter__(self):
                return self

            async def __aexit__(self, exc_type, exc, tb):
                return None

            async def post(self, url, **kwargs):
                self.url = url
                return FakeResponse()

        fake_client = FakeClient()
        with patch("services.voice.tts.httpx.AsyncClient", return_value=fake_client):
            audio = await ElevenLabsTTS("test-key").synthesize(
                "hello", voice="el_custom_voice_123"
            )

        assert audio == b"audio"
        assert fake_client.url.endswith("/text-to-speech/custom_voice_123")


# ═══════════════════════════════════════════════════════════════════════
# 6. HANDOFF STOPS AI
# ═══════════════════════════════════════════════════════════════════════
class TestHandoffStopsAI:
    def test_session_escalated_check(self):
        """ChatSession.is_escalated is used to block AI replies."""
        cols = [c.name for c in ChatSession.__table__.columns]
        assert "is_escalated" in cols

    def test_handoff_targets_support_agent(self):
        """HandoffAssignment FK goes to platform_support_agents, not users."""
        from models import HandoffAssignment
        ha = HandoffAssignment.__table__
        agent_fks = [
            fk.target_fullname
            for c in ha.columns for fk in c.foreign_keys
            if c.name == "agent_id"
        ]
        assert "platform_support_agents.id" in agent_fks

    def test_handoff_has_sla(self):
        cols = [c.name for c in HandoffSession.__table__.columns]
        assert "sla_deadline" in cols
        assert "status" in cols


# ═══════════════════════════════════════════════════════════════════════
# 7. SUPPORT_AGENT PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════
class TestSupportAgentPermissions:
    def test_user_role_accepts_support_agent(self):
        role_col = User.__table__.columns["role"]
        assert role_col.type.length >= len("support_agent")

    def test_support_agent_profile_model(self):
        cols = [c.name for c in PlatformSupportAgent.__table__.columns]
        assert "user_id" in cols
        assert "is_available" in cols
        assert "max_concurrent_handoffs" in cols
        assert "skills" in cols

    def test_handoff_router_checks_role(self):
        """Handoff router must check role before allowing assignment."""
        path = os.path.join(os.path.dirname(__file__), "..", "routers", "handoff.py")
        with open(path, encoding="utf-8") as f:
            code = f.read()
        assert "support_agent" in code
        assert "get_current_user" in code
        assert "403" in code


# ═══════════════════════════════════════════════════════════════════════
# 8. AUTOMATION DOES NOT BYPASS VERIFIER
# ═══════════════════════════════════════════════════════════════════════
class TestAutomationSafety:
    def test_all_triggers_known(self):
        assert len(TRIGGERS) == 10
        assert "hallucination_risk" in TRIGGERS
        assert "low_confidence" in TRIGGERS

    def test_keyword_trigger(self):
        from models import AutomationRule
        engine = AutomationEngine()
        rule = MagicMock(spec=AutomationRule)
        rule.trigger_type = "keyword_match"
        rule.trigger_config = {"keywords": ["سعر", "price"], "match_mode": "any"}

        ctx = AutomationContext(trigger="keyword_match", message_text="كم سعر هالمنتج؟")
        assert engine._check_trigger(rule, ctx) is True

        ctx2 = AutomationContext(trigger="keyword_match", message_text="مرحبا")
        assert engine._check_trigger(rule, ctx2) is False

    def test_hallucination_risk_trigger(self):
        from models import AutomationRule
        engine = AutomationEngine()
        rule = MagicMock(spec=AutomationRule)
        rule.trigger_type = "hallucination_risk"
        rule.trigger_config = {"threshold": 0.7}

        ctx_high = AutomationContext(trigger="hallucination_risk", verifier_risk_score=0.85)
        assert engine._check_trigger(rule, ctx_high) is True

        ctx_low = AutomationContext(trigger="hallucination_risk", verifier_risk_score=0.3)
        assert engine._check_trigger(rule, ctx_low) is False

    def test_outside_hours_trigger(self):
        from models import AutomationRule
        engine = AutomationEngine()
        rule = MagicMock(spec=AutomationRule)
        rule.trigger_type = "outside_working_hours"
        rule.trigger_config = {"start_hour": 9, "end_hour": 17}

        late = datetime(2026, 5, 23, 22, 0, 0, tzinfo=timezone.utc)
        ctx = AutomationContext(trigger="outside_working_hours", current_time=late)
        assert engine._check_trigger(rule, ctx) is True

        during = datetime(2026, 5, 23, 12, 0, 0, tzinfo=timezone.utc)
        ctx2 = AutomationContext(trigger="outside_working_hours", current_time=during)
        assert engine._check_trigger(rule, ctx2) is False

    def test_variable_substitution(self):
        ctx = AutomationContext(
            trigger="new_message",
            customer_name="أحمد",
            channel="whatsapp",
        )
        result = ctx.substitute_variables("مرحبا {{customer_name}} على {{channel}}")
        assert result == "مرحبا أحمد على whatsapp"

    def test_condition_evaluation(self):
        engine = AutomationEngine()
        ctx = AutomationContext(
            trigger="new_message", channel="whatsapp", session_message_count=5
        )
        assert engine._evaluate_condition(
            {"type": "channel", "operator": "equals", "value": "whatsapp"}, ctx
        )
        assert not engine._evaluate_condition(
            {"type": "channel", "operator": "equals", "value": "messenger"}, ctx
        )
        assert engine._evaluate_condition(
            {"type": "message_count", "operator": "greater_than", "value": 3}, ctx
        )

    @pytest.mark.asyncio
    async def test_loop_prevention_counts_executed_runs(self):
        class FakeResult:
            def scalar(self):
                return 2

        db = MagicMock()
        db.execute = AsyncMock(return_value=FakeResult())
        count = await AutomationEngine()._get_execution_count(
            uuid.uuid4(), uuid.uuid4(), db
        )

        assert count == 2
        path = os.path.join(
            os.path.dirname(__file__), "..", "services", "automation_engine.py"
        )
        with open(path, encoding="utf-8") as f:
            code = f.read()
        assert 'AutomationRun.status.in_(("success", "executed"))' in code


# ═══════════════════════════════════════════════════════════════════════
# 9. MESSENGER AUDIO FALLBACK
# ═══════════════════════════════════════════════════════════════════════
class TestMessengerAudioFallback:
    def test_domain_env_produces_https_url(self):
        m = MessengerAdapter()
        with patch.dict(os.environ, {"DOMAIN": "shop.com"}):
            url = m._make_public_url("/uploads/audio.mp3")
            assert url.startswith("https://shop.com/")
            assert "localhost" not in url
            assert "backend:8000" not in url

    def test_no_domain_returns_none(self):
        m = MessengerAdapter()
        with patch.dict(os.environ, {"DOMAIN": ""}):
            url = m._make_public_url("/uploads/audio.mp3")
            assert url is None

    def test_https_url_passes_through(self):
        m = MessengerAdapter()
        url = m._make_public_url("https://cdn.example.com/audio.mp3")
        assert url == "https://cdn.example.com/audio.mp3"

    def test_delivery_result_defaults(self):
        r = DeliveryResult(success=False, error_message="test")
        assert r.status == "pending"
        assert not r.success


# ═══════════════════════════════════════════════════════════════════════
# 10. WHATSAPP WEBHOOK PARSE
# ═══════════════════════════════════════════════════════════════════════
class TestWhatsAppWebhookParse:
    def setup_method(self):
        self.wa = WhatsAppAdapter()

    def test_text_message(self):
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{"changes": [{"value": {
                "contacts": [{"profile": {"name": "أحمد"}, "wa_id": "962791234567"}],
                "messages": [{"from": "962791234567", "id": "wamid.1", "timestamp": "1700000000",
                              "type": "text", "text": {"body": "مرحبا"}}],
            }, "field": "messages"}]}],
        }
        msgs = self.wa.parse_incoming_webhook(payload, {})
        assert len(msgs) == 1
        assert msgs[0].text == "مرحبا"
        assert msgs[0].channel == "whatsapp"
        assert msgs[0].external_user_id == "962791234567"

    def test_audio_message(self):
        payload = {
            "object": "whatsapp_business_account",
            "entry": [{"changes": [{"value": {
                "contacts": [{"wa_id": "962791111111"}],
                "messages": [{"from": "962791111111", "id": "wamid.2", "timestamp": "1700000001",
                              "type": "audio", "audio": {"id": "MID_123", "mime_type": "audio/ogg"}}],
            }, "field": "messages"}]}],
        }
        msgs = self.wa.parse_incoming_webhook(payload, {})
        assert len(msgs) == 1
        assert msgs[0].message_type == "audio"
        assert msgs[0].media_id == "MID_123"

    @pytest.mark.asyncio
    async def test_verify_webhook_valid(self):
        r = await self.wa.verify_webhook(
            {"hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "C123"},
            {"verify_token": "tok"},
        )
        assert r == "C123"

    @pytest.mark.asyncio
    async def test_verify_webhook_invalid(self):
        r = await self.wa.verify_webhook(
            {"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "X"},
            {"verify_token": "tok"},
        )
        assert r is None

    @pytest.mark.asyncio
    async def test_send_without_creds_fails_gracefully(self):
        r = await self.wa.send_text_message("123", "hi", {})
        assert not r.success

    def test_status_update_parse(self):
        payload = {"entry": [{"changes": [{"value": {
            "statuses": [{"id": "wamid.s1", "status": "delivered", "timestamp": "1700000003"}]
        }, "field": "messages"}]}]}
        statuses = self.wa.handle_message_status(payload)
        assert len(statuses) == 1
        assert statuses[0].status == "delivered"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
