"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PlanCard } from "@/components/plan-card";
import { useAuthStore } from "@/store/use-auth-store";
import { Loader2, CreditCard, Sparkles, ShieldCheck } from "lucide-react";
import { useLanguageStore } from "@/store/use-language-store";

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  features: string[];
  is_active: boolean;
}

interface UserSubscription {
  id: string;
  tier_id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  tier: SubscriptionTier;
}

export default function BillingPage() {
  const { token } = useAuthStore();
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [activeSub, setActiveSub] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradingId, setUpgradingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 5000);
  };

  useEffect(() => {
    async function loadBilling() {
      if (!token) return;
      try {
        const [tiersRes, subRes] = await Promise.all([
          fetch("/api/billing/tiers", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/billing/subscription", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (tiersRes.ok) {
          const tiersData = await tiersRes.json();
          setTiers(tiersData || []);
        } else {
          console.error("Failed to load tiers:", tiersRes.status);
        }

        if (subRes.ok) {
          const subData = await subRes.json();
          setActiveSub(subData || null);
        } else if (subRes.status === 404) {
          // 404 is a valid state indicating no active subscription exists
          setActiveSub(null);
        } else {
          console.error("Failed to load subscription:", subRes.status);
        }
      } catch (err) {
        console.error("Error loading billing page:", err);
      } finally {
        setLoading(false);
      }
    }

    loadBilling();
  }, [token]);

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!token) return;
    setUpgradingId(tier.id);
    try {
      const res = await fetch(`/api/billing/upgrade?tier_id=${tier.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        // Since backend upgrade endpoint returns UserSubscriptionWithTierOut directly
        setActiveSub(data);
        showNotice(isRtl ? `✨ تم ترقية اشتراكك بنجاح إلى باقة ${tier.name}!` : `✨ Your subscription has been successfully upgraded to the ${tier.name} plan!`);
      } else {
        showNotice(isRtl ? `❌ فشلت عملية الترقية: ${data.detail || "خطأ غير معروف"}` : `❌ Upgrade failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Error upgrading subscription:", err);
      showNotice(isRtl ? "❌ حدث خطأ غير متوقع أثناء معالجة طلبك." : "❌ An unexpected error occurred while processing your request.");
    } finally {
      setUpgradingId(null);
    }
  };

  return (
    <AppShell 
      title={isRtl ? "الباقات والاشتراكات" : "Plans & Billing"} 
      subtitle={isRtl ? "اختر الخطة المناسبة لحجم عملك للبدء بتشغيل الوكيل الذكي على قنوات التواصل ومضاعفة مبيعاتك." : "Choose the right plan for your business to start running the smart agent on communication channels and double your sales."}
    >
      {notice && (
        <div className="mb-6 rounded-3xl border border-primary-400/20 bg-primary-500/10 px-5 py-4 text-sm font-semibold text-primary-400 rtl:text-right ltr:text-left animate-pulse">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
          <span className="mx-3 text-sm text-white/50">{isRtl ? "جاري تحميل بيانات الباقات..." : "Loading plans data..."}</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Subscription Summary */}
          {activeSub ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 rtl:text-right ltr:text-left flex flex-col md:flex-row md:items-center md:justify-between gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center gap-3.5 order-first md:order-last">
                <div className="rtl:text-right ltr:text-left">
                  <span className="text-[10px] text-white/40 font-semibold block mb-0.5">{isRtl ? "الاشتراك الفعال حالياً" : "Currently Active Subscription"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">
                      {isRtl ? `باقة ${activeSub.tier?.name}` : `${activeSub.tier?.name} Plan`}
                    </span>
                    <span className="rounded-full bg-primary-500/10 border border-primary-500/20 px-2.5 py-0.5 text-[10px] font-bold text-primary-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {isRtl ? "نشط" : "Active"}
                    </span>
                  </div>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-primary-400 order-first">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>

              <div className="flex md:flex-row flex-col gap-4 rtl:text-right ltr:text-left">
                <div className="rtl:border-l rtl:border-white/5 rtl:pl-6 rtl:ml-6 ltr:border-r ltr:border-white/5 ltr:pr-6 ltr:mr-6">
                  <span className="text-[10px] text-white/40 font-semibold block mb-0.5">{isRtl ? "تاريخ التفعيل / التجديد" : "Activation / Renewal Date"}</span>
                  <span className="text-xs font-semibold text-white/80">
                    {new Date(activeSub.start_date).toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 font-semibold block mb-0.5">{isRtl ? "حالة الفوترة" : "Billing Status"}</span>
                  <span className="text-xs font-semibold text-primary-400">{isRtl ? "مدفوع عبر الرصيد التجريبي" : "Paid via demo balance"}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-amber-500/20 bg-amber-500/5 p-6 rtl:text-right ltr:text-left flex items-center gap-3.5">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-400">{isRtl ? "تنبيه: ليس لديك اشتراك نشط" : "Alert: You do not have an active subscription"}</h4>
                <p className="text-[11px] text-white/50 mt-1">
                  {isRtl ? "يرجى اختيار إحدى الباقات المتاحة أدناه لتنشيط حسابك وتفعيل خدمات الرد الآلي للذكاء الاصطناعي." : "Please choose one of the available plans below to activate your account and enable AI auto-reply services."}
                </p>
              </div>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-400">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>
          )}

          {/* Pricing Grid */}
          <div className="grid gap-5 md:grid-cols-3 items-stretch">
            {tiers.map((tier) => {
              const isActive = activeSub?.tier_id === tier.id;
              const highlighted = tier.name === "Growth";
              
              return (
                <PlanCard
                  key={tier.id}
                  id={tier.id}
                  name={tier.name}
                  price={tier.price_monthly}
                  description={tier.description}
                  features={tier.features}
                  highlighted={highlighted}
                  isActive={isActive}
                  isLoading={upgradingId === tier.id}
                  onSelect={() => handleUpgrade(tier)}
                />
              );
            })}
          </div>
          
          {/* Billing integration note */}
          <div className="text-center py-4 text-[10px] text-white/40 flex items-center justify-center gap-1">
            <span>
              {isRtl 
                ? "تغيير الخطة هنا يفعّل الاشتراك داخل النظام. الدفع الإلكتروني الحقيقي يحتاج ربط بوابة دفع وإعداد مفاتيحها على السيرفر." 
                : "Changing the plan here activates the subscription inside the system. Real electronic payment requires connecting a payment gateway and configuring its keys on the server."}
            </span>
            <ShieldCheck className="h-3.5 w-3.5 text-white/30" />
          </div>
        </div>
      )}
    </AppShell>
  );
}

