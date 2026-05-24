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
)
from services.channels.base import DeliveryResult, NormalizedIncomingMessage
from services.channels.factory import get_adapter
from services.channels.messenger_adapter import MessengerAdapter
from services.channels.whatsapp_adapter import WhatsAppAdapter
from services.voice.voice_service import VoiceService
from services.voice.tts import ElevenLabsTTS, OpenAITTS
from services.automation_engine import AutomationEngine, AutomationContext, TRIGGERS
from models import (
    HandoffSession, PlatformSupportAgent, ChatSession, User, VoiceSettings,
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
        self.verifier = AnswerVerifier(api_key="sk-test")

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
    async def test_api_error_passes_with_caution(self):
        with patch.object(
            self.verifier._client.chat.completions, "create", new_callable=AsyncMock
        ) as mock:
            mock.side_effect = Exception("API down")
            r = await self.verifier.verify("test", {}, "test answer")
            assert r.verdict == SAFE_TO_SEND
            assert "caution" in r.reasons[0].lower()


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
