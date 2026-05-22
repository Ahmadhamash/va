import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import api from "../services/api";
export default function PaymentSettingsPage() {
  const { t } = useTranslation();
  const METHODS = [{
    key: "cod",
    label: t("txt_121"),
    icon: "💵",
    placeholder: ""
  }, {
    key: "cliq",
    label: "CliQ",
    icon: "📱",
    placeholder: t("txt_122")
  }, {
    key: "bank_transfer",
    label: t("txt_123"),
    icon: "🏦",
    placeholder: t("txt_124")
  }, {
    key: "wallet",
    label: t("txt_125"),
    icon: "💳",
    placeholder: t("txt_126")
  }, {
    key: "card",
    label: t("txt_127"),
    icon: "💳",
    placeholder: t("txt_128")
  }, {
    key: "installments",
    label: t("txt_129"),
    icon: "📊",
    placeholder: t("txt_130")
  }, {
    key: "other",
    label: t("txt_107"),
    icon: "📝",
    placeholder: t("txt_131")
  }];
  const [methods, setMethods] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  async function load() {
    setLoading(true);
    const {
      data
    } = await api.get("/payment-settings");
    setMethods(data.payment_methods || {});
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  function toggle(key) {
    const copy = {
      ...methods
    };
    if (copy[key] !== undefined) delete copy[key];else copy[key] = "";
    setMethods(copy);
  }
  async function save() {
    await api.put("/payment-settings", {
      payment_methods: methods
    });
    setMsg(t("txt_132"));
    setTimeout(() => setMsg(""), 2000);
  }
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  return <div className="mx-auto max-w-2xl px-4 py-8 space-y-6" dir="rtl">
      <h1 className="text-xl font-bold">{t("txt_133")}</h1>
      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">{t("txt_134")}</div>

      {loading ? <p className="text-gray-500">{t("txt_26")}</p> : <div className="space-y-3">
          {METHODS.map(({
        key,
        label,
        icon,
        placeholder
      }) => <div key={key} className="bg-white rounded-xl shadow-sm p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={methods[key] !== undefined} onChange={() => toggle(key)} className="w-4 h-4" />
                <span className="text-lg">{icon}</span>
                <span className="font-medium text-gray-800">{label}</span>
              </label>
              {methods[key] !== undefined && placeholder && <input value={methods[key] || ""} onChange={e => setMethods({
          ...methods,
          [key]: e.target.value
        })} placeholder={placeholder} dir="auto" className={`${inputCls} mt-2`} />}
            </div>)}
        </div>}

      <div className="flex items-center gap-3">
        <button onClick={save} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-6 py-2 font-medium">{t("txt_22")}</button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
      </div>
    </div>;
}