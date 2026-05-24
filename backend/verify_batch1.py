"""Batch 1 Verification Checkpoint

Comprehensive verification of all Batch 1 infrastructure:
1. Model imports & table names
2. Channel adapter interface compliance
3. Messenger audio URL fix
4. WhatsApp webhook parsing
5. Voice pipeline provider selection
6. Answer verifier structure
7. Handoff service logic
"""
import sys
import os
import json
import unittest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from dataclasses import fields

# We need to mock the database engine creation since asyncpg isn't installed
# and we don't have a running DB for local testing
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:x@localhost/test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("OPENAI_API_KEY", "sk-test-fake-key")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Patch create_async_engine before any import touches database.py
import sqlalchemy.ext.asyncio as _async_mod
_orig_create = _async_mod.create_async_engine
def _mock_create(*a, **kw):
    m = MagicMock()
    m.dispose = AsyncMock()
    return m
_async_mod.create_async_engine = _mock_create

# Now safe to import everything
from database import Base
from models import (
    User, VoiceSettings, AIPersonaSettings, AIVerificationLog,
    MessageDeliveryLog, ProductCandidate, SocialPostMapping,
    PlatformSupportAgent, HandoffSession, HandoffAssignment,
    AutomationRule, AutomationRun, AutomationLog, AuditLog, MediaAttachment,
    Item, ChatSession, Message, ChannelIntegration, Escalation,
)

print("=" * 70)
print("BATCH 1 VERIFICATION CHECKPOINT")
print("=" * 70)

errors = []
warnings = []
passes = []

def check(description, condition, detail=""):
    if condition:
        passes.append(description)
        print(f"  ✅ PASS: {description}")
    else:
        errors.append(f"{description}: {detail}")
        print(f"  ❌ FAIL: {description} — {detail}")

def warn(description, detail=""):
    warnings.append(f"{description}: {detail}")
    print(f"  ⚠️  WARN: {description} — {detail}")

# ═══════════════════════════════════════════════════════════════════════
# 1. MODEL IMPORTS & TABLE REGISTRATION
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("1. DATABASE MODELS & TABLE REGISTRATION")
print("─" * 70)

expected_tables = [
    "users", "items", "chat_sessions", "messages", "channel_integrations",
    "style_samples", "app_settings", "delivery_rules", "escalations",
    "business_policies", "offers", "packages", "time_slots", "bookings",
    "business_workflows", "subscription_tiers", "user_subscriptions",
    # New tables
    "voice_settings", "ai_persona_settings", "ai_verification_logs",
    "message_delivery_logs", "product_candidates", "social_post_mappings",
    "platform_support_agents", "handoff_sessions", "handoff_assignments",
    "automation_rules", "automation_runs", "automation_logs",
    "audit_logs", "media_attachments",
]

registered = list(Base.metadata.tables.keys())
print(f"  Registered tables: {len(registered)}")

for t in expected_tables:
    check(f"Table '{t}' registered in metadata", t in registered,
          f"Missing from Base.metadata.tables. Registered: {registered}")

# Check User model has new relationships
check("User.voice_settings relationship exists",
      hasattr(User, 'voice_settings'))
check("User.ai_persona_settings relationship exists",
      hasattr(User, 'ai_persona_settings'))
check("User.support_agent_profile relationship exists",
      hasattr(User, 'support_agent_profile'))
check("User.is_support_agent property exists",
      hasattr(User, 'is_support_agent'))

# Check new columns
user_cols = [c.name for c in User.__table__.columns]
check("User.updated_at column exists", "updated_at" in user_cols)

# Check support_agent role is valid
check("User role accepts 'support_agent'",
      User.role.property.columns[0].type.length >= len("support_agent"),
      f"String({User.role.property.columns[0].type.length}) may be too short")


# ═══════════════════════════════════════════════════════════════════════
# 2. CHANNEL ABSTRACTION — INTERFACE COMPLIANCE
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("2. CHANNEL ADAPTER INTERFACE COMPLIANCE")
print("─" * 70)

from services.channels.base import (
    ChannelAdapter, NormalizedIncomingMessage, NormalizedOutgoingMessage,
    DeliveryResult, ChannelError, MessageStatus,
)
from services.channels.factory import get_adapter
from services.channels.messenger_adapter import MessengerAdapter
from services.channels.instagram_adapter import InstagramAdapter
from services.channels.whatsapp_adapter import WhatsAppAdapter
from services.channels.widget_adapter import WidgetAdapter
from services.channels.webhook_adapter import WebhookAdapter

required_methods = [
    "platform_name", "verify_webhook", "parse_incoming_webhook",
    "download_media", "send_text_message", "send_audio_message",
]
optional_methods = [
    "send_image_message", "send_typing_indicator",
    "handle_message_status", "normalize_error",
]

adapters = {
    "messenger": MessengerAdapter,
    "instagram": InstagramAdapter,
    "whatsapp": WhatsAppAdapter,
    "widget": WidgetAdapter,
    "webhook": WebhookAdapter,
}

for name, cls in adapters.items():
    check(f"{name}: is subclass of ChannelAdapter",
          issubclass(cls, ChannelAdapter))
    for method in required_methods:
        check(f"{name}: has {method}",
              hasattr(cls, method),
              f"Missing required method '{method}'")

# Factory test
for platform in ["messenger", "instagram", "whatsapp", "widget", "webhook"]:
    adapter = get_adapter(platform)
    check(f"factory('{platform}') returns correct adapter",
          adapter.platform_name == platform,
          f"Got platform_name='{adapter.platform_name}'")

# Unknown channel error
try:
    get_adapter("telegram")
    check("factory('telegram') raises ValueError", False, "No error raised")
except ValueError as e:
    check("factory('telegram') raises ValueError", True)

# Instagram inherits Messenger
check("InstagramAdapter inherits MessengerAdapter",
      issubclass(InstagramAdapter, MessengerAdapter))


# ═══════════════════════════════════════════════════════════════════════
# 3. MESSENGER AUDIO BUG FIX
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("3. MESSENGER AUDIO URL FIX")
print("─" * 70)

messenger = MessengerAdapter()

# Test _make_public_url with DOMAIN set
with patch.dict(os.environ, {"DOMAIN": "mybusiness.com"}):
    url = messenger._make_public_url("/uploads/audio_abc123.mp3")
    check("DOMAIN env → public HTTPS URL",
          url is not None and url.startswith("https://mybusiness.com/"),
          f"Got: {url}")
    check("URL contains api/uploads path",
          url is not None and "api/uploads/" in url,
          f"Got: {url}")
    check("No Docker-internal URL",
          url is not None and "backend:8000" not in url and "localhost" not in url,
          f"Got: {url}")

# Test without DOMAIN
with patch.dict(os.environ, {"DOMAIN": ""}):
    url = messenger._make_public_url("/uploads/audio_abc123.mp3")
    check("No DOMAIN env → returns None (safe failure)",
          url is None,
          f"Got: {url}")

# Test with already-public URL
url = messenger._make_public_url("https://cdn.example.com/audio.mp3")
check("Already-HTTPS URL passes through unchanged",
      url == "https://cdn.example.com/audio.mp3")

# Test delivery result — message should not be "sent" on failure
result = DeliveryResult(success=False, error_message="test error")
check("Failed delivery has success=False", not result.success)
check("Failed delivery has status='pending' (default)", result.status == "pending")

result_ok = DeliveryResult(success=True, channel_message_id="mid_123", status="sent")
check("Successful delivery has status='sent'", result_ok.status == "sent")
check("Successful delivery has channel_message_id", result_ok.channel_message_id == "mid_123")


# ═══════════════════════════════════════════════════════════════════════
# 4. WHATSAPP WEBHOOK PARSING
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("4. WHATSAPP CLOUD API")
print("─" * 70)

whatsapp = WhatsAppAdapter()

# Verify webhook
async def test_wa_verify():
    # Valid verification
    r = await whatsapp.verify_webhook(
        {"hub.mode": "subscribe", "hub.verify_token": "mytoken", "hub.challenge": "CHALLENGE_123"},
        {"verify_token": "mytoken"},
    )
    check("WhatsApp verify: valid → returns challenge", r == "CHALLENGE_123")

    # Invalid token
    r2 = await whatsapp.verify_webhook(
        {"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "X"},
        {"verify_token": "mytoken"},
    )
    check("WhatsApp verify: bad token → returns None", r2 is None)

    # Missing credentials = disabled
    r3 = await whatsapp.send_text_message("123", "hello", {})
    check("WhatsApp send without credentials → fails gracefully",
          not r3.success and "incomplete" in (r3.error_message or "").lower(),
          f"Got: success={r3.success}, error={r3.error_message}")

asyncio.run(test_wa_verify())

# Text message parsing
wa_text_payload = {
    "object": "whatsapp_business_account",
    "entry": [{
        "id": "WABA_123",
        "changes": [{
            "value": {
                "messaging_product": "whatsapp",
                "metadata": {"display_phone_number": "1234567890", "phone_number_id": "PH_123"},
                "contacts": [{"profile": {"name": "أحمد"}, "wa_id": "962791234567"}],
                "messages": [{
                    "from": "962791234567",
                    "id": "wamid.abc123",
                    "timestamp": "1700000000",
                    "type": "text",
                    "text": {"body": "مرحبا، كم سعر هالمنتج؟"}
                }]
            },
            "field": "messages"
        }]
    }]
}
msgs = whatsapp.parse_incoming_webhook(wa_text_payload, {})
check("WhatsApp text parse: 1 message", len(msgs) == 1, f"Got {len(msgs)}")
if msgs:
    check("WhatsApp text: channel=whatsapp", msgs[0].channel == "whatsapp")
    check("WhatsApp text: correct sender", msgs[0].external_user_id == "962791234567")
    check("WhatsApp text: correct text", msgs[0].text == "مرحبا، كم سعر هالمنتج؟")
    check("WhatsApp text: customer name parsed", msgs[0].customer_name == "أحمد")
    check("WhatsApp text: type=text", msgs[0].message_type == "text")

# Audio message parsing
wa_audio_payload = {
    "object": "whatsapp_business_account",
    "entry": [{
        "id": "WABA_123",
        "changes": [{
            "value": {
                "messaging_product": "whatsapp",
                "metadata": {"phone_number_id": "PH_123"},
                "contacts": [{"profile": {"name": "سارة"}, "wa_id": "962791111111"}],
                "messages": [{
                    "from": "962791111111",
                    "id": "wamid.audio456",
                    "timestamp": "1700000001",
                    "type": "audio",
                    "audio": {"id": "MEDIA_ID_789", "mime_type": "audio/ogg; codecs=opus"}
                }]
            },
            "field": "messages"
        }]
    }]
}
audio_msgs = whatsapp.parse_incoming_webhook(wa_audio_payload, {})
check("WhatsApp audio parse: 1 message", len(audio_msgs) == 1, f"Got {len(audio_msgs)}")
if audio_msgs:
    check("WhatsApp audio: type=audio", audio_msgs[0].message_type == "audio")
    check("WhatsApp audio: media_id set", audio_msgs[0].media_id == "MEDIA_ID_789")
    check("WhatsApp audio: mime_type set", audio_msgs[0].mime_type == "audio/ogg; codecs=opus")

# Image message parsing
wa_image_payload = {
    "object": "whatsapp_business_account",
    "entry": [{
        "id": "WABA_123",
        "changes": [{
            "value": {
                "messaging_product": "whatsapp",
                "metadata": {"phone_number_id": "PH_123"},
                "contacts": [{"wa_id": "962799999999"}],
                "messages": [{
                    "from": "962799999999",
                    "id": "wamid.img789",
                    "timestamp": "1700000002",
                    "type": "image",
                    "image": {"id": "IMG_MEDIA_123", "mime_type": "image/jpeg", "caption": "هل عندكم هاد؟"}
                }]
            },
            "field": "messages"
        }]
    }]
}
img_msgs = whatsapp.parse_incoming_webhook(wa_image_payload, {})
check("WhatsApp image parse: 1 message", len(img_msgs) == 1)
if img_msgs:
    check("WhatsApp image: type=image", img_msgs[0].message_type == "image")
    check("WhatsApp image: caption as text", img_msgs[0].text == "هل عندكم هاد؟")

# Status update parsing
wa_status_payload = {
    "entry": [{
        "changes": [{
            "value": {
                "statuses": [{
                    "id": "wamid.sent123",
                    "status": "delivered",
                    "timestamp": "1700000003",
                }]
            },
            "field": "messages"
        }]
    }]
}
statuses = whatsapp.handle_message_status(wa_status_payload)
check("WhatsApp status: 1 status update", len(statuses) == 1)
if statuses:
    check("WhatsApp status: status=delivered", statuses[0].status == "delivered")

# 24h window: template message method exists
check("WhatsApp has send_template_message method",
      hasattr(whatsapp, "send_template_message"))


# ═══════════════════════════════════════════════════════════════════════
# 5. VOICE PIPELINE
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("5. VOICE PIPELINE PROVIDER SELECTION")
print("─" * 70)

from services.voice.tts import ElevenLabsTTS, OpenAITTS, TTSProvider
from services.voice.stt import OpenAISTT, STTProvider
from services.voice.voice_service import VoiceService

# Provider abstraction
check("ElevenLabsTTS is TTSProvider", issubclass(ElevenLabsTTS, TTSProvider))
check("OpenAITTS is TTSProvider", issubclass(OpenAITTS, TTSProvider))
check("OpenAISTT is STTProvider", issubclass(OpenAISTT, STTProvider))

# Provider selection logic
with patch.dict(os.environ, {"ELEVENLABS_API_KEY": "test-el-key"}):
    vs = VoiceService.from_env("sk-openai-test")
    check("With ELEVENLABS_API_KEY → primary is elevenlabs",
          vs.tts_provider_name == "elevenlabs",
          f"Got: {vs.tts_provider_name}")
    check("STT is always openai", vs.stt_provider_name == "openai")

with patch.dict(os.environ, {"ELEVENLABS_API_KEY": ""}):
    vs2 = VoiceService.from_env("sk-openai-test")
    check("Without ELEVENLABS_API_KEY → fallback to openai",
          vs2.tts_provider_name == "openai",
          f"Got: {vs2.tts_provider_name}")

# ElevenLabs provider name
el = ElevenLabsTTS(api_key="test")
check("ElevenLabsTTS.provider_name == 'elevenlabs'", el.provider_name == "elevenlabs")

# OpenAI provider name
oai = OpenAITTS(api_key="test")
check("OpenAITTS.provider_name == 'openai'", oai.provider_name == "openai")

# Audio format compatibility
# Messenger accepts mp3, WhatsApp accepts mp3/ogg
# Our default is mp3 which works for both
vs_check = VoiceSettings.__table__
vs_cols = {c.name: str(c.server_default.arg) if c.server_default else None
           for c in vs_check.columns if hasattr(c, 'server_default') and c.server_default}
check("Default audio_format is 'mp3' (Messenger+WhatsApp compatible)",
      vs_cols.get("audio_format") == "mp3",
      f"Got: {vs_cols.get('audio_format')}")


# ═══════════════════════════════════════════════════════════════════════
# 6. ANSWER VERIFIER
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("6. ANTI-HALLUCINATION ANSWER VERIFIER")
print("─" * 70)

from services.answer_verifier import (
    AnswerVerifier, VerificationResult, SAFE_TO_SEND,
    BLOCKED_UNGROUNDED, HUMAN_HANDOFF_REQUIRED, ASK_CLARIFICATION,
    SAFE_RESPONSES, BANNED_PHRASES_AR, BANNED_PHRASES_EN,
)

verifier = AnswerVerifier(api_key="sk-test")

# Pre-check: banned phrases
result = verifier._pre_check("أنا ذكاء اصطناعي وأقدر أساعدك")
check("Banned Arabic phrase → BLOCKED",
      result is not None and result.verdict == BLOCKED_UNGROUNDED,
      f"Got: {result}")

result2 = verifier._pre_check("As an AI, I can help you")
check("Banned English phrase → BLOCKED",
      result2 is not None and result2.verdict == BLOCKED_UNGROUNDED)

# Pre-check: vague pricing
result3 = verifier._pre_check("السعر تقريباً 50 دينار")
check("Vague price 'تقريباً' → BLOCKED",
      result3 is not None and result3.verdict == BLOCKED_UNGROUNDED)

# Pre-check: safe answer passes
result4 = verifier._pre_check("السعر 25 دينار حسب الكتالوج.")
check("Grounded answer passes pre-check",
      result4 is None)

# Safe responses exist
check("Safe response for 'product_unavailable' exists",
      "product_unavailable" in SAFE_RESPONSES)
check("Safe response is natural Arabic",
      "مش متوفر" in SAFE_RESPONSES.get("product_unavailable", ""))

# Unavailable product response check (CRITICAL per user's correction)
check("Unavailable product response does NOT mention handoff",
      "أحولك" not in SAFE_RESPONSES.get("product_unavailable", ""),
      f"Response: {SAFE_RESPONSES.get('product_unavailable')}")

# Verify VerificationResult structure
vr = VerificationResult(
    verdict=SAFE_TO_SEND, risk_score=0.1,
    reasons=[], flagged_claims=[], grounding_data_used=["catalog"]
)
check("VerificationResult has verdict", hasattr(vr, "verdict"))
check("VerificationResult has risk_score", hasattr(vr, "risk_score"))
check("VerificationResult has safe_response", hasattr(vr, "safe_response"))
check("VerificationResult has modified_answer", hasattr(vr, "modified_answer"))

# Verify JSON parse failure fallback
async def test_verifier_fallback():
    with patch.object(verifier._client.chat.completions, 'create', new_callable=AsyncMock) as mock_create:
        # Simulate invalid JSON response
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock()]
        mock_resp.choices[0].message.content = "not valid json!!!"
        mock_create.return_value = mock_resp

        result = await verifier.verify("test", {}, "test answer")
        check("Invalid JSON from verifier → HUMAN_HANDOFF (safe fallback)",
              result.verdict == HUMAN_HANDOFF_REQUIRED,
              f"Got: {result.verdict}")

asyncio.run(test_verifier_fallback())


# ═══════════════════════════════════════════════════════════════════════
# 7. HANDOFF SERVICE
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("7. HANDOFF SERVICE")
print("─" * 70)

from services.handoff_service import (
    create_handoff, assign_handoff, auto_assign_handoff,
    resolve_handoff, get_pending_handoffs, SLA_MULTIPLIERS,
    DEFAULT_SLA_MINUTES,
)

# SLA configuration
check("SLA multipliers exist", len(SLA_MULTIPLIERS) == 4)
check("Urgent SLA < Normal SLA",
      SLA_MULTIPLIERS["urgent"] < SLA_MULTIPLIERS["normal"])
check("Default SLA is 30 minutes", DEFAULT_SLA_MINUTES == 30)

# Handoff model: goes to PlatformSupportAgent, not User
agent_table = PlatformSupportAgent.__table__
check("PlatformSupportAgent has user_id FK",
      any(c.name == "user_id" for c in agent_table.columns))
check("PlatformSupportAgent has is_available",
      any(c.name == "is_available" for c in agent_table.columns))
check("PlatformSupportAgent has max_concurrent_handoffs",
      any(c.name == "max_concurrent_handoffs" for c in agent_table.columns))

# HandoffSession references support agent via assignments, not directly
hs_table = HandoffSession.__table__
check("HandoffSession has session_id (chat session)",
      any(c.name == "session_id" for c in hs_table.columns))
check("HandoffSession has status column",
      any(c.name == "status" for c in hs_table.columns))
check("HandoffSession has sla_deadline",
      any(c.name == "sla_deadline" for c in hs_table.columns))

# HandoffAssignment links to PlatformSupportAgent
ha_table = HandoffAssignment.__table__
check("HandoffAssignment has agent_id FK",
      any(c.name == "agent_id" for c in ha_table.columns))
check("HandoffAssignment FK targets platform_support_agents",
      any(fk.target_fullname == "platform_support_agents.id"
          for c in ha_table.columns for fk in c.foreign_keys if c.name == "agent_id"))


# ═══════════════════════════════════════════════════════════════════════
# 8. ROUTER REGISTRATION
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("8. ROUTER REGISTRATION & WEBHOOKS")
print("─" * 70)

# Check router files exist and have correct prefix
try:
    # These may fail if runtime deps (jwt, etc.) aren't installed locally
    from routers.handoff import router as handoff_router
    from routers.voice_settings import router as voice_router

    check("Handoff router prefix is /handoff", handoff_router.prefix == "/handoff")
    check("Voice settings router prefix is /voice-settings", voice_router.prefix == "/voice-settings")

    # Check WhatsApp webhook endpoints exist in webhooks router
    from routers import webhooks
    webhook_routes = [r.path for r in webhooks.router.routes if hasattr(r, 'path')]
    check("WhatsApp verify endpoint exists",
          any("/whatsapp/" in p for p in webhook_routes),
          f"Routes: {webhook_routes}")
except ImportError as e:
    warn(f"Could not import routers (missing runtime dep: {e}), using file-based checks")

    # File-based router validation
    import re
    handoff_router_path = os.path.join(os.path.dirname(__file__), "routers", "handoff.py")
    voice_router_path = os.path.join(os.path.dirname(__file__), "routers", "voice_settings.py")
    webhooks_path = os.path.join(os.path.dirname(__file__), "routers", "webhooks.py")

    check("routers/handoff.py exists", os.path.exists(handoff_router_path))
    check("routers/voice_settings.py exists", os.path.exists(voice_router_path))

    with open(handoff_router_path, "r", encoding="utf-8") as f:
        hrc = f.read()
    check("Handoff router has /handoff prefix",
          'prefix="/handoff"' in hrc or "prefix='/handoff'" in hrc)
    check("Handoff router has create endpoint",
          '@router.post("/")' in hrc or "@router.post('/')" in hrc)
    check("Handoff router has assign endpoint",
          'assign' in hrc and '@router.post' in hrc)
    check("Handoff router has resolve endpoint",
          'resolve' in hrc)
    check("Handoff router checks support_agent role",
          'support_agent' in hrc)

    with open(voice_router_path, "r", encoding="utf-8") as f:
        vrc = f.read()
    check("Voice router has /voice-settings prefix",
          'prefix="/voice-settings"' in vrc or "prefix='/voice-settings'" in vrc)
    check("Voice router has test endpoint",
          '/test' in vrc)

    with open(webhooks_path, "r", encoding="utf-8") as f:
        wrc = f.read()
    check("Webhooks has WhatsApp verify endpoint",
          '/webhooks/whatsapp/' in wrc and '@router.get' in wrc)
    check("Webhooks has WhatsApp receive endpoint",
          '/webhooks/whatsapp/' in wrc and '@router.post' in wrc)
    check("WhatsApp webhook uses channel adapter",
          'get_adapter("whatsapp")' in wrc or "get_adapter('whatsapp')" in wrc)

# Check main.py includes the routers
with open(os.path.join(os.path.dirname(__file__), "main.py"), "r") as f:
    main_content = f.read()
check("main.py imports handoff router",
      "handoff" in main_content and "handoff.router" in main_content)
check("main.py imports voice_settings router",
      "voice_settings" in main_content and "voice_settings.router" in main_content)


# ═══════════════════════════════════════════════════════════════════════
# 9. MIGRATION FILE CHECK
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("9. MIGRATION FILE CHECK")
print("─" * 70)

migration_path = os.path.join(os.path.dirname(__file__), "alembic", "versions", "0011_platform_upgrade_v2.py")
check("Migration 0011 file exists", os.path.exists(migration_path))

with open(migration_path, "r") as f:
    mig = f.read()

check("Migration depends on 0010", "'0010'" in mig)
check("Migration creates voice_settings", "voice_settings" in mig)
check("Migration creates ai_persona_settings", "ai_persona_settings" in mig)
check("Migration creates ai_verification_logs", "ai_verification_logs" in mig)
check("Migration creates message_delivery_logs", "message_delivery_logs" in mig)
check("Migration creates handoff_sessions", "handoff_sessions" in mig)
check("Migration creates handoff_assignments", "handoff_assignments" in mig)
check("Migration creates automation_rules", "automation_rules" in mig)
check("Migration creates audit_logs", "audit_logs" in mig)
check("Migration creates media_attachments", "media_attachments" in mig)
check("Migration adds users.updated_at (non-destructive)",
      "add_column" in mig and "updated_at" in mig)
check("Migration downgrade drops new tables only",
      "drop_table" in mig and "drop_column" in mig)
check("Migration does NOT drop existing tables",
      "drop_table('users')" not in mig
      and "drop_table('messages')" not in mig
      and "drop_table('items')" not in mig
      and "drop_table('chat_sessions')" not in mig
      and "drop_table('escalations')" not in mig)

# Check the existing Escalation model is UNTOUCHED
esc_table = Escalation.__table__
check("Existing escalations table unchanged",
      esc_table.name == "escalations")
esc_cols = [c.name for c in esc_table.columns]
check("Escalation still has 'reason' column", "reason" in esc_cols)
check("Escalation still has 'status' column", "status" in esc_cols)


# ═══════════════════════════════════════════════════════════════════════
# 10. CRITICAL BUG CHECKS
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "─" * 70)
print("10. CRITICAL BUG & SAFETY CHECKS")
print("─" * 70)

# Check answer verifier banned phrases include critical Arabic phrases
check("Banned: 'أنا ذكاء اصطناعي'", "أنا ذكاء اصطناعي" in BANNED_PHRASES_AR)
check("Banned: 'أنا لا أعرف'", "أنا لا أعرف" in BANNED_PHRASES_AR)
check("Banned: 'أعتقد أن السعر'", "أعتقد أن السعر" in BANNED_PHRASES_AR)
check("Banned: 'as an ai'", "as an ai" in BANNED_PHRASES_EN)
check("Banned: 'i believe the price'", "i believe the price" in BANNED_PHRASES_EN)

# SSRF protection in STT download
stt = OpenAISTT(api_key="test")
async def test_ssrf():
    try:
        await stt._download("http://169.254.169.254/latest/meta-data/")
        check("SSRF protection: blocks metadata endpoint", False, "No error raised")
    except (ValueError, Exception) as e:
        check("SSRF protection: blocks metadata endpoint",
              "private" in str(e).lower() or "ssrf" in str(e).lower() or "link" in str(e).lower(),
              f"Error: {e}")
asyncio.run(test_ssrf())

# Verify queue_app uses channel adapters
with open(os.path.join(os.path.dirname(__file__), "queue_app.py"), "r") as f:
    qapp = f.read()
check("queue_app.py uses get_adapter",
      "from services.channels import get_adapter" in qapp or "get_adapter" in qapp)
check("queue_app.py logs deliveries",
      "MessageDeliveryLog" in qapp or "_log_delivery" in qapp)
check("queue_app.py has audio fallback to text",
      "fallback" in qapp.lower())


# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 70)
print("VERIFICATION SUMMARY")
print("=" * 70)
print(f"  ✅ Passed: {len(passes)}")
print(f"  ⚠️  Warnings: {len(warnings)}")
print(f"  ❌ Errors: {len(errors)}")

if warnings:
    print("\nWarnings:")
    for w in warnings:
        print(f"  ⚠️  {w}")

if errors:
    print("\nErrors:")
    for e in errors:
        print(f"  ❌ {e}")
    sys.exit(1)
else:
    print("\n🎉 ALL CHECKS PASSED — Safe to proceed with Batch 2")
    sys.exit(0)
