import asyncio
from services.auth_service import hash_password
from sqlalchemy import select

from database import AsyncSessionLocal
from models import User, Item, BusinessWorkflow, DeliveryRule, BusinessPolicy


async def seed_store():
    async with AsyncSessionLocal() as db:
        # Check if the store already exists
        result = await db.execute(select(User).where(User.username == "test_store"))
        user = result.scalar_one_or_none()

        if user is None:
            print("Creating test store user...")
            hashed_pw = hash_password("password123")
            user = User(
                username="test_store",
                email="store@example.com",
                hashed_password=hashed_pw,
                role="client",
                business_name="متجر الإبداع الرقمي",
                business_type="digital",
                ai_persona="أنا مساعد متجر الإبداع الرقمي. أتحدث بأسلوب عصري وحيوي لمساعدة الزبائن في الحصول على المنتجات الرقمية والتصاميم المخصصة.",
                payment_methods={
                    "card": "بطاقة الائتمان عبر رابط آمن",
                    "cliq": "الدفع عبر CliQ على الاسم المستعار (EBDA3)",
                }
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"User created: {user.id}")

        # Seed Items
        print("Seeding items...")
        items = [
            Item(
                user_id=user.id,
                name="قالب سيرة ذاتية احترافي",
                description="قالب Word و PDF بتصميم عصري وألوان جذابة.",
                price=5.00,
                currency="USD",
                category="قوالب",
                item_metadata={"الصيغة": "DOCX, PDF"},
            ),
            Item(
                user_id=user.id,
                name="تصميم شعار مخصص",
                description="تصميم شعار (لوجو) مخصص لشركتك خلال 3 أيام عمل.",
                price=50.00,
                currency="USD",
                category="خدمات تصميم",
            )
        ]
        db.add_all(items)

        # Seed Workflows
        print("Seeding workflows...")
        workflows = [
            BusinessWorkflow(
                user_id=user.id,
                trigger_event="عند شراء منتج رقمي",
                action_type="send_text",
                content="رائع! سيتم إرسال رابط تحميل المنتج الرقمي فور تأكيد عملية الدفع على البريد الإلكتروني الخاص بك."
            ),
            BusinessWorkflow(
                user_id=user.id,
                trigger_event="عند طلب تصميم مخصص",
                action_type="send_form",
                content="ممتاز! لكي نبدأ في تصميم الشعار المخصص لك، يرجى تعبئة هذا النموذج لنعرف تفاصيل أكثر عن شركتك والألوان المفضلة:\nhttps://forms.gle/test-design-form"
            )
        ]
        db.add_all(workflows)

        # Seed Policies
        print("Seeding policies...")
        policies = [
            BusinessPolicy(
                user_id=user.id,
                policy_type="return",
                title="سياسة الاسترداد",
                content="بسبب طبيعة المنتجات الرقمية، لا يمكن استرداد المبلغ بعد إتمام التحميل. أما بالنسبة للتصاميم المخصصة فيمكن استرداد 50% قبل تسليم المسودة الأولى."
            )
        ]
        db.add_all(policies)

        await db.commit()
        print("Test store seeded successfully! Username: test_store / Password: password123")

if __name__ == "__main__":
    asyncio.run(seed_store())
