"use client";

import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { Scale, Truck, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

export default function PoliciesPage() {
  const [policies, setPolicies] = useState({
    refund_policy: "يحق للعميل استرجاع المبلغ خلال 14 يوماً من تاريخ الشراء بشرط عدم استخدام المنتج.",
    shipping_policy: "يتم التوصيل خلال 2-4 أيام عمل في المدن الرئيسية، و 5-7 أيام في باقي المدن.",
    escalation_rules: "تحويل المحادثة لموظف بشري فوراً إذا ذكر العميل: شكوى, استرجاع, غاضب, تأخير.",
  });
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Mocking API call to backend/routers/policies.py and delivery.py
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("تم حفظ السياسات والقواعد بنجاح.");
    } catch (err) {
      toast.error("حدث خطأ أثناء الحفظ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="السياسات وقواعد العمل" subtitle="عرّف سياسات نشاطك التجاري ليتمكن الوكيل من التعامل مع أسئلة العملاء بوضوح.">
      <div className="space-y-6 max-w-4xl">
        <GradientCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-400">
              <Scale className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">سياسة الاسترجاع والإلغاء</h3>
              <p className="text-sm text-white/50">كيف يتعامل الوكيل مع طلبات الاسترجاع؟</p>
            </div>
          </div>
          <textarea
            value={policies.refund_policy}
            onChange={(e) => setPolicies({ ...policies, refund_policy: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emeraldx-500 focus:outline-none h-28"
          />
        </GradientCard>

        <GradientCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyanx-500/20 text-cyanx-400">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">سياسة التوصيل والشحن</h3>
              <p className="text-sm text-white/50">المدة والتكلفة ليتمكن الوكيل من إجابة العملاء.</p>
            </div>
          </div>
          <textarea
            value={policies.shipping_policy}
            onChange={(e) => setPolicies({ ...policies, shipping_policy: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emeraldx-500 focus:outline-none h-24"
          />
        </GradientCard>

        <GradientCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/20 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">قواعد التصعيد والتحويل البشري</h3>
              <p className="text-sm text-white/50">متى يتوقف الذكاء الاصطناعي ويطلب تدخل موظف؟</p>
            </div>
          </div>
          <textarea
            value={policies.escalation_rules}
            onChange={(e) => setPolicies({ ...policies, escalation_rules: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emeraldx-500 focus:outline-none h-24"
          />
        </GradientCard>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "جاري الحفظ..." : "حفظ السياسات"}
            <Save className="h-4 w-4 mr-2" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
