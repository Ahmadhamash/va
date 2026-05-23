import logging
import uuid
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from models import BusinessWorkflow, StyleSample, User

logger = logging.getLogger("ai_prompts")
STYLE_SAMPLE_LIMIT = 15

DEFAULT_COMPREHENSIVE_PROMPT = """
You are an AI assistant representing {business}.
Your persona: {persona}

## CRITICAL RULES — NEVER BREAK THESE:
1. NEVER mention any product, price or detail that didn't come from a database function call.
2. ALWAYS call the appropriate function before answering product-related questions.
3. If a product is unavailable, say so clearly — never invent alternatives.
4. If you don't know something, say you don't have that information — never guess.
5. For non-business topics (politics, general knowledge), politely redirect.
6. Prices and availability come ONLY from the database.
7. Style examples shape ONLY wording, never facts. Never copy them verbatim.
8. If the customer asks anything about products, prices, availability or
   categories, you MUST call a function FIRST and then answer it. Do not
   reply with only a greeting when a question was asked.

## STRICT FALLBACK RULE (منع الهلوسة):
- إذا استدعيت أداة get_catalog أو أي أداة ولم تجد نتيجة مطابقة، لا تقم باختراع منتجات أو أسعار أو إجابات من عندك أبداً.
- قم فوراً باستدعاء دالة التحويل للبشر escalate_to_human.

## TOOL USE (mandatory):
- **get_catalog**: Call it FIRST on every product, price, availability, warranty,
  stock, color, size, or category question. Put the product keyword in `query`.
  Leave `query` empty for general questions.
  Answer ONLY from the returned items/categories.
- **get_delivery_info**: Call this when the customer asks about delivery, shipping,
  delivery fees, areas, pickup, or delivery time.
- **get_offers**: Call this when the customer asks about discounts, deals,
  promotions, sales, promo codes, or special offers.
- **get_packages**: Call this when the customer asks about bundles, packages,
  combo deals, or grouped product offerings.
- **get_policies**: Call this when the customer asks about return policy, exchange,
  refund, payment terms, warranties, or any business rules.
- **get_available_slots**: Call this when the customer wants to book an appointment,
  reserve a time, or check available slots.
- **create_booking**: Call this ONLY after the customer confirms they want to book.
  You need their name, date, and time. Confirm the booking details before calling.
- **get_payment_methods**: Call this when the customer asks about payment options.
- **escalate_to_human**: Call this when:
  • The customer is angry, frustrated, or using aggressive language
  • The customer wants to return, exchange, or cancel an order
  • There is a payment or billing issue
  • The customer keeps repeating the same question (you already answered)
  • You are NOT confident in your answer, don't understand, or get confused
  • There is a complaint or a serious problem
  • The question is too complex or outside your scope
  (DO NOT escalate for simple greetings, thanks, or casual chit-chat. Just reply nicely.)
  When you escalate, reply EXACTLY with the phrase provided by the tool output.

## PRODUCT DETAILS:
When answering about products, include all relevant information returned:
- Name, price, currency, availability
- **Warranty**: duration, terms, coverage, exclusions (if available)
- **Stock**: quantity and status (if tracked)
- **Variants/Options**: available colors, sizes, flavors, models etc.
  Mention which variants are available and which are out of stock.
- **Delivery**: when asked, use get_delivery_info to provide delivery zones,
  fees, free-delivery thresholds, and pickup options.
- **Pricing rules**: if there are quantity discounts or special pricing, mention them.
- **Offers**: if there are active promotions, mention applicable ones.

## BOOKINGS:
- When a customer wants to book, first call get_available_slots to show available times.
- Confirm the customer's choice before calling create_booking.
- After booking, tell the customer the booking is confirmed with details.

## IMAGES:
- When the customer sends an image, FIRST identify what product or item is shown.
- Then ALWAYS call get_catalog with the product name/keyword you identified.
- Compare the image to the catalog results and tell the customer if you have
  that product, its price, and availability.
- If you cannot identify the product or it is not in the catalog, say so.

## LANGUAGE & FORMATTING:
- Reply in the SAME language the customer uses.
- When replying in Arabic, keep numbers, prices, currency codes, English words,
  emails and URLs EXACTLY as returned (left-to-right, unchanged). Put Latin/
  numeric tokens on their own or wrap them so they don't get reversed, e.g.
  write: السعر 45 USD  (never reorder the digits or letters).
- The customer may split one question across several messages; treat the whole
  batch as a single question and answer once, clearly.
- Keep responses concise and helpful.
- For payment info, use this detail:
{payment_info}
{workflow_block}{style_block}
"""

def build_system_prompt(
    user: User, 
    style_samples: list[str] | None = None,
    workflows: list[BusinessWorkflow] | None = None,
) -> str:
    business = user.business_name or "this business"
    persona = user.ai_persona or "Friendly, professional, and helpful."

    # Parse settings stored in an HTML comment JSON block (e.g. <!-- {"prompt_mode": "default", ...} -->)
    import re
    import json
    dialect_instruction = ""
    emoji_instruction = ""
    tone_instruction = ""
    prompt_mode = "default"
    
    match = re.search(r"<!--\s*({.*?})\s*-->", persona)
    if match:
        try:
            config = json.loads(match.group(1))
            prompt_mode = config.get("prompt_mode", "default")
            # voice_mode might be present in older setups, gracefully handle it
            voice_mode = config.get("voice_mode")
            if voice_mode and "prompt_mode" not in config:
                if voice_mode == "custom":
                    prompt_mode = "custom_settings"
                elif voice_mode == "samples":
                    prompt_mode = "samples"
            
            # Strip the config comment so the LLM doesn't see it as text
            persona = persona.replace(match.group(0), "").strip()
            
            # Only map configs to explicit instructions if prompt_mode is custom_settings
            if prompt_mode == "custom_settings":
                dialect = config.get("dialect")
                emoji = config.get("emoji")
                tone = config.get("tone")
                
                if dialect == "jordanian":
                    dialect_instruction = "- Dialect: You MUST reply in the Jordanian/Palestinian Arabic dialect (اللهجة الأردنية/الفلسطينية العامية). Never use formal Modern Standard Arabic (MSA)."
                elif dialect == "saudi":
                    dialect_instruction = "- Dialect: You MUST reply in the Saudi/Gulf Arabic dialect (اللهجة السعودية/الخليجية العامية). Never use formal Modern Standard Arabic (MSA)."
                elif dialect == "egyptian":
                    dialect_instruction = "- Dialect: You MUST reply in the Egyptian Arabic dialect (اللهجة المصرية العامية). Never use formal Modern Standard Arabic (MSA)."
                elif dialect == "syrian":
                    dialect_instruction = "- Dialect: You MUST reply in the Syrian/Levantine Arabic dialect (اللهجة السورية/الشامية العامية). Never use formal Modern Standard Arabic (MSA)."
                elif dialect == "msa":
                    dialect_instruction = "- Dialect: You MUST reply in simplified Modern Standard Arabic (العربية الفصحى المبسطة)."
                    
                if emoji == "none":
                    emoji_instruction = "- Emojis: Do NOT use any emojis in your responses."
                elif emoji == "low":
                    emoji_instruction = "- Emojis: Use emojis very sparingly (at most 1 emoji per response)."
                elif emoji == "medium":
                    emoji_instruction = "- Emojis: Use emojis moderately to maintain a warm and friendly style (1-3 emojis)."
                elif emoji == "high":
                    emoji_instruction = "- Emojis: Use emojis warmly and frequently to express emotion and energy."
                    
                if tone == "friendly":
                    tone_instruction = "- Tone: Be extremely friendly, warm, welcoming, and hospitable (أسلوب ودود وحميمي ومرِّحب)."
                elif tone == "professional":
                    tone_instruction = "- Tone: Be polite, helpful, and highly professional (أسلوب مهني ومؤدب ومختصر)."
                elif tone == "salesy":
                    tone_instruction = "- Tone: Be enthusiastic, energetic, persuasive, and sales-focused (أسلوب حماسي، تنشيط مبيعات ومقنع)."
        except Exception:
            pass

    if prompt_mode == "full_prompt":
        return persona

    # If prompt_mode is not samples, ignore style samples
    if prompt_mode != "samples":
        style_samples = None

    override_block = ""
    if dialect_instruction or emoji_instruction or tone_instruction:
        override_block = "\n## REQUIRED STYLE INSTRUCTIONS:\n"
        if dialect_instruction:
            override_block += dialect_instruction + "\n"
        if emoji_instruction:
            override_block += emoji_instruction + "\n"
        if tone_instruction:
            override_block += tone_instruction + "\n"

    payment_info = "Payment Methods Available:\n"
    if user.payment_methods:
        for k, v in user.payment_methods.items():
            payment_info += f"- {k}: {v}\n"
    else:
        payment_info += "No specific payment methods configured.\n"

    workflow_block = ""
    if workflows:
        workflow_block = "\n\n## AUTOMATED ACTIONS & WORKFLOWS:\n"
        workflow_block += "The business owner has configured specific actions for certain scenarios. You MUST execute these when the user's intent matches the trigger event.\n"
        for idx, wf in enumerate(workflows, start=1):
            workflow_block += f"\nRule {idx}:\n"
            workflow_block += f"- Trigger Event: When the user intent matches '{wf.trigger_event}'\n"
            workflow_block += f"- Required Action: Send a {wf.action_type} with this EXACT content: {wf.content}\n"

    style_block = ""
    persona_override = ""
    if style_samples:
        joined = "\n---\n".join(style_samples[:STYLE_SAMPLE_LIMIT])
        persona_override = "\n(IMPORTANT: If the Persona description above is in formal English or formal Arabic, you MUST ignore that formal style. You MUST prioritize and write in the exact dialect, warmth, and casual tone shown in the VOICE/STYLE examples at the bottom. / تنبيه هام: يجب إعطاء الأولوية القصوى للهجة والأسلوب العامي الدافئ المذكور في أمثلة الأسلوب بالأسفل وتجاهل أي أسلوب رسمي مكتوب في الشخصية أعلاه.)"
        style_block = f"""

## VOICE / STYLE — YOU MUST FOLLOW THIS:
You MUST write in the EXACT same dialect, tone, and style as the examples below.
If the examples are in Jordanian Arabic dialect, you MUST reply in Jordanian Arabic dialect.
If the examples use casual language (e.g. هلا، منورين، كيف منقدر نساعدك), you MUST be casual too.
Do NOT switch to formal Modern Standard Arabic (MSA). Match the warmth, emoji habits, and phrasing.
NEVER copy a line verbatim. NEVER reuse any product/price/fact from them.
If the customer ONLY greets you or chats casually, just greet them back warmly in the EXACT SAME dialect. DO NOT append robotic boilerplate like 'How can I help you today?'.
If the customer asks a question, always answer their actual question (calling a function first when it is about products).
When answering about prices, stock, or catalog items, do NOT switch to formal/robotic Arabic. Integrate the retrieved product details and prices naturally into the custom dialect and tone shown in the examples. (مثال: لا تقل بجمود "سعر هذا المنتج هو 50 دينار" بل صغها بلهجتك الطبيعية "هذا حقه 50 دينار يا غالي" أو ما يماثل أسلوبك).

<style_examples>
{joined}
</style_examples>
"""

    persona_section = f"{persona}\n{override_block}{persona_override}".strip()
    return DEFAULT_COMPREHENSIVE_PROMPT.format(
        business=business, 
        persona=persona_section, 
        payment_info=payment_info, 
        workflow_block=workflow_block,
        style_block=style_block
    ).strip()


async def get_style_samples(
    user_id: uuid.UUID, db: AsyncSession, limit: int = STYLE_SAMPLE_LIMIT
) -> list[str]:
    stmt = (
        select(StyleSample.sample)
        .where(StyleSample.user_id == user_id)
        .order_by(func.random())
        .limit(limit)
    )
    return [s for s in (await db.execute(stmt)).scalars().all() if s]


