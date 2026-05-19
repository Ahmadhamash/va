import { useEffect, useState } from "react";
import api from "../services/api";

const PRESET_TRIGGERS = [
  "عند شراء منتج رقمي",
  "عند طلب تصميم مخصص",
  "عند حجز موعد جديد",
  "عند طلب تعبئة استبيان/فورم",
  "عند السؤال عن تفاصيل الشحن الدولي",
  "غير ذلك (كتابة مخصصة)",
];

const ACTION_TYPES = [
  { value: "send_link", label: "إرسال رابط مباشر" },
  { value: "send_form", label: "إرسال نموذج (Form)" },
  { value: "send_text", label: "إرسال نص تفصيلي" },
];

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingWf, setEditingWf] = useState(null);

  const [triggerEvent, setTriggerEvent] = useState(PRESET_TRIGGERS[0]);
  const [customTrigger, setCustomTrigger] = useState("");
  const [actionType, setActionType] = useState("send_link");
  const [content, setContent] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await api.get("/workflows");
    setWorkflows(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openModal(wf = null) {
    if (wf) {
      setEditingWf(wf);
      if (PRESET_TRIGGERS.includes(wf.trigger_event)) {
        setTriggerEvent(wf.trigger_event);
        setCustomTrigger("");
      } else {
        setTriggerEvent("غير ذلك (كتابة مخصصة)");
        setCustomTrigger(wf.trigger_event);
      }
      setActionType(wf.action_type);
      setContent(wf.content);
    } else {
      setEditingWf(null);
      setTriggerEvent(PRESET_TRIGGERS[0]);
      setCustomTrigger("");
      setActionType("send_link");
      setContent("");
    }
    setShowModal(true);
  }

  async function save() {
    const finalTrigger =
      triggerEvent === "غير ذلك (كتابة مخصصة)" ? customTrigger.trim() : triggerEvent;

    if (!finalTrigger) return alert("يرجى إدخال الحدث (Trigger)");
    if (!content.trim()) return alert("يرجى إدخال المحتوى للرد");

    const payload = {
      trigger_event: finalTrigger,
      action_type: actionType,
      content: content.trim(),
      is_active: true,
    };

    if (editingWf) {
      await api.put(`/workflows/${editingWf.id}`, payload);
    } else {
      await api.post("/workflows", payload);
    }
    setShowModal(false);
    load();
  }

  async function remove(id) {
    if (!window.confirm("حذف هذا الإجراء التلقائي؟")) return;
    await api.delete(`/workflows/${id}`);
    load();
  }

  async function toggleActive(wf) {
    await api.put(`/workflows/${wf.id}`, { ...wf, is_active: !wf.is_active });
    load();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">الأتمتة وسير العمل</h1>
        <button
          onClick={() => openModal()}
          className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + إضافة إجراء تلقائي
        </button>
      </div>

      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">
        من هنا يمكنك برمجة المساعد الذكي للقيام بأفعال معينة عند حدوث موقف معين (مثل إرسال رابط تحميل لمنتج رقمي، أو إرسال فورم تعبئة عند طلب تصميم خاص).
      </div>

      {loading ? (
        <p className="text-gray-500">جاري التحميل…</p>
      ) : workflows.length === 0 ? (
        <p className="text-gray-500 text-center py-10">لا توجد أي إجراءات مبرمجة حالياً.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className={`bg-white rounded-xl shadow-sm p-4 border-r-4 ${
                wf.is_active ? "border-green-500" : "border-gray-300 opacity-70"
              } space-y-3`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-brand-600 font-semibold mb-1">
                    متى يحدث؟ (الشرط)
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    {wf.trigger_event}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(wf)}
                  className={`text-xs px-2 py-1 rounded-md ${
                    wf.is_active
                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {wf.is_active ? "فعال" : "متوقف"}
                </button>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1 mt-2">
                <p className="text-xs text-gray-500 font-semibold mb-1">
                  ماذا يرسل الذكاء الاصطناعي؟
                </p>
                <p className="text-xs font-bold text-gray-700">
                  {ACTION_TYPES.find((a) => a.value === wf.action_type)?.label || wf.action_type}
                </p>
                <p className="text-sm text-gray-800 break-all" dir="auto">
                  {wf.content}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  onClick={() => openModal(wf)}
                  className="text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50"
                >
                  تعديل
                </button>
                <button
                  onClick={() => remove(wf.id)}
                  className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingWf ? "تعديل الإجراء" : "إضافة إجراء تلقائي جديد"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  عند حدوث (الشرط)
                </label>
                <select
                  value={triggerEvent}
                  onChange={(e) => setTriggerEvent(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  {PRESET_TRIGGERS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {triggerEvent === "غير ذلك (كتابة مخصصة)" && (
                  <input
                    type="text"
                    value={customTrigger}
                    onChange={(e) => setCustomTrigger(e.target.value)}
                    placeholder="اكتب متى يتم إرسال هذا الإجراء... (مثال: عند سؤال العميل عن التصميم)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  نوع الإجراء
                </label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  المحتوى (الرابط أو النص)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="https://docs.google.com/forms/..."
                  rows={4}
                  dir="auto"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                إلغاء
              </button>
              <button
                onClick={save}
                className="px-6 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg"
              >
                حفظ الإجراء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
