"""Seed demo data so the platform is testable immediately.

Idempotent: safe to run multiple times. Run inside the backend container:

    docker compose exec backend python -m scripts.seed_demo
"""
import asyncio
import secrets
from decimal import Decimal

from sqlalchemy import func, or_, select

from database import AsyncSessionLocal
from models import ChannelIntegration, Item, StyleSample, User, SubscriptionTier, UserSubscription
from services.auth_service import hash_password

ADMIN = {"username": "admin", "email": "admin@demo.com", "password": "admin123"}
CLIENT = {
    "username": "shop",
    "email": "shop@demo.com",
    "password": "shop123",
    "business_name": "متجر بلال للإلكترونيات",
    "ai_persona": (
        "ودود ومرِح، يتكلّم بلهجة بيضاء بسيطة، يستخدم إيموجي باعتدال، "
        "يرحّب بالزبون ويختصر بالردّ. يقول 'نورتنا' و'حاضرين'."
    ),
}

ITEMS = [
    {
        "name": "سماعة بلوتوث Pro",
        "description": "سماعة لاسلكية عزل ضوضاء، بطارية 30 ساعة.",
        "category": "صوتيات",
        "price": Decimal("45.00"),
        "available": True,
    },
    {
        "name": "شاحن سريع 65W",
        "description": "شاحن USB-C يدعم الشحن السريع للموبايل واللابتوب.",
        "category": "إكسسوارات",
        "price": Decimal("18.50"),
        "available": True,
    },
    {
        "name": "ساعة ذكية S8",
        "description": "تتبّع نبض ونوم وإشعارات، مقاومة ماء.",
        "category": "أجهزة لبسية",
        "price": Decimal("89.99"),
        "available": True,
    },
    {
        "name": "كيبورد ميكانيكي RGB",
        "description": "مفاتيح زرقاء، إضاءة RGB، مناسب للألعاب.",
        "category": "إكسسوارات",
        "price": Decimal("32.00"),
        "available": False,
    },
    {
        "name": "باور بانك 20000mAh",
        "description": "يشحن جهازين بنفس الوقت، منفذ USB-C.",
        "category": "طاقة",
        "price": Decimal("25.00"),
        "available": True,
    },
    {
        "name": "ماوس لاسلكي صامت",
        "description": "نقرات صامتة، دقة 2400 DPI، بطارية تدوم سنة.",
        "category": "إكسسوارات",
        "price": Decimal("12.00"),
        "available": True,
    },
]

STYLE_SAMPLES = [
    "Customer: عندكم توصيل؟\nYou: أكيد حبيبي 🚀 نوصّللك لباب البيت، وين منطقتك؟",
    "Customer: مرحبا\nYou: هلا وغلا 🙌 نورتنا، كيف بقدر أساعدك اليوم؟",
    "Customer: في خصم؟\nYou: حاضرين ❤️ خلّيني أشيكلك على المتوفر وأرجعلك فورًا.",
    "You: تمام! طلبك بصير جاهز، وأي استفسار إحنا موجودين 24/7 😉",
]


async def _get_or_create_user(db, data: dict, role: str) -> User:
    res = await db.execute(
        select(User).where(
            or_(User.username == data["username"], User.email == data["email"])
        )
    )
    user = res.scalar_one_or_none()
    if user:
        user.role = role
        if data.get("business_name"):
            user.business_name = data["business_name"]
        if data.get("ai_persona"):
            user.ai_persona = data["ai_persona"]
        await db.commit()
        await db.refresh(user)
        return user

    user = User(
        username=data["username"],
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        business_name=data.get("business_name"),
        ai_persona=data.get("ai_persona"),
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _ensure_channel(db, user: User, platform: str) -> ChannelIntegration:
    res = await db.execute(
        select(ChannelIntegration).where(
            ChannelIntegration.user_id == user.id,
            ChannelIntegration.platform == platform,
        )
    )
    ci = res.scalar_one_or_none()
    if ci:
        return ci
    ci = ChannelIntegration(
        user_id=user.id,
        platform=platform,
        public_id=secrets.token_urlsafe(24),
        credentials={},
    )
    db.add(ci)
    await db.commit()
    await db.refresh(ci)
    return ci


async def run() -> None:
    async with AsyncSessionLocal() as db:
        await _get_or_create_user(db, ADMIN, "admin")
        client = await _get_or_create_user(db, CLIENT, "client")

        item_count = await db.scalar(
            select(func.count()).select_from(Item).where(Item.user_id == client.id)
        )
        if not item_count:
            for it in ITEMS:
                db.add(Item(user_id=client.id, currency="USD", **it))
            await db.commit()

        style_count = await db.scalar(
            select(func.count())
            .select_from(StyleSample)
            .where(StyleSample.user_id == client.id)
        )
        if not style_count:
            for s in STYLE_SAMPLES:
                db.add(
                    StyleSample(user_id=client.id, source="seed", sample=s)
                )
            await db.commit()

        widget = await _ensure_channel(db, client, "widget")
        webhook = await _ensure_channel(db, client, "webhook")

        # Seed Subscription Tiers
        tiers_data = [
            {
                "name": "Starter",
                "description": "للمتاجر الصغيرة التي تريد تجربة الردود الذكية.",
                "price_monthly": 29.00,
                "features": ["وضع تجريبي", "قناة واحدة", "500 رد ذكي", "صندوق محادثات بسيط"],
                "is_active": True
            },
            {
                "name": "Growth",
                "description": "للأعمال التي تريد تشغيل خدمة العملاء يوميا.",
                "price_monthly": 79.00,
                "features": ["واتساب + فيسبوك + إنستغرام", "3 أعضاء فريق", "5,000 رد ذكي", "تحويل بشري", "تحليلات"],
                "is_active": True
            },
            {
                "name": "Pro",
                "description": "للفرق ذات الحجم العالي والفروع المتعددة.",
                "price_monthly": 199.00,
                "features": ["فروع متعددة", "قواعد تحويل متقدمة", "دعم أولوية", "تهيئة مخصصة"],
                "is_active": True
            }
        ]
        
        tiers_db = {}
        for td in tiers_data:
            tier_res = await db.execute(
                select(SubscriptionTier).where(SubscriptionTier.name == td["name"])
            )
            tier = tier_res.scalar_one_or_none()
            if not tier:
                tier = SubscriptionTier(**td)
                db.add(tier)
                await db.commit()
                await db.refresh(tier)
            else:
                tier.description = td["description"]
                tier.price_monthly = td["price_monthly"]
                tier.features = td["features"]
                tier.is_active = td["is_active"]
                await db.commit()
                await db.refresh(tier)
            tiers_db[td["name"]] = tier

        # Assign CLIENT to Growth tier by default
        sub_res = await db.execute(
            select(UserSubscription).where(UserSubscription.user_id == client.id)
        )
        sub = sub_res.scalar_one_or_none()
        if not sub:
            sub = UserSubscription(
                user_id=client.id,
                tier_id=tiers_db["Growth"].id,
                status="active"
            )
            db.add(sub)
            await db.commit()

        print("\n" + "=" * 60)
        print("  DEMO DATA READY")
        print("=" * 60)
        print(f"  ADMIN  →  username: {ADMIN['username']}   password: {ADMIN['password']}")
        print(f"  CLIENT →  username: {CLIENT['username']}    password: {CLIENT['password']}")
        print(f"  Business: {CLIENT['business_name']}")
        print(f"  Items: {len(ITEMS)}   Style samples: {len(STYLE_SAMPLES)}")
        print("-" * 60)
        print(f"  Widget script:  /widget/{widget.public_id}.js")
        print(f"  Widget message: /webhooks/widget/{widget.public_id}/message")
        print(f"  Generic webhook: /webhooks/generic/{webhook.public_id}")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(run())
