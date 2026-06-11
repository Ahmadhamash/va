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

const STATUS_FILTERS = [
  { value: "all", label: "الكل" },
  { value: "SAFE_TO_SEND", label: "آمن" },
  { value: "NEEDS_MORE_DATA", label: "بيانات ناقصة" },
  { value: "TOOL_RESULT_REQUIRED", label: "يحتاج أداة" },
  { value: "HUMAN_HANDOFF_REQUIRED", label: "تحويل بشري" },
  { value: "BLOCKED_UNGROUNDED_ANSWER", label: "محظور" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "غير معروف";
  try {
    return new Intl.DateTimeFormat("ar-JO", {
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

function shortValue(value: unknown) {
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `${value.length} عنصر`;
  if (value && typeof value === "object") return JSON.stringify(value);
  return "فارغ";
}

function statusMeta(status: string) {
  switch (status) {
    case "SAFE_TO_SEND":
      return {
        label: "آمن للإرسال",
        icon: CheckCircle2,
        className: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
      };
    case "NEEDS_MORE_DATA":
      return {
        label: "يحتاج بيانات",
        icon: Database,
        className: "border-amber-400/25 bg-amber-500/10 text-amber-200",
      };
    case "TOOL_RESULT_REQUIRED":
      return {
        label: "أداة مطلوبة",
        icon: Wrench,
        className: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
      };
    case "HUMAN_HANDOFF_REQUIRED":
      return {
        label: "تحويل بشري",
        icon: ShieldAlert,
        className: "border-orange-400/25 bg-orange-500/10 text-orange-200",
      };
    case "BLOCKED_UNGROUNDED_ANSWER":
      return {
        label: "محظور",
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

function actionLabel(action?: string) {
  switch (action) {
    case "sent":
      return "أُرسل كما هو";
    case "modified":
      return "تم تعديله";
    case "blocked":
      return "تم حجبه";
    case "handoff":
      return "تحويل بشري";
    case "clarification":
      return "طلب توضيح";
    default:
      return action || "غير محدد";
  }
}

function riskClass(score: number) {
  if (score >= 0.75) return "text-red-200";
  if (score >= 0.45) return "text-amber-200";
  return "text-emerald-200";
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <Badge className={cn("whitespace-nowrap", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </Badge>
  );
}

function SummaryChips({ data }: { data?: Record<string, unknown> }) {
  const entries = Object.entries(data || {});
  if (!entries.length) {
    return <span className="text-xs text-white/35">لا توجد خلاصة</span>;
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="max-w-full rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-white/65"
        >
          <span className="text-white/38">{key}: </span>
          <span className="break-words">{shortValue(value)}</span>
        </span>
      ))}
    </div>
  );
}

function ToolList({ title, tools }: { title: string; tools?: TraceToolCall[] }) {
  const items = Array.isArray(tools) ? tools : [];
  if (!items.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2 text-sm font-semibold text-white">
        <span>{title}</span>
        <Wrench className="h-4 w-4 text-cyanx-400" />
      </div>
      <div className="space-y-2">
        {items.map((tool, index) => (
          <div key={`${tool.name || "tool"}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-right">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-white/38">Round {tool.round || 1}</span>
              <span className="font-mono text-sm font-semibold text-cyan-100">{tool.name || "unknown_tool"}</span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl bg-black/18 p-3">
                <div className="mb-2 text-[11px] font-semibold text-white/38">المدخلات</div>
                <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words text-left text-[11px] leading-5 text-white/60">
                  {compactJson(tool.args)}
                </pre>
              </div>
              <div className="rounded-xl bg-black/18 p-3">
                <div className="mb-2 text-[11px] font-semibold text-white/38">خلاصة النتيجة</div>
                <SummaryChips data={tool.result_summary} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceTimeline({ log }: { log: VerificationLog }) {
  const trace = log.ai_trace || {};
  const repair = trace.repair || {};
  const factGuard = trace.fact_guard || {};
  const afterRepair = trace.verification?.after_repair;
  const toolCalls = Array.isArray(trace.tool_calls) ? trace.tool_calls : [];
  const retryTools = Array.isArray(repair.supplemental_tools) ? repair.supplemental_tools : [];

  return (
    <div className="space-y-5 border-t border-white/10 pt-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
          <div className="mb-3 flex items-center justify-end gap-2 text-xs font-semibold text-white/45">
            <span>التوجيه</span>
            <GitBranch className="h-4 w-4 text-emeraldx-400" />
          </div>
          <div className="text-lg font-semibold text-white">{trace.intent || "غير معروف"}</div>
          <div className="mt-2 text-xs leading-5 text-white/45">
            {(trace.allowed_tools || []).length ? (trace.allowed_tools || []).join("، ") : "بدون أدوات"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
          <div className="mb-3 flex items-center justify-end gap-2 text-xs font-semibold text-white/45">
            <span>الأدوات</span>
            <Database className="h-4 w-4 text-cyanx-400" />
          </div>
          <div className="text-lg font-semibold text-white">{toolCalls.length}</div>
          <div className="mt-2 text-xs leading-5 text-white/45">
            {trace.tool_rounds || 0} من {trace.max_tool_rounds || 0} جولات
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
          <div className="mb-3 flex items-center justify-end gap-2 text-xs font-semibold text-white/45">
            <span>حارس الحقائق</span>
            <ShieldCheck className="h-4 w-4 text-emeraldx-400" />
          </div>
          <div className={cn("text-lg font-semibold", factGuard.triggered ? "text-amber-200" : "text-white")}>
            {factGuard.triggered ? "تدخل" : "سليم"}
          </div>
          <div className="mt-2 text-xs leading-5 text-white/45">
            {(factGuard.reasons || [])[0] || "لم يغير الحقائق الحساسة"}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
          <div className="mb-3 flex items-center justify-end gap-2 text-xs font-semibold text-white/45">
            <span>الإصلاح</span>
            <Wrench className="h-4 w-4 text-amber-300" />
          </div>
          <div className={cn("text-lg font-semibold", repair.attempted ? "text-amber-200" : "text-white")}>
            {repair.attempted ? "تمت محاولة" : "لم يحتج"}
          </div>
          <div className="mt-2 text-xs leading-5 text-white/45">
            {afterRepair?.verdict ? `النتيجة: ${afterRepair.verdict}` : "لا يوجد تحقق ثان"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ToolList title="أدوات الجولة الأولى" tools={toolCalls} />
        <ToolList title="أدوات الإصلاح" tools={retryTools} />
      </div>

      {(log.reasons?.length || log.flagged_claims?.length || factGuard.triggered || repair.retry_fact_guard?.triggered) ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
            <div className="mb-3 flex items-center justify-end gap-2 text-sm font-semibold text-white">
              <span>أسباب التحقق</span>
              <AlertTriangle className="h-4 w-4 text-amber-300" />
            </div>
            <div className="space-y-2 text-xs leading-5 text-white/60">
              {(log.reasons || []).length ? log.reasons.map((reason) => <div key={reason}>{reason}</div>) : <div>لا توجد أسباب مسجلة</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
            <div className="mb-3 flex items-center justify-end gap-2 text-sm font-semibold text-white">
              <span>ادعاءات مرفوضة</span>
              <XCircle className="h-4 w-4 text-red-300" />
            </div>
            <div className="space-y-2 text-xs leading-5 text-white/60">
              {(log.flagged_claims || []).length ? log.flagged_claims.map((claim) => <div key={claim}>{claim}</div>) : <div>لا توجد ادعاءات مرفوضة</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
            <div className="mb-3 flex items-center justify-end gap-2 text-sm font-semibold text-white">
              <span>تغيرات الحقائق</span>
              <ShieldAlert className="h-4 w-4 text-orange-300" />
            </div>
            <div className="space-y-2 text-xs leading-5 text-white/60">
              {[...(factGuard.added_numbers || []), ...(factGuard.missing_numbers || []), ...(factGuard.added_products || []), ...(factGuard.missing_products || [])].length ? (
                <>
                  {(factGuard.added_numbers || []).map((item) => <div key={`add-number-${item}`}>أضيف رقم: {item}</div>)}
                  {(factGuard.missing_numbers || []).map((item) => <div key={`missing-number-${item}`}>حذف رقم: {item}</div>)}
                  {(factGuard.added_products || []).map((item) => <div key={`add-product-${item}`}>أضيف منتج: {item}</div>)}
                  {(factGuard.missing_products || []).map((item) => <div key={`missing-product-${item}`}>حذف منتج: {item}</div>)}
                </>
              ) : (
                <div>لا توجد تغييرات حساسة</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <details className="rounded-2xl border border-white/10 bg-black/16 p-4 text-right">
        <summary className="cursor-pointer text-sm font-semibold text-white/70">عرض trace الخام</summary>
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
}: {
  log: VerificationLog;
  expanded: boolean;
  onToggle: () => void;
}) {
  const trace = log.ai_trace || {};
  const toolCount = (trace.tool_calls || []).length + (trace.repair?.supplemental_tools || []).length;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 text-right">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onToggle}>
            <Eye className="h-4 w-4" />
            {expanded ? "إخفاء التفاصيل" : "التفاصيل"}
          </Button>
          <Badge className="border-white/10 bg-white/[0.04] text-white/55">
            {formatDate(log.created_at)}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge className={cn("border-white/10 bg-white/[0.04]", riskClass(log.risk_score))}>
            Risk {Number(log.risk_score || 0).toFixed(2)}
          </Badge>
          <Badge className="border-cyan-400/20 bg-cyan-500/10 text-cyan-100">
            {actionLabel(log.final_action)}
          </Badge>
          <StatusBadge status={log.verifier_status} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/12 p-4">
          <div className="mb-2 flex items-center justify-end gap-2 text-xs font-semibold text-white/38">
            <span>رسالة العميل</span>
            <Activity className="h-4 w-4" />
          </div>
          <p className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-white/78">
            {log.customer_message || "لا توجد رسالة"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/12 p-4">
          <div className="mb-2 flex items-center justify-end gap-2 text-xs font-semibold text-white/38">
            <span>الرد النهائي</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="max-h-36 overflow-auto whitespace-pre-wrap break-words text-sm leading-6 text-white/78">
            {log.final_answer || "لا يوجد رد نهائي"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Badge className="border-white/10 bg-white/[0.04] text-white/58">Intent: {trace.intent || "غير معروف"}</Badge>
        <Badge className="border-white/10 bg-white/[0.04] text-white/58">Tools: {toolCount}</Badge>
        <Badge className="border-white/10 bg-white/[0.04] text-white/58">Model: {trace.model || "غير معروف"}</Badge>
        {trace.fact_guard?.triggered ? (
          <Badge className="border-amber-400/25 bg-amber-500/10 text-amber-200">Fact guard</Badge>
        ) : null}
        {trace.repair?.attempted ? (
          <Badge className="border-cyan-400/25 bg-cyan-500/10 text-cyan-200">Repair pass</Badge>
        ) : null}
      </div>

      {expanded ? <TraceTimeline log={log} /> : null}
    </div>
  );
}

export default function AIMonitorPage() {
  const { token } = useAuthStore();
  const [payload, setPayload] = useState<VerificationPayload | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

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
        setError("تعذر تحميل سجلات مراقبة الذكاء.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [statusFilter, token],
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
      <AppShell title="مراقبة الذكاء" subtitle="سجل قرارات الوكيل، أدواته، وحواجز السلامة قبل إرسال الرد للعميل.">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="مراقبة الذكاء" subtitle="قراءة تشغيلية لكل رد: التوجيه، الأدوات، التحقق، الإصلاح، والنتيجة النهائية.">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <GradientCard>
            <div className="flex items-center justify-between">
              <BrainCircuit className="h-5 w-5 text-emeraldx-400" />
              <span className="text-xs font-semibold text-white/42">إجمالي</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.total}</div>
            <div className="mt-1 text-sm text-white/55">عمليات تحقق</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <span className="text-xs font-semibold text-white/42">{metrics.safeRate}</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.safe}</div>
            <div className="mt-1 text-sm text-white/55">ردود آمنة</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <Gauge className="h-5 w-5 text-cyanx-400" />
              <span className="text-xs font-semibold text-white/42">آخر {logs.length}</span>
            </div>
            <div className={cn("mt-5 text-3xl font-semibold", riskClass(metrics.averageRisk))}>
              {metrics.averageRisk.toFixed(2)}
            </div>
            <div className="mt-1 text-sm text-white/55">متوسط الخطر</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <Wrench className="h-5 w-5 text-amber-300" />
              <span className="text-xs font-semibold text-white/42">{metrics.repairedSafe} نجح</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.repairAttempts}</div>
            <div className="mt-1 text-sm text-white/55">محاولات إصلاح</div>
          </GradientCard>

          <GradientCard>
            <div className="flex items-center justify-between">
              <AlertTriangle className="h-5 w-5 text-red-300" />
              <span className="text-xs font-semibold text-white/42">{metrics.blockedRate}</span>
            </div>
            <div className="mt-5 text-3xl font-semibold text-white">{metrics.blocked}</div>
            <div className="mt-1 text-sm text-white/55">حالات تدخل</div>
          </GradientCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="space-y-6">
            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <Filter className="h-5 w-5 text-emeraldx-400" />
                <h2 className="text-lg font-semibold text-white">الفلاتر</h2>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-white/35" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ابحث في الرسائل أو الجلسات"
                    className="pr-10"
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
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
                          ? "bg-emeraldx-500 text-ink-950 shadow-glow"
                          : "bg-white/7 text-white/60 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <Button type="button" variant="secondary" className="w-full" onClick={() => void loadLogs()} disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  تحديث السجلات
                </Button>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <Activity className="h-5 w-5 text-cyanx-400" />
                <h2 className="text-lg font-semibold text-white">نبض النظام</h2>
              </div>
              <div className="space-y-3 text-right">
                {[
                  ["استخدام الأدوات", `${metrics.toolUsage} من ${logs.length}`],
                  ["حارس الحقائق تدخل", String(metrics.factGuardHits)],
                  ["الردود غير الآمنة", String(metrics.blocked)],
                  ["نسبة الأمان", metrics.safeRate],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-3 text-sm">
                    <span className="font-semibold text-white">{value}</span>
                    <span className="text-white/52">{label}</span>
                  </div>
                ))}
              </div>
            </GradientCard>
          </div>

          <div className="space-y-4">
            {error ? (
              <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-right text-sm font-semibold text-red-100">
                {error}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-white/45">{filteredLogs.length} نتيجة معروضة</span>
              <h2 className="text-xl font-semibold text-white">آخر قرارات الوكيل</h2>
            </div>

            {filteredLogs.length ? (
              <div className="custom-scrollbar max-h-[70vh] space-y-4 overflow-y-auto pl-1 pr-2 xl:max-h-[calc(100vh-260px)]">
                {filteredLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    expanded={expandedId === log.id}
                    onToggle={() => setExpandedId((current) => (current === log.id ? null : log.id))}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/[0.025] text-center">
                <BrainCircuit className="h-10 w-10 text-white/30" />
                <p className="mt-4 text-sm text-white/50">لا توجد سجلات تحقق مطابقة الآن.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
