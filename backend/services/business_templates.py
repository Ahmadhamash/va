"""Pre-configured templates for different business types.

When a user selects a business type, these templates provide:
- A suggested AI persona
- Recommended metadata fields for items
- Default policies
- Common FAQ context
"""

TEMPLATES = {
    "retail": {
        "label": "متجر تجزئة",
        "icon": "🛍️",
        "persona": (
            "أنا مساعد المتجر الذكي. أساعد الزبائن في استعراض المنتجات، "
            "معرفة الأسعار والتوفر، الاستفسار عن الكفالات، وتفاصيل التوصيل. "
            "أتحدث بأسلوب ودي ومهني."
        ),
        "suggested_fields": ["اللون", "المقاس", "الخامة", "الماركة"],
        "default_policies": [
            {"type": "return", "title": "سياسة الاسترجاع", "content": "يمكن إرجاع المنتج خلال 14 يوم من تاريخ الشراء بشرط أن يكون بحالته الأصلية مع الفاتورة."},
            {"type": "exchange", "title": "سياسة الاستبدال", "content": "يمكن استبدال المنتج خلال 7 أيام. يجب أن يكون المنتج غير مستخدم وبتغليفه الأصلي."},
        ],
    },
    "restaurant": {
        "label": "مطعم / كافيه",
        "icon": "🍽️",
        "persona": (
            "أنا مساعد المطعم الذكي. أساعد الزبائن في استعراض المنيو، "
            "معرفة المكونات والحساسيات، الطلب والتوصيل، ومعرفة أوقات العمل. "
            "أتحدث بأسلوب ترحيبي ودافئ."
        ),
        "suggested_fields": ["المكونات", "الحجم", "حار/معتدل", "مناسب للنباتيين"],
        "default_policies": [
            {"type": "general", "title": "أوقات العمل", "content": "نعمل يومياً من 10 صباحاً حتى 12 ليلاً."},
        ],
    },
    "courses": {
        "label": "دورات تدريبية",
        "icon": "📚",
        "persona": (
            "أنا مساعد الأكاديمية الذكي. أساعد المتدربين في معرفة الدورات المتاحة، "
            "المستويات، المدة، الشهادات، والأسعار. أجيب عن الأسئلة المتعلقة بالتسجيل "
            "وجدول الدورات. أتحدث بأسلوب تحفيزي ومهني."
        ),
        "suggested_fields": ["المستوى", "المدة", "شهادة", "المدرب", "اللغة", "أونلاين/حضوري"],
        "default_policies": [
            {"type": "return", "title": "سياسة الإلغاء", "content": "يمكن إلغاء التسجيل واسترداد المبلغ كاملاً قبل 48 ساعة من بدء الدورة."},
        ],
    },
    "clinic": {
        "label": "عيادة / مركز طبي",
        "icon": "🏥",
        "persona": (
            "أنا مساعد العيادة الذكي. أساعد المرضى في حجز المواعيد، "
            "معرفة الخدمات المتاحة، أوقات العمل، والأطباء المتاحين. "
            "لا أقدم نصائح طبية — أوجه المريض للطبيب المختص. "
            "أتحدث بأسلوب مهني ومطمئن."
        ),
        "suggested_fields": ["التخصص", "الطبيب", "المدة", "يحتاج تحويل"],
        "default_policies": [
            {"type": "general", "title": "ملاحظة طبية", "content": "المعلومات المقدمة للتوعية فقط ولا تغني عن استشارة الطبيب."},
        ],
    },
    "salon": {
        "label": "صالون / سبا",
        "icon": "💇",
        "persona": (
            "أنا مساعد الصالون الذكي. أساعد الزبائن في حجز المواعيد، "
            "معرفة الخدمات والأسعار، وتفاصيل العلاجات المتاحة. "
            "أتحدث بأسلوب ودي وأنيق."
        ),
        "suggested_fields": ["المدة", "المختص/ة", "للرجال/للنساء"],
        "default_policies": [
            {"type": "general", "title": "سياسة المواعيد", "content": "يرجى الحضور قبل الموعد بـ 10 دقائق. في حال عدم الحضور بدون إلغاء مسبق، قد يتم تطبيق رسوم."},
        ],
    },
    "services": {
        "label": "خدمات عامة",
        "icon": "🔧",
        "persona": (
            "أنا مساعد الخدمات الذكي. أساعد الزبائن في معرفة الخدمات المتاحة، "
            "الأسعار، حجز المواعيد، ومعرفة تفاصيل كل خدمة. "
            "أتحدث بأسلوب مهني وعملي."
        ),
        "suggested_fields": ["المدة", "يشمل", "الضمان"],
        "default_policies": [],
    },
    "real_estate": {
        "label": "عقارات",
        "icon": "🏠",
        "persona": (
            "أنا مساعد العقارات الذكي. أساعد الزبائن في البحث عن عقارات، "
            "معرفة التفاصيل (المساحة، الموقع، السعر، عدد الغرف)، "
            "وترتيب معاينات. أتحدث بأسلوب مهني وشفاف."
        ),
        "suggested_fields": ["المساحة", "الموقع", "عدد الغرف", "الطابق", "إيجار/بيع", "مفروش"],
        "default_policies": [],
    },
    "cars": {
        "label": "سيارات",
        "icon": "🚗",
        "persona": (
            "أنا مساعد معرض السيارات الذكي. أساعد الزبائن في استعراض السيارات المتاحة، "
            "المواصفات، الأسعار، الكفالات، وخيارات التمويل. "
            "أتحدث بأسلوب خبير وصادق."
        ),
        "suggested_fields": ["السنة", "اللون", "الكيلومترات", "الوقود", "القير", "المحرك"],
        "default_policies": [
            {"type": "return", "title": "سياسة الإرجاع", "content": "لا يمكن إرجاع السيارة بعد إتمام البيع. يمكن الفحص والتجربة قبل الشراء."},
        ],
    },
    "electronics": {
        "label": "إلكترونيات",
        "icon": "📱",
        "persona": (
            "أنا مساعد متجر الإلكترونيات الذكي. أساعد الزبائن في اختيار الأجهزة، "
            "مقارنة المواصفات، معرفة الأسعار والكفالات، والتوفر. "
            "أتحدث بأسلوب تقني مبسط."
        ),
        "suggested_fields": ["الماركة", "المعالج", "الذاكرة", "التخزين", "الشاشة", "البطارية"],
        "default_policies": [
            {"type": "return", "title": "سياسة الاسترجاع", "content": "يمكن إرجاع المنتج خلال 7 أيام بشرط أن يكون بتغليفه الأصلي وبدون خدوش."},
        ],
    },
    "digital": {
        "label": "منتجات رقمية",
        "icon": "💻",
        "persona": (
            "أنا مساعد المنتجات الرقمية الذكي. أساعد الزبائن في معرفة المنتجات الرقمية "
            "المتاحة (اشتراكات، تصاميم، قوالب، دورات أونلاين)، الأسعار، وطريقة التسليم. "
            "أتحدث بأسلوب عصري ومبسط."
        ),
        "suggested_fields": ["الصيغة", "الحجم", "الترخيص", "تحديثات مجانية"],
        "default_policies": [
            {"type": "return", "title": "سياسة الاسترداد", "content": "بسبب طبيعة المنتجات الرقمية، لا يمكن استرداد المبلغ بعد التسليم."},
        ],
    },
    "subscriptions": {
        "label": "اشتراكات",
        "icon": "🔄",
        "persona": (
            "أنا مساعد الاشتراكات الذكي. أساعد الزبائن في معرفة خطط الاشتراك، "
            "المقارنة بين الباقات، الترقية، الإلغاء، والدفع. "
            "أتحدث بأسلوب واضح ومباشر."
        ),
        "suggested_fields": ["المدة", "الباقة", "يشمل", "حد الاستخدام"],
        "default_policies": [
            {"type": "general", "title": "سياسة الإلغاء", "content": "يمكن إلغاء الاشتراك في أي وقت. لا يتم استرداد المبلغ المدفوع عن الفترة الحالية."},
        ],
    },
    "consulting": {
        "label": "استشارات",
        "icon": "💼",
        "persona": (
            "أنا مساعد الاستشارات الذكي. أساعد العملاء في معرفة الخدمات الاستشارية المتاحة، "
            "حجز جلسات، ومعرفة خبرات المستشارين. "
            "أتحدث بأسلوب مهني وذكي."
        ),
        "suggested_fields": ["التخصص", "المدة", "أونلاين/حضوري", "المستشار"],
        "default_policies": [],
    },
}


BUSINESS_TYPE_GROUPS = {
    "retail": "Commerce & Retail",
    "restaurant": "Food & Hospitality",
    "courses": "Education",
    "clinic": "Health & Wellness",
    "salon": "Health & Wellness",
    "services": "Professional & Local Services",
    "real_estate": "Real Estate & Property",
    "cars": "Automotive",
    "electronics": "Commerce & Retail",
    "digital": "Digital Products",
    "subscriptions": "Digital Products",
    "consulting": "Professional & Local Services",
}


def _template(
    *,
    label: str,
    group: str,
    persona: str,
    fields: list[str],
    policies: list[dict] | None = None,
    icon: str = "",
) -> tuple[str, dict]:
    return group, {
        "label": label,
        "icon": icon,
        "persona": persona,
        "suggested_fields": fields,
        "default_policies": policies or [],
    }


_EXTRA_TEMPLATES = {
    "general": _template(
        label="General Business",
        group="General",
        persona="I am a professional customer-support assistant. I answer only from the business profile, product catalog, policies, and knowledge base. When information is missing, I ask a clear follow-up question or offer a human handoff.",
        fields=["contact method", "location", "working hours", "priority", "notes"],
        policies=[
            {"type": "faq", "title": "General information", "content": "Use the knowledge base and business profile as the source of truth. Do not invent prices, availability, timelines, or policies."}
        ],
    ),
    "fashion_apparel": _template(
        label="Fashion & Apparel",
        group="Commerce & Retail",
        persona="I help customers choose clothing, sizes, colors, availability, delivery options, exchanges, and returns while staying accurate to catalog data.",
        fields=["brand", "size", "color", "fabric", "fit", "gender", "season"],
    ),
    "grocery": _template(
        label="Grocery & Supermarket",
        group="Commerce & Retail",
        persona="I help customers find grocery items, freshness details, substitutions, delivery windows, and payment options.",
        fields=["brand", "weight", "expiry date", "dietary tag", "storage", "bundle size"],
    ),
    "pharmacy": _template(
        label="Pharmacy",
        group="Health & Wellness",
        persona="I help with pharmacy product availability, opening hours, delivery, and prescription process questions. I do not provide medical diagnosis or dosage advice.",
        fields=["brand", "active ingredient", "requires prescription", "size", "usage note"],
        policies=[
            {"type": "safety", "title": "Medical safety", "content": "Do not provide diagnosis, dosage, or treatment advice. For medical questions, refer the customer to a licensed pharmacist or doctor."}
        ],
    ),
    "furniture_home": _template(
        label="Furniture & Home Decor",
        group="Commerce & Retail",
        persona="I help customers compare furniture, dimensions, materials, colors, delivery, installation, warranties, and custom order timelines.",
        fields=["dimensions", "material", "color", "room", "assembly", "warranty"],
    ),
    "beauty_cosmetics": _template(
        label="Beauty & Cosmetics",
        group="Commerce & Retail",
        persona="I help customers choose beauty products using catalog facts, ingredient notes, shades, availability, and return policies.",
        fields=["shade", "skin type", "ingredients", "size", "brand", "expiry date"],
    ),
    "jewelry": _template(
        label="Jewelry & Accessories",
        group="Commerce & Retail",
        persona="I help customers with jewelry materials, sizes, customization, care instructions, pricing, and delivery timelines.",
        fields=["material", "size", "stone", "customizable", "care", "warranty"],
    ),
    "books_stationery": _template(
        label="Books & Stationery",
        group="Commerce & Retail",
        persona="I help customers find books, stationery items, editions, authors, school lists, availability, and delivery options.",
        fields=["author", "edition", "language", "grade", "format", "publisher"],
    ),
    "toys_gifts": _template(
        label="Toys & Gifts",
        group="Commerce & Retail",
        persona="I help customers choose gifts, age-appropriate items, bundles, wrapping options, availability, and delivery timing.",
        fields=["age range", "occasion", "brand", "material", "gift wrap", "bundle"],
    ),
    "fitness_wellness": _template(
        label="Fitness & Wellness",
        group="Health & Wellness",
        persona="I help customers with classes, memberships, trainers, schedules, packages, and booking steps without giving medical advice.",
        fields=["duration", "level", "coach", "location", "membership", "schedule"],
    ),
    "hotel_hospitality": _template(
        label="Hotel & Hospitality",
        group="Food & Hospitality",
        persona="I help guests with rooms, amenities, availability, booking questions, policies, check-in, and local service information.",
        fields=["room type", "capacity", "amenities", "check-in", "meal plan", "policy"],
    ),
    "travel_tourism": _template(
        label="Travel & Tourism",
        group="Food & Hospitality",
        persona="I help customers compare trips, packages, schedules, included services, booking steps, and cancellation policies.",
        fields=["destination", "duration", "included services", "date", "capacity", "language"],
    ),
    "education_school": _template(
        label="School / Education Center",
        group="Education",
        persona="I help parents and learners with programs, admissions, schedules, fees, documents, and enrollment steps.",
        fields=["program", "age group", "schedule", "teacher", "fee", "required documents"],
    ),
    "legal_services": _template(
        label="Legal Services",
        group="Professional & Local Services",
        persona="I help with intake, appointment scheduling, service descriptions, required documents, and office policies. I do not provide legal advice.",
        fields=["case type", "jurisdiction", "documents", "appointment", "urgency"],
        policies=[
            {"type": "safety", "title": "No legal advice", "content": "Do not provide legal advice. Collect intake details and offer an appointment with a qualified professional."}
        ],
    ),
    "accounting_finance": _template(
        label="Accounting & Finance",
        group="Professional & Local Services",
        persona="I help clients understand service packages, required documents, deadlines, pricing, and appointment availability without giving financial advice.",
        fields=["service type", "deadline", "documents", "company type", "period"],
    ),
    "insurance": _template(
        label="Insurance Agency",
        group="Professional & Local Services",
        persona="I help customers compare insurance service categories, collect quote details, explain required documents, and hand off policy-specific questions.",
        fields=["coverage type", "customer age", "asset value", "documents", "renewal date"],
    ),
    "construction_contracting": _template(
        label="Construction & Contracting",
        group="Real Estate & Property",
        persona="I help customers describe projects, request quotes, understand service scope, schedule site visits, and review timelines.",
        fields=["project type", "area", "location", "budget", "timeline", "materials"],
    ),
    "home_services": _template(
        label="Home Services",
        group="Professional & Local Services",
        persona="I help customers book local home services, describe issues, understand pricing ranges, service areas, and availability.",
        fields=["service type", "location", "urgency", "property type", "preferred time"],
    ),
    "cleaning_services": _template(
        label="Cleaning Services",
        group="Professional & Local Services",
        persona="I help customers book cleaning services, choose packages, estimate duration, and understand materials, areas, and policies.",
        fields=["property size", "service type", "frequency", "materials", "location"],
    ),
    "repair_maintenance": _template(
        label="Repair & Maintenance",
        group="Professional & Local Services",
        persona="I help customers troubleshoot basic service intake, book repairs, collect model details, and explain warranty or visit policies.",
        fields=["device", "model", "issue", "warranty", "location", "urgency"],
    ),
    "event_planning": _template(
        label="Events & Catering",
        group="Food & Hospitality",
        persona="I help customers plan events, compare packages, collect guest count, dates, venues, menus, and budget details.",
        fields=["event type", "date", "guest count", "venue", "budget", "package"],
    ),
    "nonprofit_ngo": _template(
        label="Nonprofit / NGO",
        group="Community & Public Sector",
        persona="I help visitors understand programs, donation options, volunteer steps, eligibility, and contact routes using approved organization information.",
        fields=["program", "eligibility", "location", "donation type", "volunteer role"],
    ),
    "b2b_wholesale": _template(
        label="B2B / Wholesale",
        group="B2B & Operations",
        persona="I help business buyers with bulk pricing, minimum order quantities, availability, delivery, invoicing, and account setup.",
        fields=["MOQ", "bulk price", "lead time", "warehouse", "invoice terms"],
    ),
    "manufacturing": _template(
        label="Manufacturing",
        group="B2B & Operations",
        persona="I help customers with product capabilities, specs, minimum orders, lead times, quote requests, and production constraints.",
        fields=["material", "capacity", "MOQ", "lead time", "certification", "customization"],
    ),
    "logistics_delivery": _template(
        label="Logistics & Delivery",
        group="B2B & Operations",
        persona="I help customers with delivery coverage, shipping options, tracking, pricing inputs, pickup scheduling, and service terms.",
        fields=["origin", "destination", "weight", "dimensions", "service level", "tracking"],
    ),
    "marketing_agency": _template(
        label="Marketing Agency",
        group="Digital Products",
        persona="I help prospects understand services, packages, timelines, required assets, consultation booking, and reporting cadence.",
        fields=["service", "platform", "budget", "timeline", "assets", "goal"],
    ),
    "photography_media": _template(
        label="Photography & Media",
        group="Creative Services",
        persona="I help customers compare packages, availability, deliverables, booking steps, locations, and editing timelines.",
        fields=["package", "date", "location", "duration", "deliverables", "editing"],
    ),
}

for key, (group, template) in _EXTRA_TEMPLATES.items():
    BUSINESS_TYPE_GROUPS[key] = group
    TEMPLATES.setdefault(key, template)


def get_template(business_type: str) -> dict | None:
    """Return the template for a given business type, or None if unknown."""
    return TEMPLATES.get(business_type)


def list_business_types() -> list[dict]:
    """Return a summary of all available business types."""
    return [
        {
            "key": k,
            "label": v["label"],
            "icon": v["icon"],
            "group": BUSINESS_TYPE_GROUPS.get(k, "Other"),
            "suggested_fields": v.get("suggested_fields", []),
        }
        for k, v in TEMPLATES.items()
    ]
