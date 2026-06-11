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
  ChevronRight,
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
import { toast } from "react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

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
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";
  
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
        const res = await apiClient.get("/billing/subscription");
        setActiveSub(res.data);
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status !== 404) {
          console.error("Error loading subscription:", err);
        }
        setActiveSub(null);
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
    toast.success(isRtl ? `تم تحديث خيار: ${label}` : `Updated option: ${label}`);
  };

  // Update Profile details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    try {
      const res = await apiClient.put("/auth/me", {
        business_name: businessName,
        business_type: businessType,
      });

      setAuth(token, res.data);
      toast.success(isRtl ? "✨ تم حفظ معلومات النشاط التجاري بنجاح!" : "✨ Business information saved successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(
        isRtl 
          ? `❌ فشل الحفظ: ${err.response?.data?.detail || "خطأ غير معروف"}` 
          : `❌ Save failed: ${err.response?.data?.detail || "Unknown error"}`
      );
    } finally {
      setSavingProfile(false);
    }
  };

  // Trigger Password Reset
  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      await apiClient.post("/auth/forgot-password", { email: user.email });
      toast.success(
        isRtl 
          ? "📧 تم إرسال تعليمات إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح." 
          : "📧 Password reset instructions have been sent to your email successfully."
      );
    } catch (err) {
      console.error(err);
      toast.error(
        isRtl 
          ? "❌ فشل إرسال الرابط. يرجى المحاولة مرة أخرى لاحقاً." 
          : "❌ Failed to send reset link. Please try again later."
      );
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
        await apiClient.post("/auth/logout").catch(() => null);
        logout();
        toast(isRtl ? "تم تسجيل الخروج بنجاح." : "Logged out successfully.", { icon: "ℹ️" });
      } else if (confirmAction === "disconnect") {
        const res = await apiClient.delete("/channels");
        toast.success(
          isRtl 
            ? `تم فصل ${res.data.deleted ?? 0} قناة اتصال بنجاح.` 
            : `Successfully disconnected ${res.data.deleted ?? 0} communication channels.`
        );
      } else if (confirmAction === "delete_chats") {
        const res = await apiClient.delete("/chat/sessions");
        toast.success(
          isRtl 
            ? `تم حذف ${res.data.deleted ?? 0} محادثة بنجاح.` 
            : `Successfully deleted ${res.data.deleted ?? 0} conversations.`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        isRtl 
          ? "❌ فشل تنفيذ الإجراء. يرجى إعادة المحاولة." 
          : "❌ Action execution failed. Please try again."
      );
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <AppShell 
      title={isRtl ? "الإعدادات" : "Settings"} 
      subtitle={isRtl ? "إدارة الملف التجاري، التنبيهات، اشتراك المنصة، وضوابط الأمان." : "Manage business profile, notifications, subscription, and safety."}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        {/* Right column: Main Form Settings */}
        <div className="space-y-6">

          {/* Business Profile Details */}
          <Card>
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2", isRtl ? "justify-end text-right" : "justify-start text-left")}>
                {isRtl ? (
                  <>
                    <span className="text-white">ملف النشاط التجاري</span>
                    <Building2 className="h-5 w-5 text-primary-400" />
                  </>
                ) : (
                  <>
                    <Building2 className="h-5 w-5 text-primary-400" />
                    <span className="text-white">Business Profile</span>
                  </>
                )}
              </CardTitle>
              <CardDescription className={isRtl ? "text-right" : "text-left"}>
                {isRtl 
                  ? "بيانات نشاطك التجاري تساعد الذكاء الاصطناعي على تقديم ردود بالغة الدقة." 
                  : "Your business details help the AI provide highly accurate responses."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                    <label className="text-xs font-semibold text-white/50 block">
                      {isRtl ? "اسم المستخدم (غير قابل للتعديل)" : "Username (Non-editable)"}
                    </label>
                    <div className="flex h-11 items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 text-sm text-white/40">
                      {isRtl ? (
                        <>
                          <User className="h-4 w-4 text-white/30" />
                          <span>{user?.username}</span>
                        </>
                      ) : (
                        <>
                          <span>{user?.username}</span>
                          <User className="h-4 w-4 text-white/30" />
                        </>
                      )}
                    </div>
                  </div>

                  <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                    <label className="text-xs font-semibold text-white/50 block">
                      {isRtl ? "البريد الإلكتروني (غير قابل للتعديل)" : "Email Address (Non-editable)"}
                    </label>
                    <div className="flex h-11 items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 text-sm text-white/40">
                      {isRtl ? (
                        <>
                          <Mail className="h-4 w-4 text-white/30 text-left" />
                          <span className="text-left font-mono">{user?.email}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-left font-mono">{user?.email}</span>
                          <Mail className="h-4 w-4 text-white/30" />
                        </>
                      )}
                    </div>
                  </div>

                  <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                    <label className="text-xs font-semibold text-white/70 block">
                      {isRtl ? "اسم النشاط التجاري" : "Business Name"}
                    </label>
                    <Input 
                      value={businessName} 
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder={isRtl ? "أدخل اسم متجرك أو شركتك" : "Enter your store or business name"}
                      required
                      className={isRtl ? "text-right" : "text-left"}
                    />
                  </div>

                  <div className={cn("space-y-1.5", isRtl ? "text-right" : "text-left")}>
                    <label className="text-xs font-semibold text-white/70 block">
                      {isRtl ? "نوع النشاط التجاري" : "Business Type"}
                    </label>
                    <div className="relative">
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className={cn(
                          "h-11 w-full rounded-2xl border border-white/10 bg-[#16161a] px-4 text-sm text-white outline-none transition focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/15 cursor-pointer appearance-none",
                          isRtl ? "pr-10 pl-4 text-right" : "pl-10 pr-4 text-left"
                        )}
                      >
                        <option value="retail">{isRtl ? "🛍️ متجر تجزئة / تجارة إلكترونية" : "🛍️ Retail / E-commerce"}</option>
                        <option value="restaurant">{isRtl ? "🍽️ مطعم / كافيه" : "🍽️ Restaurant / Cafe"}</option>
                        <option value="courses">{isRtl ? "📚 أكاديمية دورات تدريبية" : "📚 Training Academy"}</option>
                        <option value="clinic">{isRtl ? "🏥 عيادة / مركز طبي" : "🏥 Clinic / Medical Center"}</option>
                        <option value="salon">{isRtl ? "💇 صالون تجميل / سبا" : "💇 Beauty Salon / Spa"}</option>
                        <option value="services">{isRtl ? "🔧 خدمات عامة وصيانة" : "🔧 Maintenance & Services"}</option>
                        <option value="real_estate">{isRtl ? "🏠 مكتب عقارات" : "🏠 Real Estate"}</option>
                        <option value="cars">{isRtl ? "🚗 معرض سيارات" : "🚗 Car Showroom"}</option>
                        <option value="electronics">{isRtl ? "📱 متجر إلكترونيات" : "📱 Electronics Store"}</option>
                        <option value="digital">{isRtl ? "💻 منتجات رقمية واشتراكات" : "💻 Digital Products"}</option>
                        <option value="consulting">{isRtl ? "💼 مكتب استشارات وأعمال" : "💼 Consulting & Business"}</option>
                      </select>
                      <div className={cn("absolute inset-y-0 flex items-center pointer-events-none text-white/40", isRtl ? "right-3" : "left-3")}>
                        <ChevronLeft className="h-4 w-4 transform -rotate-90" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cn("pt-2 flex", isRtl ? "justify-end" : "justify-start")}>
                  <Button type="submit" disabled={savingProfile} className="min-w-[140px]">
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{isRtl ? "جاري الحفظ..." : "Saving..."}</span>
                      </>
                    ) : (
                      <span>{isRtl ? "حفظ التعديلات" : "Save Changes"}</span>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password Section */}
          <Card>
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2", isRtl ? "justify-end text-right" : "justify-start text-left")}>
                {isRtl ? (
                  <>
                    <span className="text-white">أمان الحساب وكلمة المرور</span>
                    <Key className="h-5 w-5 text-amber-400" />
                  </>
                ) : (
                  <>
                    <Key className="h-5 w-5 text-amber-400" />
                    <span className="text-white">Security & Password</span>
                  </>
                )}
              </CardTitle>
              <CardDescription className={isRtl ? "text-right" : "text-left"}>
                {isRtl 
                  ? "يمكنك إعادة تعيين كلمة المرور الخاصة بك بشكل آمن وسريع عبر البريد الإلكتروني." 
                  : "You can securely and quickly reset your password via email."}
              </CardDescription>
            </CardHeader>
            <CardContent className={cn("flex items-center justify-between gap-4 bg-white/[0.02] border border-white/5 rounded-3xl p-5 flex-col md:flex-row", isRtl ? "md:flex-row-reverse" : "md:flex-row")}>
              <div className={cn("text-right md:max-w-[70%]", isRtl ? "text-right" : "text-left")}>
                <h4 className="text-sm font-semibold text-white mb-1">
                  {isRtl ? "هل ترغب في تغيير كلمة المرور؟" : "Do you want to change your password?"}
                </h4>
                <p className="text-xs text-white/48 leading-6">
                  {isRtl 
                    ? `سنرسل لك رابطاً مشفراً لتعيين كلمة مرور جديدة على بريدك المسجل (${user?.email}) للحفاظ على سلامة حسابك.` 
                    : `We will send a secure link to reset your password to your registered email (${user?.email}) to keep your account safe.`}
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
                    <span>{isRtl ? "جاري الإرسال..." : "Sending..."}</span>
                  </>
                ) : (
                  <span>{isRtl ? "إرسال رابط التعيين" : "Send Reset Link"}</span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Alerts & Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className={cn("flex items-center gap-2", isRtl ? "justify-end text-right" : "justify-start text-left")}>
                {isRtl ? (
                  <>
                    <span className="text-white">إعدادات الإشعارات والتنبيهات</span>
                    <Bell className="h-5 w-5 text-cyan-400" />
                  </>
                ) : (
                  <>
                    <Bell className="h-5 w-5 text-cyan-400" />
                    <span className="text-white">Notification Settings</span>
                  </>
                )}
              </CardTitle>
              <CardDescription className={isRtl ? "text-right" : "text-left"}>
                {isRtl 
                  ? "حدد متى ترغب في تلقي إشعارات عاجلة لفريق الدعم الخاص بك." 
                  : "Choose when you want to receive urgent notifications for your support team."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleSetting 
                title={isRtl ? "التحويل للموظف البشري" : "Human Handoff Alert"} 
                description={isRtl ? "تلقي إشعار عاجل بمجرد أن يطلب العميل التدخل البشري من الذكاء الاصطناعي." : "Receive an urgent notification as soon as a customer requests human support."}
                checked={notifyHumanHandoff}
                onChange={(val) => handleToggleChange("settings_notify_handoff", val, setNotifyHumanHandoff, isRtl ? "إشعار التحويل البشري" : "Human Handoff Notification")}
              />
              <ToggleSetting 
                title={isRtl ? "تنبيه انخفاض الرصيد" : "Low Balance Alert"} 
                description={isRtl ? "تلقي رسالة تحذيرية عندما يصل رصيد ردود الذكاء الاصطناعي المتبقي إلى أقل من 10%." : "Receive a warning message when your remaining AI replies balance is below 10%."}
                checked={notifyLowBalance}
                onChange={(val) => handleToggleChange("settings_notify_low_balance", val, setNotifyLowBalance, isRtl ? "تنبيه الرصيد" : "Balance Alert")}
              />
              <ToggleSetting 
                title={isRtl ? "أخطاء الربط والقنوات" : "Connection & Channel Errors"} 
                description={isRtl ? "تلقي تنبيه فوري عند حدوث مشكلة تقنية أو انقطاع الربط مع واتساب أو فيسبوك." : "Receive an immediate alert if a technical issue or connection drop occurs with WhatsApp or Facebook."}
                checked={notifyErrorAlerts}
                onChange={(val) => handleToggleChange("settings_notify_error_alerts", val, setNotifyErrorAlerts, isRtl ? "إشعارات الأخطاء" : "Error Alerts")}
              />
              <ToggleSetting 
                title={isRtl ? "ملخص البريد اليومي" : "Daily Email Summary"} 
                description={isRtl ? "استقبال تقرير بريد إلكتروني يومي يحتوي على ملخص تفصيلي لأداء المحادثات ومعدلات رضا العملاء." : "Receive a daily email report containing a detailed summary of conversations performance and CSAT."}
                checked={notifyDailyReport}
                onChange={(val) => handleToggleChange("settings_notify_daily_report", val, setNotifyDailyReport, isRtl ? "تقرير البريد اليومي" : "Daily Report")}
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
                <Loader2 className="h-6 w-6 animate-spin text-primary-400 mx-auto mb-2" />
                <span className="text-xs text-white/50">
                  {isRtl ? "جاري تحميل بيانات الاشتراك..." : "Loading subscription details..."}
                </span>
              </div>
            </Card>
          ) : (
            <GradientCard className={cn(isRtl ? "text-right" : "text-left")}>
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
                <span className="rounded-full bg-primary-500/10 border border-primary-500/20 px-2.5 py-0.5 text-[10px] font-bold text-primary-400 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  {activeSub ? (isRtl ? "نشط" : "Active") : (isRtl ? "غير مفعل" : "Inactive")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{isRtl ? "الاشتراك الحالي" : "Current Subscription"}</span>
                  <CreditCard className="h-4 w-4 text-primary-400" />
                </div>
              </div>

              {activeSub ? (
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] text-white/40 block mb-0.5">{isRtl ? "الباقة الحالية" : "Current Plan"}</span>
                    <span className="text-xl font-extrabold text-white">
                      {isRtl ? `باقة ${activeSub.tier?.name}` : `${activeSub.tier?.name} Plan`}
                    </span>
                  </div>

                  <p className="text-xs text-white/60 leading-5">
                    {activeSub.tier?.description}
                  </p>

                  <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-3 text-right">
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <span className="text-[9px] text-white/40 block">{isRtl ? "سعر التجديد" : "Renewal Price"}</span>
                      <span className="text-sm font-bold text-white">
                        {isRtl ? `${activeSub.tier?.price_monthly}$ / شهرياً` : `$${activeSub.tier?.price_monthly} / month`}
                      </span>
                    </div>
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <span className="text-[9px] text-white/40 block">{isRtl ? "تاريخ البدء" : "Start Date"}</span>
                      <span className="text-xs font-semibold text-white/80">
                        {new Date(activeSub.start_date).toLocaleDateString(isRtl ? "ar-EG" : "en-US")}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link href="/billing" passHref>
                      <Button variant="secondary" className="w-full flex items-center justify-center gap-2 group text-xs py-2.5 h-auto">
                        {isRtl ? (
                          <>
                            <ChevronLeft className="h-3.5 w-3.5 transition group-hover:-translate-x-1" />
                            <span>ترقية أو تغيير الباقة</span>
                          </>
                        ) : (
                          <>
                            <span>Upgrade or Change Plan</span>
                            <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                          </>
                        )}
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-amber-500/5 border border-dashed border-amber-500/20 p-4 text-center">
                    <Sparkles className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                    <h5 className="text-xs font-bold text-amber-400 mb-1">{isRtl ? "لا يوجد اشتراك نشط" : "No active subscription"}</h5>
                    <p className="text-[10px] text-white/48 leading-5">
                      {isRtl 
                        ? "قم بترقية حسابك لتفعيل ردود الوكيل الذكي على قنواتك." 
                        : "Upgrade your account to enable the AI agent replies on your channels."}
                    </p>
                  </div>
                  <Link href="/billing" passHref>
                    <Button className="w-full flex items-center justify-center gap-2 text-xs py-2.5 h-auto">
                      {isRtl ? (
                        <>
                          <ChevronLeft className="h-3.5 w-3.5" />
                          <span>استعراض الباقات المتاحة</span>
                        </>
                      ) : (
                        <>
                          <span>Browse Available Plans</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </Link>
                </div>
              )}
            </GradientCard>
          )}

          {/* Danger Zone Controls */}
          <Card className="border-red-400/20 overflow-hidden">
            <CardHeader className="bg-red-500/[0.02] border-b border-white/5">
              <CardTitle className={cn("flex items-center gap-2 text-red-200", isRtl ? "justify-end text-right" : "justify-start text-left")}>
                {isRtl ? (
                  <>
                    <span>منطقة الخطر والتحكم</span>
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <span>Danger Zone & Controls</span>
                  </>
                )}
              </CardTitle>
              <CardDescription className={isRtl ? "text-right" : "text-left"}>
                {isRtl 
                  ? "إجراءات أمنية حساسة تؤثر على عمل حسابك وقنواتك بشكل مباشر." 
                  : "Sensitive security actions affecting your account and channels operation directly."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-5">
              {confirmAction ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-right space-y-4 animate-in fade-in slide-in-from-top-2 duration-250">
                  <div className={isRtl ? "text-right" : "text-left"}>
                    <h5 className={cn("text-xs font-bold text-red-400 flex items-center gap-1.5", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
                      <span>{isRtl ? "تأكيد الإجراء الحساس" : "Confirm Sensitive Action"}</span>
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </h5>
                    <p className="text-[11px] text-white/60 mt-1.5 leading-5">
                      {confirmAction === "logout" && (isRtl ? "هل أنت متأكد من تسجيل خروجك من حساب chatter؟" : "Are you sure you want to log out of chatter?")}
                      {confirmAction === "disconnect" && (isRtl ? "هل تريد حقاً فصل كافة قنوات التواصل والواتساب؟ سيتوقف الرد الذكي فوراً." : "Are you sure you want to disconnect all communication channels and WhatsApp? Smart replies will stop immediately.")}
                      {confirmAction === "delete_chats" && (isRtl ? "هل أنت متأكد من مسح كافة سجلات المحادثات والرسائل نهائياً؟ هذا الإجراء لا يمكن التراجع عنه." : "Are you sure you want to delete all message history permanently? This action is irreversible.")}
                    </p>
                  </div>
                  <div className={cn("flex gap-2", isRtl ? "justify-end" : "justify-start")}>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setConfirmAction(null)}
                      disabled={actionLoading}
                    >
                      {isRtl ? "إلغاء" : "Cancel"}
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
                          <span>{isRtl ? "جاري التنفيذ..." : "Executing..."}</span>
                        </>
                      ) : (
                        <span>{isRtl ? "تأكيد التنفيذ" : "Confirm"}</span>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <Button 
                    variant="danger" 
                    className={cn("w-full justify-between", isRtl ? "flex-row-reverse" : "flex-row")} 
                    onClick={() => setConfirmAction("disconnect")}
                  >
                    <span>{isRtl ? "فصل جميع قنوات التواصل" : "Disconnect All Channels"}</span>
                    <RefreshCw className="h-4 w-4 shrink-0" />
                  </Button>
                  <Button 
                    variant="danger" 
                    className={cn("w-full justify-between", isRtl ? "flex-row-reverse" : "flex-row")} 
                    onClick={() => setConfirmAction("delete_chats")}
                  >
                    <span>{isRtl ? "حذف جميع محادثات الديمو" : "Delete All Demo Chats"}</span>
                    <Trash2 className="h-4 w-4 shrink-0" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    className={cn("w-full justify-between border-red-400/20 hover:bg-red-500/5", isRtl ? "flex-row-reverse" : "flex-row")} 
                    onClick={() => setConfirmAction("logout")}
                  >
                    <span className="text-red-200">{isRtl ? "تسجيل الخروج من الحساب" : "Log Out of Account"}</span>
                    <LogOut className="h-4 w-4 shrink-0 text-red-400" />
                  </Button>
                </>
              )}

              <div className={cn("rounded-3xl border border-white/5 bg-white/[0.015] p-4", isRtl ? "text-right" : "text-left")}>
                <div className={cn("mb-2 flex items-center gap-2 text-xs font-semibold text-white/80", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
                  <span>{isRtl ? "ملاحظة أمان وسلامة البيانات" : "Security & Privacy Note"}</span>
                  <ShieldCheck className="h-4 w-4 text-primary-400" />
                </div>
                <p className="text-[11px] leading-5 text-white/40">
                  {isRtl 
                    ? "منصة chatter مصممة لمساعدة العملاء والاستجابة الفورية لاستفساراتهم الواردة. نلتزم بحماية الخصوصية المطلقة للبيانات والمعلومات المشترقة عبر القنوات." 
                    : "chatter is built to support customers and reply instantly to their queries. We are committed to absolute data privacy and security for all connected channels."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
