import { useEffect, useState } from "react";
import api from "../services/api";

const OFFER_TYPES = [
  { value: "percentage", label: "خصم %" },
  { value: "fixed", label: "مبلغ ثابت" },
  { value: "free_delivery", label: "توصيل مجاني" },
  { value: "bundle", label: "حزمة" },
  { value: "custom", label: "أخرى" },
];

export default function OffersPage() {
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
    setOffers(o.data); setPackages(p.data); setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  function reset() { setShowForm(false); setEditing(null); setForm({}); setError(""); }

  async function submitOffer(e) {
    e.preventDefault(); setError("");
    const payload = { ...form, discount_value: form.discount_value === "" ? null : Number(form.discount_value) };
    try {
      if (editing) await api.put(`/offers/${editing.id}`, payload);
      else await api.post("/offers", payload);
      reset(); await loadAll();
    } catch (err) { setError(err?.response?.data?.detail || "خطأ"); }
  }

  async function submitPkg(e) {
    e.preventDefault(); setError("");
    const payload = { ...form, price: form.price === "" ? null : Number(form.price) };
    try {
      if (editing) await api.put(`/packages/${editing.id}`, payload);
      else await api.post("/packages", payload);
      reset(); await loadAll();
    } catch (err) { setError(err?.response?.data?.detail || "خطأ"); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">العروض والباقات</h1>
      <div className="flex gap-2">
        {["offers","packages"].map(t=>(
          <button key={t} onClick={()=>{setTab(t);reset();}} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab===t?"bg-brand-600 text-white":"bg-white shadow-sm"}`}>
            {t==="offers"?"العروض":"الباقات"}
          </button>
        ))}
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      {tab==="offers" && <>
        <button onClick={()=>{reset();setForm({title:"",description:"",offer_type:"percentage",discount_value:"",promo_code:""});setShowForm(true);}} className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm">+ عرض جديد</button>
        {showForm && <form onSubmit={submitOffer} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">العنوان *</label><input value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})} required dir="auto" className={inputCls}/></div>
            <div><label className="block text-sm font-medium mb-1">النوع</label><select value={form.offer_type||"percentage"} onChange={e=>setForm({...form,offer_type:e.target.value})} className={inputCls}>{OFFER_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium mb-1">قيمة الخصم</label><input type="number" step="0.01" value={form.discount_value||""} onChange={e=>setForm({...form,discount_value:e.target.value})} className={inputCls}/></div>
            <div><label className="block text-sm font-medium mb-1">كود</label><input value={form.promo_code||""} onChange={e=>setForm({...form,promo_code:e.target.value})} placeholder="SAVE20" className={inputCls}/></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">الوصف</label><textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} rows={2} dir="auto" className={inputCls}/></div>
          <div className="flex gap-3"><button className="bg-brand-600 text-white rounded-lg px-4 py-2">حفظ</button><button type="button" onClick={reset} className="border border-gray-300 rounded-lg px-4 py-2">إلغاء</button></div>
        </form>}
        {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{offers.map(o=>(
          <div key={o.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between"><span className="font-semibold">{o.title}</span>
              <div className="flex gap-1">
                <button onClick={()=>{setEditing(o);setForm({title:o.title,description:o.description||"",offer_type:o.offer_type,discount_value:o.discount_value??"",promo_code:o.promo_code||""});setShowForm(true);}} className="text-xs text-brand-600">تعديل</button>
                <button onClick={async()=>{if(window.confirm("حذف؟")){await api.delete(`/offers/${o.id}`);await loadAll();}}} className="text-xs text-red-600">حذف</button>
              </div>
            </div>
            <div className="text-sm text-gray-600 mt-1">{o.discount_value&&<span className="text-green-600 font-bold ml-2">{o.discount_value}{o.offer_type==="percentage"?"%":""}</span>}{o.promo_code&&<span className="text-xs bg-gray-100 px-2 py-0.5 rounded">🏷️{o.promo_code}</span>}</div>
          </div>
        ))}</div>}
      </>}

      {tab==="packages" && <>
        <button onClick={()=>{reset();setForm({name:"",description:"",price:"",currency:"USD"});setShowForm(true);}} className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm">+ باقة جديدة</button>
        {showForm && <form onSubmit={submitPkg} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">الاسم *</label><input value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} required dir="auto" className={inputCls}/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="block text-sm font-medium mb-1">السعر</label><input type="number" step="0.01" value={form.price||""} onChange={e=>setForm({...form,price:e.target.value})} className={inputCls}/></div>
              <div><label className="block text-sm font-medium mb-1">العملة</label><input value={form.currency||"USD"} onChange={e=>setForm({...form,currency:e.target.value})} className={inputCls}/></div>
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-1">الوصف</label><textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} rows={3} dir="auto" className={inputCls}/></div>
          <div className="flex gap-3"><button className="bg-brand-600 text-white rounded-lg px-4 py-2">حفظ</button><button type="button" onClick={reset} className="border border-gray-300 rounded-lg px-4 py-2">إلغاء</button></div>
        </form>}
        {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{packages.map(p=>(
          <div key={p.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between"><span className="font-semibold">{p.name}</span>
              <div className="flex gap-1">
                <button onClick={()=>{setEditing(p);setForm({name:p.name,description:p.description||"",price:p.price??"",currency:p.currency||"USD"});setShowForm(true);}} className="text-xs text-brand-600">تعديل</button>
                <button onClick={async()=>{if(window.confirm("حذف؟")){await api.delete(`/packages/${p.id}`);await loadAll();}}} className="text-xs text-red-600">حذف</button>
              </div>
            </div>
            {p.price!=null&&<div className="font-bold text-green-600 mt-1">{p.price} {p.currency}</div>}
            {p.description&&<p className="text-xs text-gray-500 mt-1" dir="auto">{p.description}</p>}
          </div>
        ))}</div>}
      </>}
    </div>
  );
}
