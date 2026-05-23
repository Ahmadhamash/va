import { useEffect, useState } from "react";
import api from "../services/api";

const VERDICT_LABELS = {
  SAFE_TO_SEND: { label: "آمن", color: "bg-green-100 text-green-700" },
  BLOCKED_UNGROUNDED_ANSWER: { label: "محظور", color: "bg-red-100 text-red-700" },
  HUMAN_HANDOFF_REQUIRED: { label: "تحويل بشري", color: "bg-orange-100 text-orange-700" },
  ASK_CLARIFICATION: { label: "طلب توضيح", color: "bg-yellow-100 text-yellow-700" },
  NEEDS_MORE_DATA: { label: "بيانات ناقصة", color: "bg-blue-100 text-blue-700" },
};

const ACTION_LABELS = {
  sent: "تم الإرسال",
  modified: "معدّل",
  blocked: "محظور",
  handoff: "تحويل",
  clarification: "توضيح",
};

export default function AISafetyPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get("/verification-logs/", { params: { limit: 100 } });
      setLogs(data.logs || data || []);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      console.error("Failed to load verification logs", e);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = filter === "all" ? logs : logs.filter(l => l.verifier_status === filter);

  const blocked = logs.filter(l => l.verifier_status === "BLOCKED_UNGROUNDED_ANSWER").length;
  const handoffs = logs.filter(l => l.verifier_status === "HUMAN_HANDOFF_REQUIRED").length;
  const safe = logs.filter(l => l.verifier_status === "SAFE_TO_SEND").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">🛡️ AI Safety — مراقبة الأمان</h1>
        <p className="text-sm text-gray-500 mt-1">
          كل إجابة ذكاء اصطناعي تمر عبر نظام التحقق قبل الإرسال للعميل.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold">{logs.length}</div>
          <div className="text-xs text-gray-500 mt-1">إجمالي التحققات</div>
        </div>
        <div className="bg-green-50 rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{safe}</div>
          <div className="text-xs text-gray-500 mt-1">إجابات آمنة</div>
        </div>
        <div className="bg-red-50 rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-red-700">{blocked}</div>
          <div className="text-xs text-gray-500 mt-1">إجابات محظورة</div>
        </div>
        <div className="bg-orange-50 rounded-xl shadow p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">{handoffs}</div>
          <div className="text-xs text-gray-500 mt-1">تحويلات بشرية</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...Object.keys(VERDICT_LABELS)].map(v => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === v ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            {v === "all" ? "الكل" : VERDICT_LABELS[v]?.label || v}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      {loading ? (
        <p className="text-gray-400 text-sm">جاري التحميل...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          <p className="text-lg">لا توجد سجلات تحقق بعد</p>
          <p className="text-xs mt-2">ستظهر هنا بمجرد بدء الذكاء الاصطناعي بالرد على العملاء</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((log, i) => {
            const v = VERDICT_LABELS[log.verifier_status] || { label: log.verifier_status, color: "bg-gray-100 text-gray-600" };
            return (
              <details key={log.id || i} className="bg-white rounded-xl shadow">
                <summary className="p-4 cursor-pointer flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${v.color}`}>{v.label}</span>
                    <span className="text-sm truncate">{log.customer_message?.slice(0, 80)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-400">خطر: {(log.risk_score * 100).toFixed(0)}%</span>
                    <span className="text-xs text-gray-400">{ACTION_LABELS[log.final_action] || log.final_action}</span>
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3 text-sm">
                  <div><span className="font-medium text-gray-500">سؤال العميل:</span> {log.customer_message}</div>
                  <div><span className="font-medium text-gray-500">مسودة الذكاء الاصطناعي:</span> <span className="text-red-600">{log.draft_answer}</span></div>
                  <div><span className="font-medium text-gray-500">الإجابة النهائية:</span> <span className="text-green-700">{log.final_answer || "—"}</span></div>
                  {log.reasons?.length > 0 && (
                    <div><span className="font-medium text-gray-500">الأسباب:</span> {log.reasons.join(" • ")}</div>
                  )}
                  {log.flagged_claims?.length > 0 && (
                    <div><span className="font-medium text-gray-500">ادعاءات مشبوهة:</span> {log.flagged_claims.join(" • ")}</div>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
