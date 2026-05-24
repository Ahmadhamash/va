import { AppShell } from "@/components/app-shell";
import { PlanCard } from "@/components/plan-card";

const plans = [
  {
    name: "Starter",
    price: "$29",
    description: "للمتاجر الصغيرة التي تريد تجربة الردود الذكية.",
    features: ["وضع تجريبي", "قناة واحدة", "500 رد ذكي", "صندوق محادثات بسيط"]
  },
  {
    name: "Growth",
    price: "$79",
    description: "للأعمال التي تريد تشغيل خدمة العملاء يوميا.",
    features: ["واتساب + فيسبوك + إنستغرام", "3 أعضاء فريق", "5,000 رد ذكي", "تحويل بشري", "تحليلات"],
    highlighted: true
  },
  {
    name: "Pro",
    price: "$199",
    description: "للفرق ذات الحجم العالي والفروع المتعددة.",
    features: ["فروع متعددة", "قواعد تحويل متقدمة", "دعم أولوية", "تهيئة مخصصة"]
  }
];

export default function BillingPage() {
  return (
    <AppShell title="الباقات" subtitle="عرض أسعار بسيط ومفهوم. الدفع الحقيقي placeholder حاليا.">
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.name} {...plan} />
        ))}
      </div>
    </AppShell>
  );
}
