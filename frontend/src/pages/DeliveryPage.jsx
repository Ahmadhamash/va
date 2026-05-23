import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import api from "../services/api";
export default function DeliveryPage() {
  const {
    t
  } = useTranslation();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    zone_name: "",
    delivery_fee: "",
    currency: "JOD",
    free_above: "",
    estimated_days: "",
    pickup_available: false,
    notes: ""
  });
  const [error, setError] = useState("");
  async function loadRules() {
    setLoading(true);
    try {
      const {
        data
      } = await api.get("/delivery-rules");
      setRules(data);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    loadRules();
  }, []);
  function resetForm() {
    setForm({
      zone_name: "",
      delivery_fee: "",
      currency: "JOD",
      free_above: "",
      estimated_days: "",
      pickup_available: false,
      notes: ""
    });
    setEditing(null);
    setShowForm(false);
    setError("");
  }
  function startEdit(rule) {
    setForm({
      zone_name: rule.zone_name,
      delivery_fee: rule.delivery_fee ?? "",
      currency: rule.currency || "JOD",
      free_above: rule.free_above ?? "",
      estimated_days: rule.estimated_days || "",
      pickup_available: rule.pickup_available || false,
      notes: rule.notes || ""
    });
    setEditing(rule);
    setShowForm(true);
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      ...form,
      delivery_fee: form.delivery_fee === "" ? 0 : Number(form.delivery_fee),
      free_above: form.free_above === "" ? null : Number(form.free_above)
    };
    try {
      if (editing) {
        await api.put(`/delivery-rules/${editing.id}`, payload);
      } else {
        await api.post("/delivery-rules", payload);
      }
      resetForm();
      await loadRules();
    } catch (err) {
      setError(err?.response?.data?.detail || t("txt_41"));
    }
  }
  async function handleDelete(rule) {
    if (!window.confirm(`حذف منطقة "${rule.zone_name}"?`)) return;
    await api.delete(`/delivery-rules/${rule.id}`);
    await loadRules();
  }
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500";
  return <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("txt_43")}</h1>
        <button onClick={() => {
        resetForm();
        setShowForm(true);
      }} className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm font-medium">{t("txt_44")}</button>
      </div>

      {showForm && <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {editing ? t("txt_45") : t("txt_46")}
          </h2>
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_47")}</label>
              <input value={form.zone_name} onChange={e => setForm({
            ...form,
            zone_name: e.target.value
          })} placeholder={t("txt_48")} required dir="auto" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_49")}</label>
                <input type="number" step="0.01" min="0" value={form.delivery_fee} onChange={e => setForm({
              ...form,
              delivery_fee: e.target.value
            })} required className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_50")}</label>
                <input value={form.currency} onChange={e => setForm({
              ...form,
              currency: e.target.value
            })} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_51")}</label>
              <input type="number" step="0.01" min="0" value={form.free_above} onChange={e => setForm({
            ...form,
            free_above: e.target.value
          })} placeholder={t("txt_52")} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_53")}</label>
              <input value={form.estimated_days} onChange={e => setForm({
            ...form,
            estimated_days: e.target.value
          })} placeholder={t("txt_54")} dir="auto" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_55")}</label>
            <textarea value={form.notes} onChange={e => setForm({
          ...form,
          notes: e.target.value
        })} rows={2} dir="auto" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.pickup_available} onChange={e => setForm({
          ...form,
          pickup_available: e.target.checked
        })} />{t("txt_56")}</label>
          <div className="flex gap-3">
            <button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 font-medium">{t("txt_22")}</button>
            <button type="button" onClick={resetForm} className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50">{t("txt_23")}</button>
          </div>
        </form>}

      {loading ? <p className="text-gray-500">{t("txt_26")}</p> : rules.length === 0 ? <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">{t("txt_57")}</div> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rules.map(rule => <div key={rule.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-gray-900">
                  {rule.zone_name}
                </h3>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(rule)} className="text-xs text-brand-600 hover:underline">{t("txt_58")}</button>
                  <button onClick={() => handleDelete(rule)} className="text-xs text-red-600 hover:underline">{t("txt_25")}</button>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p>{t("txt_59")}{" "}
                  <strong>
                    {rule.delivery_fee} {rule.currency}
                  </strong>
                </p>
                {rule.free_above && <p>{t("txt_60")}{rule.free_above} {rule.currency}
                  </p>}
                {rule.estimated_days && <p>🕐 {rule.estimated_days}</p>}
                {rule.pickup_available && <p>{t("txt_61")}</p>}
                {rule.notes && <p className="text-gray-400 text-xs" dir="auto">
                    {rule.notes}
                  </p>}
              </div>
            </div>)}
        </div>}
    </div>;
}