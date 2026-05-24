import { useEffect, useMemo, useState, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  MessageSquareText,
  RefreshCw,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import api from "../services/api";

const STATUS_MAP = {
  pending: { label: "بانتظار الاستلام", tone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200", icon: Clock3 },
  assigned: { label: "تم التعيين", tone: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-200", icon: UserCheck },
  in_progress: { label: "قيد المعالجة", tone: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-200", icon: MessageSquareText },
  resolved: { label: "تم الحل", tone: "bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-300", icon: CheckCircle2 },
  expired: { label: "منتهي", tone: "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300", icon: AlertTriangle },
};

const PRIORITY_MAP = {
  urgent: { label: "عاجل", tone: "bg-red-600 text-white" },
  high: { label: "مرتفع", tone: "bg-amber-500 text-white" },
  normal: { label: "عادي", tone: "bg-brand-600 text-white" },
  low: { label: "منخفض", tone: "bg-gray-500 text-white" },
};

const FILTERS = [
  ["all", "الكل"],
  ["pending", "بانتظار"],
  ["assigned", "معيّن"],
  ["in_progress", "قيد المعالجة"],
  ["resolved", "تم الحل"],
];

export default function HandoffInboxPage() {
  const [handoffs, setHandoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [selectedId, setSelectedId] = useState("");
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    load();
  }, [filter]);

  const selected = handoffs.find((h) => h.id === selectedId) || handoffs[0];
  const activeSessionId = selected?.session_id;

  useEffect(() => {
    if (!activeSessionId) return;

    const interval = setInterval(() => {
      if (!sendingReply) {
        api.get(`/chat/sessions/${activeSessionId}/messages`)
          .then(({ data }) => {
            setSelectedMessages((prev) => {
              if (JSON.stringify(prev) !== JSON.stringify(data)) {
                return data;
              }
              return prev;
            });
          })
          .catch(() => {});
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeSessionId, sendingReply]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedMessages, selectedId]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/handoff/", {
        params: { status: filter === "all" ? undefined : filter },
      });
      const rows = data || [];
      setHandoffs(rows);
      setSelectedId((current) => current && rows.some((h) => h.id === current) ? current : rows[0]?.id || "");
    } catch (e) {
      console.error("Failed to load handoffs", e);
      setHandoffs([]);
      setSelectedId("");
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
    const note = prompt("ملاحظة الحل، اختياري:");
    try {
      await api.post(`/handoff/${handoffId}/resolve`, { resolution_note: note || "" });
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || "فشل الحل");
    }
  }

  async function sendReply(handoff) {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await api.post(`/handoff/${handoff.id}/reply`, {
        message: replyText.trim()
      });
      setReplyText("");
      const { data } = await api.get(`/chat/sessions/${handoff.session_id}/messages`);
      setSelectedMessages(data);
    } catch (err) {
      alert(err?.response?.data?.detail || "فشل إرسال الرد");
    } finally {
      setSendingReply(false);
    }
  }

  async function releaseToAi(handoff) {
    if (!window.confirm("هل أنت متأكد من إعادة المحادثة للذكاء الاصطناعي؟")) return;
    try {
      await api.post(`/handoff/${handoff.id}/release`);
      alert("تمت إعادة المحادثة بنجاح");
      await load();
    } catch (err) {
      alert(err?.response?.data?.detail || "فشل الإعادة");
    }
  }

  const stats = useMemo(() => {
    const pending = handoffs.filter((h) => h.status === "pending").length;
    const active = handoffs.filter((h) => h.status === "assigned" || h.status === "in_progress").length;
    const resolved = handoffs.filter((h) => h.status === "resolved").length;
    return { pending, active, resolved };
  }, [handoffs]);

  return (
    <div className="py-7" dir="rtl">
      <div className="app-container space-y-6">
        <section className="surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Human inbox</p>
              <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white sm:text-3xl">
                صندوق التحويلات البشرية
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-slate-300">
                كل محادثة تحتاج موظف تظهر هنا مع الأولوية، السبب، وملخص الذكاء الاصطناعي.
              </p>
            </div>
            <button onClick={load} className="btn-secondary" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              تحديث
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "بانتظار", value: stats.pending, icon: Clock3, tone: "text-amber-600" },
              { label: "قيد العمل", value: stats.active, icon: UserCheck, tone: "text-brand-600" },
              { label: "تم الحل", value: stats.resolved, icon: CheckCircle2, tone: "text-mint-600" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="surface-soft p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-gray-500 dark:text-slate-400">{item.label}</span>
                    <Icon className={`h-5 w-5 ${item.tone}`} />
                  </div>
                  <div className="mt-2 text-3xl font-black text-gray-950 dark:text-white">{item.value}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
          <aside className="surface overflow-hidden">
            <div className="border-b border-gray-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                      filter === value
                        ? "border-mint-600 bg-mint-600 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-3 p-8 text-sm text-gray-400">
                <RefreshCw className="h-4 w-4 animate-spin" />
                جاري التحميل...
              </div>
            ) : handoffs.length === 0 ? (
              <div className="p-8 text-center">
                <Inbox className="mx-auto h-10 w-10 text-gray-400" />
                <h3 className="mt-3 font-black text-gray-950 dark:text-white">لا توجد تحويلات</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
                  ستظهر هنا المحادثات التي تحتاج تدخل بشري.
                </p>
              </div>
            ) : (
              <div className="max-h-[680px] overflow-y-auto p-3">
                {handoffs.map((h) => {
                  const st = STATUS_MAP[h.status] || STATUS_MAP.pending;
                  const pr = PRIORITY_MAP[h.priority] || PRIORITY_MAP.normal;
                  const StatusIcon = st.icon;
                  const active = selected?.id === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setSelectedId(h.id)}
                      className={`mb-2 w-full rounded-lg border p-4 text-start transition ${
                        active
                          ? "border-mint-500 bg-mint-50/70 dark:border-mint-400 dark:bg-mint-500/10"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-slate-800 dark:bg-slate-950"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`status-pill ${pr.tone}`}>{pr.label}</span>
                        <span className="text-xs text-gray-400">
                          {h.created_at ? new Date(h.created_at).toLocaleString("ar") : ""}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <StatusIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-black text-gray-950 dark:text-white">{st.label}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
                        {h.reason || h.ai_summary || "تحويل بدون سبب واضح"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <main className="surface p-5 sm:p-6">
            {!selected ? (
              <div className="grid min-h-[420px] place-items-center text-center">
                <div>
                  <Inbox className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-3 text-lg font-black text-gray-950 dark:text-white">اختر تحويل من القائمة</h3>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">Conversation review</p>
                    <h2 className="mt-2 text-2xl font-black text-gray-950 dark:text-white">
                      تحويل بشري
                    </h2>
                  </div>
                  <span className={`status-pill ${(STATUS_MAP[selected.status] || STATUS_MAP.pending).tone}`}>
                    {(STATUS_MAP[selected.status] || STATUS_MAP.pending).label}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="surface-soft p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-black text-gray-700 dark:text-slate-200">
                      <ShieldAlert className="h-4 w-4 text-amber-600" />
                      سبب التحويل
                    </div>
                    <p className="text-sm leading-7 text-gray-600 dark:text-slate-300">
                      {selected.reason || "لم يتم إرسال سبب واضح."}
                    </p>
                  </div>
                  <div className="surface-soft p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-black text-gray-700 dark:text-slate-200">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      الأولوية
                    </div>
                    <span className={`status-pill ${(PRIORITY_MAP[selected.priority] || PRIORITY_MAP.normal).tone}`}>
                      {(PRIORITY_MAP[selected.priority] || PRIORITY_MAP.normal).label}
                    </span>
                  </div>
                </div>

                {selected.ai_summary && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="mb-2 text-sm font-black text-gray-700 dark:text-slate-200">ملخص الذكاء الاصطناعي</div>
                    <p className="text-sm leading-7 text-gray-600 dark:text-slate-300">{selected.ai_summary}</p>
                  </div>
                )}

                {/* Messages Area */}
                <div className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/50">
                  <div className="flex-grow space-y-2 overflow-y-auto p-3" style={{ maxHeight: "400px" }}>
                    {selectedMessages.length === 0 ? (
                      <p className="py-4 text-center text-sm text-gray-400">لا توجد رسائل</p>
                    ) : (
                      selectedMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                            m.role === "user"
                              ? "me-auto bg-brand-100 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100"
                              : "ms-auto border border-gray-200 bg-white text-gray-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                          dir="auto"
                        >
                          <div className="mb-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                            {m.role === "user" ? "العميل" : "المساعد الذكي"}
                          </div>
                          {m.content}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Area */}
                  {(selected.status === "assigned" || selected.status === "in_progress") && (
                    <div className="space-y-3 border-t border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-[#0b1118]">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") sendReply(selected);
                          }}
                          placeholder="اكتب ردك هنا..."
                          className="input-field flex-grow"
                          disabled={sendingReply}
                        />
                        <button
                          onClick={() => sendReply(selected)}
                          disabled={sendingReply || !replyText.trim()}
                          className="btn-primary"
                        >
                          {sendingReply ? "جاري الإرسال..." : "إرسال"}
                        </button>
                      </div>

                      <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-slate-800">
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          يمكنك إرسال رسالة نيابة عن المساعد، أو حل المحادثة ليعود الذكاء الاصطناعي للرد.
                        </span>
                        <button
                          onClick={() => releaseToAi(selected)}
                          className="btn-secondary text-xs"
                        >
                          إعادة للذكاء الاصطناعي
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selected.status === "pending" && (
                    <button onClick={() => assign(selected.id)} className="btn-primary">
                      <UserCheck className="h-4 w-4" />
                      استلام المحادثة
                    </button>
                  )}
                  {(selected.status === "assigned" || selected.status === "in_progress") && (
                    <button onClick={() => resolve(selected.id)} className="btn-primary">
                      <CheckCircle2 className="h-4 w-4" />
                      تم الحل
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
        </section>
      </div>
    </div>
  );
}
