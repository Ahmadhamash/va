import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import api from "../services/api";
export default function BookingsPage() {
  const { t } = useTranslation();
  const DAYS = [t("txt_0"), t("txt_1"), t("txt_2"), t("txt_3"), t("txt_4"), t("txt_5"), t("txt_6")];
  const STATUS_LABEL = {
    pending: t("txt_7"),
    confirmed: t("txt_8"),
    cancelled: t("txt_9"),
    completed: t("txt_10"),
    rescheduled: t("txt_11")
  };
  const STATUS_COLOR = {
    pending: "bg-amber-100 text-amber-700",
    confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600",
    completed: "bg-blue-100 text-blue-700"
  };
  const [tab, setTab] = useState("bookings");
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({
    day_of_week: 0,
    start_time: "09:00",
    end_time: "17:00",
    slot_duration_minutes: 30,
    max_bookings_per_slot: 1
  });
  const [error, setError] = useState("");
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500";
  async function loadAll() {
    setLoading(true);
    const [s, b] = await Promise.all([api.get("/time-slots"), api.get("/bookings")]);
    setSlots(s.data);
    setBookings(b.data);
    setLoading(false);
  }
  useEffect(() => {
    loadAll();
  }, []);
  async function addSlot(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/time-slots", slotForm);
      setShowSlotForm(false);
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || t("txt_12"));
    }
  }
  async function deleteSlot(id) {
    await api.delete(`/time-slots/${id}`);
    await loadAll();
  }
  async function updateBookingStatus(id, status) {
    await api.patch(`/bookings/${id}`, {
      status
    });
    await loadAll();
  }
  return <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">{t("txt_13")}</h1>
      <div className="flex gap-2">
        {["bookings", "slots"].map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? "bg-brand-600 text-white" : "bg-white shadow-sm"}`}>
            {t === "bookings" ? t("txt_14") : t("txt_15")}
          </button>)}
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      {tab === "slots" && <div className="space-y-4">
        <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">{t("txt_16")}</div>
        <button onClick={() => setShowSlotForm(true)} className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm">{t("txt_17")}</button>
        {showSlotForm && <form onSubmit={addSlot} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><label className="block text-sm font-medium mb-1">{t("txt_18")}</label>
              <select value={slotForm.day_of_week} onChange={e => setSlotForm({
              ...slotForm,
              day_of_week: Number(e.target.value)
            })} className={inputCls}>
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select></div>
            <div><label className="block text-sm font-medium mb-1">{t("txt_19")}</label>
              <input type="time" value={slotForm.start_time} onChange={e => setSlotForm({
              ...slotForm,
              start_time: e.target.value
            })} className={inputCls} /></div>
            <div><label className="block text-sm font-medium mb-1">{t("txt_20")}</label>
              <input type="time" value={slotForm.end_time} onChange={e => setSlotForm({
              ...slotForm,
              end_time: e.target.value
            })} className={inputCls} /></div>
            <div><label className="block text-sm font-medium mb-1">{t("txt_21")}</label>
              <input type="number" min="5" value={slotForm.slot_duration_minutes} onChange={e => setSlotForm({
              ...slotForm,
              slot_duration_minutes: Number(e.target.value)
            })} className={inputCls} /></div>
          </div>
          <div className="flex gap-3"><button className="bg-brand-600 text-white rounded-lg px-4 py-2">{t("txt_22")}</button><button type="button" onClick={() => setShowSlotForm(false)} className="border border-gray-300 rounded-lg px-4 py-2">{t("txt_23")}</button></div>
        </form>}
        {!loading && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slots.map(s => <div key={s.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
              <div><span className="font-medium">{DAYS[s.day_of_week]}</span>
                <span className="text-sm text-gray-500 mr-2">{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span>
                <span className="text-xs text-gray-400 mr-2">({s.slot_duration_minutes}{t("txt_24")}</span></div>
              <button onClick={() => deleteSlot(s.id)} className="text-xs text-red-600">{t("txt_25")}</button>
            </div>)}
        </div>}
      </div>}

      {tab === "bookings" && <div className="space-y-3">
        {loading ? <p className="text-gray-500">{t("txt_26")}</p> : bookings.length === 0 ? <p className="text-gray-500 text-center py-10">{t("txt_27")}</p> : bookings.map(b => <div key={b.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="font-semibold">{b.customer_name} {b.customer_phone && <span className="text-sm text-gray-500">({b.customer_phone})</span>}</div>
                <div className="text-sm text-gray-600">📅 {b.booking_date} ⏰ {b.booking_time?.slice(0, 5)} {b.service_name && <span>— {b.service_name}</span>}</div>
                {b.notes && <p className="text-xs text-gray-400" dir="auto">{b.notes}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[b.status] || ""}`}>{STATUS_LABEL[b.status] || b.status}</span>
                {b.status === "pending" && <div className="flex gap-1">
                  <button onClick={() => updateBookingStatus(b.id, "confirmed")} className="text-xs bg-green-600 text-white rounded px-2 py-1">{t("txt_28")}</button>
                  <button onClick={() => updateBookingStatus(b.id, "cancelled")} className="text-xs bg-red-100 text-red-600 rounded px-2 py-1">{t("txt_23")}</button>
                </div>}
                {b.status === "confirmed" && <button onClick={() => updateBookingStatus(b.id, "completed")} className="text-xs bg-blue-600 text-white rounded px-2 py-1">{t("txt_10")}</button>}
              </div>
            </div>
          </div>)}
      </div>}
    </div>;
}