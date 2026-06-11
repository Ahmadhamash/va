"use client";

import { useState, useEffect } from "react";
import { 
  Users, 
  Bot,
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
  RefreshCw,
  CheckCircle2,
  Clock3,
  Coins,
  TrendingUp,
  Calculator,
  Sliders
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/use-auth-store";
import { GradientCard } from "@/components/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ManyChatSetupStatus = "not_started" | "pending_setup" | "completed";

interface ClientData {
  id: string;
  username: string;
  email: string;
  business_name: string | null;
  business_type: string | null;
  role: string;
  is_active: boolean;
  ai_auto_reply_enabled: boolean;
  created_at: string;
  item_count: number;
  session_count: number;
  style_sample_count: number;
  manychat_setup_status: ManyChatSetupStatus;
  fb_page_link: string | null;
  ig_username: string | null;
  wa_number: string | null;
  manychat_admin_confirmed: boolean;
  manychat_setup_submitted_at: string | null;
  manychat_setup_completed_at: string | null;
  ai_persona: string | null;
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
  master_system_prompt: string;
}

interface BusinessTypeOption {
  key: string;
  label: string;
  icon?: string;
  group?: string;
}

const fallbackBusinessTypes: BusinessTypeOption[] = [
  { key: "retail", label: "Retail / Ecommerce", group: "Commerce" },
  { key: "restaurant", label: "Restaurant / Cafe", group: "Food" },
  { key: "services", label: "Professional Services", group: "Services" },
];

function manyChatStatusLabel(status: ManyChatSetupStatus) {
  if (status === "completed") return "مكتمل";
  if (status === "pending_setup") return "قيد الإعداد";
  return "لم يبدأ";
}

function manyChatStatusClass(status: ManyChatSetupStatus) {
  if (status === "completed") {
    return "bg-primary-500/10 border border-primary-500/20 text-primary-400";
  }
  if (status === "pending_setup") {
    return "bg-amber-500/10 border border-amber-500/20 text-amber-300";
  }
  return "bg-white/5 border border-white/10 text-white/35";
}

export default function AdminDashboardPage() {
  const { token, user } = useAuthStore();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [systemSettings, setSystemSettings] = useState<PlatformSettings | null>(null);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeOption[]>(fallbackBusinessTypes);
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
  const [masterSystemPromptInput, setMasterSystemPromptInput] = useState("");
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Notification notices
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Edit Client Prompt States
  const [editingClientPrompt, setEditingClientPrompt] = useState<ClientData | null>(null);
  const [clientPromptText, setClientPromptText] = useState("");
  const [savingClientPrompt, setSavingClientPrompt] = useState(false);

  // AI Testing Store States
  const [resettingTesting, setResettingTesting] = useState(false);

  // Pricing Simulator States
  const [pricingModel, setPricingModel] = useState("gpt-4o-mini");
  const [avgInputTokens, setAvgInputTokens] = useState(450);
  const [avgOutputTokens, setAvgOutputTokens] = useState(80);

  const showNotice = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 5000);
  };

  const handleSaveClientPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingClientPrompt) return;
    setSavingClientPrompt(true);
    try {
      const res = await fetch(`/api/admin/clients/${editingClientPrompt.id}/persona`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ai_persona: clientPromptText,
          business_name: editingClientPrompt.business_name
        })
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setClients(prev => prev.map(c => c.id === editingClientPrompt.id ? { ...c, ai_persona: updatedUser.ai_persona } : c));
        showNotice(`✨ تم تحديث البرومبت الشخصي للعميل ${editingClientPrompt.username} بنجاح.`);
        setEditingClientPrompt(null);
      } else {
        showNotice("❌ فشل تحديث البرومبت الشخصي.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء الاتصال بالخادم.", "error");
    } finally {
      setSavingClientPrompt(false);
    }
  };

  const handleResetTestingStore = async () => {
    if (!token) return;
    if (!confirm("هل أنت متأكد من رغبتك في إعادة تهيئة بيئة الاختبار؟ سيتم مسح الجلسات وسجلات المحاكاة الاختبارية.")) return;
    setResettingTesting(true);
    try {
      const res = await fetch("/api/admin/reset-testing", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showNotice(`✅ ${data.message}`);
      } else {
        showNotice("❌ فشل إعادة تهيئة بيئة الاختبار.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء محاولة الاتصال بالخادم.", "error");
    } finally {
      setResettingTesting(false);
    }
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
      const [statsRes, clientsRes, settingsRes, businessTypesRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: { Authorization: "Bearer " + token } }),
        fetch("/api/admin/clients", { headers: { Authorization: "Bearer " + token } }),
        fetch("/api/admin/settings", { headers: { Authorization: "Bearer " + token } }),
        fetch("/api/business-types", { cache: "no-store" })
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
        setMasterSystemPromptInput(settingsData.master_system_prompt || "");
      }
      if (businessTypesRes.ok) {
        const typesData = await businessTypesRes.json().catch(() => []);
        if (Array.isArray(typesData) && typesData.length) {
          setBusinessTypes(typesData);
        }
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

  const pendingManychatClients = clients.filter(
    (client) => client.manychat_setup_status === "pending_setup"
  );

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

  const handleToggleClientAI = async (client: ClientData) => {
    if (!token) return;
    const nextEnabledState = !client.ai_auto_reply_enabled;
    try {
      const res = await fetch(`/api/admin/clients/${client.id}/ai-auto-reply`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: nextEnabledState })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setClients(prev => prev.map(c => c.id === client.id ? { ...c, ...data, ai_auto_reply_enabled: nextEnabledState } : c));
        showNotice(nextEnabledState ? "AI auto-replies enabled for this company." : "AI auto-replies disabled for this company.");
      } else {
        showNotice(data.detail || "Failed to update AI auto-reply status.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("Failed to update AI auto-reply status.", "error");
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

  // Generate Manychat Webhook URL
  const handleGenerateManychatWebhook = async (clientId: string) => {
    if (!token) return;
    
    showNotice(`⏳ جاري توليد رابط Webhook لمنصة Manychat...`);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/manychat-webhook`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.webhook_url) {
        navigator.clipboard.writeText(data.webhook_url);
        showNotice("✅ تم إنشاء الرابط ونسخه إلى الحافظة بنجاح!");
      } else {
        showNotice(`❌ فشل توليد الرابط: ${data.detail || "خطأ غير معروف"}`, "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ حدث خطأ أثناء الاتصال بالخادم.", "error");
    }
  };

  const handleUpdateManychatStatus = async (clientId: string, status: ManyChatSetupStatus) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/manychat-status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ manychat_setup_status: status })
      });
      const data = await res.json();
      if (res.ok) {
        setClients(prev => prev.map(client => client.id === clientId ? { ...client, ...data } : client));
        showNotice(status === "completed" ? "تم تعليم طلب ManyChat كمكتمل." : "تم تحديث حالة طلب ManyChat.");
      } else {
        showNotice(`فشل تحديث حالة ManyChat: ${data.detail || "خطأ غير معروف"}`, "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("حدث خطأ أثناء تحديث حالة ManyChat.", "error");
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
          debounce_seconds: debounceSecondsInput,
          master_system_prompt: masterSystemPromptInput
        })
      });

      if (res.ok) {
        const updatedSettings = await res.json();
        setSystemSettings(updatedSettings);
        setMasterSystemPromptInput(updatedSettings.master_system_prompt || "");
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
      <div className="space-y-6" dir="rtl">
        {notice && (
          <div className={`rounded-3xl border px-5 py-4 text-sm font-semibold text-right animate-pulse ${
            notice.type === "success" ? "border-primary-400/20 bg-primary-500/10 text-primary-400" : "border-red-400/20 bg-red-500/10 text-red-400"
          }`}>
            {notice.message}
          </div>
        )}

        <Tabs defaultValue="management" className="w-full text-right">
          <TabsList className="grid grid-cols-3 bg-white/5 border border-white/10 p-1 rounded-2xl w-full max-w-xl mb-6">
            <TabsTrigger value="management" className="rounded-xl text-xs font-semibold py-2">
              <Settings className="h-4 w-4 ml-1.5 shrink-0" />
              إدارة المشتركين والإعدادات
            </TabsTrigger>
            <TabsTrigger value="testing" className="rounded-xl text-xs font-semibold py-2">
              <Bot className="h-4 w-4 ml-1.5 shrink-0" />
              متجر اختبار الـ AI
            </TabsTrigger>
            <TabsTrigger value="pricing" className="rounded-xl text-xs font-semibold py-2">
              <Coins className="h-4 w-4 ml-1.5 shrink-0" />
              التسعير والتكاليف
            </TabsTrigger>
          </TabsList>

          <TabsContent value="management" className="space-y-6">
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
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/40">المحادثات في المنصة</span>
                    <MessageSquare className="h-5 w-5 text-primary-400" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-white">{stats.sessions}</div>
                  <div className="mt-1 text-[10px] text-primary-400 font-semibold">{stats.messages} رسالة متبادلة</div>
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
                <Card className="border-amber-400/20">
                  <CardHeader className="flex flex-col md:flex-row-reverse md:items-center md:justify-between gap-3">
                    <div className="text-right">
                      <CardTitle className="flex items-center justify-end gap-2 text-right">
                        <span>طلبات ربط ManyChat</span>
                        <Clock3 className="h-5 w-5 text-amber-300" />
                      </CardTitle>
                      <CardDescription className="text-right">العملاء الذين أرسلوا بيانات الصفحة وينتظرون الإعداد اليدوي من حساب الوكالة.</CardDescription>
                    </div>
                    <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                      {pendingManychatClients.length} قيد الإعداد
                    </span>
                  </CardHeader>
                  <CardContent>
                    {pendingManychatClients.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
                        لا توجد طلبات ManyChat معلقة حالياً.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingManychatClients.map((client) => (
                          <div key={client.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-right">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="text-xs"
                                  onClick={() => handleGenerateManychatWebhook(client.id)}
                                >
                                  <Smartphone className="h-3.5 w-3.5 ml-1" />
                                  نسخ Webhook
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => handleUpdateManychatStatus(client.id, "completed")}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                                  تم الإعداد
                                </Button>
                              </div>
                              <div>
                                <div className="font-semibold text-white">{client.business_name || client.username}</div>
                                <div className="mt-1 text-xs text-white/40">{client.email}</div>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-white/55 md:grid-cols-3">
                              <a
                                href={client.fb_page_link || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className={`rounded-xl bg-black/15 p-3 font-mono text-cyanx-300 ${!client.fb_page_link ? "pointer-events-none text-white/30" : ""}`}
                                dir="ltr"
                              >
                                {client.fb_page_link || "no facebook link"}
                              </a>
                              <div className="rounded-xl bg-black/15 p-3 font-mono" dir="ltr">
                                {client.ig_username ? `@${client.ig_username}` : "no instagram"}
                              </div>
                              <div className="rounded-xl bg-black/15 p-3 font-mono" dir="ltr">
                                {client.wa_number || "no whatsapp"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

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
                            <th className="p-4 text-center">AI</th>
                            <th className="p-4 text-center">ManyChat</th>
                            <th className="p-4 text-center">الحالة</th>
                            <th className="p-4 text-left">التحكم</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-white/80">
                          {clients.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-white/40">لا يوجد عملاء مطابقين للبحث.</td>
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
                                    client.ai_auto_reply_enabled ? "border border-cyanx-500/20 bg-cyanx-500/10 text-cyanx-300" : "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                                  }`}>
                                    {client.ai_auto_reply_enabled ? "ON" : "OFF"}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${manyChatStatusClass(client.manychat_setup_status)}`}>
                                    {manyChatStatusLabel(client.manychat_setup_status)}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                    client.is_active ? "bg-primary-500/10 border border-primary-500/20 text-primary-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
                                  }`}>
                                    {client.is_active ? "نشط" : "معطل"}
                                  </span>
                                </td>
                                <td className="p-4 text-left flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-cyanx-400 hover:bg-cyanx-400/10 py-1.5 h-auto text-xs"
                                    onClick={() => {
                                      setEditingClientPrompt(client);
                                      setClientPromptText(client.ai_persona || "");
                                    }}
                                  >
                                    <Bot className="h-3.5 w-3.5 ml-1" />
                                    <span>تعديل البرومبت</span>
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="text-amber-400 hover:bg-amber-400/10 py-1.5 h-auto text-xs"
                                    onClick={() => setResettingClientId(client.id)}
                                  >
                                    <Key className="h-3.5 w-3.5 ml-1" />
                                    <span>كلمة المرور</span>
                                  </Button>
                                  <div className="flex bg-violet-400/5 rounded-md p-1 gap-1 items-center border border-violet-500/10">
                                    <span className="text-[9px] text-violet-300/50 px-1 font-bold">ربط:</span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-violet-400 hover:bg-violet-400/10 py-1 h-auto text-[10px] px-2 flex gap-1 items-center"
                                      title="نسخ رابط Manychat Webhook"
                                      onClick={() => handleGenerateManychatWebhook(client.id)}
                                    >
                                      <Smartphone className="h-3 w-3" />
                                      Manychat
                                    </Button>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="py-1.5 h-auto text-xs"
                                    onClick={() => handleToggleClientAI(client)}
                                  >
                                    <Bot className="h-3.5 w-3.5 ml-1" />
                                    <span>{client.ai_auto_reply_enabled ? "AI OFF" : "AI ON"}</span>
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant={client.is_active ? "danger" : "secondary"}
                                    className="py-1.5 h-auto text-xs"
                                    onClick={() => handleToggleClientActive(client)}
                                  >
                                    {client.is_active ? <Lock className="h-3.5 w-3.5 ml-1" /> : <Unlock className="h-3.5 w-3.5 ml-1" />}
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
                        <label className="text-xs font-semibold text-white/50 block">Master system prompt</label>
                        <Textarea
                          value={masterSystemPromptInput}
                          onChange={(e) => setMasterSystemPromptInput(e.target.value)}
                          placeholder="Optional platform-wide prompt applied to all companies."
                          className="min-h-36 text-left font-mono text-xs"
                          dir="ltr"
                        />
                        <span className="text-[10px] text-white/30 block mt-1 leading-5">
                          Applies below critical safety and grounding rules; company prompts can still add local tone and business behavior.
                        </span>
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
                              <Loader2 className="h-4 w-4 animate-spin ml-2" />
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
          </TabsContent>

          <TabsContent value="testing" className="space-y-6">
            <GradientCard className="text-right">
              <div className="flex items-center justify-end gap-2 border-b border-white/10 pb-4 mb-4">
                <span className="font-bold text-white text-lg">بيئة محاكاة واختبار الذكاء الاصطناعي (AI Testing Store)</span>
                <Bot className="h-6 w-6 text-cyanx-400" />
              </div>
              <p className="text-sm leading-6 text-white/70 mb-6 font-semibold">
                تتيح لك لوحة الاختبار الإشراف على كيفية تفاعل وكلاء العملاء في بيئة تجريبية معزولة قبل تطبيق التغييرات على قنوات الواتساب أو ماسنجر الرسمية.
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Reset Section */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 text-right">
                  <h3 className="font-bold text-white text-base">إعادة تهيئة بيئة الاختبار</h3>
                  <p className="text-xs text-white/50 leading-5">
                    عند إعادة التهيئة، سيتم مسح كافة سجلات المحاكاة وجلسات الدردشة الاختبارية السابقة للتأكد من أن الاختبارات الجديدة تبدأ بنظافة مطلقة ودون أي تداخل مع مدخلات قديمة.
                  </p>
                  <Button 
                    type="button" 
                    variant="danger" 
                    className="w-full justify-center h-11"
                    onClick={handleResetTestingStore}
                    disabled={resettingTesting}
                  >
                    {resettingTesting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        <span>جاري إعادة التهيئة...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 ml-2" />
                        <span>إعادة تهيئة بيئة الاختبار</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Login Instructions Section */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4 text-right">
                  <h3 className="font-bold text-white text-base">تعليمات تسجيل الدخول والمحاكاة</h3>
                  <div className="text-xs text-white/60 space-y-3 leading-5">
                    <div className="flex items-start gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyanx-500/20 text-[10px] font-bold text-cyanx-300 mt-0.5 ml-2">1</span>
                      <p>اختر العميل المستهدف للاختبار من القائمة في التبويب الرئيسي للإشراف العام.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyanx-500/20 text-[10px] font-bold text-cyanx-300 mt-0.5 ml-2">2</span>
                      <p>قم بنسخ اسم المستخدم الخاص به. إذا لم تكن تعرف كلمة المرور الخاصة به، استخدم زر <strong>"كلمة المرور"</strong> في الجدول لتعيين كلمة مرور مؤقتة للاختبار.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyanx-500/20 text-[10px] font-bold text-cyanx-300 mt-0.5 ml-2">3</span>
                      <p>افتح متصفحاً خفياً أو سجل خروجك من الحساب الحالي، ثم قم بتسجيل الدخول كعميل باستخدام تلك البيانات.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyanx-500/20 text-[10px] font-bold text-cyanx-300 mt-0.5 ml-2">4</span>
                      <p>اذهب إلى صندوق الوارد أو صفحة المنتجات والسياسات الخاصة بالعميل، واستخدم الدردشة التفاعلية لاختبار إجابات المساعد فورياً ورؤية نقاط أمان الردود.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Clients Quick Lookup */}
              <div className="mt-8 space-y-4 text-right">
                <h3 className="font-bold text-white text-base">العملاء النشطون المتاحون للاختبار السريع</h3>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-semibold text-white/40">
                        <th className="p-3">النشاط التجاري / اسم المستخدم</th>
                        <th className="p-3">البريد الإلكتروني</th>
                        <th className="p-3 text-center">المنتجات</th>
                        <th className="p-3 text-center">حالة الـ AI</th>
                        <th className="p-3 text-left">التوجيه</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white/70">
                      {clients.filter(c => c.is_active).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-white/30">لا يوجد عملاء نشطون حالياً.</td>
                        </tr>
                      ) : (
                        clients.filter(c => c.is_active).map((client) => (
                          <tr key={client.id} className="hover:bg-white/[0.005]">
                            <td className="p-3">
                              <span className="font-semibold text-white">{client.business_name || "بدون اسم"}</span>
                              <span className="text-white/40 block">@{client.username}</span>
                            </td>
                            <td className="p-3 font-mono text-white/50">{client.email}</td>
                            <td className="p-3 text-center text-white">{client.item_count}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                                client.ai_auto_reply_enabled ? "bg-cyanx-500/10 text-cyanx-300" : "bg-amber-500/10 text-amber-300"
                              }`}>
                                {client.ai_auto_reply_enabled ? "نشط" : "معطل"}
                              </span>
                            </td>
                            <td className="p-3 text-left">
                              <span className="text-white/30 text-[10px]">استخدم بيانات الحساب لتسجيل الدخول كعميل والاختبار</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </GradientCard>
          </TabsContent>

          <TabsContent value="pricing" className="space-y-6">
            <GradientCard className="text-right">
              <div className="flex items-center justify-end gap-2 border-b border-white/10 pb-4 mb-4">
                <span className="font-bold text-white text-lg">التسعير وتكاليف رسائل الذكاء الاصطناعي (Pricing & Costs)</span>
                <Coins className="h-6 w-6 text-cyanx-400" />
              </div>
              <p className="text-sm leading-6 text-white/70 mb-6">
                احسب تكاليف استدعاءات LLM للمحادثات، وراجع التكلفة التفصيلية لكل رسالة بناءً على النموذج وحجم المدخلات لضمان تحقيق هوامش ربح جيدة للمنصة.
              </p>

              <div className="grid gap-6 md:grid-cols-2 text-right">
                {/* Cost Breakdown Info */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                  <h3 className="font-bold text-white text-base flex items-center justify-start gap-2">
                    <TrendingUp className="h-5 w-5 text-primary-400" />
                    <span>تحليل تكاليف الـ LLM لكل 1,000 رسالة</span>
                  </h3>
                  <div className="text-xs text-white/60 space-y-3 leading-5">
                    <p>
                      يتم تسعير الرسائل بناءً على عدد التوكينات (Tokens) المدخلة والمخرجة من OpenAI API.
                    </p>
                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="font-mono text-white">$0.005 / 1K</span>
                        <span>تكلفة مدخلات GPT-4o (Input Tokens):</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-white">$0.015 / 1K</span>
                        <span>تكلفة مخرجات GPT-4o (Output Tokens):</span>
                      </div>
                    </div>
                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="font-mono text-white">$0.00015 / 1K</span>
                        <span>تكلفة مدخلات GPT-4o-mini:</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-white">$0.0006 / 1K</span>
                        <span>تكلفة مخرجات GPT-4o-mini:</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/40 border-t border-white/5 pt-3">
                      * يمثل النموذج gpt-4o-mini خياراً اقتصادياً جداً للخدمة بنسبة وفر تتجاوز 90% مع كفاءة ردود عالية للمحادثات العادية.
                    </p>
                  </div>
                </div>

                {/* Interactive Simulator */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                  <h3 className="font-bold text-white text-base flex items-center justify-start gap-2">
                    <Calculator className="h-5 w-5 text-cyanx-400" />
                    <span>حاسبة التكلفة التفاعلية للرسائل</span>
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/50 block text-right">النموذج المستخدم</label>
                      <select
                        value={pricingModel}
                        onChange={(e) => setPricingModel(e.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-[#16161a] px-3 text-right text-xs text-white"
                      >
                        <option value="gpt-4o">gpt-4o (الدقة الفائقة)</option>
                        <option value="gpt-4o-mini">gpt-4o-mini (الاقتصادي)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-right">
                      <div className="space-y-1">
                        <label className="text-[11px] text-white/50 block">مخرجات الرسالة (Tokens)</label>
                        <Input 
                          type="number"
                          value={avgOutputTokens}
                          onChange={(e) => setAvgOutputTokens(parseInt(e.target.value) || 0)}
                          className="font-mono text-left h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-white/50 block">مدخلات الرسالة (Tokens)</label>
                        <Input 
                          type="number"
                          value={avgInputTokens}
                          onChange={(e) => setAvgInputTokens(parseInt(e.target.value) || 0)}
                          className="font-mono text-left h-9 text-xs"
                        />
                      </div>
                    </div>

                    {/* Simulation Result */}
                    {(() => {
                      const isMini = pricingModel === "gpt-4o-mini";
                      const inputRate = isMini ? 0.00015 : 0.005;
                      const outputRate = isMini ? 0.0006 : 0.015;
                      
                      const inputCost = (avgInputTokens / 1000) * inputRate;
                      const outputCost = (avgOutputTokens / 1000) * outputRate;
                      const totalCostPerMessage = inputCost + outputCost;
                      const totalCost1K = totalCostPerMessage * 1000;
                      
                      const platformPricePerMessage = 0.01; // $0.01 flat price billed to client per message
                      const platformProfitPerMessage = platformPricePerMessage - totalCostPerMessage;
                      const platformProfit1K = platformProfitPerMessage * 1000;

                      return (
                        <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2 text-xs">
                          <div className="flex justify-between font-bold">
                            <span className="font-mono text-cyanx-300">${totalCostPerMessage.toFixed(6)}</span>
                            <span>التكلفة الفعلية التقريبية للرسالة الواحدة:</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span className="font-mono text-white">${totalCost1K.toFixed(4)}</span>
                            <span>تكلفة 1,000 استعلام من هذا الحجم:</span>
                          </div>
                          <div className="flex justify-between text-primary-400 border-t border-white/5 pt-2 font-bold">
                            <span className="font-mono">${platformProfit1K.toFixed(2)}</span>
                            <span>صافي الربح التقريبي لكل 1,000 رسالة (بافتراض اشتراك 1 سنت للرسالة):</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* General Message Costs Comparative Table */}
              <div className="mt-8 space-y-4 text-right">
                <h3 className="font-bold text-white text-base">مقارنة التكاليف للمقاييس الشائعة للرسائل</h3>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-semibold text-white/40">
                        <th className="p-3">حجم المحادثة المفترض (سياق + مدخلات + مخرجات)</th>
                        <th className="p-3 text-center">النموذج gpt-4o</th>
                        <th className="p-3 text-center">النموذج gpt-4o-mini</th>
                        <th className="p-3 text-center">وفر التكاليف %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white/70">
                      <tr>
                        <td className="p-3">رسالة قصيرة (200 مدخلات، 50 مخرجات)</td>
                        <td className="p-3 text-center font-mono">$0.00175</td>
                        <td className="p-3 text-center font-mono">$0.00006</td>
                        <td className="p-3 text-center text-primary-400 font-bold">96.5%</td>
                      </tr>
                      <tr>
                        <td className="p-3">رسالة متوسطة مع سياق بسيط (500 مدخلات، 100 مخرجات)</td>
                        <td className="p-3 text-center font-mono">$0.00400</td>
                        <td className="p-3 text-center font-mono">$0.00014</td>
                        <td className="p-3 text-center text-primary-400 font-bold">96.6%</td>
                      </tr>
                      <tr>
                        <td className="p-3">رسالة طويلة مع سياق قاعدة معرفة كاملة (2,000 مدخلات، 200 مخرجات)</td>
                        <td className="p-3 text-center font-mono">$0.01300</td>
                        <td className="p-3 text-center font-mono">$0.00042</td>
                        <td className="p-3 text-center text-primary-400 font-bold">96.8%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </GradientCard>
          </TabsContent>
        </Tabs>
      </div>

      {/* MODAL 1: Create Client Account */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-950 p-6 text-right space-y-4" dir="rtl">
            <h4 className="text-lg font-bold text-white flex items-center justify-start gap-2">
              <Plus className="h-5 w-5 text-cyanx-400" />
              <span>إنشاء حساب مشترك جديد</span>
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
                  {businessTypes.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.group ? `${item.group} - ` : ""}{item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={creatingClient}>
                  {creatingClient ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
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
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-ink-950 p-6 text-right space-y-4" dir="rtl">
            <h4 className="text-lg font-bold text-white flex items-center justify-start gap-2">
              <Key className="h-5 w-5 text-amber-400" />
              <span>تغيير كلمة مرور المشترك</span>
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
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
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

      {/* MODAL 3: Edit Client Persona */}
      {editingClientPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-ink-950 p-6 text-right space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center justify-start gap-2">
              <Bot className="h-5 w-5 text-cyanx-400" />
              <span>تعديل سلوك العميل والذكاء الاصطناعي (AI Persona)</span>
            </h4>
            <p className="text-xs text-white/50">
              قم بتخصيص السلوك العام والمكالمات ونبرة الرد لوكيل الذكاء الاصطناعي الخاص بالعميل <span className="text-cyanx-400 font-bold">@{editingClientPrompt.username}</span>.
            </p>

            <form onSubmit={handleSaveClientPrompt} className="space-y-4">
              <div className="space-y-1 text-right">
                <label className="text-xs font-semibold text-white/70 block text-right">البرومبت الشخصي (AI Persona Override)</label>
                <Textarea 
                  value={clientPromptText} 
                  onChange={(e) => setClientPromptText(e.target.value)}
                  placeholder="مثال: أنت موظف خدمة عملاء ودود لمتجر عطور، تجيب باختصار وترحب بالعميل بلهجة سعودية..." 
                  className="min-h-72 text-right text-sm leading-6 bg-white/[0.03] border-white/10"
                  required 
                />
                <span className="text-[10px] text-white/30 block mt-1 text-right">
                  ملاحظة: هذا النص يحدد السلوك المحلي للوكيل للمتجر المحدد فقط، مع الاحتفاظ بقواعد الأمان الشاملة للمنصة.
                </span>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" type="button" onClick={() => setEditingClientPrompt(null)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={savingClientPrompt}>
                  {savingClientPrompt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>حفظ وتطبيق البرومبت</span>
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
