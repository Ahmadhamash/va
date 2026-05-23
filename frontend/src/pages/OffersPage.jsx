import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import api from "../services/api";
export default function OffersPage() {
  const { t } = useTranslation();
  const OFFER_TYPES = [{
    value: "percentage",
    label: t("txt_103")
  }, {
    value: "fixed",
    label: t("txt_104")
  }, {
    value: "free_delivery",
    label: t("txt_105")
  }, {
    value: "bundle",
    label: t("txt_106")
  }, {
    value: "custom",
    label: t("txt_107")
  }];
  const [tab, setTab] = useState("offers");
  const [offers, setOffers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState("");
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500";
  async function loadAll() {
    setLoading(true);
    const [o, p] = await Promise.all([api.get("/offers"), api.get("/packages")]);
    setOffers(o.data);
    setPackages(p.data);
    setLoading(false);
  }
  useEffect(() => {
    loadAll();
  }, []);
  function reset() {
    setShowForm(false);
    setEditing(null);
    setForm({});
    setError("");
  }
  async function submitOffer(e) {
    e.preventDefault();
    setError("");
    const payload = {
      ...form,
      discount_value: form.discount_value === "" ? null : Number(form.discount_value)
    };
    try {
      if (editing) await api.put(`/offers/${editing.id}`, payload);else await api.post("/offers", payload);
      reset();
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || t("txt_12"));
    }
  }
  async function submitPkg(e) {
    e.preventDefault();
    setError("");
    const payload = {
      ...form,
      price: form.price === "" ? null : Number(form.price)
    };
    try {
      if (editing) await api.put(`/packages/${editing.id}`, payload);else await api.post("/packages", payload);
      reset();
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || t("txt_12"));
    }
  }
  return <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">{t("txt_108")}</h1>
      <div className="flex gap-2">
        {["offers", "packages"].map(tabKey => <button key={tabKey} onClick={() => {
        setTab(tabKey);
        reset();
      }} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === tabKey ? "bg-brand-600 text-white" : "bg-white shadow-sm"}`}>
            {tabKey === "offers" ? t("txt_109") : t("txt_110")}
          </button>)}
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      {tab === "offers" && <>
        <button onClick={() => {
        reset();
        setForm({
          title: "",
          description: "",
          offer_type: "percentage",
          discount_value: "",
          promo_code: ""
        });
        setShowForm(true);
      }} className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm">{t("txt_111")}</button>
        {showForm && <form onSubmit={submitOffer} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">{t("txt_112")}</label><input value={form.title || ""} onChange={e => setForm({
              ...form,
              title: e.target.value
            })} required dir="auto" className={inputCls} /></div>
            <div><label className="block text-sm font-medium mb-1">{t("txt_113")}</label><select value={form.offer_type || "percentage"} onChange={e => setForm({
              ...form,
              offer_type: e.target.value
            })} className={inputCls}>{OFFER_TYPES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium mb-1">{t("txt_114")}</label><input type="number" step="0.01" value={form.discount_value || ""} onChange={e => setForm({
              ...form,
              discount_value: e.target.value
            })} className={inputCls} /></div>
            <div><label className="block text-sm font-medium mb-1">{t("txt_115")}</label><input value={form.promo_code || ""} onChange={e => setForm({
              ...form,
              promo_code: e.target.value
            })} placeholder="SAVE20" className={inputCls} /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">{t("txt_116")}</label><textarea value={form.description || ""} onChange={e => setForm({
            ...form,
            description: e.target.value
          })} rows={2} dir="auto" className={inputCls} /></div>
          <div className="flex gap-3"><button className="bg-brand-600 text-white rounded-lg px-4 py-2">{t("txt_22")}</button><button type="button" onClick={reset} className="border border-gray-300 rounded-lg px-4 py-2">{t("txt_23")}</button></div>
        </form>}
        {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{offers.map(o => <div key={o.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between"><span className="font-semibold">{o.title}</span>
              <div className="flex gap-1">
                <button onClick={() => {
                setEditing(o);
                setForm({
                  title: o.title,
                  description: o.description || "",
                  offer_type: o.offer_type,
                  discount_value: o.discount_value ?? "",
                  promo_code: o.promo_code || ""
                });
                setShowForm(true);
              }} className="text-xs text-brand-600">{t("txt_58")}</button>
                <button onClick={async () => {
                if (window.confirm(t("txt_117"))) {
                  await api.delete(`/offers/${o.id}`);
                  await loadAll();
                }
              }} className="text-xs text-red-600">{t("txt_25")}</button>
              </div>
            </div>
            <div className="text-sm text-gray-600 mt-1">{o.discount_value && <span className="text-green-600 font-bold ms-2">{o.discount_value}{o.offer_type === "percentage" ? "%" : ""}</span>}{o.promo_code && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">🏷️{o.promo_code}</span>}</div>
          </div>)}</div>}
      </>}

      {tab === "packages" && <>
        <button onClick={() => {
        reset();
        setForm({
          name: "",
          description: "",
          price: "",
          currency: "USD"
        });
        setShowForm(true);
      }} className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm">{t("txt_118")}</button>
        {showForm && <form onSubmit={submitPkg} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">{t("txt_119")}</label><input value={form.name || ""} onChange={e => setForm({
              ...form,
              name: e.target.value
            })} required dir="auto" className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-sm font-medium mb-1">{t("txt_120")}</label><input type="number" step="0.01" value={form.price || ""} onChange={e => setForm({
                ...form,
                price: e.target.value
              })} className={inputCls} /></div>
              <div><label className="block text-sm font-medium mb-1">{t("txt_50")}</label><input value={form.currency || "USD"} onChange={e => setForm({
                ...form,
                currency: e.target.value
              })} className={inputCls} /></div>
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">{t("txt_116")}</label><textarea value={form.description || ""} onChange={e => setForm({
            ...form,
            description: e.target.value
          })} rows={3} dir="auto" className={inputCls} /></div>
          <div className="flex gap-3"><button className="bg-brand-600 text-white rounded-lg px-4 py-2">{t("txt_22")}</button><button type="button" onClick={reset} className="border border-gray-300 rounded-lg px-4 py-2">{t("txt_23")}</button></div>
        </form>}
        {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{packages.map(p => <div key={p.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between"><span className="font-semibold">{p.name}</span>
              <div className="flex gap-1">
                <button onClick={() => {
                setEditing(p);
                setForm({
                  name: p.name,
                  description: p.description || "",
                  price: p.price ?? "",
                  currency: p.currency || "USD"
                });
                setShowForm(true);
              }} className="text-xs text-brand-600">{t("txt_58")}</button>
                <button onClick={async () => {
                if (window.confirm(t("txt_117"))) {
                  await api.delete(`/packages/${p.id}`);
                  await loadAll();
                }
              }} className="text-xs text-red-600">{t("txt_25")}</button>
              </div>
            </div>
            {p.price != null && <div className="font-bold text-green-600 mt-1">{p.price} {p.currency}</div>}
            {p.description && <p className="text-xs text-gray-500 mt-1" dir="auto">{p.description}</p>}
          </div>)}</div>}
      </>}
    </div>;
}