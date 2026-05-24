import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Building2, CheckCircle2, Clock3, LogOut, Moon, Store, Sun } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext.jsx";

export default function OnboardingWizard() {
  const { setUser, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    business_name: "",
    business_type: "retail",
    start_time: "09:00",
    end_time: "17:00",
  });

  const businessTypes = [
    { value: "retail", label: "متجر / تجارة إلكترونية", hint: "منتجات، أسعار، مخزون" },
    { value: "restaurant", label: "مطعم / كافيه", hint: "قوائم، طلبات، عروض" },
    { value: "services", label: "خدمات", hint: "استفسارات، مواعيد، متابعة" },
    { value: "healthcare", label: "عيادة / رعاية", hint: "حجوزات، تعليمات، تحويل" },
  ];

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: updatedUser } = await api.put("/auth/me", {
        business_name: formData.business_name,
        business_type: formData.business_type,
      });

      const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
      for (const day of days) {
        await api.post("/bookings/timeslots", {
          day_of_week: day,
          start_time: formData.start_time,
          end_time: formData.end_time,
          is_active: true,
        });
      }

      setUser(updatedUser);
      navigate("/");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      alert("تعذر حفظ الإعدادات. حاول مرة ثانية.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50 p-4 text-gray-950 dark:bg-[#0b1118] dark:text-white" dir="rtl">
      <div className="mx-auto grid min-h-full max-w-6xl items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden lg:block">
          <p className="eyebrow">Setup journey</p>
          <h1 className="mt-3 text-4xl font-black leading-tight">
            ثلاث خطوات، وبعدها بتدخل على مسارات الربط والتجربة.
          </h1>
          <div className="mt-8 space-y-3">
            {[
              { icon: Building2, title: "اسم العمل", text: "حتى تظهر الردود باسم مشروعك." },
              { icon: Store, title: "نوع العمل", text: "نستخدمه لاختيار قالب بداية مناسب." },
              { icon: Clock3, title: "أوقات العمل", text: "حتى يعرف المساعد متى يقترح الحجوزات." },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="surface flex items-start gap-4 p-4">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-mint-50 text-mint-600 dark:bg-mint-500/10 dark:text-mint-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-xs font-bold text-gray-400 dark:text-slate-500">خطوة {index + 1}</div>
                    <h3 className="font-black">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{item.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="surface relative mx-auto w-full max-w-xl p-6 sm:p-8">
          <div className="absolute left-4 top-4 flex gap-2">
            <button onClick={toggleTheme} className="icon-button" title={isDark ? "الوضع النهاري" : "الوضع الليلي"}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={handleLogout} className="icon-button" title="خروج">
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-8 pe-24">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-ink-900 text-white dark:bg-white dark:text-ink-900">
              <Bot className="h-6 w-6" />
            </div>
            <p className="eyebrow">Welcome</p>
            <h2 className="mt-2 text-2xl font-black text-gray-950 dark:text-white">
              خلينا نجهز مساحة العمل
            </h2>
            <p className="mt-2 text-sm leading-7 text-gray-500 dark:text-slate-400">
              بعدها رح تشوف الداشبورد الجديد مع مسارات الربط والصوت وتجربة العميل.
            </p>
          </div>

          <div className="mb-8 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                <div className={`h-full rounded-full ${step >= i ? "bg-mint-500" : "bg-transparent"}`} />
              </div>
            ))}
          </div>

          <form onSubmit={step === 3 ? handleSubmit : (e) => { e.preventDefault(); nextStep(); }}>
            {step === 1 && (
              <div className="space-y-4 animate-fadein">
                <h3 className="text-xl font-black">ما اسم العمل؟</h3>
                <div>
                  <label className="label">اسم العمل</label>
                  <input
                    type="text"
                    name="business_name"
                    required
                    value={formData.business_name}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="مثال: Masar Store"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fadein">
                <h3 className="text-xl font-black">اختار نوع العمل</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">هذا يساعدنا نرتب تجربة البداية بشكل أقرب لك.</p>
                <div className="grid gap-3">
                  {businessTypes.map((type) => (
                    <label
                      key={type.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
                        formData.business_type === type.value
                          ? "border-ink-900 bg-ink-900 text-white dark:border-white dark:bg-white dark:text-ink-900"
                          : "border-gray-200 bg-white hover:border-gray-300 dark:border-slate-700 dark:bg-slate-900"
                      }`}
                    >
                      <input
                        type="radio"
                        name="business_type"
                        value={type.value}
                        checked={formData.business_type === type.value}
                        onChange={handleChange}
                        className="h-4 w-4"
                      />
                      <span>
                        <span className="block font-black">{type.label}</span>
                        <span className="block text-xs opacity-70">{type.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-fadein">
                <h3 className="text-xl font-black">أوقات العمل الأساسية</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">رح نضيفها كبداية من الاثنين للجمعة، وبتقدر تعدّلها لاحقاً.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">من الساعة</label>
                    <input type="time" name="start_time" required value={formData.start_time} onChange={handleChange} className="input-field" />
                  </div>
                  <div>
                    <label className="label">إلى الساعة</label>
                    <input type="time" name="end_time" required value={formData.end_time} onChange={handleChange} className="input-field" />
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 flex justify-between gap-3">
              {step > 1 ? (
                <button type="button" onClick={prevStep} className="btn-secondary">
                  رجوع
                </button>
              ) : (
                <div />
              )}

              <button type="submit" disabled={loading || (step === 1 && !formData.business_name.trim())} className="btn-primary">
                {loading ? "جاري الحفظ..." : step === 3 ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    إنهاء الإعداد
                  </>
                ) : (
                  "التالي"
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
