"use client";

import { useState, useEffect, useMemo } from "react";
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
  Sliders,
  Copy
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/use-auth-store";
import { GradientCard } from "@/components/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleSetting } from "@/components/toggle-setting";
import { useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

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
  human_handoff_enabled: boolean;
}

type PromptKey =
  | "sales_prompt"
  | "support_prompt"
  | "booking_prompt"
  | "general_prompt"
  | "humanizer_prompt"
  | "voice_prompt";

interface PromptSection {
  key: PromptKey;
  label: string;
  description: string;
  default_prompt: string;
  custom_prompt: string;
  active_custom_prompt: string;
  draft_prompt: string;
  effective_prompt: string;
  draft_effective_prompt: string;
  is_custom: boolean;
  is_draft_custom: boolean;
  has_unpublished_changes: boolean;
}

interface PromptVersion {
  id: string;
  version_number: number;
  status: "draft" | "active" | "archived" | string;
  title: string;
  notes: string;
  prompt_payload: Record<string, string>;
  test_status: "untested" | "passed" | "failed" | string;
  test_report?: {
    status?: string;
    checks?: Array<{ name: string; status: string; message: string }>;
  } | null;
  created_at: string;
  updated_at: string;
  activated_at?: string | null;
}

interface ClientPromptSettings {
  client_id: string;
  username: string;
  business_name: string | null;
  client_ai_persona: string;
  admin_persona_prompt: string;
  ai_persona: string;
  active_version: PromptVersion | null;
  draft_version: PromptVersion | null;
  versions: PromptVersion[];
  sections: Record<PromptKey, PromptSection>;
}

interface UsageModelBreakdown {
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  cost_estimated: boolean;
}

interface ClientUsageData extends UsageModelBreakdown {
  client_id: string;
  username: string;
  business_name: string | null;
  email: string;
  active_model: string;
  last_model: string | null;
  last_used_at: string | null;
  models: Record<string, UsageModelBreakdown>;
}

interface UsageSummary {
  generated_at: string;
  active_model: string;
  totals: UsageModelBreakdown;
  clients: ClientUsageData[];
}

interface BusinessTypeOption {
  key: string;
  label: string;
  icon?: string;
  group?: string;
}

type ManyChatChannelKey = "facebook" | "instagram";

interface ManyChatSetupChannel {
  label: string;
  request_url: string;
  text_external_request_url: string;
  voice_request_url: string;
  text_and_voice_request_url: string;
  body: Record<string, unknown>;
}

interface ManyChatResponseMapping {
  json_path: string;
  custom_field: string;
  field_type: string;
}

interface ManyChatRequiredVariable {
  json_key: string;
  manychat_label: string;
  template: string;
}

interface ManyChatWebhookSetup {
  method: string;
  block_type: string;
  response_format: string;
  webhook_url: string;
  webhook_secret: string;
  headers: Record<string, string>;
  response_mapping: ManyChatResponseMapping;
  required_variables: ManyChatRequiredVariable[];
  flow_steps: string[];
  channels: Record<ManyChatChannelKey, ManyChatSetupChannel>;
}

const fallbackBusinessTypes: BusinessTypeOption[] = [
  { key: "retail", label: "Retail / Ecommerce", group: "Commerce" },
  { key: "restaurant", label: "Restaurant / Cafe", group: "Food" },
  { key: "services", label: "Professional Services", group: "Services" },
];

const promptKeys: PromptKey[] = [
  "sales_prompt",
  "support_prompt",
  "booking_prompt",
  "general_prompt",
  "humanizer_prompt",
  "voice_prompt",
];

function manyChatStatusLabel(status: ManyChatSetupStatus, isRtl: boolean) {
  if (status === "completed") return isRtl ? "مكتمل" : "Completed";
  if (status === "pending_setup") return isRtl ? "قيد الإعداد" : "Pending Setup";
  return isRtl ? "لم يبدأ" : "Not Started";
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
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
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
  const [humanHandoffEnabled, setHumanHandoffEnabled] = useState(true);
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Notification notices
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [manychatSetup, setManychatSetup] = useState<ManyChatWebhookSetup | null>(null);
  const [manychatSetupClient, setManychatSetupClient] = useState<ClientData | null>(null);

  // Edit Client Prompt States
  const [editingClientPrompt, setEditingClientPrompt] = useState<ClientData | null>(null);
  const [clientPromptText, setClientPromptText] = useState("");
  const [savingClientPrompt, setSavingClientPrompt] = useState(false);

  // Prompt center states
  const [promptClientId, setPromptClientId] = useState("");
  const [promptSettings, setPromptSettings] = useState<ClientPromptSettings | null>(null);
  const [promptDrafts, setPromptDrafts] = useState<Partial<Record<PromptKey, string>>>({});
  const [personaDraft, setPersonaDraft] = useState("");
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [testingPrompts, setTestingPrompts] = useState(false);
  const [activatingPrompts, setActivatingPrompts] = useState(false);
  const [rollbackVersionId, setRollbackVersionId] = useState<string | null>(null);

  // AI Testing Store States
  const [resettingTesting, setResettingTesting] = useState(false);

  // Pricing Simulator States
  const [pricingModel, setPricingModel] = useState("gpt-4o-mini");
  const [avgInputTokens, setAvgInputTokens] = useState(450);
  const [avgOutputTokens, setAvgOutputTokens] = useState(80);

  const formatTokens = (value: number) => new Intl.NumberFormat("en-US").format(value || 0);
  const formatUsd = (value: number) => {
    const amount = value || 0;
    return `$${amount >= 1 ? amount.toFixed(2) : amount.toFixed(6)}`;
  };

  const showNotice = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 5000);
  };

  const copyToClipboard = async (text: string, successMessage?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotice(successMessage || (isRtl ? "تم النسخ إلى الحافظة." : "Copied to clipboard."));
    } catch (err) {
      console.error("Clipboard copy failed", err);
      showNotice(isRtl ? "تعذر النسخ إلى الحافظة." : "Could not copy to clipboard.", "error");
    }
  };

  const prettyJson = (value: unknown) => JSON.stringify(value, null, 2);

  const buildManychatChannelText = (setup: ManyChatWebhookSetup, channelKey: ManyChatChannelKey) => {
    const channel = setup.channels[channelKey];
    return [
      `ManyChat ${channel.label}`,
      `Block: Dynamic Block (Auto)`,
      `Method: ${setup.method || "POST"}`,
      `Recommended Auto URL: ${channel.request_url}`,
      `Voice-only URL (Dynamic Block): ${channel.voice_request_url}`,
      `Text + Voice URL (Dynamic Block): ${channel.text_and_voice_request_url}`,
      `Legacy text-only URL (External Request): ${channel.text_external_request_url}`,
      `Headers:\n${prettyJson(setup.headers)}`,
      `Body:\n${prettyJson(channel.body)}`,
      `Response Mapping (legacy External Request only): ${setup.response_mapping?.json_path || "$.ai_reply"} -> ${setup.response_mapping?.custom_field || "ai_reply"}`,
      `Recommended Flow: User sends a message -> Dynamic Block (Auto URL)`,
    ].join("\n\n");
  };

  const buildManychatSetupText = (setup: ManyChatWebhookSetup) =>
    (["facebook", "instagram"] as ManyChatChannelKey[])
      .map((channelKey) => buildManychatChannelText(setup, channelKey))
      .join("\n\n---\n\n");

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
        showNotice(
          isRtl 
            ? `✨ تم تحديث البرومبت الشخصي للعميل ${editingClientPrompt.username} بنجاح.` 
            : `✨ Persona behavior for client ${editingClientPrompt.username} has been successfully updated.`
        );
        setEditingClientPrompt(null);
      } else {
        showNotice(isRtl ? "❌ فشل تحديث البرومبت الشخصي." : "❌ Failed to update persona prompt.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء الاتصال بالخادم." : "❌ An error occurred connecting to the server.", "error");
    } finally {
      setSavingClientPrompt(false);
    }
  };

  const handleResetTestingStore = async () => {
    if (!token) return;
    const msg = isRtl
      ? "هل أنت متأكد من رغبتك في إعادة تهيئة بيئة الاختبار؟ سيتم مسح الجلسات وسجلات المحاكاة الاختبارية."
      : "Are you sure you want to reset the testing environment? Past mock conversations and logs will be deleted.";
    if (!confirm(msg)) return;
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
        showNotice(isRtl ? "❌ فشل إعادة تهيئة بيئة الاختبار." : "❌ Failed to reset testing environment.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء محاولة الاتصال بالخادم." : "❌ An error occurred connecting to the server.", "error");
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
      const [statsRes, clientsRes, settingsRes, businessTypesRes, usageRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }),
        fetch("/api/admin/clients", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }),
        fetch("/api/admin/settings", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }),
        fetch("/api/business-types", { cache: "no-store" }),
        fetch("/api/admin/usage", { headers: { Authorization: "Bearer " + token }, cache: "no-store" })
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
        setHumanHandoffEnabled(settingsData.human_handoff_enabled ?? true);
      }
      if (businessTypesRes.ok) {
        const typesData = await businessTypesRes.json().catch(() => []);
        if (Array.isArray(typesData) && typesData.length) {
          setBusinessTypes(typesData);
        }
      }
      if (usageRes.ok) {
        setUsageSummary(await usageRes.json());
      }
    } catch (err) {
      console.error("Failed to load admin dashboard data", err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء الاتصال بالخادم لجلب البيانات." : "❌ Error occurred fetching platform data from server.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const refreshClients = async () => {
      const path = searchQuery ? `/api/admin/clients?q=${encodeURIComponent(searchQuery)}` : "/api/admin/clients";
      try {
        const res = await fetch(path, {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store",
        });
        if (res.ok) {
          setClients(await res.json());
        }
      } catch (err) {
        console.error("Client status refresh error:", err);
      }
    };

    const refreshVisibleTab = () => {
      if (document.visibilityState === "visible") {
        void refreshClients();
      }
    };

    window.addEventListener("focus", refreshClients);
    document.addEventListener("visibilitychange", refreshVisibleTab);
    return () => {
      window.removeEventListener("focus", refreshClients);
      document.removeEventListener("visibilitychange", refreshVisibleTab);
    };
  }, [searchQuery, token]);

  const pendingManychatClients = clients.filter(
    (client) => client.manychat_setup_status === "pending_setup"
  );
  const usageClients = usageSummary?.clients || [];
  const topUsageClients = usageClients
    .filter((client) => client.total_tokens > 0)
    .slice(0, 5);

  useEffect(() => {
    if (!promptClientId && clients.length > 0) {
      setPromptClientId(clients[0].id);
    }
  }, [clients, promptClientId]);

  const loadPromptSettings = async (clientId: string) => {
    if (!token || !clientId) return;
    setLoadingPrompts(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/prompt-settings`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!res.ok) {
        showNotice(isRtl ? "فشل تحميل برومبتات العميل." : "Failed to load client prompts.", "error");
        return;
      }
      const data: ClientPromptSettings = await res.json();
      const drafts: Partial<Record<PromptKey, string>> = {};
      promptKeys.forEach((key) => {
        drafts[key] = data.sections[key]?.draft_prompt ?? data.sections[key]?.custom_prompt ?? "";
      });
      setPromptSettings(data);
      setPromptDrafts(drafts);
      setPersonaDraft(data.admin_persona_prompt || "");
    } catch (err) {
      console.error("Prompt settings load error", err);
      showNotice(isRtl ? "حدث خطأ أثناء تحميل البرومبتات." : "Error loading prompts.", "error");
    } finally {
      setLoadingPrompts(false);
    }
  };

  useEffect(() => {
    if (promptClientId) {
      void loadPromptSettings(promptClientId);
    }
  }, [promptClientId, token]);

  const buildPromptSettingsBody = () => {
    const body: Record<string, string> = {
      admin_persona_prompt: personaDraft,
      title: promptSettings?.draft_version?.title || "Prompt draft",
    };
    promptKeys.forEach((key) => {
      body[key] = promptDrafts[key] || "";
    });
    return body;
  };

  const applyPromptSettingsResponse = (data: ClientPromptSettings) => {
    const drafts: Partial<Record<PromptKey, string>> = {};
    promptKeys.forEach((key) => {
      drafts[key] = data.sections[key]?.draft_prompt ?? data.sections[key]?.custom_prompt ?? "";
    });
    setPromptSettings(data);
    setPromptDrafts(drafts);
    setPersonaDraft(data.admin_persona_prompt || "");
  };

  const handleSavePromptSettings = async () => {
    if (!token || !promptClientId) return;
    setSavingPrompts(true);
    try {
      const res = await fetch(`/api/admin/clients/${promptClientId}/prompt-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildPromptSettingsBody()),
      });
      if (!res.ok) {
        showNotice(isRtl ? "فشل حفظ مسودة البرومبت." : "Failed to save prompt draft.", "error");
        return;
      }
      const data: ClientPromptSettings = await res.json();
      applyPromptSettingsResponse(data);
      showNotice(isRtl ? "تم حفظ المسودة. اختبرها قبل التفعيل." : "Draft saved. Test it before activation.");
    } catch (err) {
      console.error("Prompt settings save error", err);
      showNotice(isRtl ? "حدث خطأ أثناء حفظ مسودة البرومبت." : "Error saving prompt draft.", "error");
    } finally {
      setSavingPrompts(false);
    }
  };

  const handleTestPromptSettings = async () => {
    if (!token || !promptClientId) return;
    setTestingPrompts(true);
    try {
      const res = await fetch(`/api/admin/clients/${promptClientId}/prompt-settings/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildPromptSettingsBody()),
      });
      const data: ClientPromptSettings | null = await res.json().catch(() => null);
      if (!res.ok || !data) {
        showNotice(isRtl ? "فشل اختبار المسودة." : "Failed to test draft.", "error");
        return;
      }
      applyPromptSettingsResponse(data);
      const passed = data.draft_version?.test_status === "passed";
      showNotice(
        passed
          ? isRtl ? "نجح الاختبار. يمكنك التفعيل الآن." : "Draft passed. You can activate it now."
          : isRtl ? "فشل الاختبار. راجع التقرير قبل التفعيل." : "Draft failed. Review the report before activation.",
        passed ? "success" : "error",
      );
    } catch (err) {
      console.error("Prompt settings test error", err);
      showNotice(isRtl ? "حدث خطأ أثناء اختبار المسودة." : "Error testing draft.", "error");
    } finally {
      setTestingPrompts(false);
    }
  };

  const handleActivatePromptSettings = async () => {
    if (!token || !promptClientId) return;
    setActivatingPrompts(true);
    try {
      const res = await fetch(`/api/admin/clients/${promptClientId}/prompt-settings/activate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ClientPromptSettings | null = await res.json().catch(() => null);
      if (!res.ok || !data) {
        showNotice(isRtl ? "لا يمكن التفعيل قبل نجاح الاختبار." : "Cannot activate before the draft passes tests.", "error");
        return;
      }
      applyPromptSettingsResponse(data);
      showNotice(isRtl ? "تم تفعيل نسخة البرومبت بنجاح." : "Prompt version activated successfully.");
    } catch (err) {
      console.error("Prompt settings activate error", err);
      showNotice(isRtl ? "حدث خطأ أثناء تفعيل البرومبت." : "Error activating prompt.", "error");
    } finally {
      setActivatingPrompts(false);
    }
  };

  const handleRollbackPromptVersion = async (versionId: string) => {
    if (!token || !promptClientId) return;
    setRollbackVersionId(versionId);
    try {
      const res = await fetch(`/api/admin/clients/${promptClientId}/prompt-settings/versions/${versionId}/rollback`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ClientPromptSettings | null = await res.json().catch(() => null);
      if (!res.ok || !data) {
        showNotice(isRtl ? "فشل الرجوع لهذه النسخة." : "Failed to roll back to this version.", "error");
        return;
      }
      applyPromptSettingsResponse(data);
      showNotice(isRtl ? "تم الرجوع للنسخة المحددة." : "Rolled back to the selected version.");
    } catch (err) {
      console.error("Prompt rollback error", err);
      showNotice(isRtl ? "حدث خطأ أثناء الرجوع للنسخة." : "Error rolling back prompt version.", "error");
    } finally {
      setRollbackVersionId(null);
    }
  };

  const handleSavePromptSettingsLegacy = async () => {
    if (!token || !promptClientId) return;
    setSavingPrompts(true);
    try {
      const body: Record<string, string> = {
        admin_persona_prompt: personaDraft,
      };
      promptKeys.forEach((key) => {
        body[key] = promptDrafts[key] || "";
      });

      const res = await fetch(`/api/admin/clients/${promptClientId}/prompt-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        showNotice(isRtl ? "فشل حفظ البرومبتات." : "Failed to save prompts.", "error");
        return;
      }
      const data: ClientPromptSettings = await res.json();
      const drafts: Partial<Record<PromptKey, string>> = {};
      promptKeys.forEach((key) => {
        drafts[key] = data.sections[key]?.custom_prompt || "";
      });
      setPromptSettings(data);
      setPromptDrafts(drafts);
      setPersonaDraft(data.admin_persona_prompt || "");
      showNotice(isRtl ? "تم حفظ برومبتات العميل بنجاح." : "Client prompts saved successfully.");
    } catch (err) {
      console.error("Prompt settings save error", err);
      showNotice(isRtl ? "حدث خطأ أثناء حفظ البرومبتات." : "Error saving prompts.", "error");
    } finally {
      setSavingPrompts(false);
    }
  };

  // Handle Client Search
  useEffect(() => {
    if (!token) return;
    const fetchFilteredClients = async () => {
      try {
        const path = searchQuery ? `/api/admin/clients?q=${encodeURIComponent(searchQuery)}` : "/api/admin/clients";
        const res = await fetch(path, { headers: { Authorization: "Bearer " + token }, cache: "no-store" });
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
        showNotice(
          nextActiveState 
            ? (isRtl ? `🔓 تم تنشيط حساب العميل ${client.username} بنجاح.` : `🔓 Account for @${client.username} activated successfully.`) 
            : (isRtl ? `🔒 تم تعطيل حساب العميل ${client.username} بنجاح.` : `🔒 Account for @${client.username} deactivated successfully.`)
        );
        
        // Reload stats to reflect active client counts
        const statsRes = await fetch("/api/admin/stats", { headers: { Authorization: "Bearer " + token } });
        if (statsRes.ok) setStats(await statsRes.json());
      } else {
        showNotice(isRtl ? "❌ فشل تعديل حالة نشاط الحساب." : "❌ Failed to change account status.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء الاتصال بالخادم." : "❌ An error occurred connecting to the server.", "error");
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
        showNotice(
          nextEnabledState 
            ? (isRtl ? "تم تفعيل ردود الذكاء الاصطناعي لهذه الشركة." : "AI auto-replies enabled for this company.") 
            : (isRtl ? "تم تعطيل ردود الذكاء الاصطناعي لهذه الشركة." : "AI auto-replies disabled for this company.")
        );
      } else {
        showNotice(data.detail || (isRtl ? "فشل تعديل حالة الرد الآلي للذكاء." : "Failed to update AI auto-reply status."), "error");
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "فشل تعديل حالة الرد الآلي للذكاء." : "Failed to update AI auto-reply status.", "error");
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
        showNotice(
          isRtl 
            ? `✨ تم إنشاء حساب العميل ${newClientUsername} بنجاح!` 
            : `✨ Client account ${newClientUsername} created successfully!`
        );
        setShowCreateModal(false);
        // Clear inputs
        setNewClientUsername("");
        setNewClientEmail("");
        setNewClientPassword("");
        setNewClientBusinessName("");
        
        // Refresh stats & client list
        loadAdminData();
      } else {
        showNotice(
          isRtl 
            ? `❌ فشل إنشاء العميل: ${data.detail || "خطأ غير معروف"}` 
            : `❌ Failed to create client: ${data.detail || "Unknown error"}`, 
          "error"
        );
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء محاولة إرسال البيانات." : "❌ An error occurred submitting details.", "error");
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
        showNotice(isRtl ? "🔑 تم تغيير كلمة مرور الحساب بنجاح." : "🔑 Account password updated successfully.");
        setResettingClientId(null);
        setNewPassword("");
      } else {
        showNotice(isRtl ? "❌ فشل تحديث كلمة المرور." : "❌ Failed to update password.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء معالجة الطلب." : "❌ An error occurred updating password.", "error");
    } finally {
      setProcessingPasswordReset(false);
    }
  };

  // Generate Manychat Webhook URL
  const handleGenerateManychatWebhook = async (clientId: string) => {
    if (!token) return;
    
    showNotice(isRtl ? `⏳ جاري تجهيز إعدادات ManyChat...` : `⏳ Preparing ManyChat setup...`);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/manychat-webhook`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.webhook_url) {
        const setup = data as ManyChatWebhookSetup;
        setManychatSetup(setup);
        setManychatSetupClient(clients.find((client) => client.id === clientId) || null);
        await copyToClipboard(
          setup.channels?.facebook?.request_url || setup.webhook_url,
          isRtl ? "تم تجهيز الإعدادات ونسخ رابط فيسبوك." : "Setup ready. Facebook URL copied."
        );
      } else {
        showNotice(
          isRtl 
            ? `❌ فشل توليد الرابط: ${data.detail || "خطأ غير معروف"}` 
            : `❌ Generation failed: ${data.detail || "Unknown error"}`, 
          "error"
        );
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء الاتصال بالخادم." : "❌ An error occurred connecting to the server.", "error");
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
        showNotice(
          status === "completed" 
            ? (isRtl ? "تم تعليم طلب ManyChat كمكتمل." : "ManyChat setup marked completed.") 
            : (isRtl ? "تم تحديث حالة طلب ManyChat." : "ManyChat setup status updated.")
        );
      } else {
        showNotice(
          isRtl 
            ? `فشل تحديث حالة ManyChat: ${data.detail || "خطأ غير معروف"}` 
            : `Failed to update ManyChat status: ${data.detail || "Unknown error"}`, 
          "error"
        );
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "حدث خطأ أثناء تحديث حالة ManyChat." : "Error occurred updating ManyChat status.", "error");
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
          master_system_prompt: masterSystemPromptInput,
          human_handoff_enabled: humanHandoffEnabled
        })
      });

      if (res.ok) {
        const updatedSettings = await res.json();
        setSystemSettings(updatedSettings);
        setMasterSystemPromptInput(updatedSettings.master_system_prompt || "");
        setHumanHandoffEnabled(updatedSettings.human_handoff_enabled ?? true);
        setApiKeyInput(""); // Clear the input sensitive string
        showNotice(isRtl ? "⚙️ تم تحديث وحفظ إعدادات المنصة والذكاء الاصطناعي بنجاح." : "⚙️ Platform config and AI parameters successfully saved.");
      } else {
        showNotice(isRtl ? "❌ فشل حفظ الإعدادات." : "❌ Failed to save configurations.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice(isRtl ? "❌ حدث خطأ أثناء محاولة حفظ التكوينات الجديدة." : "❌ An error occurred saving new configurations.", "error");
    } finally {
      setUpdatingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto mb-3" />
          <span className="text-sm text-white/50">
            {isRtl ? "جاري تحميل لوحة تحكم مدير المنصة..." : "Loading Admin Dashboard..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <AppShell 
      title={isRtl ? "لوحة الإشراف العام" : "Admin Dashboard"} 
      subtitle={isRtl ? "إدارة العملاء، إحصائيات النظام، وإعدادات الذكاء الاصطناعي للمنصة." : "Platform administration: manage accounts, check statistics, and configure global AI properties."}
    >
      <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
        {notice && (
          <div className={cn(
            "rounded-3xl border px-5 py-4 text-sm font-semibold animate-pulse",
            isRtl ? "text-right" : "text-left",
            notice.type === "success" ? "border-primary-400/20 bg-primary-500/10 text-primary-400" : "border-red-400/20 bg-red-500/10 text-red-400"
          )}>
            {notice.message}
          </div>
        )}

        <Tabs defaultValue="management" className={cn("w-full", isRtl ? "text-right" : "text-left")}>
          <TabsList className="grid grid-cols-5 bg-white/5 border border-white/10 p-1 rounded-2xl w-full max-w-5xl mb-6">
            <TabsTrigger value="management" className="rounded-xl text-xs font-semibold py-2">
              <Settings className="h-4 w-4 mx-1.5 shrink-0" />
              {isRtl ? "العملاء" : "Clients"}
            </TabsTrigger>
            <TabsTrigger value="usage" className="rounded-xl text-xs font-semibold py-2">
              <TrendingUp className="h-4 w-4 mx-1.5 shrink-0" />
              {isRtl ? "الاستهلاك" : "Usage"}
            </TabsTrigger>
            <TabsTrigger value="prompts" className="rounded-xl text-xs font-semibold py-2">
              <Sliders className="h-4 w-4 mx-1.5 shrink-0" />
              {isRtl ? "مركز البرومبتات" : "Prompt Center"}
            </TabsTrigger>
            <TabsTrigger value="testing" className="rounded-xl text-xs font-semibold py-2">
              <Bot className="h-4 w-4 mx-1.5 shrink-0" />
              {isRtl ? "متجر اختبار الـ AI" : "AI Testing Center"}
            </TabsTrigger>
            <TabsTrigger value="pricing" className="rounded-xl text-xs font-semibold py-2">
              <Coins className="h-4 w-4 mx-1.5 shrink-0" />
              {isRtl ? "التسعير والتكاليف" : "Pricing & Costs"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="management" className="space-y-6">
            {/* 1. Statistics Cards */}
            {stats && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className={cn("rounded-3xl border border-white/10 bg-white/[0.04] p-5 relative overflow-hidden", isRtl ? "text-right" : "text-left")}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/40">{isRtl ? "إجمالي الشركات المسجلة" : "Total Registered Businesses"}</span>
                    <Users className="h-5 w-5 text-cyan-400" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-white">{stats.clients}</div>
                  <div className="mt-1 text-[10px] text-cyan-400 font-semibold">
                    {isRtl ? `${stats.active_clients} شركة نشطة حالياً` : `${stats.active_clients} active accounts`}
                  </div>
                </div>

                <div className={cn("rounded-3xl border border-white/10 bg-white/[0.04] p-5 relative overflow-hidden", isRtl ? "text-right" : "text-left")}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full blur-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/40">{isRtl ? "المحادثات في المنصة" : "Total Platform Chats"}</span>
                    <MessageSquare className="h-5 w-5 text-primary-400" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-white">{stats.sessions}</div>
                  <div className="mt-1 text-[10px] text-primary-400 font-semibold">
                    {isRtl ? `${stats.messages} رسالة متبادلة` : `${stats.messages} total messages`}
                  </div>
                </div>

                <div className={cn("rounded-3xl border border-white/10 bg-white/[0.04] p-5 relative overflow-hidden", isRtl ? "text-right" : "text-left")}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/40">{isRtl ? "القنوات المتصلة" : "Connected Channels"}</span>
                    <Smartphone className="h-5 w-5 text-violet-400" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-white">{stats.channels}</div>
                  <div className="mt-1 text-[10px] text-violet-400 font-semibold">
                    {isRtl ? "موزعة على واتساب وماسنجر وإنستغرام" : "WhatsApp, FB Messenger & IG"}
                  </div>
                </div>

                <div className={cn("rounded-3xl border border-white/10 bg-white/[0.04] p-5 relative overflow-hidden", isRtl ? "text-right" : "text-left")}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white/40">{isRtl ? "المعرفة والمنتجات" : "Items & Catalog size"}</span>
                    <BookOpen className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="mt-4 text-3xl font-extrabold text-white">{stats.items}</div>
                  <div className="mt-1 text-[10px] text-amber-400 font-semibold">
                    {isRtl ? `${stats.style_samples} نموذج أسلوب مسجل` : `${stats.style_samples} style tone samples`}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
              {/* Left / Main Panel: Client List & Management */}
              <div className="space-y-6">
                <Card className="border-amber-400/20">
                  <CardHeader className={cn("flex gap-3 flex-col md:flex-row", isRtl ? "md:flex-row-reverse" : "md:flex-row")}>
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <CardTitle className={cn("flex items-center gap-2", isRtl ? "justify-end text-right" : "justify-start text-left")}>
                        {isRtl ? (
                          <>
                            <span>طلبات ربط ManyChat</span>
                            <Clock3 className="h-5 w-5 text-amber-300" />
                          </>
                        ) : (
                          <>
                            <Clock3 className="h-5 w-5 text-amber-300" />
                            <span>ManyChat Integration Requests</span>
                          </>
                        )}
                      </CardTitle>
                      <CardDescription className={isRtl ? "text-right" : "text-left"}>
                        {isRtl 
                          ? "العملاء الذين أرسلوا بيانات الصفحة وينتظرون الإعداد اليدوي من حساب الوكالة." 
                          : "Clients who sent page details and wait for manual agency account setup."}
                      </CardDescription>
                    </div>
                    <span className={cn("rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300 md:mr-auto", isRtl ? "md:mr-auto" : "md:ml-auto")}>
                      {isRtl ? `${pendingManychatClients.length} قيد الإعداد` : `${pendingManychatClients.length} Pending`}
                    </span>
                  </CardHeader>
                  <CardContent>
                    {pendingManychatClients.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
                        {isRtl ? "لا توجد طلبات ManyChat معلقة حالياً." : "No pending ManyChat setup requests."}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingManychatClients.map((client) => (
                          <div key={client.id} className={cn("rounded-2xl border border-white/10 bg-white/[0.025] p-4", isRtl ? "text-right" : "text-left")}>
                            <div className={cn("flex flex-wrap items-start gap-4", isRtl ? "justify-between" : "justify-between flex-row-reverse")}>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="text-xs"
                                  onClick={() => handleGenerateManychatWebhook(client.id)}
                                >
                                  <Smartphone className="h-3.5 w-3.5 mx-1" />
                                  {isRtl ? "إعداد ManyChat" : "ManyChat Setup"}
                                </Button>
                                <Button
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => handleUpdateManychatStatus(client.id, "completed")}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mx-1" />
                                  {isRtl ? "تم الإعداد" : "Complete Setup"}
                                </Button>
                              </div>
                              <div className={isRtl ? "text-right" : "text-left"}>
                                <div className="font-semibold text-white">{client.business_name || client.username}</div>
                                <div className="mt-1 text-xs text-white/40">{client.email}</div>
                              </div>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-white/55 md:grid-cols-3">
                              <a
                                href={client.fb_page_link || "#"}
                                target="_blank"
                                rel="noreferrer"
                                className={cn("rounded-xl bg-black/15 p-3 font-mono text-cyan-300 text-center", !client.fb_page_link && "pointer-events-none text-white/30")}
                                dir="ltr"
                              >
                                {client.fb_page_link || "No Facebook link"}
                              </a>
                              <div className="rounded-xl bg-black/15 p-3 font-mono text-center" dir="ltr">
                                {client.ig_username ? `@${client.ig_username}` : "No Instagram Username"}
                              </div>
                              <div className="rounded-xl bg-black/15 p-3 font-mono text-center" dir="ltr">
                                {client.wa_number || "No WhatsApp number"}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className={cn("flex gap-4 flex-col md:flex-row", isRtl ? "md:flex-row-reverse" : "md:flex-row")}>
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <CardTitle className={cn("flex items-center gap-2", isRtl ? "justify-end text-right" : "justify-start text-left")}>
                        {isRtl ? (
                          <>
                            <span>إدارة المشتركين والشركات</span>
                            <UserCheck className="h-5 w-5 text-cyan-400" />
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-5 w-5 text-cyan-400" />
                            <span>Subscriber Accounts Directory</span>
                          </>
                        )}
                      </CardTitle>
                      <CardDescription className={isRtl ? "text-right" : "text-left"}>
                        {isRtl 
                          ? "إجمالي الشركات المسجلة بالخدمة، يمكنك تعطيل/تنشيط الحسابات أو تغيير كلمة المرور." 
                          : "Total registered companies in the service. Activate/deactivate accounts or reset passwords."}
                      </CardDescription>
                    </div>
                    <div className={cn("flex gap-2", isRtl ? "md:mr-auto" : "md:ml-auto")}>
                      <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 text-xs py-2.5 h-auto">
                        <Plus className="h-4 w-4" />
                        <span>{isRtl ? "إنشاء حساب مشترك" : "Add Subscriber Account"}</span>
                      </Button>
                      <Button variant="secondary" onClick={loadAdminData} className="p-2 h-10 w-10 shrink-0">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search Bar */}
                    <div className={isRtl ? "text-right" : "text-left"}>
                      <Input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isRtl ? "🔍 ابحث عن عميل بالاسم، اسم المستخدم، أو البريد الإلكتروني..." : "🔍 Search client by name, username, or email address..."} 
                        className={cn("max-w-md", isRtl ? "ml-auto text-right" : "mr-auto text-left")}
                      />
                    </div>

                    {/* Clients Table */}
                    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.015] scrollbar-thin">
                      <table className={cn("w-full border-collapse", isRtl ? "text-right" : "text-left")}>
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold text-white/50">
                            <th className="p-4">{isRtl ? "العميل / النشاط التجاري" : "Client / Business"}</th>
                            <th className="p-4">{isRtl ? "البريد الإلكتروني" : "Email"}</th>
                            <th className="p-4 text-center">{isRtl ? "المنتجات" : "Products"}</th>
                            <th className="p-4 text-center">{isRtl ? "المحادثات" : "Chats"}</th>
                            <th className="p-4 text-center">AI</th>
                            <th className="p-4 text-center">ManyChat</th>
                            <th className="p-4 text-center">{isRtl ? "الحالة" : "Status"}</th>
                            <th className="p-4 text-center">{isRtl ? "التحكم" : "Actions"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-sm text-white/80">
                          {clients.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="p-8 text-center text-white/40">
                                {isRtl ? "لا يوجد عملاء مطابقين للبحث." : "No clients matching search filter."}
                              </td>
                            </tr>
                          ) : (
                            clients.map((client) => (
                              <tr key={client.id} className="hover:bg-white/[0.01]">
                                <td className="p-4 font-semibold text-white">
                                  <div>{client.business_name || (isRtl ? "بدون اسم نشاط" : "No business name")}</div>
                                  <div className="text-xs text-white/40 mt-0.5">@{client.username}</div>
                                </td>
                                <td className="p-4 font-mono text-xs text-white/60">{client.email}</td>
                                <td className="p-4 text-center">{client.item_count}</td>
                                <td className="p-4 text-center">{client.session_count}</td>
                                <td className="p-4 text-center">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                    client.ai_auto_reply_enabled ? "border border-cyan-500/20 bg-cyan-500/10 text-cyan-300" : "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                                  }`}>
                                    {client.ai_auto_reply_enabled
                                      ? (isRtl ? "يعمل" : "ON")
                                      : (isRtl ? "متوقف" : "OFF")}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${manyChatStatusClass(client.manychat_setup_status)}`}>
                                    {manyChatStatusLabel(client.manychat_setup_status, isRtl)}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                    client.is_active ? "bg-primary-500/10 border border-primary-500/20 text-primary-400" : "bg-red-500/10 border border-red-500/20 text-red-400"
                                  }`}>
                                    {client.is_active ? (isRtl ? "نشط" : "Active") : (isRtl ? "معطل" : "Deactivated")}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <div className={cn("flex gap-2 flex-wrap items-center", isRtl ? "justify-end" : "justify-start")}>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-cyan-400 hover:bg-cyan-400/10 py-1.5 h-auto text-xs"
                                      onClick={() => {
                                        setEditingClientPrompt(client);
                                        setClientPromptText(client.ai_persona || "");
                                      }}
                                    >
                                      <Bot className="h-3.5 w-3.5 mx-1" />
                                      <span>{isRtl ? "تعديل البرومبت" : "Edit Persona"}</span>
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      className="text-amber-400 hover:bg-amber-400/10 py-1.5 h-auto text-xs"
                                      onClick={() => setResettingClientId(client.id)}
                                    >
                                      <Key className="h-3.5 w-3.5 mx-1" />
                                      <span>{isRtl ? "كلمة المرور" : "Password"}</span>
                                    </Button>
                                    <div className="flex bg-violet-400/5 rounded-md p-1 gap-1 items-center border border-violet-500/10">
                                      <span className="text-[9px] text-violet-300/50 px-1 font-bold">{isRtl ? "ربط:" : "Link:"}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-violet-400 hover:bg-violet-400/10 py-1 h-auto text-[10px] px-2 flex gap-1 items-center"
                                        title={isRtl ? "فتح حزمة إعداد ManyChat" : "Open ManyChat setup kit"}
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
                                      <Bot className="h-3.5 w-3.5 mx-1" />
                                      <span>
                                        {client.ai_auto_reply_enabled
                                          ? (isRtl ? "إيقاف AI" : "Disable AI")
                                          : (isRtl ? "تشغيل AI" : "Enable AI")}
                                      </span>
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant={client.is_active ? "danger" : "secondary"}
                                      className="py-1.5 h-auto text-xs"
                                      onClick={() => handleToggleClientActive(client)}
                                    >
                                      {client.is_active ? <Lock className="h-3.5 w-3.5 mx-1" /> : <Unlock className="h-3.5 w-3.5 mx-1" />}
                                      <span>{client.is_active ? (isRtl ? "تعطيل" : "Deactivate") : (isRtl ? "تنشيط" : "Activate")}</span>
                                    </Button>
                                  </div>
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
                <GradientCard className={isRtl ? "text-right" : "text-left"}>
                  <div className={cn("flex items-center gap-2 border-b border-white/10 pb-4 mb-4", isRtl ? "justify-end text-right" : "justify-start text-left flex-row-reverse")}>
                    <span className="font-bold text-white text-base">{isRtl ? "إعدادات المنصة والـ AI" : "Platform & Global AI Config"}</span>
                    <Settings className="h-5 w-5 text-cyan-400" />
                  </div>

                  {systemSettings && (
                    <form onSubmit={handleSaveSettings} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/50 block">
                          {isRtl ? "مفتاح OpenAI API Key" : "OpenAI API Key"}
                        </label>
                        <div className="relative">
                          <Input 
                            type={showApiKey ? "text" : "password"} 
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            placeholder={systemSettings.openai_api_key_masked || (isRtl ? "لم يتم إدخال مفتاح API" : "No API Key entered")}
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
                          {isRtl ? "المصدر الحالي للمفتاح: " : "Current key source: "}
                          <span className="font-bold text-cyan-400">
                            {systemSettings.key_source === "env" 
                              ? (isRtl ? "ملف البيئة (.env)" : "Environment variables (.env)") 
                              : systemSettings.key_source === "database" 
                                ? (isRtl ? "قاعدة البيانات" : "Database config") 
                                : (isRtl ? "لا يوجد" : "None")}
                          </span>
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/50 block">
                          {isRtl ? "نموذج الذكاء الاصطناعي الافتراضي" : "Default Global LLM Model"}
                        </label>
                        <select
                          value={aiModelInput}
                          onChange={(e) => setAiModelInput(e.target.value)}
                          className={cn(
                            "h-11 w-full rounded-2xl border border-white/10 bg-[#16161a] px-4 text-sm text-white outline-none cursor-pointer appearance-none",
                            isRtl ? "text-right" : "text-left"
                          )}
                        >
                          <option value="gpt-4o">{isRtl ? "gpt-4o (الافتراضي - فائق الدقة)" : "gpt-4o (Default - Ultra Accurate)"}</option>
                          <option value="gpt-4o-mini">{isRtl ? "gpt-4o-mini (سريع واقتصادي)" : "gpt-4o-mini (Fast & Cost Efficient)"}</option>
                          <option value="gpt-4-turbo">gpt-4-turbo</option>
                          <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/50 block">Master System Prompt</label>
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

                      <ToggleSetting
                        title={isRtl ? "التحويل البشري التلقائي" : "Automatic human handoff"}
                        description={
                          isRtl
                            ? "عند إيقافه سيحاول الذكاء الاصطناعي إكمال المساعدة بسؤال توضيحي أو رد آمن بدل تحويل المحادثة لموظف."
                            : "When disabled, the AI keeps trying with a safe answer or clarifying question instead of transferring the conversation to a human."
                        }
                        checked={humanHandoffEnabled}
                        onChange={setHumanHandoffEnabled}
                      />

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-white/50 block">
                          {isRtl ? "ثواني التأخير للرد الآلي (Debounce)" : "Auto-Reply Debounce (Seconds)"}
                        </label>
                        <Input 
                          type="number" 
                          min="1" 
                          max="15" 
                          value={debounceSecondsInput}
                          onChange={(e) => setDebounceSecondsInput(parseInt(e.target.value) || 2)}
                          className="font-mono text-left"
                        />
                        <span className="text-[10px] text-white/30 block mt-1">
                          {isRtl ? "حجم النافذة الزمنية لتجميع رسائل العميل المتتالية قبل الرد." : "Time window to buffer consecutive customer messages before replying."}
                        </span>
                      </div>

                      <div className="pt-2">
                        <Button type="submit" disabled={updatingSettings} className="w-full justify-center">
                          {updatingSettings ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mx-2" />
                              <span>{isRtl ? "جاري الحفظ..." : "Saving..."}</span>
                            </>
                          ) : (
                            <span>{isRtl ? "حفظ التكوينات" : "Save Configurations"}</span>
                          )}
                        </Button>
                      </div>
                    </form>
                  )}
                </GradientCard>

                <Card className="border-cyan-400/20">
                  <CardHeader>
                    <CardTitle className={cn("flex items-center gap-2", isRtl ? "justify-end text-right" : "justify-start text-left flex-row-reverse")}>
                      <span>{isRtl ? "أمان وموثوقية المنصة" : "Platform Reliability & Security"}</span>
                      <ShieldCheck className="h-5 w-5 text-cyan-400" />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className={cn("text-xs text-white/40 leading-6 space-y-2", isRtl ? "text-right" : "text-left")}>
                    <p>
                      {isRtl 
                        ? "كمشرف عام، يرجى الحفاظ على سرية مفاتيح API المضافة. تؤثر التعديلات هنا بشكل فوري على جميع عمليات الرد والـ Webhooks النشطة عبر النظام لكافة حسابات العملاء."
                        : "As master administrator, please preserve the confidentiality of API Keys. Any changes applied here instantly impact message replies and active Webhooks system-wide."}
                    </p>
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3 flex items-center justify-between">
                      <span className="font-bold text-white font-mono">{user?.username}</span>
                      <span className="text-cyan-400">{isRtl ? "حساب الإشراف النشط" : "Active Admin Account"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="usage" className="space-y-6">
            <GradientCard className={isRtl ? "text-right" : "text-left"}>
              <div className={cn("mb-5 flex flex-wrap items-center justify-between gap-3", isRtl && "flex-row-reverse")}>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {isRtl ? "استهلاك العملاء" : "Client Usage"}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-white/45">
                    {isRtl
                      ? "متابعة التوكنز والتكلفة التقديرية والموديلات المستخدمة لكل حساب."
                      : "Track tokens, estimated cost, and models used per client account."}
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={loadAdminData}>
                  <RefreshCw className="h-4 w-4" />
                  {isRtl ? "تحديث" : "Refresh"}
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="text-xs font-semibold text-white/45">{isRtl ? "إجمالي التوكنز" : "Total tokens"}</div>
                  <div className="mt-2 text-2xl font-bold text-white">{formatTokens(usageSummary?.totals.total_tokens || 0)}</div>
                  <div className="mt-1 text-xs text-white/35">
                    {formatTokens(usageSummary?.totals.input_tokens || 0)} in / {formatTokens(usageSummary?.totals.output_tokens || 0)} out
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="text-xs font-semibold text-white/45">{isRtl ? "التكلفة التقديرية" : "Estimated cost"}</div>
                  <div className="mt-2 text-2xl font-bold text-cyan-300">{formatUsd(usageSummary?.totals.cost_usd || 0)}</div>
                  <div className="mt-1 text-xs text-white/35">
                    {usageSummary?.totals.cost_estimated === false ? (isRtl ? "يوجد موديل بلا تسعيرة" : "Some models have no rate") : (isRtl ? "حسب جدول أسعار النظام" : "Based on system rates")}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="text-xs font-semibold text-white/45">{isRtl ? "استدعاءات AI" : "AI calls"}</div>
                  <div className="mt-2 text-2xl font-bold text-white">{formatTokens(usageSummary?.totals.calls || 0)}</div>
                  <div className="mt-1 text-xs text-white/35">{isRtl ? "تشمل الرد والتحقق والتحسين" : "Reply, verifier, and humanizer"}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div className="text-xs font-semibold text-white/45">{isRtl ? "الموديل الافتراضي" : "Default model"}</div>
                  <div className="mt-2 break-all font-mono text-lg font-bold text-white">{usageSummary?.active_model || aiModelInput}</div>
                  <div className="mt-1 text-xs text-white/35">{isRtl ? "من إعدادات المنصة" : "From platform settings"}</div>
                </div>
              </div>

              {topUsageClients.length > 0 && (
                <div className="mt-5 grid gap-3 lg:grid-cols-5">
                  {topUsageClients.map((client) => (
                    <div key={client.client_id} className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
                      <div className="truncate text-sm font-semibold text-white">{client.business_name || client.username}</div>
                      <div className="mt-1 font-mono text-xs text-white/35">@{client.username}</div>
                      <div className="mt-3 text-lg font-bold text-cyan-300">{formatUsd(client.cost_usd)}</div>
                      <div className="mt-1 text-xs text-white/40">{formatTokens(client.total_tokens)} tokens</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-black/15">
                <table className={cn("w-full border-collapse", isRtl ? "text-right" : "text-left")}>
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold text-white/50">
                      <th className="p-4">{isRtl ? "الحساب" : "Account"}</th>
                      <th className="p-4 text-center">{isRtl ? "التكلفة" : "Cost"}</th>
                      <th className="p-4 text-center">{isRtl ? "التوكنز" : "Tokens"}</th>
                      <th className="p-4 text-center">{isRtl ? "المدخلات" : "Input"}</th>
                      <th className="p-4 text-center">{isRtl ? "المخرجات" : "Output"}</th>
                      <th className="p-4 text-center">{isRtl ? "الموديل" : "Model"}</th>
                      <th className="p-4 text-center">{isRtl ? "آخر استخدام" : "Last used"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-sm text-white/75">
                    {usageClients.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-white/40">
                          {isRtl ? "لا توجد بيانات استهلاك بعد." : "No usage data yet."}
                        </td>
                      </tr>
                    ) : (
                      usageClients.map((client) => (
                        <tr key={client.client_id} className="hover:bg-white/[0.02]">
                          <td className="p-4">
                            <div className="font-semibold text-white">{client.business_name || client.username}</div>
                            <div className="mt-0.5 font-mono text-xs text-white/40">@{client.username}</div>
                          </td>
                          <td className="p-4 text-center font-mono text-cyan-300">{formatUsd(client.cost_usd)}</td>
                          <td className="p-4 text-center font-mono">{formatTokens(client.total_tokens)}</td>
                          <td className="p-4 text-center font-mono text-white/55">{formatTokens(client.input_tokens)}</td>
                          <td className="p-4 text-center font-mono text-white/55">{formatTokens(client.output_tokens)}</td>
                          <td className="p-4 text-center">
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[11px] text-white/70">
                              {client.last_model || client.active_model || "-"}
                            </span>
                          </td>
                          <td className="p-4 text-center text-xs text-white/45">
                            {client.last_used_at ? new Date(client.last_used_at).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </GradientCard>
          </TabsContent>

          <TabsContent value="prompts" className="space-y-6">
            <GradientCard className={isRtl ? "text-right" : "text-left"}>
              <div className={cn("mb-5 flex flex-wrap items-center justify-between gap-3", isRtl && "flex-row-reverse")}>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {isRtl ? "مركز برومبتات العملاء" : "Client Prompt Center"}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-white/45">
                    {isRtl
                      ? "عدّل شخصية العميل وأقسام برومبتات الرد. الحقول الفارغة تستخدم البرومبت الافتراضي الآمن من الكود."
                      : "Edit the client persona and prompt sections. Empty fields use the protected default prompt from code."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => void loadPromptSettings(promptClientId)} disabled={!promptClientId || loadingPrompts}>
                    {loadingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isRtl ? "تحديث" : "Refresh"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleSavePromptSettings} disabled={!promptClientId || savingPrompts || loadingPrompts}>
                    {savingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isRtl ? "حفظ مسودة" : "Save draft"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleTestPromptSettings} disabled={!promptClientId || testingPrompts || loadingPrompts}>
                    {testingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {isRtl ? "اختبار" : "Test"}
                  </Button>
                  <Button type="button" onClick={handleActivatePromptSettings} disabled={!promptClientId || activatingPrompts || loadingPrompts || promptSettings?.draft_version?.test_status !== "passed"}>
                    {activatingPrompts ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {isRtl ? "تفعيل" : "Activate"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-white/60">
                      {isRtl ? "اختر الحساب" : "Select account"}
                    </label>
                    <select
                      value={promptClientId}
                      onChange={(event) => setPromptClientId(event.target.value)}
                      className={cn(
                        "h-11 w-full rounded-2xl border border-white/10 bg-[#16161a] px-4 text-sm text-white outline-none",
                        isRtl ? "text-right" : "text-left",
                      )}
                    >
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.business_name || client.username} - @{client.username}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="text-xs font-semibold text-white/50">
                      {isRtl ? "الحساب المحدد" : "Selected account"}
                    </div>
                    <div className="mt-2 text-sm font-bold text-white">
                      {promptSettings?.business_name || promptSettings?.username || (isRtl ? "لا يوجد حساب" : "No account")}
                    </div>
                    <div className="mt-1 text-xs text-white/40" dir="ltr">
                      {promptSettings ? `@${promptSettings.username}` : ""}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-center"
                    onClick={() => {
                      setPersonaDraft(promptSettings?.admin_persona_prompt || "");
                      const drafts: Partial<Record<PromptKey, string>> = {};
                      promptKeys.forEach((key) => {
                        drafts[key] = promptSettings?.sections[key]?.draft_prompt ?? promptSettings?.sections[key]?.custom_prompt ?? "";
                      });
                      setPromptDrafts(drafts);
                    }}
                    disabled={!promptSettings}
                  >
                    <RefreshCw className="h-4 w-4" />
                    {isRtl ? "إلغاء التغييرات غير المحفوظة" : "Discard unsaved changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-center"
                    onClick={() => {
                      setPersonaDraft("");
                      const drafts: Partial<Record<PromptKey, string>> = {};
                      promptKeys.forEach((key) => {
                        drafts[key] = "";
                      });
                      setPromptDrafts(drafts);
                    }}
                    disabled={!promptSettings}
                  >
                    <Database className="h-4 w-4" />
                    {isRtl ? "استخدام كل الافتراضيات" : "Use all defaults"}
                  </Button>

                  {promptSettings && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs text-white/55">
                      <div className="flex items-center justify-between gap-3">
                        <span>{isRtl ? "النسخة النشطة" : "Active version"}</span>
                        <span className="font-mono text-white">
                          v{promptSettings.active_version?.version_number ?? 0}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span>{isRtl ? "المسودة" : "Draft"}</span>
                        <span className="font-mono text-white">
                          {promptSettings.draft_version ? `v${promptSettings.draft_version.version_number}` : "-"}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span>{isRtl ? "الاختبار" : "Test"}</span>
                        <span className={cn(
                          "rounded-full px-2 py-1 text-[10px] font-bold",
                          promptSettings.draft_version?.test_status === "passed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : promptSettings.draft_version?.test_status === "failed"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-white/10 text-white/50",
                        )}>
                          {promptSettings.draft_version?.test_status || "no draft"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {loadingPrompts ? (
                    <div className="grid min-h-80 place-items-center rounded-2xl border border-white/10 bg-white/[0.025]">
                      <Loader2 className="h-7 w-7 animate-spin text-primary-400" />
                    </div>
                  ) : !promptSettings ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
                      {isRtl ? "اختر حساباً لعرض البرومبتات." : "Select an account to view prompts."}
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-primary-400/20 bg-primary-500/10 p-4">
                        <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs font-semibold text-white/50">
                            {isRtl ? "شخصية البوت من حساب العميل (قراءة فقط)" : "Client bot personality (read-only)"}
                          </div>
                          <div className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap text-xs leading-5 text-white/60">
                            {promptSettings.client_ai_persona || (isRtl ? "لم يحدد العميل شخصية بعد." : "The client has not set a personality yet.")}
                          </div>
                        </div>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <label className="text-sm font-semibold text-white">
                            {isRtl ? "إرشادات الأدمن لهذا الحساب" : "Admin account guidance"}
                          </label>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setPersonaDraft("")}>
                            {isRtl ? "تفريغ" : "Clear"}
                          </Button>
                        </div>
                        <Textarea
                          value={personaDraft}
                          onChange={(event) => setPersonaDraft(event.target.value)}
                          className={cn("min-h-40 font-mono text-xs leading-5", isRtl ? "text-right" : "text-left")}
                          placeholder={isRtl ? "أضف قواعد أو توجيهات إدارية لهذا الحساب بدون استبدال شخصية العميل." : "Add admin guidance for this account without replacing the client-owned personality."}
                        />
                        <p className="mt-2 text-xs leading-5 text-white/40">
                          {isRtl
                            ? "هذه الخانة تضاف كإرشادات أدمن فقط. بيانات المتجر والكتالوج وقواعد الأمان تبقى أعلى أولوية، وشخصية العميل لا تتغير عند الحفظ."
                            : "This is added as admin guidance only. Store data, catalog facts, and safety rules stay higher priority, and saving here does not change the client's personality."}
                        </p>
                      </div>

                      {promptSettings.draft_version?.test_report?.checks?.length ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <h4 className="text-sm font-semibold text-white">
                              {isRtl ? "تقرير اختبار المسودة" : "Draft test report"}
                            </h4>
                            <span className={cn(
                              "rounded-full px-2 py-1 text-[10px] font-bold",
                              promptSettings.draft_version.test_status === "passed"
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-rose-500/15 text-rose-300",
                            )}>
                              {promptSettings.draft_version.test_status}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {promptSettings.draft_version.test_report.checks.map((check) => (
                              <div key={check.name} className="rounded-xl border border-white/10 bg-black/15 p-3">
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <span className="font-mono text-white/70">{check.name}</span>
                                  <span className={check.status === "passed" ? "text-emerald-300" : "text-rose-300"}>
                                    {check.status}
                                  </span>
                                </div>
                                <div className="mt-2 text-xs leading-5 text-white/45">{check.message}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {promptSettings.versions?.length ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                          <h4 className="mb-3 text-sm font-semibold text-white">
                            {isRtl ? "تاريخ النسخ" : "Version history"}
                          </h4>
                          <div className="space-y-2">
                            {promptSettings.versions.slice(0, 8).map((version) => (
                              <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/15 p-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    v{version.version_number} · {version.status}
                                  </div>
                                  <div className="mt-1 text-xs text-white/40">
                                    {new Date(version.updated_at).toLocaleString()}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => void handleRollbackPromptVersion(version.id)}
                                  disabled={version.status === "active" || rollbackVersionId === version.id}
                                >
                                  {rollbackVersionId === version.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                  {isRtl ? "رجوع" : "Rollback"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {promptKeys.map((key) => {
                        const section = promptSettings.sections[key];
                        const value = promptDrafts[key] ?? "";
                        return (
                          <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-semibold text-white">{section.label}</h4>
                                <p className="mt-1 text-xs leading-5 text-white/40">{section.description}</p>
                              </div>
                              <div className="flex gap-2">
                                {section.is_custom && (
                                  <span className="rounded-full bg-primary-500/15 px-2 py-1 text-[10px] font-bold text-primary-300">
                                    {isRtl ? "نشط مخصص" : "Active custom"}
                                  </span>
                                )}
                                {section.has_unpublished_changes && (
                                  <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-300">
                                    {isRtl ? "غير مفعّل" : "Unpublished"}
                                  </span>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPromptDrafts((current) => ({ ...current, [key]: "" }))}
                                >
                                  {isRtl ? "استخدام الافتراضي" : "Use default"}
                                </Button>
                              </div>
                            </div>
                            <Textarea
                              value={value}
                              onChange={(event) => setPromptDrafts((current) => ({ ...current, [key]: event.target.value }))}
                              className="min-h-44 font-mono text-xs leading-5 text-left"
                              dir="ltr"
                              placeholder={isRtl ? "اتركه فارغاً لاستخدام الافتراضي." : "Leave empty to use the default."}
                            />
                            <details className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3">
                              <summary className="cursor-pointer text-xs font-semibold text-white/50">
                                {isRtl ? "عرض البرومبت الافتراضي" : "Show default prompt"}
                              </summary>
                              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-left text-[11px] leading-5 text-white/45" dir="ltr">
                                {section.default_prompt}
                              </pre>
                            </details>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </GradientCard>
          </TabsContent>

          <TabsContent value="testing" className="space-y-6">
            <GradientCard className={isRtl ? "text-right" : "text-left"}>
              <div className={cn("flex items-center gap-2 border-b border-white/10 pb-4 mb-4", isRtl ? "justify-end text-right" : "justify-start text-left flex-row-reverse")}>
                <span className="font-bold text-white text-lg">{isRtl ? "بيئة محاكاة واختبار الذكاء الاصطناعي (AI Testing Store)" : "AI Simulation & Test Sandbox (AI Testing Store)"}</span>
                <Bot className="h-6 w-6 text-cyan-400" />
              </div>
              <p className="text-sm leading-6 text-white/70 mb-6 font-semibold">
                {isRtl 
                  ? "تتيح لك لوحة الاختبار الإشراف على كيفية تفاعل وكلاء العملاء في بيئة تجريبية معزولة قبل تطبيق التغييرات على قنوات الواتساب أو ماسنجر الرسمية." 
                  : "The testing console allows you to monitor how company agents interact in an isolated simulation before applying changes live to WhatsApp/Messenger."}
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Reset Section */}
                <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4", isRtl ? "text-right" : "text-left")}>
                  <h3 className="font-bold text-white text-base">{isRtl ? "إعادة تهيئة بيئة الاختبار" : "Reset Test Environment"}</h3>
                  <p className="text-xs text-white/50 leading-5">
                    {isRtl 
                      ? "عند إعادة التهيئة، سيتم مسح كافة سجلات المحاكاة وجلسات الدردشة الاختبارية السابقة للتأكد من أن الاختبارات الجديدة تبدأ بنظافة مطلقة ودون أي تداخل مع مدخلات قديمة." 
                      : "Resetting deletes all past test chats and simulation history to ensure a clean testing state free of historical context leaks."}
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
                        <Loader2 className="h-4 w-4 animate-spin mx-2" />
                        <span>{isRtl ? "جاري إعادة التهيئة..." : "Resetting..."}</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mx-2" />
                        <span>{isRtl ? "إعادة تهيئة بيئة الاختبار" : "Reset Test Sandbox"}</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Login Instructions Section */}
                <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4", isRtl ? "text-right" : "text-left")}>
                  <h3 className="font-bold text-white text-base">{isRtl ? "تعليمات تسجيل الدخول والمحاكاة" : "How to Log In & Run Simulation"}</h3>
                  <div className="text-xs text-white/60 space-y-3 leading-5">
                    <div className={cn("flex items-start gap-2", isRtl ? "flex-row" : "flex-row-reverse")}>
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300 mt-0.5 mx-2">1</span>
                      <p>{isRtl ? "اختر العميل المستهدف للاختبار من القائمة في التبويب الرئيسي للإشراف العام." : "Select the target client from the subscribers list on the main tab."}</p>
                    </div>
                    <div className={cn("flex items-start gap-2", isRtl ? "flex-row" : "flex-row-reverse")}>
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300 mt-0.5 mx-2">2</span>
                      <p>{isRtl ? "قم بنسخ اسم المستخدم الخاص به. إذا لم تكن تعرف كلمة المرور الخاصة به، استخدم زر \"كلمة المرور\" في الجدول لتعيين كلمة مرور مؤقتة للاختبار." : "Copy their username. If password is unknown, click the 'Password' button in the table to assign a temporary testing password."}</p>
                    </div>
                    <div className={cn("flex items-start gap-2", isRtl ? "flex-row" : "flex-row-reverse")}>
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300 mt-0.5 mx-2">3</span>
                      <p>{isRtl ? "افتح متصفحاً خفياً أو سجل خروجك من الحساب الحالي، ثم قم بتسجيل الدخول كعميل باستخدام تلك البيانات." : "Open an incognito window or log out, then sign in as the company using those details."}</p>
                    </div>
                    <div className={cn("flex items-start gap-2", isRtl ? "flex-row" : "flex-row-reverse")}>
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300 mt-0.5 mx-2">4</span>
                      <p>{isRtl ? "اذهب إلى صندوق الوارد أو صفحة المنتجات والسياسات الخاصة بالعميل، واستخدم الدردشة التفاعلية لاختبار إجابات المساعد فورياً ورؤية نقاط أمان الردود." : "Go to the inbox or knowledge base pages of the client and use the chat interface to test replies and safety metrics."}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Clients Quick Lookup */}
              <div className="mt-8 space-y-4">
                <h3 className="font-bold text-white text-base">{isRtl ? "العملاء النشطون المتاحون للاختبار السريع" : "Active Clients Available for Sandbox Testing"}</h3>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                  <table className={cn("w-full border-collapse", isRtl ? "text-right" : "text-left")}>
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-semibold text-white/40">
                        <th className="p-3">{isRtl ? "النشاط التجاري / اسم المستخدم" : "Business / Username"}</th>
                        <th className="p-3">{isRtl ? "البريد الإلكتروني" : "Email"}</th>
                        <th className="p-3 text-center">{isRtl ? "المنتجات" : "Products"}</th>
                        <th className="p-3 text-center">{isRtl ? "حالة الـ AI" : "AI Status"}</th>
                        <th className="p-3 text-center">{isRtl ? "التوجيه" : "Guidance"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white/70">
                      {clients.filter(c => c.is_active).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-white/30">{isRtl ? "لا يوجد عملاء نشطون حالياً." : "No active clients currently."}</td>
                        </tr>
                      ) : (
                        clients.filter(c => c.is_active).map((client) => (
                          <tr key={client.id} className="hover:bg-white/[0.005]">
                            <td className="p-3">
                              <span className="font-semibold text-white">{client.business_name || (isRtl ? "بدون اسم" : "Unnamed")}</span>
                              <span className="text-white/40 block">@{client.username}</span>
                            </td>
                            <td className="p-3 font-mono text-white/50">{client.email}</td>
                            <td className="p-3 text-center text-white">{client.item_count}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold ${
                                client.ai_auto_reply_enabled ? "bg-cyan-500/10 text-cyan-300" : "bg-amber-500/10 text-amber-300"
                              }`}>
                                {client.ai_auto_reply_enabled ? (isRtl ? "نشط" : "Active") : (isRtl ? "معطل" : "Disabled")}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className="text-white/30 text-[10px]">
                                {isRtl ? "استخدم بيانات الحساب لتسجيل الدخول كعميل والاختبار" : "Sign in with these credentials to simulate client view"}
                              </span>
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
            <GradientCard className={isRtl ? "text-right" : "text-left"}>
              <div className={cn("flex items-center gap-2 border-b border-white/10 pb-4 mb-4", isRtl ? "justify-end text-right" : "justify-start text-left flex-row-reverse")}>
                <span className="font-bold text-white text-lg">{isRtl ? "التسعير وتكاليف رسائل الذكاء الاصطناعي (Pricing & Costs)" : "LLM Execution Cost & Simulator"}</span>
                <Coins className="h-6 w-6 text-cyan-400" />
              </div>
              <p className="text-sm leading-6 text-white/70 mb-6 font-medium">
                {isRtl 
                  ? "احسب تكاليف استدعاءات LLM للمحادثات، وراجع التكلفة التفصيلية لكل رسالة بناءً على النموذج وحجم المدخلات لضمان تحقيق هوامش ربح جيدة للمنصة." 
                  : "Simulate and project LLM API call costs. Review detailed message usage costs based on active model and tokens to maintain platform margins."}
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Cost Breakdown Info */}
                <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4", isRtl ? "text-right" : "text-left")}>
                  <h3 className={cn("font-bold text-white text-base flex items-center gap-2", isRtl ? "justify-start" : "justify-start flex-row-reverse")}>
                    <TrendingUp className="h-5 w-5 text-primary-400" />
                    <span>{isRtl ? "تحليل تكاليف الـ LLM لكل 1,000 رسالة" : "LLM API Cost per 1,000 queries"}</span>
                  </h3>
                  <div className="text-xs text-white/60 space-y-3 leading-5">
                    <p>
                      {isRtl 
                        ? "يتم تسعير الرسائل بناءً على عدد التوكينات (Tokens) المدخلة والمخرجة من OpenAI API." 
                        : "API calls are priced directly based on input and output tokens consumed."}
                    </p>
                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <div className={cn("flex justify-between", !isRtl && "flex-row-reverse")}>
                        <span className="font-mono text-white">$0.005 / 1K</span>
                        <span>{isRtl ? "تكلفة مدخلات GPT-4o (Input Tokens):" : "GPT-4o Input tokens cost:"}</span>
                      </div>
                      <div className={cn("flex justify-between", !isRtl && "flex-row-reverse")}>
                        <span className="font-mono text-white">$0.015 / 1K</span>
                        <span>{isRtl ? "تكلفة مخرجات GPT-4o (Output Tokens):" : "GPT-4o Output tokens cost:"}</span>
                      </div>
                    </div>
                    <div className="border-t border-white/5 pt-3 space-y-2">
                      <div className={cn("flex justify-between", !isRtl && "flex-row-reverse")}>
                        <span className="font-mono text-white">$0.00015 / 1K</span>
                        <span>{isRtl ? "تكلفة مدخلات GPT-4o-mini:" : "GPT-4o-mini Input tokens cost:"}</span>
                      </div>
                      <div className={cn("flex justify-between", !isRtl && "flex-row-reverse")}>
                        <span className="font-mono text-white">$0.0006 / 1K</span>
                        <span>{isRtl ? "تكلفة مخرجات GPT-4o-mini:" : "GPT-4o-mini Output tokens cost:"}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/40 border-t border-white/5 pt-3">
                      {isRtl 
                        ? "* يمثل النموذج gpt-4o-mini خياراً اقتصادياً جداً للخدمة بنسبة وفر تتجاوز 90% مع كفاءة ردود عالية للمحادثات العادية." 
                        : "* gpt-4o-mini model offers an incredibly economical option, saving >90% in cost with reliable response generation for standard text."}
                    </p>
                  </div>
                </div>

                {/* Interactive Simulator */}
                <div className={cn("rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-4", isRtl ? "text-right" : "text-left")}>
                  <h3 className={cn("font-bold text-white text-base flex items-center gap-2", isRtl ? "justify-start" : "justify-start flex-row-reverse")}>
                    <Calculator className="h-5 w-5 text-cyan-400" />
                    <span>{isRtl ? "حاسبة التكلفة التفاعلية للرسائل" : "Interactive Message Cost Calculator"}</span>
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/50 block">{isRtl ? "النموذج المستخدم" : "AI model simulated"}</label>
                      <select
                        value={pricingModel}
                        onChange={(e) => setPricingModel(e.target.value)}
                        className={cn(
                          "h-10 w-full rounded-xl border border-white/10 bg-[#16161a] px-3 text-xs text-white",
                          isRtl ? "text-right" : "text-left"
                        )}
                      >
                        <option value="gpt-4o">{isRtl ? "gpt-4o (الدقة الفائقة)" : "gpt-4o (Ultra Accuracy)"}</option>
                        <option value="gpt-4o-mini">{isRtl ? "gpt-4o-mini (الاقتصادي)" : "gpt-4o-mini (Economic)"}</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-white/50 block">{isRtl ? "مخرجات الرسالة (Tokens)" : "Output Tokens size"}</label>
                        <Input 
                          type="number"
                          value={avgOutputTokens}
                          onChange={(e) => setAvgOutputTokens(parseInt(e.target.value) || 0)}
                          className="font-mono text-left h-9 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-white/50 block">{isRtl ? "مدخلات الرسالة (Tokens)" : "Input Tokens size"}</label>
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
                          <div className={cn("flex justify-between font-bold", !isRtl && "flex-row-reverse")}>
                            <span className="font-mono text-cyan-300">${totalCostPerMessage.toFixed(6)}</span>
                            <span>{isRtl ? "التكلفة الفعلية التقريبية للرسالة الواحدة:" : "Approx actual cost per message:"}</span>
                          </div>
                          <div className={cn("flex justify-between font-semibold", !isRtl && "flex-row-reverse")}>
                            <span className="font-mono text-white">${totalCost1K.toFixed(4)}</span>
                            <span>{isRtl ? "تكلفة 1,000 استعلام من هذا الحجم:" : "Estimated cost per 1,000 messages:"}</span>
                          </div>
                          <div className={cn("flex text-primary-400 border-t border-white/5 pt-2 font-bold justify-between", !isRtl && "flex-row-reverse")}>
                            <span className="font-mono">${platformProfit1K.toFixed(2)}</span>
                            <span>{isRtl ? "صافي الربح التقريبي لكل 1,000 رسالة (بافتراض اشتراك 1 سنت للرسالة):" : "Approx net margin per 1K replies (assuming client billed $0.01/message):"}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* General Message Costs Comparative Table */}
              <div className="mt-8 space-y-4">
                <h3 className="font-bold text-white text-base">{isRtl ? "مقارنة التكاليف للمقاييس الشائعة للرسائل" : "Comparative Benchmarks for Standard Conversational Sizes"}</h3>
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20">
                  <table className={cn("w-full border-collapse", isRtl ? "text-right" : "text-left")}>
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02] text-xs font-semibold text-white/40">
                        <th className="p-3">{isRtl ? "حجم المحادثة المفترض (سياق + مدخلات + مخرجات)" : "Assumed Conversation Size (Context + Inputs + Output)"}</th>
                        <th className="p-3 text-center">{isRtl ? "النموذج gpt-4o" : "gpt-4o Model"}</th>
                        <th className="p-3 text-center">{isRtl ? "النموذج gpt-4o-mini" : "gpt-4o-mini Model"}</th>
                        <th className="p-3 text-center">{isRtl ? "وفر التكاليف %" : "Cost Savings %"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-white/70">
                      <tr>
                        <td className="p-3">{isRtl ? "رسالة قصيرة (200 مدخلات، 50 مخرجات)" : "Short message (200 inputs, 50 outputs)"}</td>
                        <td className="p-3 text-center font-mono">$0.00175</td>
                        <td className="p-3 text-center font-mono">$0.00006</td>
                        <td className="p-3 text-center text-primary-400 font-bold">96.5%</td>
                      </tr>
                      <tr>
                        <td className="p-3">{isRtl ? "رسالة متوسطة مع سياق بسيط (500 مدخلات، 100 مخرجات)" : "Medium message with minor context (500 inputs, 100 outputs)"}</td>
                        <td className="p-3 text-center font-mono">$0.00400</td>
                        <td className="p-3 text-center font-mono">$0.00014</td>
                        <td className="p-3 text-center text-primary-400 font-bold">96.6%</td>
                      </tr>
                      <tr>
                        <td className="p-3">{isRtl ? "رسالة طويلة مع سياق قاعدة معرفة كاملة (2,000 مدخلات، 200 مخرجات)" : "Long message with full knowledge base context (2,000 inputs, 200 outputs)"}</td>
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

      {/* MODAL: ManyChat Setup Kit */}
      {manychatSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn("w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-ink-950 p-6 space-y-5", isRtl ? "text-right" : "text-left")} dir={isRtl ? "rtl" : "ltr"}>
            <div className={cn("flex flex-col gap-3 md:flex-row md:items-start md:justify-between", isRtl ? "md:flex-row-reverse" : "")}>
              <div>
                <h4 className={cn("text-lg font-bold text-white flex items-center gap-2", isRtl ? "justify-end" : "justify-start")}>
                  <Smartphone className="h-5 w-5 text-violet-300" />
                  <span>{isRtl ? "حزمة إعداد ManyChat" : "ManyChat Setup Kit"}</span>
                </h4>
                <p className="mt-1 text-xs text-white/50">
                  {manychatSetupClient
                    ? (isRtl ? `العميل: ${manychatSetupClient.business_name || manychatSetupClient.username}` : `Client: ${manychatSetupClient.business_name || manychatSetupClient.username}`)
                    : (isRtl ? "جاهزة للنسخ داخل ManyChat." : "Ready to copy into ManyChat.")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs"
                  onClick={() => copyToClipboard(
                    buildManychatSetupText(manychatSetup),
                    isRtl ? "تم نسخ حزمة الإعداد كاملة." : "Full setup kit copied."
                  )}
                >
                  <Copy className="h-3.5 w-3.5 mx-1" />
                  {isRtl ? "نسخ الكل" : "Copy All"}
                </Button>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => setManychatSetup(null)}>
                  {isRtl ? "إغلاق" : "Close"}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4">
              <h5 className="text-sm font-bold text-emerald-200">
                {isRtl ? "التركيب الصحيح لكل متجر جديد" : "Correct setup for every new store"}
              </h5>
              <ol className="mt-3 grid gap-2 text-xs text-white/70 md:grid-cols-2">
                <li><span className="font-bold text-emerald-300">1.</span> {isRtl ? "أنشئ Automation: المستخدم يرسل رسالة." : "Create an automation triggered when the user sends a message."}</li>
                <li><span className="font-bold text-emerald-300">2.</span> {isRtl ? "أضف Dynamic Block واحد فقط." : "Add one Dynamic Block only."}</li>
                <li><span className="font-bold text-emerald-300">3.</span> {isRtl ? "الصق رابط Auto الرئيسي والهيدرز الخاصين بهذا المتجر." : "Paste this store's main Auto URL and headers."}</li>
                <li><span className="font-bold text-emerald-300">4.</span> {isRtl ? "أضف User ID وLast Input Text من قائمة المتغيرات." : "Insert User ID and Last Input Text from the variable picker."}</li>
                <li><span className="font-bold text-emerald-300">5.</span> {isRtl ? "انشر الفلو؛ لا تضف Send Message بعد الـDynamic Block." : "Publish the flow; do not add Send Message after the Dynamic Block."}</li>
              </ol>
              <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100/80">
                {isRtl
                  ? "مهم: داخل JSON اختَر User ID وLast Input Text من زر المتغيرات في ManyChat حتى يظهرا كحقول ملوّنة. لا تكتب {{...}} يدويًا، واحذف أي contact أو live_chat_url."
                  : "Important: insert User ID and Last Input Text using ManyChat's variable picker so they appear as colored tokens. Do not type {{...}} manually, and do not add contact or live_chat_url."}
              </div>
              <div className="mt-2 rounded-xl border border-violet-300/20 bg-violet-300/[0.06] px-3 py-2 text-xs text-violet-100/80">
                {isRtl
                  ? "بعد التركيب لا تعدّل ManyChat مرة ثانية: صاحب المتجر يختار من إعدادات الصوت «متوقف» أو «نص وصوت» أو «صوت دائماً»، ورابط Auto يطبّق اختياره تلقائياً."
                  : "After setup, never edit ManyChat again: the store owner chooses Off, Text & Voice, or Always Voice in Voice Settings, and the Auto URL applies it automatically."}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
              <div className={cn("flex flex-wrap items-center gap-2", isRtl ? "justify-between" : "justify-between")}>
                <div>
                  <div className="text-xs font-bold text-white/70">Headers</div>
                  <div className="text-[11px] text-white/40">{isRtl ? "ضعها في إعدادات الطلب." : "Add these to the request settings."}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-cyan-300"
                  onClick={() => copyToClipboard(
                    prettyJson(manychatSetup.headers),
                    isRtl ? "تم نسخ الهيدرز." : "Headers copied."
                  )}
                >
                  <Copy className="h-3.5 w-3.5 mx-1" />
                  {isRtl ? "نسخ" : "Copy"}
                </Button>
              </div>
              <Textarea
                dir="ltr"
                readOnly
                value={prettyJson(manychatSetup.headers)}
                className="mt-3 min-h-24 resize-none border-white/10 bg-black/30 font-mono text-xs text-left"
              />
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className={cn("flex flex-wrap items-center justify-between gap-3", isRtl ? "flex-row-reverse" : "")}>
                <div>
                  <div className="text-sm font-bold text-white/60">{isRtl ? "خيار قديم للنص فقط — External Request" : "Legacy text-only option — External Request"}</div>
                  <div className="mt-1 text-xs text-white/50">
                    {isRtl ? "لا تحتاج هذا مع رابط Auto. استخدمه فقط إذا أردت الإبقاء على الفلو النصّي القديم." : "You do not need this with the Auto URL. Use it only to keep the old text-only flow."}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-cyan-300"
                  onClick={() => copyToClipboard(
                    manychatSetup.response_mapping?.json_path || "$.ai_reply",
                    isRtl ? "تم نسخ JSON Path." : "JSON Path copied."
                  )}
                >
                  <Copy className="h-3.5 w-3.5 mx-1" />
                  {isRtl ? "نسخ المسار" : "Copy path"}
                </Button>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3" dir="ltr">
                <div className="rounded-xl bg-black/25 p-3 text-left">
                  <div className="text-[10px] uppercase text-white/35">JSON Path</div>
                  <code className="mt-1 block text-sm text-cyan-200">{manychatSetup.response_mapping?.json_path || "$.ai_reply"}</code>
                </div>
                <div className="rounded-xl bg-black/25 p-3 text-left">
                  <div className="text-[10px] uppercase text-white/35">Save to field</div>
                  <code className="mt-1 block text-sm text-cyan-200">{manychatSetup.response_mapping?.custom_field || "ai_reply"}</code>
                </div>
                <div className="rounded-xl bg-black/25 p-3 text-left">
                  <div className="text-[10px] uppercase text-white/35">Flow</div>
                  <code className="mt-1 block text-xs text-cyan-200">Trigger → External Request → ai_reply</code>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {(["facebook", "instagram"] as ManyChatChannelKey[]).map((channelKey) => {
                const channel = manychatSetup.channels?.[channelKey];
                if (!channel) return null;
                return (
                  <div key={channelKey} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 space-y-4">
                    <div className={cn("flex items-center justify-between gap-2", isRtl ? "flex-row-reverse" : "")}>
                      <div>
                        <div className="text-sm font-bold text-white">{channel.label}</div>
                        <div className="text-[11px] uppercase tracking-wide text-emerald-300">{manychatSetup.method || "POST"} · Dynamic Block · Auto</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs text-violet-300"
                        onClick={() => copyToClipboard(
                          buildManychatChannelText(manychatSetup, channelKey),
                          isRtl ? "تم نسخ إعدادات القناة." : "Channel setup copied."
                        )}
                      >
                        <Copy className="h-3.5 w-3.5 mx-1" />
                        {isRtl ? "نسخ القناة" : "Copy Channel"}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className={cn("flex items-center justify-between gap-2", isRtl ? "flex-row-reverse" : "")}>
                        <label className="text-xs font-semibold text-emerald-200">{isRtl ? "رابط Auto الموصى به" : "Recommended Auto URL"}</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px] text-cyan-300"
                          onClick={() => copyToClipboard(
                            channel.request_url,
                            isRtl ? "تم نسخ الرابط." : "URL copied."
                          )}
                        >
                          <Copy className="h-3 w-3 mx-1" />
                          {isRtl ? "نسخ" : "Copy"}
                        </Button>
                      </div>
                      <Input dir="ltr" readOnly value={channel.request_url} className="font-mono text-xs text-left" />
                    </div>

                    <div className="space-y-3 rounded-xl border border-violet-400/15 bg-violet-400/[0.04] p-3">
                      <div>
                        <div className="text-xs font-bold text-violet-200">{isRtl ? "خيارات ثابتة متقدمة" : "Advanced fixed modes"}</div>
                        <div className="mt-1 text-[11px] text-white/40">
                          {isRtl ? "لا تحتاجها عادةً؛ رابط Auto أعلاه يتبع اختيار صاحب المتجر." : "Usually unnecessary; the Auto URL follows the store owner's setting."}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className={cn("flex items-center justify-between gap-2", isRtl ? "flex-row-reverse" : "")}>
                          <label className="text-[11px] font-semibold text-white/55">{isRtl ? "فويس فقط" : "Voice only"}</label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-violet-300"
                            onClick={() => copyToClipboard(
                              channel.voice_request_url,
                              isRtl ? "تم نسخ رابط الفويس." : "Voice URL copied."
                            )}
                          >
                            <Copy className="h-3 w-3 mx-1" />
                            {isRtl ? "نسخ" : "Copy"}
                          </Button>
                        </div>
                        <Input dir="ltr" readOnly value={channel.voice_request_url} className="font-mono text-[10px] text-left" />
                      </div>
                      <div className="space-y-1.5">
                        <div className={cn("flex items-center justify-between gap-2", isRtl ? "flex-row-reverse" : "")}>
                          <label className="text-[11px] font-semibold text-white/55">{isRtl ? "نص + فويس" : "Text + voice"}</label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-violet-300"
                            onClick={() => copyToClipboard(
                              channel.text_and_voice_request_url,
                              isRtl ? "تم نسخ رابط النص والفويس." : "Text + voice URL copied."
                            )}
                          >
                            <Copy className="h-3 w-3 mx-1" />
                            {isRtl ? "نسخ" : "Copy"}
                          </Button>
                        </div>
                        <Input dir="ltr" readOnly value={channel.text_and_voice_request_url} className="font-mono text-[10px] text-left" />
                      </div>
                      <div className="space-y-1.5 border-t border-white/10 pt-2">
                        <div className={cn("flex items-center justify-between gap-2", isRtl ? "flex-row-reverse" : "")}>
                          <label className="text-[11px] font-semibold text-white/45">{isRtl ? "النص القديم — External Request" : "Legacy text — External Request"}</label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[10px] text-white/45"
                            onClick={() => copyToClipboard(
                              channel.text_external_request_url,
                              isRtl ? "تم نسخ رابط النص القديم." : "Legacy text URL copied."
                            )}
                          >
                            <Copy className="h-3 w-3 mx-1" />
                            {isRtl ? "نسخ" : "Copy"}
                          </Button>
                        </div>
                        <Input dir="ltr" readOnly value={channel.text_external_request_url} className="font-mono text-[10px] text-left opacity-60" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className={cn("flex items-center justify-between gap-2", isRtl ? "flex-row-reverse" : "")}>
                        <label className="text-xs font-semibold text-white/60">JSON Body</label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px] text-cyan-300"
                          onClick={() => copyToClipboard(
                            prettyJson(channel.body),
                            isRtl ? "تم نسخ جسم الطلب." : "Body copied."
                          )}
                        >
                          <Copy className="h-3 w-3 mx-1" />
                          {isRtl ? "نسخ" : "Copy"}
                        </Button>
                      </div>
                      <Textarea
                        dir="ltr"
                        readOnly
                        value={prettyJson(channel.body)}
                        className="min-h-40 resize-none border-white/10 bg-black/30 font-mono text-xs text-left"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={cn("rounded-2xl border border-violet-400/15 bg-violet-400/5 p-4 text-xs text-white/55", isRtl ? "text-right" : "text-left")}>
              {isRtl
                ? "كل متجر يحصل على رابط وسر خاصين به من هذه الصفحة. كرر نفس الخطوات فقط، ولا تعِد استخدام رابط متجر آخر."
                : "Each store gets its own URL and secret from this page. Repeat the same steps, and never reuse another store's URL."}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Create Client Account */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn("w-full max-w-md rounded-3xl border border-white/10 bg-ink-950 p-6 space-y-4", isRtl ? "text-right" : "text-left")} dir={isRtl ? "rtl" : "ltr"}>
            <h4 className={cn("text-lg font-bold text-white flex items-center gap-2", isRtl ? "justify-start" : "justify-start flex-row-reverse")}>
              <Plus className="h-5 w-5 text-cyan-400" />
              <span>{isRtl ? "إنشاء حساب مشترك جديد" : "Register New Subscriber Account"}</span>
            </h4>
            <p className="text-xs text-white/50">
              {isRtl 
                ? "قم بتعبئة بيانات المشترك وسيتم تنشيط حسابه وصناعة قالب البيانات الخاص به تلقائياً." 
                : "Fill out the fields. The company account will be provisioned and templates generated automatically."}
            </p>

            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">{isRtl ? "اسم المستخدم (Username)" : "Username"}</label>
                <Input 
                  value={newClientUsername} 
                  onChange={(e) => setNewClientUsername(e.target.value)}
                  placeholder={isRtl ? "مثال: custom_shop" : "e.g. custom_shop"}
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">{isRtl ? "البريد الإلكتروني" : "Email Address"}</label>
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
                <label className="text-xs font-semibold text-white/70 block">{isRtl ? "كلمة المرور البدئية" : "Initial Password"}</label>
                <Input 
                  type="password" 
                  value={newClientPassword} 
                  onChange={(e) => setNewClientPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">{isRtl ? "اسم النشاط التجاري (Business Name)" : "Business Name"}</label>
                <Input 
                  value={newClientBusinessName} 
                  onChange={(e) => setNewClientBusinessName(e.target.value)}
                  placeholder={isRtl ? "مثال: معرض الهدى للسيارات" : "e.g. Al Hoda Cars showroom"} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">{isRtl ? "نوع النشاط (Template)" : "Business Type (Template)"}</label>
                <select
                  value={newClientBusinessType}
                  onChange={(e) => setNewClientBusinessType(e.target.value)}
                  className={cn(
                    "h-11 w-full rounded-2xl border border-white/10 bg-[#16161a] px-4 text-sm text-white outline-none cursor-pointer appearance-none",
                    isRtl ? "text-right" : "text-left"
                  )}
                >
                  {businessTypes.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.group ? `${item.group} - ` : ""}{item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={cn("flex gap-2 pt-2", isRtl ? "justify-end" : "justify-start")}>
                <Button variant="ghost" type="button" onClick={() => setShowCreateModal(false)}>
                  {isRtl ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={creatingClient}>
                  {creatingClient ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mx-2" />
                      <span>{isRtl ? "جاري الإنشاء..." : "Creating..."}</span>
                    </>
                  ) : (
                    <span>{isRtl ? "تأكيد وإنشاء الحساب" : "Confirm and Create Account"}</span>
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
          <div className={cn("w-full max-w-md rounded-3xl border border-white/10 bg-ink-950 p-6 space-y-4", isRtl ? "text-right" : "text-left")} dir={isRtl ? "rtl" : "ltr"}>
            <h4 className={cn("text-lg font-bold text-white flex items-center gap-2", isRtl ? "justify-start" : "justify-start flex-row-reverse")}>
              <Key className="h-5 w-5 text-amber-400" />
              <span>{isRtl ? "تغيير كلمة مرور المشترك" : "Change Subscriber Password"}</span>
            </h4>
            <p className="text-xs text-white/50">
              {isRtl 
                ? "أدخل كلمة المرور الجديدة للحساب. ننصح باختيار كلمة مرور قوية." 
                : "Enter the new account password. We recommend a strong, random password."}
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">{isRtl ? "كلمة المرور الجديدة" : "New Password"}</label>
                <Input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                />
              </div>

              <div className={cn("flex gap-2 pt-2", isRtl ? "justify-end" : "justify-start")}>
                <Button variant="ghost" type="button" onClick={() => setResettingClientId(null)}>
                  {isRtl ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={processingPasswordReset}>
                  {processingPasswordReset ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mx-2" />
                      <span>{isRtl ? "جاري التحديث..." : "Updating..."}</span>
                    </>
                  ) : (
                    <span>{isRtl ? "حفظ التعديل" : "Save Changes"}</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Client Persona */}
      {editingClientPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={cn("w-full max-w-2xl rounded-3xl border border-white/10 bg-ink-950 p-6 space-y-4", isRtl ? "text-right" : "text-left")} dir={isRtl ? "rtl" : "ltr"}>
            <h4 className={cn("text-lg font-bold text-white flex items-center gap-2", isRtl ? "justify-start" : "justify-start flex-row-reverse")}>
              <Bot className="h-5 w-5 text-cyan-400" />
              <span>{isRtl ? "تعديل سلوك العميل والذكاء الاصطناعي (AI Persona)" : "Edit Client AI Persona Behavior"}</span>
            </h4>
            <p className="text-xs text-white/50 font-medium">
              {isRtl 
                ? `قم بتخصيص السلوك العام والمكالمات ونبرة الرد لوكيل الذكاء الاصطناعي الخاص بالعميل @${editingClientPrompt.username}.`
                : `Customize the general behavior parameters and reply tone of the AI agent for @${editingClientPrompt.username}.`}
            </p>

            <form onSubmit={handleSaveClientPrompt} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white/70 block">{isRtl ? "البرومبت الشخصي (AI Persona Override)" : "AI Persona Override Prompt"}</label>
                <Textarea 
                  value={clientPromptText} 
                  onChange={(e) => setClientPromptText(e.target.value)}
                  placeholder={isRtl ? "مثال: أنت موظف خدمة عملاء ودود لمتجر عطور، تجيب باختصار وترحب بالعميل بلهجة سعودية..." : "e.g. You are a friendly customer service agent for a perfume store, answer briefly and use a helpful tone..."} 
                  className={cn("min-h-72 text-sm leading-6 bg-white/[0.03] border-white/10", isRtl ? "text-right" : "text-left")}
                  required 
                />
                <span className="text-[10px] text-white/30 block mt-1">
                  {isRtl 
                    ? "ملاحظة: هذا النص يحدد السلوك المحلي للوكيل للمتجر المحدد فقط، مع الاحتفاظ بقواعد الأمان الشاملة للمنصة." 
                    : "Note: This prompt overrides behavior for this specific subscriber only, while global platform safety checks remain active."}
                </span>
              </div>

              <div className={cn("flex gap-2 pt-2", isRtl ? "justify-end" : "justify-start")}>
                <Button variant="ghost" type="button" onClick={() => setEditingClientPrompt(null)}>
                  {isRtl ? "إلغاء" : "Cancel"}
                </Button>
                <Button type="submit" disabled={savingClientPrompt}>
                  {savingClientPrompt ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mx-2" />
                      <span>{isRtl ? "جاري الحفظ..." : "Saving..."}</span>
                    </>
                  ) : (
                    <span>{isRtl ? "حفظ وتطبيق البرومبت" : "Save & Apply Persona"}</span>
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
