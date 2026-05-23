import { useEffect, useState } from "react";
import api from "../services/api";

const STATUS_MAP = {
  pending: { label: "قيد الانتظار", color: "bg-yellow-100 text-yellow-700", icon: "⏳" },
  assigned: { label: "تم التعيين", color: "bg-blue-100 text-blue-700", icon: "👤" },
  in_progress: { label: "قيد المعالجة", color: "bg-purple-100 text-purple-700", icon: "🔄" },
  resolved: { label: "تم الحل", color: "bg-green-100 text-green-700", icon: "✅" },
  expired: { label: "منتهي", color: "bg-gray-100 text-gray-600", icon: "⏰" },
};

const PRIORITY_MAP = {
  urgent: { label: "عاجل", color: "bg-red-600 text-white" },
  high: { label: "عالي", color: "bg-orange-500 text-white" },
  normal: { label: "عادي", color: "bg-blue-500 text-white" },
  low: { label: "منخفض", color: "bg-gray-400 text-white" },
};

export default function HandoffInboxPage() {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  useEffect(() => { load(); }, [filter]);

  async function load() {
    try {
      const { data } = await api.get("/handoff/", { params: { status: filter === "all" ? undefined : filter } });
      setHandoffs(data || []);
    } catch (e) {
      console.error("Failed to load handoffs", e);
      setHandoffs([]);
    } finally {
      setLoading(false);
    }
  }

  async function assign(handoffId) {
    try {
      await api.post(`/handoff/${handoffId}/assign`);
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || "فشل التعيين");
    }
  }

  async function resolve(handoffId) {
    const note = prompt("ملاحظة الحل (اختياري):");
    try {
      await api.post(`/handoff/${handoffId}/resolve`, { resolution_note: note || "" });
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || "فشل الحل");
    }
  }

  const pending = handoffs.filter(h => h.status === "pending").length;
  const assigned = handoffs.filter(h => h.status === "assigned" || h.status === "in_progress").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">📥 صندوق التحويلات — Handoff Inbox</h1>
        <p className="text-sm text-gray-500 mt-1">
          المحادثات التي تحتاج تدخل بشري — عميل غاضب، إجابة غير مؤكدة، أو طلب خاص.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="flex gap-4">
        <div className="bg-yellow-50 rounded-lg px-4 py-2 text-center">
          <span className="text-lg font-bold text-yellow-700">{pending}</span>
          <span className="text-xs text-gray-500 mr-1">بانتظار</span>
        </div>
        <div className="bg-blue-50 rounded-lg px-4 py-2 text-center">
          <span className="text-lg font-bold text-blue-700">{assigned}</span>
          <span className="text-xs text-gray-500 mr-1">قيد المعالجة</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "assigned", "in_progress", "resolved"].map(s => (
          <button
            key={s}
            onClick={() => { setFilter(s); setLoading(true); }}
            className={`text-xs px-3 py-1.5 rounded-full border ${
              filter === s ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            {s === "all" ? "الكل" : STATUS_MAP[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Handoff List */}
      {loading ? (
        <p className="text-gray-400 text-sm">جاري التحميل...</p>
      ) : handoffs.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
          <p className="text-lg">لا توجد تحويلات</p>
          <p className="text-xs mt-2">ستظهر هنا عندما يحتاج عميل تدخل بشري</p>
        </div>
      ) : (
        <div className="space-y-3">
          {handoffs.map(h => {
            const st = STATUS_MAP[h.status] || { label: h.status, color: "bg-gray-100", icon: "❓" };
            const pr = PRIORITY_MAP[h.priority] || { label: h.priority, color: "bg-gray-400 text-white" };
            return (
              <div key={h.id} className="bg-white rounded-xl shadow p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${pr.color}`}>{pr.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.icon} {st.label}</span>
                  </div>
                  <span className="text-xs text-gray-400">{h.created_at ? new Date(h.created_at).toLocaleString("ar") : ""}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium text-gray-500">السبب:</span> {h.reason || "—"}
                </div>
                {h.ai_summary && (
                  <div className="text-sm text-gray-600 bg-gray-50 rounded p-2">{h.ai_summary}</div>
                )}
                {h.status === "pending" && (
                  <div className="flex gap-2">
                    <button onClick={() => assign(h.id)} className="bg-brand-600 text-white text-sm px-4 py-1.5 rounded-md hover:bg-brand-700">
                      تعيين لي
                    </button>
                  </div>
                )}
                {(h.status === "assigned" || h.status === "in_progress") && (
                  <div className="flex gap-2">
                    <button onClick={() => resolve(h.id)} className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-md hover:bg-green-700">
                      ✅ تم الحل
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
