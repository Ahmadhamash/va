import { useEffect, useState } from "react";
import api from "../services/api";

const POLICY_TYPES = [
  { value: "return", label: "سياسة الاسترجاع" },
  { value: "exchange", label: "سياسة الاستبدال" },
  { value: "payment", label: "سياسة الدفع" },
  { value: "shipping", label: "سياسة الشحن" },
  { value: "general", label: "سياسة عامة" },
  { value: "custom", label: "أخرى" },
];

export default function PoliciesPage() {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ policy_type: "return", title: "", content: "" });
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try { const { data } = await api.get("/policies"); setPolicies(data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function resetForm() { setForm({ policy_type: "return", title: "", content: "" }); setEditing(null); setShowForm(false); setError(""); }

  function startEdit(p) {
    setForm({ policy_type: p.policy_type, title: p.title, content: p.content });
    setEditing(p); setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault(); setError("");
    try {
      if (editing) await api.put(`/policies/${editing.id}`, form);
      else await api.post("/policies", form);
      resetForm(); await load();
    } catch (err) { setError(err?.response?.data?.detail || "حدث خطأ"); }
  }

  async function handleDelete(p) {
    if (!window.confirm(`حذف "${p.title}"?`)) return;
    await api.delete(`/policies/${p.id}`); await load();
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">سياسات العمل</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm font-medium">+ إضافة سياسة</button>
      </div>

      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">
        أضف سياسات عملك (الاسترجاع، الاستبدال، الدفع، الشحن) حتى يتمكن المساعد الذكي من الرد على استفسارات الزبائن.
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">{editing ? "تعديل السياسة" : "إضافة سياسة"}</h2>
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
              <select value={form.policy_type} onChange={(e) => setForm({ ...form, policy_type: e.target.value })} className={inputCls}>
                {POLICY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">العنوان *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required dir="auto" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">المحتوى *</label>
            <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={4} required dir="auto" className={inputCls} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 font-medium">حفظ</button>
            <button type="button" onClick={resetForm} className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50">إلغاء</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500">جاري التحميل…</p> : policies.length === 0 ? (
        <p className="text-gray-500 text-center py-10">لم تضف أي سياسات بعد.</p>
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full ml-2">
                    {POLICY_TYPES.find((t) => t.value === p.policy_type)?.label || p.policy_type}
                  </span>
                  <span className="font-semibold text-gray-900">{p.title}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs text-brand-600 hover:underline">تعديل</button>
                  <button onClick={() => handleDelete(p)} className="text-xs text-red-600 hover:underline">حذف</button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap" dir="auto">{p.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
