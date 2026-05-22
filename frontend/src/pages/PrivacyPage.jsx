export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 bg-white min-h-screen" dir="rtl">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">سياسة الخصوصية</h1>
        <p className="text-gray-500">آخر تحديث: 1 يناير 2024</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">1. جمع المعلومات</h2>
          <p className="text-gray-700 leading-relaxed">
            نقوم بجمع المعلومات التي تقدمها مباشرة لنا، مثل عند إنشاء حساب، استخدام خدماتنا التفاعلية، أو التواصل مع الدعم الفني. قد تشمل هذه المعلومات اسمك، بريدك الإلكتروني، وتفاصيل عملك.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">2. استخدام المعلومات</h2>
          <p className="text-gray-700 leading-relaxed">
            نستخدم المعلومات التي نجمعها لتقديم خدماتنا، تخصيص تجربتك، معالجة معاملاتك، وإرسال تحديثات تقنية أو رسائل دعم. كما نستخدمها لتدريب نماذج الذكاء الاصطناعي الخاصة بك لتحسين استجابات المساعد الافتراضي.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">3. مشاركة المعلومات</h2>
          <p className="text-gray-700 leading-relaxed">
            لا نقوم ببيع أو تأجير معلوماتك الشخصية لأطراف ثالثة. قد نشارك معلوماتك مع مزودي خدمات موثوقين يساعدوننا في تشغيل منصتنا، شريطة التزامهم بالحفاظ على سرية هذه المعلومات.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">4. أمن البيانات</h2>
          <p className="text-gray-700 leading-relaxed">
            نحن نتخذ تدابير أمنية معقولة لحماية معلوماتك الشخصية من الوصول غير المصرح به أو التعديل أو الإفصاح. ومع ذلك، لا يوجد نقل عبر الإنترنت أو نظام تخزين إلكتروني آمن بنسبة 100%.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">5. حقوقك</h2>
          <p className="text-gray-700 leading-relaxed">
            يحق لك الوصول إلى معلوماتك الشخصية التي نحتفظ بها، وتصحيحها، أو طلب حذفها. يمكنك التواصل معنا في أي وقت لممارسة هذه الحقوق.
          </p>
        </section>

      </div>
    </div>
  );
}
