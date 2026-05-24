import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Cable,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  MessageSquareText,
  Moon,
  PackageSearch,
  ShieldCheck,
  Sun,
  UserRound,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : t("txt_94"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-[#0b1118] dark:text-white" dir="rtl">
      <div className="app-container grid min-h-screen items-center gap-10 py-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <Bot className="h-4 w-4 text-mint-600" />
              منصة ردود ذكية لقنوات البيع وخدمة العملاء
            </div>
            <h1 className="text-4xl font-black leading-tight text-gray-950 dark:text-white">
              سجّل دخولك، اربط قنواتك، وخلي المساعد يرد بنفس أسلوبك.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-8 text-gray-600 dark:text-slate-300">
              التجربة مصممة كمسار تشغيل واضح: جهّز الكاتالوج، اربط واتساب أو إنستغرام أو الويب، اختبر الردود، وتابع التحويلات من لوحة واحدة.
            </p>

            <div className="mt-8 grid max-w-lg grid-cols-2 gap-3">
              {[
                { icon: PackageSearch, title: "كاتالوج عربي", text: "منتجات وأسعار وسياسات" },
                { icon: Cable, title: "ربط واضح", text: "Webhook و Widget بنسخ سريع" },
                { icon: ShieldCheck, title: "تحكم بالأمان", text: "مراجعة وتحويل بشري" },
                { icon: MessageSquareText, title: "تجربة العميل", text: "رسائل، حجز، وتحويل" },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="surface p-4">
                    <Icon className="mb-3 h-5 w-5 text-mint-600 dark:text-mint-400" />
                    <h3 className="text-sm font-bold text-gray-950 dark:text-white">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-5 flex items-center justify-between">
            <Link to="/login" className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-ink-900 text-white dark:bg-white dark:text-ink-900">
                <Bot className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-black">{t("business_assistant")}</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">لوحة التحكم</span>
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
              <p className="eyebrow">Welcome back</p>
              <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white">{t("txt_95")}</h1>
              <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
                ادخل للحساب حتى تكمّل إعداد الردود والربط وتجربة العميل.
              </p>
            </div>

            {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

            <div className="space-y-4">
              <div>
                <label className="label">{t("txt_97")}</label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="input-field pe-10"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="label">{t("txt_98")}</label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input-field pe-10"
                    autoComplete="current-password"
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
              {busy ? t("txt_99") : t("txt_100")}
            </button>

            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-slate-400">
              <CheckCircle2 className="h-4 w-4 text-mint-600" />
              <span>{t("txt_101")}</span>
              <Link to="/register" className="font-bold text-brand-600 dark:text-mint-300">
                {t("txt_102")}
              </Link>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
