"use client";

import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { Scale, Truck, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useLanguageStore } from "@/store/use-language-store";

export default function PoliciesPage() {
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [policies, setPolicies] = useState({
    refund_policy: "",
    shipping_policy: "",
    escalation_rules: "",
  });

  useEffect(() => {
    setPolicies({
      refund_policy: isRtl 
        ? "يحق للعميل استرجاع المبلغ خلال 14 يوماً من تاريخ الشراء بشرط عدم استخدام المنتج." 
        : "The customer has the right to refund the amount within 14 days of purchase, provided the product is not used.",
      shipping_policy: isRtl 
        ? "يتم التوصيل خلال 2-4 أيام عمل في المدن الرئيسية، و 5-7 أيام في باقي المدن." 
        : "Delivery takes 2-4 business days in major cities, and 5-7 days in other cities.",
      escalation_rules: isRtl 
        ? "تحويل المحادثة لموظف بشري فوراً إذا ذكر العميل: شكوى, استرجاع, غاضب, تأخير." 
        : "Transfer the chat to a human agent immediately if the customer mentions: complaint, refund, angry, delay.",
    });
  }, [isRtl]);
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Mocking API call to backend/routers/policies.py and delivery.py
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success(isRtl ? "تم حفظ السياسات والقواعد بنجاح." : "Policies and rules saved successfully.");
    } catch (err) {
      toast.error(isRtl ? "حدث خطأ أثناء الحفظ." : "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell 
      title={isRtl ? "السياسات وقواعد العمل" : "Policies & Business Rules"} 
      subtitle={isRtl ? "عرّف سياسات نشاطك التجاري ليتمكن الوكيل من التعامل مع أسئلة العملاء بوضوح." : "Define your business policies so the agent can clearly handle customer questions."}
    >
      <div className="space-y-6 max-w-4xl rtl:text-right ltr:text-left">
        <GradientCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-400">
              <Scale className="h-6 w-6" />
            </div>
            <div className="rtl:text-right ltr:text-left">
              <h3 className="text-xl font-semibold text-white">{isRtl ? "سياسة الاسترجاع والإلغاء" : "Refund & Cancellation Policy"}</h3>
              <p className="text-sm text-white/50">{isRtl ? "كيف يتعامل الوكيل مع طلبات الاسترجاع؟" : "How does the agent handle refund requests?"}</p>
            </div>
          </div>
          <textarea
            value={policies.refund_policy}
            onChange={(e) => setPolicies({ ...policies, refund_policy: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-primary-500 focus:outline-none h-28 rtl:text-right ltr:text-left"
          />
        </GradientCard>

        <GradientCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyanx-500/20 text-cyanx-400">
              <Truck className="h-6 w-6" />
            </div>
            <div className="rtl:text-right ltr:text-left">
              <h3 className="text-xl font-semibold text-white">{isRtl ? "سياسة التوصيل والشحن" : "Shipping & Delivery Policy"}</h3>
              <p className="text-sm text-white/50">{isRtl ? "المدة والتكلفة ليتمكن الوكيل من إجابة العملاء." : "Duration and cost so that the agent can answer customers."}</p>
            </div>
          </div>
          <textarea
            value={policies.shipping_policy}
            onChange={(e) => setPolicies({ ...policies, shipping_policy: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-primary-500 focus:outline-none h-24 rtl:text-right ltr:text-left"
          />
        </GradientCard>

        <GradientCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-500/20 text-red-400">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="rtl:text-right ltr:text-left">
              <h3 className="text-xl font-semibold text-white">{isRtl ? "قواعد التصعيد والتحويل البشري" : "Escalation & Human Handoff Rules"}</h3>
              <p className="text-sm text-white/50">{isRtl ? "متى يتوقف الذكاء الاصطناعي ويطلب تدخل موظف؟" : "When does the AI stop and request staff intervention?"}</p>
            </div>
          </div>
          <textarea
            value={policies.escalation_rules}
            onChange={(e) => setPolicies({ ...policies, escalation_rules: e.target.value })}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-primary-500 focus:outline-none h-24 rtl:text-right ltr:text-left"
          />
        </GradientCard>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (isRtl ? "جاري الحفظ..." : "Saving...") : (isRtl ? "حفظ السياسات" : "Save Policies")}
            <Save className="h-4 w-4 mr-2" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

