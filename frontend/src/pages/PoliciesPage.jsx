import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import api from "../services/api";
export default function PoliciesPage() {
  const { t } = useTranslation();
  const POLICY_TYPES = [{
    value: "return",
    label: t("txt_135")
  }, {
    value: "exchange",
    label: t("txt_136")
  }, {
    value: "payment",
    label: t("txt_137")
  }, {
    value: "shipping",
    label: t("txt_138")
  }, {
    value: "general",
    label: t("txt_139")
  }, {
    value: "custom",
    label: t("txt_107")
  }];
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    policy_type: "return",
    title: "",
    content: ""
  });
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    try {
      const {
        data
      } = await api.get("/policies");
      setPolicies(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  function resetForm() {
    setForm({
      policy_type: "return",
      title: "",
      content: ""
    });
    setEditing(null);
    setShowForm(false);
    setError("");
  }
  function startEdit(p) {
    setForm({
      policy_type: p.policy_type,
      title: p.title,
      content: p.content
    });
    setEditing(p);
    setShowForm(true);
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      if (editing) await api.put(`/policies/${editing.id}`, form);else await api.post("/policies", form);
      resetForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || t("txt_41"));
    }
  }
  async function handleDelete(p) {
    if (!window.confirm(`حذف "${p.title}"?`)) return;
    await api.delete(`/policies/${p.id}`);
    await load();
  }
  const inputCls = "input-field";
  return <div className="py-7" dir="rtl">
    <div className="app-container space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-950 dark:text-white sm:text-2xl">{t("txt_140")}</h1>
        <button onClick={() => {
        resetForm();
        setShowForm(true);
      }} className="btn-primary">{t("txt_141")}</button>
      </div>

      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">{t("txt_142")}</div>

      {showForm && <form onSubmit={handleSubmit} className="surface p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-black text-gray-950 dark:text-white">{editing ? t("txt_143") : t("txt_144")}</h2>
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_113")}</label>
              <select value={form.policy_type} onChange={e => setForm({
            ...form,
            policy_type: e.target.value
          })} className={inputCls}>
                {POLICY_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_112")}</label>
              <input value={form.title} onChange={e => setForm({
            ...form,
            title: e.target.value
          })} required dir="auto" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_145")}</label>
            <textarea value={form.content} onChange={e => setForm({
          ...form,
          content: e.target.value
        })} rows={4} required dir="auto" className={inputCls} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary">{t("txt_22")}</button>
            <button type="button" onClick={resetForm} className="btn-secondary">{t("txt_23")}</button>
          </div>
        </form>}

      {loading ? <p className="text-gray-500">{t("txt_26")}</p> : policies.length === 0 ? <p className="text-gray-500 text-center py-10">{t("txt_146")}</p> : <div className="space-y-3">
          {policies.map(p => <div key={p.id} className="surface p-5">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full ms-2">
                    {POLICY_TYPES.find(opt => opt.value === p.policy_type)?.label || p.policy_type}
                  </span>
                  <span className="font-semibold text-gray-900">{p.title}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs text-brand-600 hover:underline">{t("txt_58")}</button>
                  <button onClick={() => handleDelete(p)} className="text-xs text-red-600 hover:underline">{t("txt_25")}</button>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap" dir="auto">{p.content}</p>
            </div>)}
        </div>}
    </div>
  </div>;
}