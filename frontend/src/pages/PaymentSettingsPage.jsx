import { useEffect, useState } from "react";
import api from "../services/api";

const METHODS = [
  { key: "cod", label: "الدفع عند الاستلام", icon: "💵", placeholder: "" },
  { key: "cliq", label: "CliQ", icon: "📱", placeholder: "رقم الهاتف أو الاسم المستعار" },
  { key: "bank_transfer", label: "تحويل بنكي", icon: "🏦", placeholder: "اسم البنك / رقم الحساب IBAN" },
  { key: "wallet", label: "محفظة إلكترونية", icon: "💳", placeholder: "مثل: Orange Money / Zain Cash" },
  { key: "card", label: "بطاقة ائتمان", icon: "💳", placeholder: "تفاصيل أو رابط الدفع" },
  { key: "installments", label: "تقسيط", icon: "📊", placeholder: "مثل: 3 دفعات بدون فوائد" },
  { key: "other", label: "أخرى", icon: "📝", placeholder: "تفاصيل طريقة الدفع" },
];

export default function PaymentSettingsPage() {
  const [methods, setMethods] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await api.get("/payment-settings");
    setMethods(data.payment_methods || {});
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function toggle(key) {
    const copy = { ...methods };
    if (copy[key] !== undefined) delete copy[key];
    else copy[key] = "";
    setMethods(copy);
  }

  async function save() {
    await api.put("/payment-settings", { payment_methods: methods });
    setMsg("تم الحفظ ✓");
    setTimeout(() => setMsg(""), 2000);
  }

  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">طرق الدفع</h1>
      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">
        فعّل طرق الدفع المتاحة وأضف التفاصيل. المساعد الذكي سيخبر الزبائن بهذه المعلومات عند السؤال عن الدفع.
      </div>

      {loading ? <p className="text-gray-500">جاري التحميل…</p> : (
        <div className="space-y-3">
          {METHODS.map(({ key, label, icon, placeholder }) => (
            <div key={key} className="bg-white rounded-xl shadow-sm p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={methods[key] !== undefined} onChange={() => toggle(key)} className="w-4 h-4" />
                <span className="text-lg">{icon}</span>
                <span className="font-medium text-gray-800">{label}</span>
              </label>
              {methods[key] !== undefined && placeholder && (
                <input
                  value={methods[key] || ""}
                  onChange={(e) => setMethods({ ...methods, [key]: e.target.value })}
                  placeholder={placeholder}
                  dir="auto"
                  className={`${inputCls} mt-2`}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-6 py-2 font-medium">حفظ</button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
      </div>
    </div>
  );
}
