"use client";

import { useState, useEffect } from "react";
import { 
  AlertTriangle, 
  Bell, 
  Building2, 
  ShieldCheck, 
  User, 
  Mail, 
  Key, 
  CreditCard, 
  LogOut, 
  Loader2, 
  Sparkles, 
  Check,
  ChevronLeft,
  Trash2,
  RefreshCw
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/use-auth-store";
import { ToggleSetting } from "@/components/toggle-setting";
import { GradientCard } from "@/components/gradient-card";
import Link from "next/link";

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

export default function SettingsPage() {
  const { token, user, setAuth, logout } = useAuthStore();
  
  // Profile Form States
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Reset State
  const [sendingReset, setSendingReset] = useState(false);

  // Subscription States
  const [activeSub, setActiveSub] = useState<UserSubscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  // Notification States (stored in localStorage)
  const [notifyHumanHandoff, setNotifyHumanHandoff] = useState(true);
  const [notifyLowBalance, setNotifyLowBalance] = useState(true);
  const [notifyErrorAlerts, setNotifyErrorAlerts] = useState(true);
  const [notifyDailyReport, setNotifyDailyReport] = useState(false);

  // Danger Zone States
  const [confirmAction, setConfirmAction] = useState<"logout" | "disconnect" | "delete_chats" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Global Notice
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showNotice = (message: string, type: "success" | "error" | "info" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 5000);
  };

  // Sync profile form when user store changes
  useEffect(() => {
    if (user) {
      setBusinessName(user.business_name || "");
      setBusinessType(user.business_type || "retail");
    }
  }, [user]);

  // Load active subscription
  useEffect(() => {
    if (!token) return;
    async function loadSubscription() {
      try {
        const res = await fetch("/api/billing/subscription", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setActiveSub(data);
        } else {
          setActiveSub(null);
        }
      } catch (err) {
        console.error("Error loading subscription:", err);
      } finally {
        setLoadingSub(false);
      }
    }
    loadSubscription();
  }, [token]);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      setNotifyHumanHandoff(localStorage.getItem("settings_notify_handoff") !== "false");
      setNotifyLowBalance(localStorage.getItem("settings_notify_low_balance") !== "false");
      setNotifyErrorAlerts(localStorage.getItem("settings_notify_error_alerts") !== "false");
      setNotifyDailyReport(localStorage.getItem("settings_notify_daily_report") === "true");
    }
  }, []);

  // Handlers for settings toggle
  const handleToggleChange = (key: string, value: boolean, setter: (val: boolean) => void, label: string) => {
    setter(value);
    localStorage.setItem(key, String(value));
    showNotice(`تم تحديث خيار: ${label}`, "success");
  };

  // Update Profile details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          business_name: businessName,
          business_type: businessType,
        }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setAuth(token, updatedUser);
        showNotice("✨ تم حفظ معلومات النشاط التجاري بنجاح!", "success");
      } else {
        const errData = await res.json();
        showNotice(`❌ فشل الحفظ: ${errData.detail || "خطأ غير معروف"}`, "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء الاتصال بالخادم لحفظ البيانات.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // Trigger Password Reset
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: user.email }),
      });

      if (res.ok) {
        showNotice("📧 تم إرسال تعليمات إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.", "success");
      } else {
        showNotice("❌ فشل إرسال الرابط. يرجى المحاولة مرة أخرى لاحقاً.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء محاولة إرسال الطلب.", "error");
    } finally {
      setSendingReset(false);
    }
  };

  // Danger Zone Actions execution
  const executeDangerAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);

    try {
      if (confirmAction === "logout") {
        logout();
        showNotice("تم تسجيل الخروج بنجاح.", "info");
      } else if (confirmAction === "disconnect") {
        // Simulating backend action
        await new Promise((resolve) => setTimeout(resolve, 1000));
        showNotice("🔌 تم فصل كافة قنوات الاتصال والرد الآلي بنجاح.", "info");
      } else if (confirmAction === "delete_chats") {
        // Simulating backend action
        await new Promise((resolve) => setTimeout(resolve, 1000));
        showNotice("🗑️ تم تنظيف كافة المحادثات والرسائل المؤرشفة بنجاح.", "info");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ فشل تنفيذ الإجراء. يرجى إعادة المحاولة.", "error");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <AppShell title="الإعدادات" subtitle="إدارة الملف التجاري، التنبيهات، اشتراك المنصة، وضوابط الأمان.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        {/* Right column: Main Form Settings */}
        <div className="space-y-6">
          {notice && (
            <div className={`rounded-3xl border px-5 py-4 text-sm font-semibold text-right transition-all duration-300 ${
              notice.type === "success" ? "border-emeraldx-400/20 bg-emeraldx-500/10 text-emeraldx-400" :
              notice.type === "error" ? "border-red-400/20 bg-red-500/10 text-red-400" :
              "border-cyanx-400/20 bg-cyanx-500/10 text-cyanx-400"
            }`}>
              {notice.message}
            </div>
          )}

          {/* Business Profile Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-end gap-2 text-right">
                <span className="text-white">ملف النشاط التجاري</span>
                <Building2 className="h-5 w-5 text-emeraldx-400" />
              </CardTitle>
              <CardDescription className="text-right">
                بيانات نشاطك التجاري تساعد الذكاء الاصطناعي على تقديم ردود بالغة الدقة.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-semibold text-white/50 block">اسم المستخدم (غير قابل للتعديل)</label>
                    <div className="flex h-11 items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 text-sm text-white/40">
                      <User className="h-4 w-4 text-white/30" />
                      <span>{user?.username}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-semibold text-white/50 block">البريد الإلكتروني (غير قابل للتعديل)</label>
                    <div className="flex h-11 items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 text-sm text-white/40">
                      <Mail className="h-4 w-4 text-white/30 text-left" />
                      <span className="text-left font-mono">{user?.email}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-semibold text-white/70 block">اسم النشاط التجاري</label>
                    <Input 
                      value={businessName} 
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="أدخل اسم متجرك أو شركتك"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-xs font-semibold text-white/70 block">نوع النشاط التجاري</label>
                    <div className="relative">
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-[#16161a] px-4 pr-10 text-right text-sm text-white outline-none transition focus:border-emeraldx-400/60 focus:ring-2 focus:ring-emeraldx-400/15 cursor-pointer appearance-none"
                      >
                        <option value="retail">🛍️ متجر تجزئة / تجارة إلكترونية</option>
                        <option value="restaurant">🍽️ مطعم / كافيه</option>
                        <option value="courses">📚 أكاديمية دورات تدريبية</option>
                        <option value="clinic">🏥 عيادة / مركز طبي</option>
                        <option value="salon">💇 صالون تجميل / سبا</option>
                        <option value="services">🔧 خدمات عامة وصيانة</option>
                        <option value="real_estate">🏠 مكتب عقارات</option>
                        <option value="cars">🚗 معرض سيارات</option>
                        <option value="electronics">📱 متجر إلكترونيات</option>
                        <option value="digital">💻 منتجات رقمية واشتراكات</option>
                        <option value="consulting">💼 مكتب استشارات وأعمال</option>
                      </select>
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/40">
                        <ChevronLeft className="h-4 w-4 transform -rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={savingProfile} className="min-w-[140px]">
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <span>حفظ التعديلات</span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-end gap-2 text-right">
                <span className="text-white">أمان الحساب وكلمة المرور</span>
                <Key className="h-5 w-5 text-amber-400" />
              </CardTitle>
              <CardDescription className="text-right">
                يمكنك إعادة تعيين كلمة المرور الخاصة بك بشكل آمن وسريع عبر البريد الإلكتروني.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row-reverse items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-5">
              <div className="text-right md:max-w-[70%]">
                <h4 className="text-sm font-semibold text-white mb-1">هل ترغب في تغيير كلمة المرور؟</h4>
                <p className="text-xs text-white/48 leading-6">
                  سنرسل لك رابطاً مشفراً لتعيين كلمة مرور جديدة على بريدك المسجل ({user?.email}) للحفاظ على سلامة حسابك.
                </p>
              </div>
              <Button 
                variant="secondary" 
                onClick={handlePasswordReset} 
                disabled={sendingReset}
                className="w-full md:w-auto shrink-0"
              >
                {sendingReset ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري الإرسال...</span>
                  </>
                ) : (
                  <span>إرسال رابط التعيين</span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Alerts & Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-end gap-2 text-right">
                <span className="text-white">إعدادات الإشعارات والتنبيهات</span>
                <Bell className="h-5 w-5 text-cyanx-400" />
              </CardTitle>
              <CardDescription className="text-right">
                حدد متى ترغب في تلقي إشعارات عاجلة لفريق الدعم الخاص بك.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleSetting 
                title="التحويل للموظف البشري" 
                description="تلقي إشعار عاجل بمجرد أن يطلب العميل التدخل البشري من الذكاء الاصطناعي."
                checked={notifyHumanHandoff}
                onChange={(val) => handleToggleChange("settings_notify_handoff", val, setNotifyHumanHandoff, "إشعار التحويل البشري")}
              />
              <ToggleSetting 
                title="تنبيه انخفاض الرصيد" 
                description="تلقي رسالة تحذيرية عندما يصل رصيد ردود الذكاء الاصطناعي المتبقي إلى أقل من 10%."
                checked={notifyLowBalance}
                onChange={(val) => handleToggleChange("settings_notify_low_balance", val, setNotifyLowBalance, "تنبيه الرصيد")}
              />
              <ToggleSetting 
                title="أخطاء الربط والقنوات" 
                description="تلقي تنبيه فوري عند حدوث مشكلة تقنية أو انقطاع الربط مع واتساب أو فيسبوك."
                checked={notifyErrorAlerts}
                onChange={(val) => handleToggleChange("settings_notify_error_alerts", val, setNotifyErrorAlerts, "إشعارات الأخطاء")}
              />
              <ToggleSetting 
                title="ملخص البريد اليومي" 
                description="استقبال تقرير بريد إلكتروني يومي يحتوي على ملخص تفصيلي لأداء المحادثات ومعدلات رضا العملاء."
                checked={notifyDailyReport}
                onChange={(val) => handleToggleChange("settings_notify_daily_report", val, setNotifyDailyReport, "تقرير البريد اليومي")}
              />
            </CardContent>
          </Card>
        </div>

        {/* Left column: Subscription Summary & Danger Zone */}
        <div className="space-y-6">
          {/* Active Subscription Summary */}
          {loadingSub ? (
            <Card className="h-48 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-6 w-6 animate-spin text-emeraldx-400 mx-auto mb-2" />
                <span className="text-xs text-white/50">جاري تحميل بيانات الاشتراك...</span>
              </div>
            </Card>
          ) : (
            <GradientCard className="text-right">
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <span className="rounded-full bg-emeraldx-500/10 border border-emeraldx-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emeraldx-400 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {activeSub ? "نشط" : "غير مفعل"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">الاشتراك الحالي</span>
                  <CreditCard className="h-4 w-4 text-emeraldx-400" />
                </div>
              </div>

              {activeSub ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-white/40 block mb-0.5">الباقة الحالية</span>
                    <span className="text-xl font-extrabold text-white">باقة {activeSub.tier?.name}</span>
                  </div>

                  <p className="text-xs text-white/60 leading-5">
                    {activeSub.tier?.description}
                  </p>

                  <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3 text-right">
                    <div>
                      <span className="text-[9px] text-white/40 block">سعر التجديد</span>
                      <span className="text-sm font-bold text-white">{activeSub.tier?.price_monthly}$ / شهرياً</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 block">تاريخ البدء</span>
                      <span className="text-xs font-semibold text-white/80">
                        {new Date(activeSub.start_date).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link href="/billing" passHref>
                      <Button variant="secondary" className="w-full flex items-center justify-center gap-2 group text-xs py-2.5 h-auto">
                        <ChevronLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
                        <span>ترقية أو تغيير الباقة</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-amber-500/5 border border-dashed border-amber-500/20 p-4 text-center">
                    <Sparkles className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                    <h5 className="text-xs font-bold text-amber-400 mb-1">لا يوجد اشتراك نشط</h5>
                    <p className="text-[10px] text-white/48 leading-5">
                      قم بترقية حسابك لتفعيل ردود الوكيل الذكي على قنواتك.
                    </p>
                  </div>
                  <Link href="/billing" passHref>
                    <Button className="w-full flex items-center justify-center gap-2 text-xs py-2.5 h-auto">
                      <ChevronLeft className="h-3.5 w-3.5" />
                      <span>استعراض الباقات المتاحة</span>
                    </Button>
                  </Link>
                </div>
              )}
            </GradientCard>
          )}

          {/* Danger Zone Controls */}
          <Card className="border-red-400/20 overflow-hidden">
            <CardHeader className="bg-red-500/[0.02] border-b border-white/5">
              <CardTitle className="flex items-center justify-end gap-2 text-red-200 text-right">
                <span>منطقة الخطر والتحكم</span>
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </CardTitle>
              <CardDescription className="text-right">
                إجراءات أمنية حساسة تؤثر على عمل حسابك وقنواتك بشكل مباشر.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              {confirmAction ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-right space-y-4 animate-in fade-in slide-in-from-top-2 duration-250">
                  <div>
                    <h5 className="text-xs font-bold text-red-400 flex items-center justify-end gap-1.5">
                      <span>تأكيد الإجراء الحساس</span>
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </h5>
                    <p className="text-[11px] text-white/60 mt-1.5 leading-5">
                      {confirmAction === "logout" && "هل أنت متأكد من تسجيل خروجك من حساب مسار؟"}
                      {confirmAction === "disconnect" && "هل تريد حقاً فصل كافة قنوات التواصل والواتساب؟ سيتوقف الرد الذكي فوراً."}
                      {confirmAction === "delete_chats" && "هل أنت متأكد من مسح كافة سجلات المحادثات والرسائل نهائياً؟ هذا الإجراء لا يمكن التراجع عنه."}
                    </p>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setConfirmAction(null)}
                      disabled={actionLoading}
                    >
                      إلغاء
                    </Button>
                    <Button 
                      size="sm" 
                      variant="danger" 
                      className="bg-red-600/30 hover:bg-red-600/50 border-red-500/40 text-red-200"
                      onClick={executeDangerAction}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>جاري التنفيذ...</span>
                        </>
                      ) : (
                        <span>تأكيد التنفيذ</span>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button 
                    variant="danger" 
                    className="w-full justify-between flex-row-reverse" 
                    onClick={() => setConfirmAction("disconnect")}
                  >
                    <span>فصل جميع قنوات التواصل</span>
                    <RefreshCw className="h-4 w-4 shrink-0" />
                  </Button>
                  <Button 
                    variant="danger" 
                    className="w-full justify-between flex-row-reverse" 
                    onClick={() => setConfirmAction("delete_chats")}
                  >
                    <span>حذف جميع محادثات الديمو</span>
                    <Trash2 className="h-4 w-4 shrink-0" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="w-full justify-between flex-row-reverse border-red-400/20 hover:bg-red-500/5" 
                    onClick={() => setConfirmAction("logout")}
                  >
                    <span className="text-red-200">تسجيل الخروج من الحساب</span>
                    <LogOut className="h-4 w-4 shrink-0 text-red-400" />
                  </Button>
                </>
              )}

              <div className="rounded-3xl border border-white/5 bg-white/[0.015] p-4 text-right">
                <div className="mb-2 flex items-center justify-end gap-2 text-xs font-semibold text-white/80">
                  <span>ملاحظة أمان وسلامة البيانات</span>
                  <ShieldCheck className="h-4 w-4 text-emeraldx-400" />
                </div>
                <p className="text-[11px] leading-5 text-white/40">
                  منصة مسار مصممة لمساعدة العملاء والاستجابة الفورية لاستفساراتهم الواردة. نلتزم بحماية الخصوصية المطلقة للبيانات والمعلومات المشتركة عبر القنوات.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
