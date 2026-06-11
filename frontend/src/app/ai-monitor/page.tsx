"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Database,
  Eye,
  Filter,
  Gauge,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";

type TraceToolCall = {
  round?: number;
  name?: string;
  args?: Record<string, unknown>;
  result_summary?: Record<string, unknown>;
};

type FactGuardTrace = {
  triggered?: boolean;
  reasons?: string[];
  missing_numbers?: string[];
  added_numbers?: string[];
  missing_products?: string[];
  added_products?: string[];
};

type VerificationStepTrace = {
  verdict?: string;
  risk_score?: number;
  reasons?: string[];
  flagged_claims?: string[];
};

type AITrace = {
  intent?: string;
  router_text?: string;
  allowed_tools?: string[];
  tool_calls?: TraceToolCall[];
  tool_rounds?: number;
  max_tool_rounds?: number;
  finish_reason?: string;
  retrieved_keys?: string[];
  model?: string;
  local_llm_enabled?: boolean;
  fact_guard?: FactGuardTrace;
  verification?: {
    initial?: VerificationStepTrace;
    after_repair?: VerificationStepTrace;
  };
  repair?: {
    attempted?: boolean;
    trigger_verdict?: string;
    supplemental_tools?: TraceToolCall[];
    supplemental_keys?: string[];
    retry_generated?: boolean;
    retry_fact_guard?: {
      triggered?: boolean;
      reasons?: string[];
    };
  };
  final?: {
    action?: string;
    verdict?: string;
    risk_score?: number;
    answer_length?: number;
  };
};

type VerificationLog = {
  id: string;
  message_id?: string | null;
  session_id: string;
  customer_message: string;
  draft_answer: string;
  final_answer: string;
  verifier_status: string;
  risk_score: number;
  reasons: string[];
  flagged_claims: string[];
  grounding_data_used: string[];
  final_action: string;
  created_at?: string | null;
  ai_trace?: AITrace;
};

type VerificationPayload = {
  ok: boolean;
  logs: VerificationLog[];
  stats: {
    total: number;
    by_status: Record<string, number>;
  };
};

function formatDate(value?: string | null, isRtl = true) {
  if (!value) return isRtl ? "غير معروف" : "Unknown";
  try {
    return new Intl.DateTimeFormat(isRtl ? "ar-JO" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function compactJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value);
  }
}

function shortValue(value: unknown, isRtl = true) {
  if (typeof value === "boolean") return value ? (isRtl ? "نعم" : "Yes") : (isRtl ? "لا" : "No");
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return isRtl ? `${value.length} عنصر` : `${value.length} item(s)`;
  if (value && typeof value === "object") return JSON.stringify(value);
  return isRtl ? "فارغ" : "Empty";
}

function getStatusMeta(status: string, isRtl: boolean) {
  switch (status) {
    case "SAFE_TO_SEND":
      return {
        label: isRtl ? "آمن للإرسال" : "Safe to Send",
        icon: CheckCircle2,
        className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      };
    case "NEEDS_MORE_DATA":
      return {
        label: isRtl ? "يحتاج بيانات" : "Needs More Data",
        icon: Database,
        className: "border-amber-400/25 bg-amber-500/10 text-amber-200",
      };
    case "TOOL_RESULT_REQUIRED":
      return {
        label: isRtl ? "أداة مطلوبة" : "Tool Required",
        icon: Wrench,
        className: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
      };
    case "HUMAN_HANDOFF_REQUIRED":
      return {
        label: isRtl ? "تحويل بشري" : "Human Handoff",
        icon: ShieldAlert,
        className: "border-orange-400/25 bg-orange-500/10 text-orange-200",
      };
    case "BLOCKED_UNGROUNDED_ANSWER":
      return {
        label: isRtl ? "محظور" : "Blocked (Ungrounded)",
        icon: XCircle,
        className: "border-red-400/25 bg-red-500/10 text-red-200",
      };
    default:
      return {
        label: status.replaceAll("_", " "),
        icon: Activity,
        className: "border-white/10 bg-white/8 text-white/70",
      };
  }
}

function getActionLabel(action?: string, isRtl = true) {
  switch (action) {
    case "sent":
      return isRtl ? "أُرسل كما هو" : "Sent as is";
    case "modified":
      return isRtl ? "تم تعديله" : "Modified";
    case "blocked":
      return isRtl ? "تم حجبه" : "Blocked";
    case "handoff":
      return isRtl ? "تحويل بشري" : "Handoff";
    case "clarification":
      return isRtl ? "طلب توضيح" : "Clarification";
    default:
      return action || (isRtl ? "غير محدد" : "Not specified");
  }
}

function riskClass(score: number) {
  if (score >= 0.75) return "text-red-200";
  if (score >= 0.45) return "text-amber-200";
  return "text-emerald-200";
}

function LocalStatusBadge({ status, isRtl }: { status: string; isRtl: boolean }) {
  const meta = getStatusMeta(status, isRtl);
  const Icon = meta.icon;
  return (
    <Badge className={cn("whitespace-nowrap", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

function SummaryChips({ data, isRtl }: { data?: Record<string, unknown>; isRtl: boolean }) {
  const entries = Object.entries(data || {});
  if (!entries.length) {
    return <span className="text-xs text-white/35">{isRtl ? "لا توجد خلاصة" : "No summary"}</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", isRtl ? "justify-end" : "justify-start")}>
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="max-w-full rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65"
        >
          <span className="text-white/38">{key}: </span>
          <span className="break-words">{shortValue(value, isRtl)}</span>
        </span>
      ))}
    </div>
  );
}

function ToolList({ title, tools, isRtl }: { title: string; tools?: TraceToolCall[]; isRtl: boolean }) {
  const items = Array.isArray(tools) ? tools : [];
  if (!items.length) return null;

  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-2 text-sm font-semibold text-white", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
        <span>{title}</span>
        <Wrench className="h-4 w-4 text-cyan-400" />
      </div>
      <div className="space-y-2">
        {items.map((tool, index) => (
          <div key={`${tool.name || "tool"}-${index}`} className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-3", isRtl ? "text-right" : "text-left")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-white/38">Round {tool.round || 1}</span>
              <span className="font-mono text-sm font-semibold text-cyan-100">{tool.name || "unknown_tool"}</span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-black/18 p-3">
                <div className={cn("mb-2 text-[11px] font-semibold text-white/38", isRtl ? "text-right" : "text-left")}>
                  {isRtl ? "المدخلات" : "Inputs"}
                </div>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-left text-[11px] leading-5 text-white/60">
                  {compactJson(tool.args)}
                </pre>
              </div>
              <div className="rounded-xl bg-black/18 p-3">
                <div className={cn("mb-2 text-[11px] font-semibold text-white/38", isRtl ? "text-right" : "text-left")}>
                  {isRtl ? "خلاصة النتيجة" : "Result Summary"}
                </div>
                <SummaryChips data={tool.result_summary} isRtl={isRtl} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceTimeline({ log, isRtl }: { log: VerificationLog; isRtl: boolean }) {
  const trace = log.ai_trace || {};
  const repair = trace.repair || {};
  const factGuard = trace.fact_guard || {};
  const afterRepair = trace.verification?.after_repair;
  const toolCalls = Array.isArray(trace.tool_calls) ? trace.tool_calls : [];
  const retryTools = Array.isArray(repair.supplemental_tools) ? repair.supplemental_tools : [];

  return (
    <div className="space-y-5 border-t border-white/10 pt-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
          <div className={cn("mb-3 flex items-center gap-2 text-xs font-semibold text-white/45", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
            <span>{isRtl ? "التوجيه" : "Routing Intent"}</span>
            <GitBranch className="h-4 w-4 text-primary-400" />
          </div>
          <div className="text-lg font-semibold text-white">{trace.intent || (isRtl ? "غير معروف" : "Unknown")}</div>
          <div className="mt-2 text-xs leading-5 text-white/45">
            {(trace.allowed_tools || []).length ? (trace.allowed_tools || []).join(", ") : (isRtl ? "بدون أدوات" : "No tools")}
          </div>
        </div>

        <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
          <div className={cn("mb-3 flex items-center gap-2 text-xs font-semibold text-white/45", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
            <span>{isRtl ? "الأدوات" : "Tools"}</span>
            <Database className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-lg font-semibold text-white">{toolCalls.length}</div>
          <div className="mt-2 text-xs leading-5 text-white/45">
            {isRtl 
              ? `${trace.tool_rounds || 0} من ${trace.max_tool_rounds || 0} جولات` 
              : `${trace.tool_rounds || 0} of ${trace.max_tool_rounds || 0} rounds`}
          </div>
        </div>

        <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
          <div className={cn("mb-3 flex items-center gap-2 text-xs font-semibold text-white/45", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
            <span>{isRtl ? "حارس الحقائق" : "Fact Guard"}</span>
            <ShieldCheck className="h-4 w-4 text-primary-400" />
          </div>
          <div className={cn("text-lg font-semibold", factGuard.triggered ? "text-amber-200" : "text-white")}>
            {factGuard.triggered ? (isRtl ? "تدخل" : "Triggered") : (isRtl ? "سليم" : "Clean")}
          </div>
          <div className="mt-2 text-xs leading-5 text-white/45 font-medium">
            {(factGuard.reasons || [])[0] || (isRtl ? "لم يغير الحقائق الحساسة" : "No sensitive fact changes")}
          </div>
        </div>

        <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
          <div className={cn("mb-3 flex items-center gap-2 text-xs font-semibold text-white/45", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
            <span>{isRtl ? "الإصلاح" : "Self Repair"}</span>
            <Wrench className="h-4 w-4 text-amber-300" />
          </div>
          <div className={cn("text-lg font-semibold", repair.attempted ? "text-amber-200" : "text-white")}>
            {repair.attempted ? (isRtl ? "تمت محاولة" : "Attempted") : (isRtl ? "لم يحتج" : "Not needed")}
          </div>
          <div className="mt-2 text-xs leading-5 text-white/45">
            {afterRepair?.verdict ? (isRtl ? `النتيجة: ${afterRepair.verdict}` : `Result: ${afterRepair.verdict}`) : (isRtl ? "لا يوجد تحقق ثان" : "No secondary check")}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ToolList title={isRtl ? "أدوات الجولة الأولى" : "First Round Tools"} tools={toolCalls} isRtl={isRtl} />
        <ToolList title={isRtl ? "أدوات الإصلاح" : "Repair Tools"} tools={retryTools} isRtl={isRtl} />
      </div>

      {(log.reasons?.length || log.flagged_claims?.length || factGuard.triggered || repair.retry_fact_guard?.triggered) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
            <div className={cn("mb-3 flex items-center gap-2 text-sm font-semibold text-white", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
              <span>{isRtl ? "أسباب التحقق" : "Verification Reasons"}</span>
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </div>
            <div className="space-y-2 text-xs leading-5 text-white/60">
              {(log.reasons || []).length ? log.reasons.map((reason) => <div key={reason}>{reason}</div>) : <div>{isRtl ? "لا توجد أسباب مسجلة" : "No reasons recorded"}</div>}
            </div>
          </div>

          <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
            <div className={cn("mb-3 flex items-center gap-2 text-sm font-semibold text-white", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
              <span>{isRtl ? "ادعاءات مرفوضة" : "Flagged Claims"}</span>
              <XCircle className="h-4 w-4 text-red-300" />
            </div>
            <div className="space-y-2 text-xs leading-5 text-white/60">
              {(log.flagged_claims || []).length ? log.flagged_claims.map((claim) => <div key={claim}>{claim}</div>) : <div>{isRtl ? "لا توجد ادعاءات مرفوضة" : "No flagged claims"}</div>}
            </div>
          </div>

          <div className={cn("rounded-2xl border border-white/10 bg-white/[0.035] p-4", isRtl ? "text-right" : "text-left")}>
            <div className={cn("mb-3 flex items-center gap-2 text-sm font-semibold text-white", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
              <span>{isRtl ? "تغيرات الحقائق" : "Fact Guard Actions"}</span>
              <ShieldAlert className="h-4 w-4 text-orange-300" />
            </div>
            <div className="space-y-2 text-xs leading-5 text-white/60">
              {[...(factGuard.added_numbers || []), ...(factGuard.missing_numbers || []), ...(factGuard.added_products || []), ...(factGuard.missing_products || [])].length ? (
                <>
                  {(factGuard.added_numbers || []).map((item) => <div key={`add-number-${item}`}>{isRtl ? `أضيف رقم: ${item}` : `Added number: ${item}`}</div>)}
                  {(factGuard.missing_numbers || []).map((item) => <div key={`missing-number-${item}`}>{isRtl ? `حذف رقم: ${item}` : `Removed number: ${item}`}</div>)}
                  {(factGuard.added_products || []).map((item) => <div key={`add-product-${item}`}>{isRtl ? `أضيف منتج: ${item}` : `Added product: ${item}`}</div>)}
                  {(factGuard.missing_products || []).map((item) => <div key={`missing-product-${item}`}>{isRtl ? `حذف منتج: ${item}` : `Removed product: ${item}`}</div>)}
                </>
              ) : (
                <div>{isRtl ? "لا توجد تغييرات حساسة" : "No sensitive modifications"}</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <details className={cn("rounded-2xl border border-white/10 bg-black/16 p-4", isRtl ? "text-right" : "text-left")}>
        <summary className="cursor-pointer text-sm font-semibold text-white/70">
          {isRtl ? "عرض trace الخام" : "View Raw Trace Payload"}
        </summary>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/24 p-4 text-left text-xs leading-5 text-white/62">
          {compactJson(trace)}
        </pre>
      </details>
    </div>
  );
}

function LogCard({
  log,
  expanded,
  onToggle,
  isRtl,
}: {
  log: VerificationLog;
  expanded: boolean;
  onToggle: () => void;
  isRtl: boolean;
}) {
  const trace = log.ai_trace || {};
  const toolCount = (trace.tool_calls || []).length + (trace.repair?.supplemental_tools || []).length;

  return (
    <div className={cn("rounded-3xl border border-white/10 bg-white/[0.035] p-5", isRtl ? "text-right" : "text-left")}>
      <div className={cn("flex flex-wrap items-start gap-3", isRtl ? "justify-between" : "justify-between flex-row-reverse")}>
        <div className={cn("flex flex-wrap items-center gap-2", isRtl ? "flex-row" : "flex-row-reverse")}>
          <Button type="button" variant="secondary" size="sm" onClick={onToggle}>
            <Eye className="h-4 w-4" />
            {expanded ? (isRtl ? "إخفاء التفاصيل" : "Hide Details") : (isRtl ? "التفاصيل" : "View Details")}
          </Button>
          <Badge className="border-white/10 bg-white/[0.04] text-white/55">
            {formatDate(log.created_at, isRtl)}
          </Badge>
        </div>

        <div className={cn("flex flex-wrap items-center gap-2", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
          <Badge className={cn("border-white/10 bg-white/[0.04]", riskClass(log.risk_score))}>
            Risk {Number(log.risk_score || 0).toFixed(2)}
          </Badge>
          <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
            {getActionLabel(log.final_action, isRtl)}
          </Badge>
          <LocalStatusBadge status={log.verifier_status} isRtl={isRtl} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/12 p-4">
          <div className={cn("mb-2 flex items-center gap-2 text-xs font-semibold text-white/38", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
            <span>{isRtl ? "رسالة العميل" : "Customer Message"}</span>
            <Activity className="h-4 w-4" />
          </div>
          <p className={cn("max-h-36 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-white/78", isRtl ? "text-right" : "text-left")}>
            {log.customer_message || (isRtl ? "لا توجد رسالة" : "No message body")}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/12 p-4">
          <div className={cn("mb-2 flex items-center gap-2 text-xs font-semibold text-white/38", isRtl ? "justify-end" : "justify-start flex-row-reverse")}>
            <span>{isRtl ? "الرد النهائي" : "Final Answer"}</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <p className={cn("max-h-36 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-white/78", isRtl ? "text-right" : "text-left")}>
            {log.final_answer || (isRtl ? "لا يوجد رد نهائي" : "No final answer")}
          </p>
        </div>
      </div>

      <div className={cn("mt-4 flex flex-wrap gap-2", isRtl ? "justify-end" : "justify-start")}>
        <Badge className="border-white/10 bg-white/[0.04] text-white/58">
          {isRtl ? `التوجيه: ${trace.intent || "غير معروف"}` : `Intent: ${trace.intent || "Unknown"}`}
        </Badge>
        <Badge className="border-white/10 bg-white/[0.04] text-white/58">
          {isRtl ? `الأدوات: ${toolCount}` : `Tools: ${toolCount}`}
        </Badge>
        <Badge className="border-white/10 bg-white/[0.04] text-white/58">
          {isRtl ? `الموديل: ${trace.model || "غير معروف"}` : `Model: ${trace.model || "Unknown"}`}
        </Badge>
        {trace.fact_guard?.triggered ? (
          <Badge className="border-amber-400/25 bg-amber-500/10 text-amber-200">Fact Guard</Badge>
        ) : null}
        {trace.repair?.attempted ? (
          <Badge className="border-cyan-400/25 bg-cyan-500/10 text-cyan-200">Repair Pass</Badge>
        ) : null}
      </div>

      {expanded ? <TraceTimeline log={log} isRtl={isRtl} /> : null}
    </div>
  );
}

export default function AIMonitorPage() {
  const { token } = useAuthStore();
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [payload, setPayload] = useState<VerificationPayload | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const STATUS_FILTERS = useMemo(() => [
    { value: "all", label: isRtl ? "الكل" : "All" },
    { value: "SAFE_TO_SEND", label: isRtl ? "آمن" : "Safe" },
    { value: "NEEDS_MORE_DATA", label: isRtl ? "بيانات ناقصة" : "Needs Data" },
    { value: "TOOL_RESULT_REQUIRED", label: isRtl ? "يحتاج أداة" : "Needs Tool" },
    { value: "HUMAN_HANDOFF_REQUIRED", label: isRtl ? "تحويل بشري" : "Handoff" },
    { value: "BLOCKED_UNGROUNDED_ANSWER", label: isRtl ? "محظور" : "Blocked" },
  ], [isRtl]);

  const loadLogs = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (!token) return;
      if (mode === "initial") setLoading(true);
      setRefreshing(true);
      setError("");

      const params = new URLSearchParams({ limit: "120" });
      if (statusFilter !== "all") {
        params.set("verifier_status", statusFilter);
      }

      try {
        const res = await apiClient.get<VerificationPayload>(`/verification-logs?${params.toString()}`);
        setPayload(res.data);
        setExpandedId((current) => current ?? res.data.logs?.[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        setError(isRtl ? "تعذر تحميل سجلات مراقبة الذكاء." : "Failed to load AI verification logs.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, token, isRtl],
  );

  useEffect(() => {
    void loadLogs("initial");
  }, [loadLogs]);

  const logs = payload?.logs || [];
  const filteredLogs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => {
      const trace = log.ai_trace || {};
      return [
        log.customer_message,
        log.final_answer,
        log.session_id,
        log.verifier_status,
        log.final_action,
        trace.intent,
        trace.model,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [logs, query]);

  const metrics = useMemo(() => {
    const counts = payload?.stats?.by_status || {};
    const total = payload?.stats?.total || logs.length;
    const safe = counts.SAFE_TO_SEND || 0;
    const blocked =
      (counts.BLOCKED_UNGROUNDED_ANSWER || 0) +
      (counts.HUMAN_HANDOFF_REQUIRED || 0) +
      (counts.NEEDS_MORE_DATA || 0) +
      (counts.TOOL_RESULT_REQUIRED || 0);
    const averageRisk = logs.length
      ? logs.reduce((sum, log) => sum + Number(log.risk_score || 0), 0) / logs.length
      : 0;
    const repairAttempts = logs.filter((log) => log.ai_trace?.repair?.attempted).length;
    const repairedSafe = logs.filter(
      (log) => log.ai_trace?.repair?.attempted && log.ai_trace?.final?.verdict === "SAFE_TO_SEND",
    ).length;
    const factGuardHits = logs.filter(
      (log) => log.ai_trace?.fact_guard?.triggered || log.ai_trace?.repair?.retry_fact_guard?.triggered,
    ).length;
    const toolUsage = logs.filter(
      (log) => (log.ai_trace?.tool_calls || []).length + (log.ai_trace?.repair?.supplemental_tools || []).length > 0,
    ).length;

    return {
      total,
      safe,
      blocked,
      safeRate: percent(safe, total),
      blockedRate: percent(blocked, total),
      averageRisk,
      repairAttempts,
      repairedSafe,
      factGuardHits,
      toolUsage,
    };
  }, [logs, payload?.stats?.by_status, payload?.stats?.total]);

  if (loading) {
    return (
      <AppShell 
        title={isRtl ? "مراقبة الذكاء" : "AI Monitor"} 
        subtitle={isRtl ? "سجل قرارات الوكيل، أدواته، وحواجز السلامة قبل إرسال الرد للعميل." : "AI agent decisions, tool logs, and safety guardrails summary."}
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title={isRtl ? "مراقبة الذكاء" : "AI Monitor"} 
      subtitle={isRtl ? "قراءة تشغيلية لكل رد: التوجيه، الأدوات، التحقق، الإصلاح، والنتيجة النهائية." : "Operational diagnostics: intent routing, tools usage, verification, self-repair, and outcomes."}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <GradientCard>
            <div className="flex items-center justify-between">
              <BrainCircuit className="h-5 w-5 text-primary-400" />
              <span className="text-xs font-semibold text-white/42">{isRtl ? "إجمالي" : "Total"}</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.total}</div>
            <div className="mt-1 text-sm text-white/55">{isRtl ? "عمليات تحقق" : "Verifications"}</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <span className="text-xs font-semibold text-white/42">{metrics.safeRate}</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.safe}</div>
            <div className="mt-1 text-sm text-white/55">{isRtl ? "ردود آمنة" : "Safe Replies"}</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <Gauge className="h-5 w-5 text-cyan-400" />
              <span className="text-xs font-semibold text-white/42">{isRtl ? `آخر ${logs.length}` : `Last ${logs.length}`}</span>
            </div>
            <div className={cn("mt-5 text-3xl font-semibold", riskClass(metrics.averageRisk))}>
              {metrics.averageRisk.toFixed(2)}
            </div>
            <div className="mt-1 text-sm text-white/55">{isRtl ? "متوسط الخطر" : "Avg Risk Score"}</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <Wrench className="h-5 w-5 text-amber-300" />
              <span className="text-xs font-semibold text-white/42">{isRtl ? `${metrics.repairedSafe} نجح` : `${metrics.repairedSafe} Success`}</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.repairAttempts}</div>
            <div className="mt-1 text-sm text-white/55">{isRtl ? "محاولات إصلاح" : "Repair Passes"}</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-5 w-5 text-red-300" />
              <span className="text-xs font-semibold text-white/42">{metrics.blockedRate}</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.blocked}</div>
            <div className="mt-1 text-sm text-white/55">{isRtl ? "حالات تدخل" : "Safety Actions"}</div>
          </GradientCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-6">
            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <Filter className="h-5 w-5 text-primary-400" />
                <h2 className="text-lg font-semibold text-white">{isRtl ? "الفلاتر" : "Filters"}</h2>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search className={cn("pointer-events-none absolute top-3 h-4 w-4 text-white/35", isRtl ? "right-3" : "left-3")} />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={isRtl ? "ابحث في الرسائل أو الجلسات" : "Search logs or sessions..."}
                    className={cn(isRtl ? "pr-10 text-right" : "pl-10 text-left")}
                  />
                </div>

                <div className={cn("flex flex-wrap gap-2", isRtl ? "justify-end" : "justify-start")}>
                  {STATUS_FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(item.value);
                        setExpandedId(null);
                      }}
                      className={cn(
                        "rounded-2xl px-3 py-2 text-xs font-semibold transition",
                        statusFilter === item.value
                          ? "bg-primary-500 text-ink-950 shadow-glow"
                          : "bg-white/7 text-white/60 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <Button type="button" variant="secondary" className="w-full" onClick={() => void loadLogs()} disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {isRtl ? "تحديث السجلات" : "Refresh Log Grid"}
                </Button>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <Activity className="h-5 w-5 text-cyan-400" />
                <h2 className="text-lg font-semibold text-white">{isRtl ? "نبض النظام" : "System Pulse"}</h2>
              </div>
              <div className={cn("space-y-3", isRtl ? "text-right" : "text-left")}>
                {[
                  [isRtl ? "استخدام الأدوات" : "Tool Usage Rate", isRtl ? `${metrics.toolUsage} من ${logs.length}` : `${metrics.toolUsage} of ${logs.length}`],
                  [isRtl ? "حارس الحقائق تدخل" : "Fact Guard Escapes", String(metrics.factGuardHits)],
                  [isRtl ? "الردود غير الآمنة" : "Blocked Unsafe Answers", String(metrics.blocked)],
                  [isRtl ? "نسبة الأمان" : "Safety Pass Rate", metrics.safeRate],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
                    {isRtl ? (
                      <>
                        <span className="font-semibold text-white">{value}</span>
                        <span className="text-white/52">{label}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-white/52">{label}</span>
                        <span className="font-semibold text-white">{value}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </GradientCard>
          </div>

          <div className="space-y-4">
            {error ? (
              <div className={cn("rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-semibold text-red-100", isRtl ? "text-right" : "text-left")}>
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-white/45">
                {isRtl ? `${filteredLogs.length} نتيجة معروضة` : `${filteredLogs.length} verifications displayed`}
              </span>
              <h2 className="text-xl font-semibold text-white">{isRtl ? "آخر قرارات الوكيل" : "Recent Decisions Stack"}</h2>
            </div>

            {filteredLogs.length ? (
              <div className="custom-scrollbar max-h-[70vh] space-y-4 overflow-y-auto pl-1 pr-2 xl:max-h-[calc(100vh-260px)]">
                {filteredLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    expanded={expandedId === log.id}
                    onToggle={() => setExpandedId((current) => (current === log.id ? null : log.id))}
                    isRtl={isRtl}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.025] text-center">
                <BrainCircuit className="h-10 w-10 text-white/30" />
                <p className="mt-4 text-sm text-white/50">{isRtl ? "لا توجد سجلات تحقق مطابقة الآن." : "No matching verification logs found."}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
