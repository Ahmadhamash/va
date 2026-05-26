"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  MessageSquare, 
  Settings, 
  ShieldCheck, 
  Loader2, 
  Plus, 
  Lock, 
  Unlock, 
  Key, 
  Globe, 
  Database,
  UserCheck,
  Smartphone,
  BookOpen,
  Eye,
  EyeOff,
  Building2,
  RefreshCw
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/use-auth-store";
import { GradientCard } from "@/components/gradient-card";

interface ClientData {
  id: string;
  username: string;
  email: string;
  business_name: string | null;
  business_type: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  item_count: number;
  session_count: number;
  style_sample_count: number;
}

interface PlatformStats {
  clients: number;
  active_clients: number;
  items: number;
  sessions: number;
  messages: number;
  style_samples: number;
  channels: number;
  sessions_by_channel: Record<string, number>;
}

interface PlatformSettings {
  openai_api_key_masked: string;
  key_source: string;
  ai_model: string;
  debounce_seconds: number;
}

export default function AdminDashboardPage() {
  const { token, user } = useAuthStore();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [systemSettings, setSystemSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Creation States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClientUsername, setNewClientUsername] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPassword, setNewClientPassword] = useState("");
  const [newClientBusinessName, setNewClientBusinessName] = useState("");
  const [newClientBusinessType, setNewClientBusinessType] = useState("retail");
  const [creatingClient, setCreatingClient] = useState(false);

  // Password reset States
  const [resettingClientId, setResettingClientId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [processingPasswordReset, setProcessingPasswordReset] = useState(false);

  // Settings updating states
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [aiModelInput, setAiModelInput] = useState("gpt-4o");
  const [debounceSecondsInput, setDebounceSecondsInput] = useState(2);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Notification notices
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotice = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 5000);
  };

  // Guard routing
  useEffect(() => {
    if (user && user.role !== "admin") {
      window.location.href = "/dashboard";
    }
  }, [user]);

  // Load everything
  const loadAdminData = async () => {
    if (!token) return;
    try {
      const [statsRes, clientsRes, settingsRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: { Authorization: "Bearer " + token } }),
        fetch("/api/admin/clients", { headers: { Authorization: "Bearer " + token } }),
        fetch("/api/admin/settings", { headers: { Authorization: "Bearer " + token } })
      ]);

      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (clientsRes.ok) {
        setClients(await clientsRes.json());
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSystemSettings(settingsData);
        setAiModelInput(settingsData.ai_model || "gpt-4o");
        setDebounceSecondsInput(settingsData.debounce_seconds ?? 2);
      }
    } catch (err) {
      console.error("Failed to load admin dashboard data", err);
      showNotice("❌ حدث خطأ أثناء الاتصال بالخادم لجلب البيانات.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  // Handle Client Search
  useEffect(() => {
    if (!token) return;
    const fetchFilteredClients = async () => {
      try {
        const path = searchQuery ? `/api/admin/clients?q=${encodeURIComponent(searchQuery)}` : "/api/admin/clients";
        const res = await fetch(path, { headers: { Authorization: "Bearer " + token } });
        if (res.ok) {
          setClients(await res.json());
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    };

    const delayDebounce = setTimeout(() => {
      fetchFilteredClients();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, token]);

  // Toggle client active status
  const handleToggleClientActive = async (client: ClientData) => {
    if (!token) return;
    const nextActiveState = !client.is_active;
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/active`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: nextActiveState })
      });

      if (res.ok) {
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, is_active: nextActiveState } : c));
        showNotice(nextActiveState ? `🔓 تم تنشيط حساب العميل ${client.username} بنجاح.` : `🔒 تم تعطيل حساب العميل ${client.username} بنجاح.`);
        
        // Reload stats to reflect active client counts
        const statsRes = await fetch("/api/admin/stats", { headers: { Authorization: "Bearer " + token } });
        if (statsRes.ok) setStats(await statsRes.json());
      } else {
        showNotice("❌ فشل تعديل حالة نشاط الحساب.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء الاتصال بالخادم.", "error");
    }
  };

  // Provision new client account
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCreatingClient(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newClientUsername,
          email: newClientEmail,
          password: newClientPassword,
          business_name: newClientBusinessName || null,
          business_type: newClientBusinessType || "retail"
        })
      });

      const data = await res.json();
      if (res.ok) {
        showNotice(`✨ تم إنشاء حساب العميل ${newClientUsername} بنجاح!`);
        setShowCreateModal(false);
        // Clear inputs
        setNewClientUsername("");
        setNewClientEmail("");
        setNewClientPassword("");
        setNewClientBusinessName("");
        
        // Refresh stats & client list
        loadAdminData();
      } else {
        showNotice(`❌ فشل إنشاء العميل: ${data.detail || "خطأ غير معروف"}`, "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء محاولة إرسال البيانات.", "error");
    } finally {
      setCreatingClient(false);
    }
  };

  // Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !resettingClientId) return;
    setProcessingPasswordReset(true);
    try {
      const res = await fetch(`/api/admin/clients/${resettingClientId}/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ new_password: newPassword })
      });

      if (res.ok) {
        showNotice("🔑 تم تغيير كلمة مرور الحساب بنجاح.");
        setResettingClientId(null);
        setNewPassword("");
      } else {
        showNotice("❌ فشل تحديث كلمة المرور.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء معالجة الطلب.", "error");
    } finally {
      setProcessingPasswordReset(false);
    }
  };

  // Save Platform Config Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setUpdatingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          openai_api_key: apiKeyInput || null,
          ai_model: aiModelInput,
          debounce_seconds: debounceSecondsInput
        })
      });

      if (res.ok) {
        const updatedSettings = await res.json();
        setSystemSettings(updatedSettings);
        setApiKeyInput(""); // Clear the input sensitive string
        showNotice("⚙️ تم تحديث وحفظ إعدادات المنصة والذكاء الاصطناعي بنجاح.");
      } else {
        showNotice("❌ فشل حفظ الإعدادات.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء محاولة حفظ التكوينات الجديدة.", "error");
    } finally {
      setUpdatingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyanx-400 mx-auto mb-3" />
          <span className="text-sm text-white/50">جاري تحميل لوحة تحكم مدير المنصة...</span>
        </div>
      </div>
    );
  }

  return (
    <AppShell title="لوحة الإشراف العام" subtitle="إدارة العملاء، إحصائيات النظام، وإعدادات الذكاء الاصطناعي للمنصة.">
      <div className="space-y-6">
        {notice && (
          <div className={`rounded-3xl border px-5 py-4 text-sm font-semibold text-right animate-pulse ${
            notice.type === "success" ? "border-emeraldx-400/20 bg-emeraldx-500/10 text-emeraldx-400" : "border-red-400/20 bg-red-500/10 text-red-400"
          }`}>
            {notice.message}
          </div>
        )}

        {/* 1. Statistics Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyanx-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/40">إجمالي الشركات المسجلة</span>
                <Users className="h-5 w-5 text-cyanx-400" />
              </div>
              <div className="mt-4 text-3xl font-extrabold text-white">{stats.clients}</div>
              <div className="mt-1 text-[10px] text-cyanx-400 font-semibold">{stats.active_clients} شركة نشطة حالياً</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emeraldx-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/40">المحادثات في المنصة</span>
                <MessageSquare className="h-5 w-5 text-emeraldx-400" />
              </div>
              <div className="mt-4 text-3xl font-extrabold text-white">{stats.sessions}</div>
              <div className="mt-1 text-[10px] text-emeraldx-400 font-semibold">{stats.messages} رسالة متبادلة</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/40">القنوات المتصلة</span>
                <Smartphone className="h-5 w-5 text-violet-400" />
              </div>
              <div className="mt-4 text-3xl font-extrabold text-white">{stats.channels}</div>
              <div className="mt-1 text-[10px] text-violet-400 font-semibold">موزعة على واتساب وماسنجر وإنستغرام</div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white/40">المعرفة والمنتجات</span>
                <BookOpen className="h-5 w-5 text-amber-400" />
              </div>
              <div className="mt-4 text-3xl font-extrabold text-white">{stats.items}</div>
              <div className="mt-1 text-[10px] text-amber-400 font-semibold">{stats.style_samples} نموذج أسلوب مسجل</div>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
          {/* Left / Main Panel: Client List & Management */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-col md:flex-row-reverse md:items-center md:justify-between gap-4">
                <div className="text-right">
                  <CardTitle className="flex items-center justify-end gap-2 text-right">
                    <span>إدارة المشتركين والشركات</span>
                    <UserCheck className="h-5 w-5 text-cyanx-400" />
                  </CardTitle>
                  <CardDescription className="text-right">إجمالي الشركات المسجلة بالخدمة، يمكنك تعطيل/تنشيط الحسابات أو تغيير كلمة المرور.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 text-xs py-2.5 h-auto">
                    <Plus className="h-4 w-4" />
                    <span>إنشاء حساب مشترك</span>
                  </Button>
                  <Button variant="secondary" onClick={loadAdminData} className="p-2 h-10 w-10 shrink-0">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search Bar */}
                <div className="text-right">
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 ابحث عن عميل بالاسم، اسم المستخدم، أو البريد الإلكتروني..." 
                    className="max-w-md ml-auto"
                  />
                </div>

                {/* Clients Table */}
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.015] scrollbar-thin">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold text-white/50">
                        <th className="p-4">العميل / النشاط التجاري</th>
                        <th className="p-4">البريد الإلكتروني</th>
                        <th className="p-4 text-center">المنتجات</th>
                        <th className="p-4 text-center">المحادثات</th>
                        <th className="p-4 text-center">الحالة</th>
                        <th className="p-4 text-left">التحكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm text-white/80">
                      {clients.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-white/40">لا يوجد عملاء مطابقين للبحث.</td>
                        </tr>
                      ) : (
                        clients.map((client) => (
                          <tr key={client.id} className="hover:bg-white/[0.01]">
                            <td className="p-4 font-semibold text-white">
                              <div>{client.business_name || "بدون اسم نشاط"}</div>
                              <div className="text-xs text-white/40 mt-0.5">@{client.username}</div>
                            </td>
                            <td className="p-4 font-mono text-xs text-white/60">{client.email}</td>
                            <td className="p-4 text-center">{client.item_count}</td>
                            <td className="p-4 text-center">{client.session_count}</td>
                            <td className="p-4 text-center">
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                client.is_active ? "bg-emeraldx-500/10 border border-emeraldx-500/20 text-emeraldx-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
                              }`}>
                                {client.is_active ? "نشط" : "معطل"}
                              </span>
                            </td>
                            <td className="p-4 text-left flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="text-amber-400 hover:bg-amber-400/10 py-1.5 h-auto text-xs"
                                onClick={() => setResettingClientId(client.id)}
                              >
                                <Key className="h-3.5 w-3.5" />
                                <span>كلمة المرور</span>
                              </Button>
                              <Button 
                                size="sm" 
                                variant={client.is_active ? "danger" : "secondary"}
                                className="py-1.5 h-auto text-xs"
                                onClick={() => handleToggleClientActive(client)}
                              >
                                {client.is_active ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                                <span>{client.is_active ? "تعطيل" : "تنشيط"}</span>
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel: Platform Global Settings */}
          <div className="space-y-6">
            <GradientCard className="text-right">
              <div className="flex items-center justify-end gap-2 border-b border-white/10 pb-4 mb-4">
                <span className="font-bold text-white text-base">إعدادات المنصة والـ AI</span>
                <Settings className="h-5 w-5 text-cyanx-400" />
              </div>

              {systemSettings && (
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/50 block">مفتاح OpenAI API Key</label>
                    <div className="relative">
                      <Input 
                        type={showApiKey ? "text" : "password"} 
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder={systemSettings.openai_api_key_masked || "لم يتم إدخال مفتاح API"}
                        className="font-mono text-left pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute inset-y-0 left-3 flex items-center text-white/40 hover:text-white"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <span className="text-[10px] text-white/30 block mt-1 leading-5">
                      المصدر الحالي للمفتاح: <span className="font-bold text-cyanx-400">{systemSettings.key_source === "env" ? "ملف البيئة (.env)" : systemSettings.key_source === "database" ? "قاعدة البيانات" : "لا يوجد"}</span>
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/50 block">نموذج الذكاء الاصطناعي الافتراضي</label>
                    <select
                      value={aiModelInput}
                      onChange={(e) => setAiModelInput(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-white/10 bg-[#16161a] px-4 text-right text-sm text-white outline-none cursor-pointer appearance-none"
                    >
                      <option value="gpt-4o">gpt-4o (الافتراضي - فائق الدقة)</option>
                      <option value="gpt-4o-mini">gpt-4o-mini (سريع واقتصادي)</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/50 block">ثواني التأخير للرد الآلي (Debounce)</label>
                    <Input 
                      type="number" 
                      min="1" 
                      max="15" 
                      value={debounceSecondsInput}
                      onChange={(e) => setDebounceSecondsInput(parseInt(e.target.value) || 2)}
                      className="font-mono text-left"
                    />
                    <span className="text-[10px] text-white/30 block mt-1">حجم النافذة الزمنية لتجميع رسائل العميل المتتالية قبل الرد.</span>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" disabled={updatingSettings} className="w-full justify-center">
                      {updatingSettings ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <span>حفظ التكوينات</span>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </GradientCard>

            <Card className="border-cyanx-400/20">
              <CardHeader>
                <CardTitle className="flex items-center justify-end gap-2 text-right">
                  <span>أمان وموثوقية المنصة</span>
                  <ShieldCheck className="h-5 w-5 text-cyanx-400" />
                </CardTitle>
              </CardHeader>
              <CardContent className="text-right text-xs text-white/40 leading-6 space-y-2">
                <p>
                  كمشرف عام، يرجى الحفاظ على سرية مفاتيح API المضافة. تؤثر التعديلات هنا بشكل فوري على جميع عمليات الرد والـ Webhooks النشطة عبر النظام لكافة حسابات العملاء.
                </p>
                <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 flex items-center justify-between">
                  <span className="font-bold text-white font-mono">{user?.username}</span>
                  <span className="text-cyanx-400">حساب الإشراف النشط</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* MODAL 1: Create Client Account */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-950 p-6 text-right space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center justify-end gap-2">
              <span>إنشاء حساب مشترك جديد</span>
              <Plus className="h-5 w-5 text-cyanx-400" />
            </h4>
            <p className="text-xs text-white/50">قم بتعبئة بيانات المشترك وسيتم تنشيط حسابه وصناعة قالب البيانات الخاص به تلقائياً.</p>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">اسم المستخدم (Username)</label>
                <Input 
                  value={newClientUsername} 
                  onChange={(e) => setNewClientUsername(e.target.value)}
                  placeholder="مثال: custom_shop" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">البريد الإلكتروني</label>
                <Input 
                  type="email" 
                  value={newClientEmail} 
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  placeholder="name@example.com" 
                  required 
                  className="text-left font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">كلمة المرور البدئية</label>
                <Input 
                  type="password" 
                  value={newClientPassword} 
                  onChange={(e) => setNewClientPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">اسم النشاط التجاري (Business Name)</label>
                <Input 
                  value={newClientBusinessName} 
                  onChange={(e) => setNewClientBusinessName(e.target.value)}
                  placeholder="مثال: معرض الهدى للسيارات" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">نوع النشاط (Template)</label>
                <select
                  value={newClientBusinessType}
                  onChange={(e) => setNewClientBusinessType(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-[#16161a] px-4 text-right text-sm text-white outline-none cursor-pointer appearance-none"
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
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={creatingClient}>
                  {creatingClient ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جاري الإنشاء...</span>
                    </>
                  ) : (
                    <span>تأكيد وإنشاء الحساب</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Reset Client Password */}
      {resettingClientId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-950 p-6 text-right space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center justify-end gap-2">
              <span>تغيير كلمة مرور المشترك</span>
              <Key className="h-5 w-5 text-amber-400" />
            </h4>
            <p className="text-xs text-white/50">أدخل كلمة المرور الجديدة للحساب. ننصح باختيار كلمة مرور قوية.</p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">كلمة المرور الجديدة</label>
                <Input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" type="button" onClick={() => setResettingClientId(null)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={processingPasswordReset}>
                  {processingPasswordReset ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>جاري التحديث...</span>
                    </>
                  ) : (
                    <span>حفظ التعديل</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
