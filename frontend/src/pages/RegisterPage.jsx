import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Building2,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Mail,
  Moon,
  Network,
  Sun,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import api from "../services/api";

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    business_name: "",
    business_type: "",
  });
  const [types, setTypes] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/business-types").then(({ data }) => setTypes(data)).catch(() => {});
  }, []);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : t("txt_159"));
    } finally {
      setBusy(false);
    }
  }

  const fields = [
    { f: "username", label: t("txt_97"), type: "text", icon: UserRound, required: true, autoComplete: "username" },
    { f: "email", label: t("txt_161"), type: "email", icon: Mail, required: true, autoComplete: "email" },
    { f: "password", label: t("txt_98"), type: "password", icon: LockKeyhole, required: true, autoComplete: "new-password" },
    { f: "business_name", label: t("txt_162"), type: "text", icon: Building2, required: false, autoComplete: "organization" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-[#0b1118] dark:text-white" dir="rtl">
      <div className="app-container grid min-h-screen items-center gap-10 py-8 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="mx-auto w-full max-w-lg">
          <div className="mb-5 flex items-center justify-between">
            <Link to="/login" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-ink-900 text-white dark:bg-white dark:text-ink-900">
                <Bot className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-black">{t("business_assistant")}</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">ابدأ إعداد المنصة</span>
              </span>
            </Link>
            <div className="flex gap-2">
              <button onClick={toggleTheme} className="icon-button" title={isDark ? "الوضع النهاري" : "الوضع الليلي"}>
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <button
                onClick={() => i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar")}
                className="icon-button"
                title="تغيير اللغة"
              >
                <Globe2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="surface p-6 sm:p-7">
            <div className="mb-6">
              <p className="eyebrow">New workspace</p>
              <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white">{t("txt_102")}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
                أنشئ مساحة العمل، وبعدها رح تمشي في مسار بسيط لإعداد العمل والقنوات.
              </p>
            </div>

            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map(({ f, label, type, icon: Icon, required, autoComplete }) => (
                <div key={f} className={f === "business_name" ? "sm:col-span-2" : ""}>
                  <label className="label">{label}</label>
                  <div className="relative">
                    <Icon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type={type}
                      value={form[f]}
                      onChange={update(f)}
                      required={required}
                      autoComplete={autoComplete}
                      className="input-field pe-10"
                    />
                  </div>
                </div>
              ))}

              <div className="sm:col-span-2">
                <label className="label">{t("txt_163")}</label>
                <div className="relative">
                  <Network className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <select value={form.business_type} onChange={update("business_type")} className="input-field pe-10">
                    <option value="">{t("txt_164")}</option>
                    {types.map((bt) => (
                      <option key={bt.key} value={bt.key}>
                        {bt.icon} {bt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t("txt_165")}</p>
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
              {busy ? t("txt_166") : t("txt_102")}
            </button>

            <p className="mt-5 text-center text-sm text-gray-500 dark:text-slate-400">
              {t("txt_167")}{" "}
              <Link to="/login" className="font-bold text-brand-600 dark:text-mint-300">
                {t("txt_95")}
              </Link>
            </p>
          </form>
        </section>

        <section className="hidden lg:block">
          <div className="max-w-xl">
            <p className="eyebrow">Customer journey</p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-gray-950 dark:text-white">
              من أول رسالة للزبون لغاية الرد، الحجز، أو التحويل البشري.
            </h2>
            <div className="mt-8 space-y-3">
              {[
                "الزبون يسأل على واتساب أو إنستغرام أو ويدجت الموقع.",
                "المساعد يقرأ الكاتالوج والسياسات ونبرة الكلام.",
                "إذا احتاج تدخل بشري، تظهر التحويلات فوراً في الداشبورد.",
              ].map((line) => (
                <div key={line} className="surface flex items-start gap-3 p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint-600" />
                  <p className="text-sm leading-7 text-gray-600 dark:text-slate-300">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
