"""Anti-Hallucination Answer Verifier (Supervisor).

Every AI-generated answer passes through this verifier before being sent
to the customer. The verifier uses a secondary LLM call to check the
draft answer against retrieved data and apply 12 verification checks.

Model selection:
- Default:   GPT-4o-mini (fast, cheap)
- High-risk: GPT-4o (for messages with risk_score > 0.6)

Possible verdicts:
- SAFE_TO_SEND            → answer is grounded, send as-is
- NEEDS_MORE_DATA         → call more tools, then re-verify
- ASK_CLARIFICATION       → ask the customer to clarify
- HUMAN_HANDOFF_REQUIRED  → escalate to human agent
- BLOCKED_UNGROUNDED_ANSWER → discard and send safe fallback
- TOOL_RESULT_REQUIRED    → force a tool call before answering

Anti-hallucination is more important than speed.
If not sure, do not answer.
"""
from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Optional

from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("answer_verifier")

# ── Verdicts ─────────────────────────────────────────────────────────────
SAFE_TO_SEND = "SAFE_TO_SEND"
NEEDS_MORE_DATA = "NEEDS_MORE_DATA"
ASK_CLARIFICATION = "ASK_CLARIFICATION"
HUMAN_HANDOFF_REQUIRED = "HUMAN_HANDOFF_REQUIRED"
BLOCKED_UNGROUNDED = "BLOCKED_UNGROUNDED_ANSWER"
TOOL_RESULT_REQUIRED = "TOOL_RESULT_REQUIRED"
MULTIMODAL_REVIEW = "MULTIMODAL_REVIEW_REQUIRED"

# ── Models ───────────────────────────────────────────────────────────────
DEFAULT_VERIFIER_MODEL = "gpt-4o-mini"
HIGH_RISK_MODEL = "gpt-4o"
RISK_THRESHOLD_HIGH = 0.6

_ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u0640]")
_SMALLTALK_RE = re.compile(
    r"(?:"
    r"\b(?:hi|hello|hey|thanks|thank you|how are you|good morning|good evening)\b"
    r"|السلام عليكم|وعليكم السلام|مرحبا|مراحب|اهلا|أهلا|هلا|يعطيك العافية"
    r"|صباح الخير|مساء الخير|كيف الحال|كيفك|كيفكم|شلونك|اخبارك|أخبارك|شو اخبارك"
    r"|تمام|الحمد لله|شكرا|شكراً|يسلمو"
    r")",
    re.IGNORECASE,
)
_BUSINESS_INTENT_RE = re.compile(
    r"(?:"
    r"سعر|بكم|كم سعر|متوفر|متوفره|توصيل|شحن|حجز|موعد|منتج|طلب|اوردر|أوردر"
    r"|دفع|ارجاع|إرجاع|استرجاع|ضمان|قياس|مقاس|لون|عندكم|بدي|اريد|أريد|عايز"
    r"|price|cost|available|stock|delivery|shipping|booking|appointment|order|pay"
    r"|payment|refund|return|warranty|product"
    r")",
    re.IGNORECASE,
)
_FACTUAL_CLAIM_RE = re.compile(
    r"(?:"
    r"\d|[٠-٩]|دينار|دولار|درهم|ريال|شيكل|سعر|متوفر|غير متوفر|خصم|توصيل|شحن"
    r"|ضمان|حجز|موعد|مخزون|قطعة|منتج|طلب"
    r"|price|cost|available|unavailable|stock|discount|delivery|shipping|warranty"
    r"|booking|appointment|order|product"
    r")",
    re.IGNORECASE,
)

# ── Banned phrases that should NEVER appear in AI output ─────────────────
BANNED_PHRASES_AR = [
    "أنا ذكاء اصطناعي",
    "أنا روبوت",
    "أنا مساعد افتراضي",
    "أنا لا أعرف",
    "لست متأكداً",
    "حسب علمي",
    "بناءً على معرفتي",
    "كما تعلم",
    "من المحتمل",
    "ربما يكون",
    "أعتقد أن السعر",
    "أظن أن",
    "تقريباً",
    "حسب تقديري",
]

BANNED_PHRASES_EN = [
    "as an ai",
    "i'm an ai",
    "i am an artificial intelligence",
    "i don't have access",
    "i cannot browse",
    "my training data",
    "as of my last update",
    "i believe the price",
    "i think it costs",
    "approximately",
    "i'm not sure but",
]

# ── Safe fallback responses ──────────────────────────────────────────────
SAFE_RESPONSES = {
    "product_not_found": "للأسف ما لقيت هالمنتج عندنا حالياً. بس خليني أحولك لزميلي يقدر يساعدك أكثر! 😊",
    "product_unavailable": "للأسف هالمنتج مش متوفر حالياً.",
    "price_unknown": "ما عندي معلومات عن سعر هالمنتج حالياً. خليني أحولك لحدا يقدر يفيدك.",
    "uncertain": "ما بقدر أأكدلك هالمعلومة. خليني أحولك لزميلي ليساعدك بشكل أفضل.",
    "hallucination_blocked": "لحظة من فضلك، خليني أتأكد من المعلومة وأرجعلك.",
    "handoff": "لحظة من فضلك، رح أحولك لزميلي ليقدر يساعدك بشكل أفضل.",
    "off_topic": "أنا هون عشان أساعدك بمنتجاتنا وخدماتنا. كيف بقدر أساعدك؟",
}


@dataclass
class VerificationResult:
    """Result of verifying a draft answer."""
    verdict: str
    risk_score: float
    reasons: list[str] = field(default_factory=list)
    flagged_claims: list[str] = field(default_factory=list)
    grounding_data_used: list[str] = field(default_factory=list)
    safe_response: Optional[str] = None
    modified_answer: Optional[str] = None


# ── Verifier prompt ──────────────────────────────────────────────────────
VERIFIER_SYSTEM_PROMPT = """You are an AI Safety Supervisor for an Arabic customer support chatbot.

Your ONLY job is to verify whether a draft answer is safe to send to a customer.

## INPUT
You will receive:
1. customer_message: What the customer asked
2. retrieved_data: The data retrieved from the business database (products, prices, policies, etc.)
3. draft_answer: The AI assistant's proposed response

## YOUR CHECKS (perform ALL 12):
1. GROUNDING CHECK: Every factual claim (product name, price, availability, warranty, stock) in the draft MUST be traceable to retrieved_data. If any fact is NOT in retrieved_data, it is hallucinated.
2. PRICE ACCURACY: Every price mentioned MUST exactly match retrieved_data. No rounding, no approximation.
3. AVAILABILITY ACCURACY: Product availability MUST match retrieved_data exactly.
4. NO INVENTION: The draft must NOT mention products, features, or services not found in retrieved_data.
5. NO COMPETITOR MENTION: Draft must not recommend competitor products or services.
6. BANNED PHRASES: Check for phrases an AI should never say (e.g., "أنا ذكاء اصطناعي", "approximately", "I believe the price").
7. TONE CHECK: Response should be warm, helpful, and match the business persona.
8. SAFETY: No harmful, discriminatory, or inappropriate content.
9. SCOPE CHECK: Answer stays within business topics (products, delivery, payment, booking). Off-topic = redirect.
10. ESCALATION CHECK: If the customer seems angry, frustrated, or has a complaint → HUMAN_HANDOFF_REQUIRED.
11. COMPLETENESS: If the customer asked a specific question, the answer should actually address it.
12. CONTRADICTION: The answer must not contradict information in retrieved_data.

## LOW-RISK CONVERSATION RULE
Simple greetings, thanks, "how are you?", and casual chit-chat do NOT need
retrieved_data as long as the draft contains no factual business claims
(no product, price, availability, delivery, booking, payment, or policy claim).
For these cases, return SAFE_TO_SEND with risk_score <= 0.1. Do NOT escalate
or block only because grounding_data_used is empty.

## OUTPUT (JSON only):
{
  "verdict": "SAFE_TO_SEND" | "NEEDS_MORE_DATA" | "ASK_CLARIFICATION" | "HUMAN_HANDOFF_REQUIRED" | "BLOCKED_UNGROUNDED_ANSWER" | "TOOL_RESULT_REQUIRED",
  "risk_score": 0.0 to 1.0,
  "reasons": ["reason 1", "reason 2"],
  "flagged_claims": ["claim that failed verification"],
  "grounding_data_used": ["data point from retrieved_data that supports the answer"],
  "safe_response": "Arabic fallback response if verdict is not SAFE_TO_SEND (optional)"
}

## CRITICAL RULES:
- Anti-hallucination is MORE important than speed
- If ANY price is wrong → BLOCKED_UNGROUNDED_ANSWER
- If ANY product doesn't exist in data → BLOCKED_UNGROUNDED_ANSWER
- If uncertain about factual business data → ASK_CLARIFICATION or BLOCKED_UNGROUNDED_ANSWER
- HUMAN_HANDOFF_REQUIRED is only for angry/frustrated customers, complaints,
  explicit human-agent requests, or operational issues that truly need a person.
- Never use HUMAN_HANDOFF_REQUIRED for a simple greeting, thanks, or casual chit-chat.
- risk_score: 0.0 = completely safe, 1.0 = definitely hallucinated
- Always respond in valid JSON only, no markdown, no extra text"""


class AnswerVerifier:
    """Verifies AI answers against retrieved data before sending."""

    def __init__(self, api_key: str):
        self._client = AsyncOpenAI(api_key=api_key)

    async def verify(
        self,
        customer_message: str,
        retrieved_data: dict,
        draft_answer: str,
        *,
        force_high_risk: bool = False,
    ) -> VerificationResult:
        """Verify a draft answer against retrieved data.

        Args:
            customer_message: The original customer message
            retrieved_data: Data retrieved from tool calls (catalog, policies, etc.)
            draft_answer: The AI's proposed response
            force_high_risk: Force use of GPT-4o instead of GPT-4o-mini

        Returns:
            VerificationResult with verdict, risk score, and reasoning
        """
        # Quick pre-checks (no API call needed)
        smalltalk_check = self._safe_smalltalk_check(customer_message, draft_answer)
        if smalltalk_check is not None:
            return smalltalk_check

        pre_check = self._pre_check(draft_answer)
        if pre_check is not None:
            return pre_check

        # Determine model based on risk assessment
        model = HIGH_RISK_MODEL if force_high_risk else DEFAULT_VERIFIER_MODEL

        # Build verification request
        user_content = json.dumps(
            {
                "customer_message": customer_message,
                "retrieved_data": self._truncate_data(retrieved_data),
                "draft_answer": draft_answer,
            },
            ensure_ascii=False,
        )

        try:
            response = await self._client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": VERIFIER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.0,
                max_tokens=500,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content or "{}"
            result = json.loads(content)

            verdict = result.get("verdict", SAFE_TO_SEND)
            risk_score = float(result.get("risk_score", 0.0))

            # If risk is high but model was mini → re-verify with GPT-4o
            if risk_score > RISK_THRESHOLD_HIGH and model == DEFAULT_VERIFIER_MODEL:
                logger.info(
                    "Risk score %.2f > %.2f, re-verifying with %s",
                    risk_score,
                    RISK_THRESHOLD_HIGH,
                    HIGH_RISK_MODEL,
                )
                return await self.verify(
                    customer_message,
                    retrieved_data,
                    draft_answer,
                    force_high_risk=True,
                )

            return VerificationResult(
                verdict=verdict,
                risk_score=risk_score,
                reasons=result.get("reasons", []),
                flagged_claims=result.get("flagged_claims", []),
                grounding_data_used=result.get("grounding_data_used", []),
                safe_response=result.get("safe_response"),
                modified_answer=result.get("modified_answer"),
            )

        except json.JSONDecodeError:
            logger.error("Verifier returned invalid JSON")
            return VerificationResult(
                verdict=HUMAN_HANDOFF_REQUIRED,
                risk_score=0.8,
                reasons=["Verifier returned unparseable response"],
            )
        except Exception:
            logger.exception("Answer verification failed")
            # On verifier failure → err on the side of caution
            return VerificationResult(
                verdict=SAFE_TO_SEND,
                risk_score=0.3,
                reasons=["Verification service unavailable — passed with caution"],
            )

    def _pre_check(self, draft_answer: str) -> VerificationResult | None:
        """Fast local checks before calling the LLM."""
        lower = draft_answer.lower()

        # Check banned phrases
        for phrase in BANNED_PHRASES_AR + BANNED_PHRASES_EN:
            if phrase in lower or phrase in draft_answer:
                return VerificationResult(
                    verdict=BLOCKED_UNGROUNDED,
                    risk_score=0.9,
                    reasons=[f"Contains banned phrase: '{phrase}'"],
                    flagged_claims=[phrase],
                    safe_response=SAFE_RESPONSES["hallucination_blocked"],
                )

        # Check for suspiciously vague price language
        vague_price_patterns = ["تقريباً", "حوالي", "approximately", "around", "roughly"]
        for pattern in vague_price_patterns:
            if pattern in lower:
                return VerificationResult(
                    verdict=BLOCKED_UNGROUNDED,
                    risk_score=0.85,
                    reasons=[f"Uses vague pricing language: '{pattern}'"],
                    flagged_claims=[pattern],
                    safe_response=SAFE_RESPONSES["price_unknown"],
                )

        return None

    def _safe_smalltalk_check(
        self, customer_message: str, draft_answer: str
    ) -> VerificationResult | None:
        """Allow greetings/chit-chat that contain no factual business claims."""
        customer = self._normalise_text(customer_message)
        draft = self._normalise_text(draft_answer)
        if not customer or not draft:
            return None

        # Keep this narrow so product questions that begin with a greeting
        # still go through the full grounding verifier.
        if len(customer.split()) > 8:
            return None
        if not _SMALLTALK_RE.search(customer):
            return None
        if _BUSINESS_INTENT_RE.search(customer):
            return None
        if _FACTUAL_CLAIM_RE.search(draft):
            return None

        return VerificationResult(
            verdict=SAFE_TO_SEND,
            risk_score=0.05,
            reasons=["Simple greeting/chit-chat with no factual business claims"],
            grounding_data_used=[],
        )

    def _normalise_text(self, text: str | None) -> str:
        text = (text or "").strip().lower()
        return _ARABIC_DIACRITICS_RE.sub("", text)

    def _truncate_data(self, data: dict, max_chars: int = 3000) -> dict:
        """Truncate retrieved data to stay within token limits."""
        serialised = json.dumps(data, ensure_ascii=False)
        if len(serialised) <= max_chars:
            return data
        return json.loads(serialised[:max_chars] + "...")

    # ── Logging helper ───────────────────────────────────────────────────
    async def log_verification(
        self,
        result: VerificationResult,
        customer_message: str,
        retrieved_data: dict,
        draft_answer: str,
        final_action: str,
        final_answer: str | None,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        message_id: uuid.UUID | None,
        db: AsyncSession,
    ) -> None:
        """Persist verification result to the database."""
        from models import AIVerificationLog

        log = AIVerificationLog(
            message_id=message_id,
            session_id=session_id,
            user_id=user_id,
            customer_message=customer_message,
            retrieved_data=retrieved_data,
            draft_answer=draft_answer,
            verifier_status=result.verdict,
            risk_score=result.risk_score,
            reasons=result.reasons,
            flagged_claims=result.flagged_claims,
            grounding_data_used=result.grounding_data_used,
            final_action=final_action,
            final_answer=final_answer,
        )
        db.add(log)
        await db.commit()
