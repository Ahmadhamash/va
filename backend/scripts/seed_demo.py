"""Seed demo data so the platform is testable immediately.

Idempotent: safe to run multiple times. Run inside the backend container:

    docker compose exec backend python -m scripts.seed_demo
"""
import asyncio
import secrets
from decimal import Decimal

from sqlalchemy import func, or_, select

from database import AsyncSessionLocal
from models import BusinessPolicy, ChannelIntegration, Item, StyleSample, User, SubscriptionTier, UserSubscription
from services.auth_service import hash_password

ADMIN = {"username": "admin", "email": "admin@demo.com", "password": "admin123"}
CLIENT = {
    "username": "shop",
    "email": "shop@demo.com",
    "password": "shop123",
    "business_name": "متجر بلال للإلكترونيات",
    "business_type": "electronics",
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
    {
        "name": "Galaxy A55 5G 256GB",
        "description": "هاتف 5G بشاشة AMOLED، ذاكرة 256GB، كاميرا 50MP، وكفالة سنة.",
        "category": "هواتف",
        "price": Decimal("389.00"),
        "available": True,
        "item_metadata": {"storage": "256GB", "color": "navy", "warranty": "12 months"},
    },
    {
        "name": "iPhone 15 128GB",
        "description": "هاتف Apple جديد، USB-C، كاميرا مزدوجة، متوفر باللون الأسود والأزرق.",
        "category": "هواتف",
        "price": Decimal("799.00"),
        "available": True,
        "item_metadata": {"storage": "128GB", "colors": "black, blue"},
    },
    {
        "name": "Laptop Pro 14",
        "description": "لابتوب للأعمال والدراسة، شاشة 14 بوصة، 16GB RAM، 512GB SSD.",
        "category": "لابتوبات",
        "price": Decimal("699.00"),
        "available": True,
        "item_metadata": {"ram": "16GB", "storage": "512GB SSD"},
    },
    {
        "name": "Gaming Monitor 27",
        "description": "شاشة ألعاب 27 بوصة، 165Hz، دقة QHD، مدخل HDMI وDisplayPort.",
        "category": "شاشات",
        "price": Decimal("239.00"),
        "available": True,
        "item_metadata": {"refresh_rate": "165Hz", "resolution": "QHD"},
    },
    {
        "name": "USB-C Hub 8-in-1",
        "description": "محول USB-C فيه HDMI، قارئ ذاكرة، USB 3.0، وشحن PD.",
        "category": "إكسسوارات",
        "price": Decimal("29.00"),
        "available": True,
    },
    {
        "name": "AX3000 Wi-Fi Router",
        "description": "راوتر Wi-Fi 6 سريع للمنازل والمكاتب الصغيرة، يغطي حتى 180 متر مربع.",
        "category": "شبكات",
        "price": Decimal("79.00"),
        "available": True,
    },
    {
        "name": "Webcam Full HD",
        "description": "كاميرا 1080p للاجتماعات والبث، مايك مدمج وغطاء خصوصية.",
        "category": "إكسسوارات",
        "price": Decimal("34.00"),
        "available": True,
    },
    {
        "name": "Screen Protector Pack",
        "description": "بكج حماية شاشة زجاجية لعدة موديلات، يشمل قطعتين وأدوات تركيب.",
        "category": "حماية",
        "price": Decimal("8.00"),
        "available": True,
    },
]

BUSINESS_POLICIES = [
    {
        "policy_type": "delivery",
        "title": "مناطق وتكلفة التوصيل",
        "content": "التوصيل داخل عمان خلال 24 ساعة بقيمة 3 دنانير. باقي المحافظات خلال 24-48 ساعة حسب شركة الشحن.",
    },
    {
        "policy_type": "return",
        "title": "سياسة الاستبدال والاسترجاع",
        "content": "يمكن استبدال أو إرجاع المنتج خلال 7 أيام إذا كان غير مستخدم وبالتغليف الأصلي ومع الفاتورة. لا يشمل ذلك المنتجات المتضررة بسبب سوء الاستخدام.",
    },
    {
        "policy_type": "warranty",
        "title": "الكفالة",
        "content": "معظم الأجهزة تشمل كفالة سنة على عيوب التصنيع. الإكسسوارات تختلف حسب المورد، ويجب التأكد من صفحة المنتج أو سؤال الموظف.",
    },
    {
        "policy_type": "payment",
        "title": "طرق الدفع",
        "content": "نوفر الدفع نقدا عند الاستلام داخل عمان، وبطاقات الدفع، وتحويل CliQ على الاسم المستعار EBDA3.",
    },
    {
        "policy_type": "faq",
        "title": "تجربة المنتجات",
        "content": "يمكن تجربة الأجهزة داخل المعرض قبل الشراء. المنتجات المختومة يمكن فتحها عند الشراء فقط حسب سياسة المورد.",
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
        if data.get("business_type"):
            user.business_type = data["business_type"]
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
        business_type=data.get("business_type"),
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

        item_rows = await db.execute(
            select(Item.name).where(Item.user_id == client.id)
        )
        existing_item_names = set(item_rows.scalars().all())
        added_items = 0
        for it in ITEMS:
            if it["name"] not in existing_item_names:
                db.add(Item(user_id=client.id, currency="USD", **it))
                added_items += 1
        if added_items:
            await db.commit()

        policy_rows = await db.execute(
            select(BusinessPolicy.title).where(BusinessPolicy.user_id == client.id)
        )
        existing_policy_titles = set(policy_rows.scalars().all())
        added_policies = 0
        for policy in BUSINESS_POLICIES:
            if policy["title"] not in existing_policy_titles:
                db.add(BusinessPolicy(user_id=client.id, is_active=True, **policy))
                added_policies += 1
        if added_policies:
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
        print(f"  Items: {len(ITEMS)}   Policies: {len(BUSINESS_POLICIES)}   Style samples: {len(STYLE_SAMPLES)}")
        print("-" * 60)
        print(f"  Widget script:  /widget/{widget.public_id}.js")
        print(f"  Widget message: /webhooks/widget/{widget.public_id}/message")
        print(f"  Generic webhook: /webhooks/generic/{webhook.public_id}")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(run())
