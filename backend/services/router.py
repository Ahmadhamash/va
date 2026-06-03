import logging
import json
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from services.settings_service import effective_openai_key

logger = logging.getLogger("router")

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

# Keep an internal cache of clients to match ai_chat.py
_clients: dict[str, AsyncOpenAI] = {}
def _client_for(api_key: str) -> AsyncOpenAI:
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    client = _clients.get(api_key)
    if client is None:
        client = AsyncOpenAI(api_key=api_key)
        _clients[api_key] = client
    return client

async def get_intent_for_message(customer_message: str, db: AsyncSession) -> str:
    """
    Classifies the user message into an intent.
    Uses gpt-4o-mini as a fast, cheap router.
    """
    if not customer_message or not customer_message.strip():
        return "general"

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

        intent = response.choices[0].message.content.strip().lower()
        
        # Sanitize output
        valid_intents = {"sales", "support", "booking", "general"}
        for valid in valid_intents:
            if valid in intent:
                return valid
                
        return "general"  # Fallback
    except Exception:
        logger.exception("Router classification failed, falling back to general.")
        return "general"
