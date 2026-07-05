import logging
import re
from sqlalchemy.ext.asyncio import AsyncSession
from services.settings_service import effective_openai_key
from services.openai_client import get_openai_client

logger = logging.getLogger("router")
ROUTER_TIMEOUT_SECONDS = 15.0
BUSINESS_INTENTS = ("sales", "support", "booking")
VALID_ROUTER_INTENTS = {"sales", "support", "booking", "general"}
UNCERTAIN_INTENT = "uncertain"

DETAILED_INTENTS = {
    "ASK_PRICE",
    "ASK_AVAILABILITY",
    "ASK_RECOMMENDATION",
    "ASK_IMAGES",
    "ASK_PRODUCT_LOOK",
    "ASK_DELIVERY",
    "HUMAN_HANDOFF",
    "OUT_OF_SCOPE",
    "LANGUAGE_SWITCH",
}

ROUTER_PROMPT = """
You are a highly efficient message router for an e-commerce / service business chatbot.
Your ONLY job is to read the customer's message and classify their intent into exactly ONE of these four categories:

1. "sales": The customer is asking about products, prices, availability, catalog, offers, or discounts.
   (e.g., "كم سعر السماعة؟", "شو عندكم منتجات؟", "في خصومات؟")
2. "support": The customer is asking about delivery, shipping, locations, returns, refunds, policies, or has a complaint/issue.
   (e.g., "متى بتوصل الطلبية؟", "بدي أرجع المنتج", "كم رسوم التوصيل؟")
3. "booking": The customer wants to book an appointment, check available slots, or reserve a service.
   (e.g., "بدي أحجز موعد", "متى في مواعيد فاضية؟")
4. "general": The customer is just saying hi, thanking you, chatting, or asking something completely unrelated.
   (e.g., "مرحبا", "يعطيك العافية", "شكراً")

Output ONLY the category name in lowercase (sales, support, booking, general) and nothing else. No punctuation, no explanation.
"""

def _client_for(api_key: str):
    return get_openai_client(api_key, timeout=ROUTER_TIMEOUT_SECONDS)


_ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u0640]")

_BOOKING_TERMS = (
    "\u062d\u062c\u0632", "\u0627\u062d\u062c\u0632", "\u0623\u062d\u062c\u0632",
    "\u0645\u0648\u0639\u062f", "\u0645\u0648\u0627\u0639\u064a\u062f",
    "\u0631\u064a\u0632\u0631\u0641", "\u0627\u062d\u062c\u0632\u0644\u064a",
    "book", "booking", "appointment", "reservation", "reserve",
)

_SUPPORT_TERMS = (
    "\u062a\u0648\u0635\u064a\u0644", "\u062f\u064a\u0644\u064a\u0641\u0631\u064a",
    "\u0634\u062d\u0646", "\u0627\u0631\u062c\u0627\u0639", "\u0625\u0631\u062c\u0627\u0639",
    "\u0627\u0631\u062c\u0639", "\u0623\u0631\u062c\u0639",
    "\u062a\u0631\u062c\u064a\u0639", "\u0627\u0633\u062a\u0631\u062c\u0627\u0639",
    "\u0627\u0633\u062a\u0628\u062f\u0627\u0644", "\u0627\u0644\u063a\u0627\u0621",
    "\u0625\u0644\u063a\u0627\u0621", "\u0634\u0643\u0648\u0649", "\u0645\u0634\u0643\u0644\u0629",
    "\u0633\u064a\u0621", "\u063a\u0627\u0636\u0628", "\u062a\u0627\u062e\u064a\u0631",
    "\u062a\u0623\u062e\u064a\u0631", "\u0636\u0645\u0627\u0646", "\u0633\u064a\u0627\u0633\u0629",
    "\u0633\u064a\u0627\u0633\u0627\u062a", "\u0631\u0633\u0648\u0645 \u0627\u0644\u062a\u0648\u0635\u064a\u0644",
    "\u0645\u0648\u0642\u0639", "\u0639\u0646\u0648\u0627\u0646", "\u0648\u064a\u0646", "\u0627\u064a\u0646",
    "\u0641\u064a\u0646\u0643\u0645", "\u0648\u064a\u0646\u0643\u0645", "\u0645\u062d\u0644\u0643\u0645",
    "\u0627\u0645\u0627\u0643\u0646\u0643\u0645", "\u0645\u0643\u0627\u0646\u0643\u0645",
    "\u0645\u0643\u0627\u0646\u0643\u0648", "\u0639\u0646\u0627\u0648\u064a\u0646\u0643\u0645",
    "\u0633\u0627\u0639\u0627\u062a", "\u0633\u0627\u0639\u0629", "\u0627\u0644\u062f\u0648\u0627\u0645",
    "\u062a\u0641\u062a\u062d", "\u062a\u0633\u0643\u0631", "\u0641\u0631\u0639", "\u0641\u0631\u0648\u0639",
    "\u062a\u0648\u0627\u0635\u0644", "\u0631\u0642\u0645\u0643\u0645", "\u0627\u0644\u0647\u0627\u062a\u0641",
    "\u062a\u062a\u0628\u0639", "\u062a\u0627\u0628\u0639", "\u062d\u0627\u0644\u0629 \u0627\u0644\u0637\u0644\u0628",
    "\u0648\u064a\u0646 \u0627\u0644\u0637\u0644\u0628", "\u0648\u0635\u0644 \u0637\u0644\u0628\u064a",
    "\u0646\u0642\u0627\u0637 \u0627\u0644\u0628\u064a\u0639", "\u0646\u0642\u0637\u0629 \u0628\u064a\u0639",
    "\u0646\u0642\u0637\u0647 \u0628\u064a\u0639", "\u0646\u0642\u0627\u0637 \u0628\u064a\u0639",
    "\u0627\u0644\u0645\u0648\u0632\u0639\u064a\u0646",
    "\u0645\u0648\u0632\u0639\u064a\u0646", "\u0648\u064a\u0646 \u0627\u0634\u062a\u0631\u064a",
    "\u0647\u0648\u064a\u0629 \u0627\u0644\u0635\u0641\u062d\u0629", "\u0647\u0648\u064a\u0647 \u0627\u0644\u0635\u0641\u062d\u0647",
    "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0635\u0641\u062d\u0629",
    "\u0647\u0648\u064a\u0629 \u0627\u0644\u062d\u0633\u0627\u0628", "\u0647\u0648\u064a\u0647 \u0627\u0644\u062d\u0633\u0627\u0628",
    "\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062d\u0633\u0627\u0628",
    "\u0627\u0644\u0628\u0631\u0627\u0646\u062f",
    "delivery", "shipping", "refund", "return", "exchange", "cancel",
    "complaint", "problem", "warranty", "policy", "location", "address",
    "hours", "opening", "closing", "branch", "contact", "phone",
    "track order", "tracking", "order status", "sales point", "sales points",
    "where to buy", "distributor", "distributors", "page identity",
    "account identity", "brand info",
)

_SALES_TERMS = (
    "\u0633\u0639\u0631", "\u0627\u0644\u0633\u0639\u0631", "\u0628\u0643\u0645",
    "\u0627\u0633\u0639\u0627\u0631", "\u0627\u0644\u0627\u0633\u0639\u0627\u0631",
    "\u0643\u0645 \u0633\u0639\u0631", "\u0643\u0627\u0645 \u0633\u0639\u0631",
    "\u0642\u062f\u064a\u0634", "\u0628\u0642\u062f\u064a\u0634",
    "\u062d\u0642\u0647", "\u062d\u0642\u0647\u0627", "\u0645\u062a\u0648\u0641\u0631",
    "\u0645\u062a\u0648\u0641\u0631\u0647", "\u0645\u0648\u062c\u0648\u062f",
    "\u0645\u0648\u062c\u0648\u062f\u0629", "\u0639\u0646\u062f\u0643\u0645",
    "\u0628\u062a\u0628\u064a\u0639\u0648", "\u0628\u062a\u0628\u064a\u0639\u0648\u0627",
    "\u0643\u062a\u0627\u0644\u0648\u062c", "\u0645\u0646\u062a\u062c",
    "\u0645\u0646\u062a\u062c\u0627\u062a", "\u0628\u0636\u0627\u0639\u0629",
    "\u0639\u0631\u0648\u0636", "\u0639\u0631\u0636", "\u062e\u0635\u0645",
    "\u062e\u0635\u0648\u0645\u0627\u062a", "\u0644\u0648\u0646", "\u0645\u0642\u0627\u0633",
    "\u0642\u064a\u0627\u0633", "\u0633\u062a\u0648\u0643", "\u0645\u062e\u0632\u0648\u0646",
    "\u0627\u0648\u0631\u062f\u0631", "\u0623\u0648\u0631\u062f\u0631",
    "\u0627\u0643\u0644", "\u0623\u0643\u0644", "\u0637\u0639\u0627\u0645",
    "\u0627\u0637\u0639\u0645\u0629", "\u0623\u0637\u0639\u0645\u0629",
    "\u0645\u0627\u0643\u0648\u0644\u0627\u062a", "\u0645\u0623\u0643\u0648\u0644\u0627\u062a",
    "\u062d\u0644\u0648\u064a\u0627\u062a", "\u0627\u064a\u0633 \u0643\u0631\u064a\u0645",
    "\u0627\u064a\u0633\u0643\u0631\u064a\u0645", "\u0622\u064a\u0633 \u0643\u0631\u064a\u0645",
    "\u0628\u0648\u0638\u0629", "\u0646\u0643\u0647\u0629", "\u0646\u0643\u0647\u0627\u062a",
    "\u0628\u0648\u0643\u0633", "\u0628\u0648\u0643\u0633\u0627\u062a",
    "\u0627\u0644\u0628\u0648\u0643\u0633", "\u0639\u0628\u0648\u0629", "\u0639\u0628\u0648\u0627\u062a",
    "\u0627\u0644\u0639\u0627\u0626\u0644\u064a", "\u062c\u0645\u0639\u0627\u062a",
    "price", "cost", "available", "stock", "catalog", "product",
    "products", "offer", "discount", "deal", "size", "color",
    "food", "foods", "dessert", "desserts", "ice cream", "flavor",
    "flavors", "box", "boxes", "gathering", "family box",
    "recommend", "recommendation", "suggest", "suggestion",
)

_PRICE_TERMS = (
    "\u0633\u0639\u0631", "\u0627\u0644\u0633\u0639\u0631", "\u0628\u0643\u0645",
    "\u0627\u0633\u0639\u0627\u0631", "\u0627\u0644\u0627\u0633\u0639\u0627\u0631",
    "\u0643\u0645 \u0633\u0639\u0631", "\u0642\u062f\u064a\u0634", "\u062d\u0642\u0647",
    "\u062d\u0642\u0647\u0627", "price", "cost", "how much",
)
_AVAILABILITY_TERMS = (
    "\u0645\u062a\u0648\u0641\u0631", "\u0645\u062a\u0648\u0641\u0631\u0629",
    "\u0645\u0648\u062c\u0648\u062f", "\u0645\u0648\u062c\u0648\u062f\u0629",
    "\u0639\u0646\u062f\u0643\u0645", "\u0639\u0646\u062f\u0643\u0648",
    "available", "in stock", "do you have",
)
_RECOMMENDATION_TERMS = (
    "\u0628\u062a\u0646\u0635\u062d\u0646\u064a", "\u062a\u0646\u0635\u062d\u0646\u064a",
    "\u0634\u0648 \u0628\u062a\u0646\u0635\u062d", "\u0634\u0648 \u062a\u0646\u0635\u062d",
    "\u0627\u0648\u0644 \u0645\u0631\u0629", "\u0623\u0648\u0644 \u0645\u0631\u0629",
    "\u0631\u0634\u062d", "\u0627\u0642\u062a\u0631\u062d", "\u0646\u0635\u064a\u062d\u0629",
    "recommend", "suggest", "first time", "what should i try",
)
_DELIVERY_TERMS = (
    "\u062a\u0648\u0635\u064a\u0644", "\u062f\u064a\u0644\u064a\u0641\u0631\u064a",
    "\u0634\u062d\u0646", "\u0627\u0633\u062a\u0644\u0627\u0645",
    "delivery", "shipping", "pickup", "deliver",
)
_IMAGE_TERMS = (
    "\u0635\u0648\u0631\u0629", "\u0635\u0648\u0631\u0647", "\u0635\u0648\u0631",
    "\u0627\u0628\u0639\u062a\u0644\u064a", "\u0627\u0628\u0639\u062b\u0644\u064a",
    "\u0627\u0631\u0633\u0644\u064a", "image", "photo", "picture", "pic",
)
_LOOK_TERMS = (
    "\u0634\u0643\u0644\u0647", "\u0634\u0643\u0644\u0647\u0627", "\u0643\u064a\u0641 \u0634\u0643\u0644",
    "\u0628\u064a\u062c\u064a", "\u0628\u062a\u0637\u0644\u0639", "\u062a\u0637\u0644\u0639",
    "look like", "looks like", "what does", "describe",
)
_HUMAN_HANDOFF_TERMS = (
    "\u0645\u0648\u0638\u0641", "\u0627\u0646\u0633\u0627\u0646", "\u0628\u0634\u0631",
    "\u0645\u0646 \u0627\u0644\u0641\u0631\u064a\u0642", "\u0627\u062d\u0643\u064a \u0645\u0639",
    "\u0623\u062d\u0643\u064a \u0645\u0639", "\u062d\u0648\u0644\u0646\u064a",
    "\u062d\u0648\u0651\u0644\u0646\u064a", "\u062d\u0642\u064a\u0642\u064a",
    "\u0645\u0648\u0638\u0641 \u062d\u0642\u064a\u0642\u064a",
    "\u0627\u0639\u0637\u064a\u0646\u064a \u0645\u0648\u0638\u0641",
    "\u0634\u062e\u0635 \u062d\u0642\u064a\u0642\u064a",
    "human", "real human", "real person", "agent", "employee",
    "representative", "talk to someone", "speak to someone",
)
_LANGUAGE_SWITCH_TERMS = (
    "can you speak english", "do you speak english", "english please",
    "answer in english", "reply in english", "speak english",
    "in english", "\u0628\u0627\u0644\u0627\u0646\u062c\u0644\u064a\u0632\u064a",
    "\u0627\u0646\u062c\u0644\u064a\u0632\u064a", "\u0628\u0627\u0644\u0639\u0631\u0628\u064a",
    "\u0639\u0631\u0628\u064a", "arabic please", "answer in arabic",
)
_OUT_OF_SCOPE_TERMS = (
    "\u0631\u0627\u064a\u0643 \u0628\u0627\u0644\u0633\u064a\u0627\u0633\u0629",
    "\u0631\u0623\u064a\u0643 \u0628\u0627\u0644\u0633\u064a\u0627\u0633\u0629",
    "\u0634\u0648 \u0631\u0627\u064a\u0643 \u0628\u0627\u0644\u0633\u064a\u0627\u0633\u0629",
    "\u0634\u0648 \u0631\u0623\u064a\u0643 \u0628\u0627\u0644\u0633\u064a\u0627\u0633\u0629",
    "politics", "political opinion", "election", "president",
)

_FOLLOWUP_TERMS = (
    "\u0637\u064a\u0628", "\u0648\u0643\u064a\u0641", "\u0643\u0645\u0627\u0646",
    "\u0628\u0631\u0636\u0648", "\u0648\u0627\u064a\u0634", "\u0648\u0634\u0648",
    "and", "what about", "also", "how about",
)
_SMALLTALK_TERMS = (
    "\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645",
    "\u0648\u0639\u0644\u064a\u0643\u0645 \u0627\u0644\u0633\u0644\u0627\u0645",
    "\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645",
    "\u0633\u0644\u0627\u0645", "\u0645\u0631\u062d\u0628\u0627",
    "\u0645\u0631\u0627\u062d\u0628", "\u0647\u0644\u0627",
    "\u0627\u0647\u0644\u0627", "\u0627\u0647\u0644\u064a\u0646",
    "\u0627\u0644\u0648", "\u0627\u0644\u0648\u0648",
    "\u0635\u0628\u0627\u062d \u0627\u0644\u062e\u064a\u0631",
    "\u0645\u0633\u0627\u0621 \u0627\u0644\u062e\u064a\u0631",
    "\u064a\u0639\u0637\u064a\u0643 \u0627\u0644\u0639\u0627\u0641\u064a\u0647",
    "\u0643\u064a\u0641\u0643", "\u0643\u064a\u0641\u0643\u0645",
    "\u0643\u064a\u0641 \u062d\u0627\u0644\u0643",
    "\u0643\u064a\u0641 \u0627\u0644\u062d\u0627\u0644",
    "\u0643\u064a\u0641 \u0627\u0644\u0627\u0645\u0648\u0631",
    "\u0643\u064a\u0641 \u0627\u0645\u0648\u0631\u0643",
    "\u0634\u0648 \u0627\u062e\u0628\u0627\u0631\u0643",
    "\u0627\u062e\u0628\u0627\u0631\u0643",
    "\u0627\u0644\u062d\u0645\u062f\u0644\u0644\u0647",
    "\u062a\u0645\u0627\u0645", "\u0634\u0643\u0631\u0627",
    "\u064a\u0633\u0644\u0645\u0648",
    "hi", "hello", "hey", "thanks", "thank you",
    "how are you", "how r you",
)
_SMALLTALK_ONLY_TOKENS = {
    "\u0627\u0644\u0633\u0644\u0627\u0645", "\u0639\u0644\u064a\u0643\u0645",
    "\u0648\u0639\u0644\u064a\u0643\u0645", "\u0633\u0644\u0627\u0645",
    "\u0645\u0631\u062d\u0628\u0627", "\u0645\u0631\u0627\u062d\u0628",
    "\u0647\u0644\u0627", "\u0627\u0647\u0644\u0627",
    "\u0627\u0647\u0644\u064a\u0646", "\u0627\u0644\u0648",
    "\u0627\u0644\u0648\u0648", "\u0643\u064a\u0641\u0643",
    "\u0643\u064a\u0641\u0643\u0645", "\u0643\u064a\u0641",
    "\u062d\u0627\u0644\u0643", "\u0627\u0644\u062d\u0627\u0644",
    "\u0627\u0644\u0627\u0645\u0648\u0631", "\u0627\u0645\u0648\u0631\u0643",
    "\u0634\u0648", "\u0627\u062e\u0628\u0627\u0631\u0643",
    "\u0627\u062e\u0628\u0627\u0631\u0643", "\u0637\u064a\u0628",
    "\u062a\u0645\u0627\u0645", "\u0627\u0648\u0643\u064a",
    "\u0627\u0648\u0643\u0649", "\u0634\u0643\u0631\u0627",
    "\u064a\u0633\u0644\u0645\u0648", "\u0627\u0644\u062d\u0645\u062f\u0644\u0644\u0647",
    "hi", "hello", "hey", "ok", "okay", "thanks",
    "thank", "you", "how", "are", "r",
}
_SMALLTALK_TOKEN_SPLIT_RE = re.compile(r"[\s,\u060c/\\|+\-_.:;\u061f?!()]+")
_BUSINESS_SIGNAL_TERMS = (
    _BOOKING_TERMS
    + _SUPPORT_TERMS
    + _SALES_TERMS
    + _RECOMMENDATION_TERMS
    + _DELIVERY_TERMS
    + _IMAGE_TERMS
    + _LOOK_TERMS
    + _HUMAN_HANDOFF_TERMS
    + _LANGUAGE_SWITCH_TERMS
    + _OUT_OF_SCOPE_TERMS
)
_PLACE_SALES_RE = re.compile(
    r"(?:بتبيعوا|بتبيعو|بتبيع|تبيعوا|تبيعو|sell|selling).{0,20}"
    r"(?:\sفي\s|\sب\s|\sداخل\s|\sin\s)",
    re.IGNORECASE,
)


def _normalise_message(text: str) -> str:
    text = (text or "").strip().lower()
    text = _ARABIC_DIACRITICS_RE.sub("", text)
    return text.replace("\u0623", "\u0627").replace("\u0625", "\u0627").replace("\u0622", "\u0627")


def _contains_any(text: str, terms: tuple[str, ...]) -> bool:
    return any(term in text for term in terms)


def is_smalltalk_message(customer_message: str) -> bool:
    """True only for greetings/thanks/chit-chat with no business request."""
    text = _normalise_message(customer_message)
    if not text:
        return True

    if _contains_any(text, _BUSINESS_SIGNAL_TERMS) or _PLACE_SALES_RE.search(text):
        return False

    tokens = [
        token
        for token in _SMALLTALK_TOKEN_SPLIT_RE.split(text)
        if token
    ]
    for term in _SMALLTALK_TERMS:
        if " " in term:
            if term in text:
                return True
        elif term in tokens:
            return True

    return bool(tokens) and len(tokens) <= 4 and all(
        token in _SMALLTALK_ONLY_TOKENS for token in tokens
    )


def heuristic_intent_for_message(customer_message: str) -> str | None:
    """Deterministic guardrail before the LLM router.

    The LLM router is useful for fuzzy language, but product/price/support
    words should never fall through to general chat just because routing failed.
    """
    text = _normalise_message(customer_message)
    if not text:
        return "general"

    if is_smalltalk_message(customer_message):
        return "general"

    if _contains_any(text, _BOOKING_TERMS):
        return "booking"
    if _contains_any(text, _HUMAN_HANDOFF_TERMS):
        return "support"
    if _PLACE_SALES_RE.search(text):
        return "support"
    if _contains_any(text, _SUPPORT_TERMS):
        return "support"
    if _contains_any(text, _SALES_TERMS + _RECOMMENDATION_TERMS + _IMAGE_TERMS + _LOOK_TERMS):
        return "sales"
    return None


def heuristic_intents_for_message(customer_message: str) -> list[str]:
    """Return all obvious deterministic intents in a message."""
    text = _normalise_message(customer_message)
    if not text:
        return ["general"]

    if is_smalltalk_message(customer_message):
        return ["general"]

    intents: list[str] = []
    if _contains_any(text, _BOOKING_TERMS):
        intents.append("booking")
    if _contains_any(text, _SUPPORT_TERMS + _HUMAN_HANDOFF_TERMS):
        intents.append("support")
    if _contains_any(text, _SALES_TERMS + _RECOMMENDATION_TERMS + _IMAGE_TERMS + _LOOK_TERMS):
        intents.append("sales")
    return intents or ["general"]


def detect_message_intents(customer_message: str) -> list[str]:
    """Return deterministic fine-grained intents for behavior and trace data."""
    text = _normalise_message(customer_message)
    if not text:
        return []

    intents: list[str] = []
    checks = (
        ("LANGUAGE_SWITCH", _LANGUAGE_SWITCH_TERMS),
        ("HUMAN_HANDOFF", _HUMAN_HANDOFF_TERMS),
        ("OUT_OF_SCOPE", _OUT_OF_SCOPE_TERMS),
        ("ASK_PRICE", _PRICE_TERMS),
        ("ASK_AVAILABILITY", _AVAILABILITY_TERMS),
        ("ASK_RECOMMENDATION", _RECOMMENDATION_TERMS),
        ("ASK_IMAGES", _IMAGE_TERMS),
        ("ASK_PRODUCT_LOOK", _LOOK_TERMS),
        ("ASK_DELIVERY", _DELIVERY_TERMS),
    )
    for intent, terms in checks:
        if terms and _contains_any(text, terms):
            intents.append(intent)
    if "ASK_PRODUCT_LOOK" in intents and "ASK_IMAGES" not in intents:
        # Product appearance is image-adjacent, but keeping both labels helps
        # downstream behavior distinguish "send photo" from "describe it".
        intents.append("ASK_IMAGES")
    return intents


def expanded_intents_for_message(
    primary_intent: str, customer_message: str
) -> list[str]:
    """Return downstream candidate intents for tools and retrieval.

    `uncertain` is intentionally not treated as `general`: when the router cannot
    make a safe classification, downstream agents get a conservative read-only
    business surface instead of casual-chat behavior.
    """
    heuristic_intents = heuristic_intents_for_message(customer_message)
    if primary_intent == UNCERTAIN_INTENT:
        return [UNCERTAIN_INTENT, *BUSINESS_INTENTS, "general"]
    if primary_intent not in heuristic_intents:
        return [primary_intent, *heuristic_intents]
    return heuristic_intents


def _intent_from_history(history: list[dict] | None) -> str | None:
    if not history:
        return None
    for item in reversed(history[-8:]):
        content = item.get("content") if isinstance(item, dict) else None
        if not content:
            continue
        intent = heuristic_intent_for_message(str(content))
        if intent in {"sales", "support", "booking"}:
            return intent
    return None


def _is_followup(customer_message: str) -> bool:
    text = _normalise_message(customer_message)
    if not text:
        return False
    if is_smalltalk_message(customer_message):
        return False
    if len(text.split()) <= 4:
        return True
    return _contains_any(text, _FOLLOWUP_TERMS)


def _parse_router_intent(raw_intent: str | None) -> str | None:
    text = _normalise_message(raw_intent or "")
    if not text:
        return None
    matches = [
        intent
        for intent in VALID_ROUTER_INTENTS
        if re.search(rf"\b{re.escape(intent)}\b", text)
    ]
    if len(matches) == 1:
        return matches[0]
    return None


async def get_intent_for_message(
    customer_message: str,
    db: AsyncSession,
    *,
    history: list[dict] | None = None,
) -> str:
    """
    Classifies the user message into an intent.
    Uses gpt-4o-mini as a fast, cheap router.
    """
    if not customer_message or not customer_message.strip():
        return "general"

    heuristic_intent = heuristic_intent_for_message(customer_message)
    if heuristic_intent is not None:
        return heuristic_intent

    if _is_followup(customer_message):
        history_intent = _intent_from_history(history)
        if history_intent is not None:
            return history_intent

    try:
        api_key = await effective_openai_key(db)
        client = _client_for(api_key)

        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": ROUTER_PROMPT},
                {"role": "user", "content": customer_message}
            ],
            temperature=0.0,
            max_tokens=5,
        )

        intent = _parse_router_intent(response.choices[0].message.content)
        if intent is not None:
            return intent

        logger.warning(
            "Router returned unparseable intent; using uncertain fallback."
        )
        return UNCERTAIN_INTENT
    except Exception:
        logger.exception("Router classification failed; using uncertain fallback.")
        return UNCERTAIN_INTENT
