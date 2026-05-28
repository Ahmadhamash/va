"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { PlanCard } from "@/components/plan-card";
import { useAuthStore } from "@/store/use-auth-store";
import { Loader2, CreditCard, Sparkles, ShieldCheck } from "lucide-react";

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
        showNotice(`✨ تم ترقية اشتراكك بنجاح إلى باقة ${tier.name}!`);
      } else {
        showNotice(`❌ فشلت عملية الترقية: ${data.detail || "خطأ غير معروف"}`);
      }
    } catch (err) {
      console.error("Error upgrading subscription:", err);
      showNotice("❌ حدث خطأ غير متوقع أثناء معالجة طلبك.");
    } finally {
      setUpgradingId(null);
    }
  };

  return (
    <AppShell title="الباقات والاشتراكات" subtitle="اختر الخطة المناسبة لحجم عملك للبدء بتشغيل الوكيل الذكي على قنوات التواصل ومضاعفة مبيعاتك.">
      {notice && (
        <div className="mb-6 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-5 py-4 text-sm font-semibold text-emeraldx-400 text-right animate-pulse">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
          <span className="mr-3 text-sm text-white/50">جاري تحميل بيانات الباقات...</span>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active Subscription Summary */}
          {activeSub ? (
            <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 text-right flex flex-col md:flex-row-reverse md:items-center md:justify-between gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emeraldx-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-start md:justify-end gap-3.5">
                <div className="text-right">
                  <span className="text-[10px] text-white/40 font-semibold block mb-0.5">الاشتراك الفعال حالياً</span>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-lg font-bold text-white">باقة {activeSub.tier?.name}</span>
                    <span className="rounded-full bg-emeraldx-500/10 border border-emeraldx-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emeraldx-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      نشط
                    </span>
                  </div>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>

              <div className="flex md:flex-row flex-col gap-4 text-right md:text-left">
                <div className="md:border-l md:border-white/5 md:pl-6 md:ml-6">
                  <span className="text-[10px] text-white/40 font-semibold block mb-0.5">تاريخ التفعيل / التجديد</span>
                  <span className="text-xs font-semibold text-white/80">
                    {new Date(activeSub.start_date).toLocaleDateString("ar-EG", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-white/40 font-semibold block mb-0.5">حالة الفوترة</span>
                  <span className="text-xs font-semibold text-emeraldx-400">مدفوع عبر الرصيد التجريبي</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-amber-500/20 bg-amber-500/5 p-6 text-right flex items-center justify-end gap-3.5">
              <div>
                <h4 className="text-sm font-bold text-amber-400">تنبيه: ليس لديك اشتراك نشط</h4>
                <p className="text-[11px] text-white/50 mt-1">
                  يرجى اختيار إحدى الباقات المتاحة أدناه لتنشيط حسابك وتفعيل خدمات الرد الآلي للذكاء الاصطناعي.
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
          
          {/* Bottom Security Info Badge */}
          <div className="text-center py-4 text-[10px] text-white/30 flex items-center justify-center gap-1">
            <span>جميع المعاملات تتم بأمان وحماية مشفرة 100% بالتعاون مع بوابات الدفع العالمية</span>
            <ShieldCheck className="h-3.5 w-3.5 text-white/30" />
          </div>
        </div>
      )}
    </AppShell>
  );
}
