import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Cable,
  Camera,
  CheckCircle2,
  Code2,
  MessageCircle,
  MessagesSquare,
  Moon,
  Play,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  Zap,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

const channels = [
  { label: "واتساب", icon: MessageCircle, status: "جاهز للربط", tone: "text-mint-600" },
  { label: "إنستغرام", icon: Camera, status: "رسائل وتعليقات", tone: "text-rose-500" },
  { label: "ماسنجر", icon: MessagesSquare, status: "صفحات فيسبوك", tone: "text-brand-600" },
  { label: "موقعك", icon: Code2, status: "ودجت مباشر", tone: "text-ember-600" },
];

const steps = [
  {
    title: "اربط القنوات",
    text: "العميل يضغط زر ربط، يختار صفحته أو رقمه، والباقي يجهز تلقائيا.",
    icon: Cable,
  },
  {
    title: "درّب المساعد",
    text: "أضف المنتجات، السياسات، اللهجة، وطريقة الرد المناسبة لعملك.",
    icon: Bot,
  },
  {
    title: "ابدأ الردود",
    text: "الذكاء الاصطناعي يرد، والموظف يستلم عند التحويل أو الحالات الحساسة.",
    icon: UserCheck,
  },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="surface overflow-hidden border-gray-200 bg-white shadow-2xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-mint-500" />
          </div>
          <span className="rounded-full bg-mint-50 px-3 py-1 text-xs font-black text-mint-700 dark:bg-mint-500/10 dark:text-mint-300">
            AI يعمل الآن
          </span>
        </div>

        <div className="grid min-h-[360px] grid-cols-[0.86fr_1.14fr]">
          <aside className="border-l border-gray-100 bg-gray-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-3 text-xs font-black text-gray-400">القنوات</div>
            <div className="space-y-2">
              {channels.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${item.tone}`} />
                      <span className="text-sm font-black text-gray-900 dark:text-white">{item.label}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">{item.status}</div>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-mint-600">المحادثة الحالية</div>
                <div className="mt-1 text-lg font-black text-gray-950 dark:text-white">طلب عميل من واتساب</div>
              </div>
              <span className="status-pill bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200">
                تحويل عند الحاجة
              </span>
            </div>

            <div className="space-y-3">
              <div className="max-w-[78%] rounded-lg rounded-tr-sm bg-gray-100 p-3 text-sm leading-6 text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                مرحبا، شو المنتجات المتوفرة عندكم؟
              </div>
              <div className="mr-auto max-w-[84%] rounded-lg rounded-tl-sm bg-mint-600 p-3 text-sm leading-6 text-white">
                أهلا وسهلا، عنا بلايستيشن، شاورما، وباقات مناسبات. بأي قسم مهتم عشان أفصّلك؟
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-2 flex items-center gap-2 text-xs font-black text-gray-500 dark:text-slate-400">
                  <Sparkles className="h-4 w-4 text-mint-600" />
                  اقتراح ذكي
                </div>
                <div className="text-sm leading-6 text-gray-700 dark:text-slate-200">
                  الرد مختصر، عربي، وبدون تفاصيل زائدة. اسأل العميل عن اهتمامه قبل عرض الأسعار.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 dark:bg-[#071015] dark:text-white" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-[#071015]/90">
        <div className="app-container flex h-16 items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-mint-600 text-white shadow-sm shadow-mint-600/20">
              <Bot className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-black">Masarjo</span>
              <span className="block text-xs text-gray-500 dark:text-slate-400">AI Support Platform</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-bold text-gray-600 dark:text-slate-300 md:flex">
            <a href="#channels" className="hover:text-mint-600">القنوات</a>
            <a href="#workflow" className="hover:text-mint-600">التجربة</a>
            <a href="#handoff" className="hover:text-mint-600">التحويل البشري</a>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="icon-button" title={isDark ? "الوضع النهاري" : "الوضع الليلي"}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className="btn-secondary hidden sm:inline-flex">دخول</Link>
            <Link to="/register" className="btn-primary">ابدأ الآن</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero-band overflow-hidden">
          <div className="app-container grid min-h-[calc(86vh-4rem)] items-center gap-10 py-10 lg:grid-cols-[0.92fr_1.08fr] lg:py-14">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-mint-100 bg-white px-3 py-1.5 text-sm font-black text-mint-700 shadow-sm dark:border-mint-500/20 dark:bg-slate-900 dark:text-mint-300">
                <Zap className="h-4 w-4" />
                ربط القنوات والردود الذكية من مكان واحد
              </div>
              <h1 className="max-w-3xl text-4xl font-black leading-[1.16] text-gray-950 dark:text-white sm:text-5xl lg:text-6xl">
                اربط قنواتك وخلي الذكاء الاصطناعي يرد عنك
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-gray-600 dark:text-slate-300 sm:text-lg">
                واتساب، إنستغرام، فيسبوك، وموقعك في مكان واحد. ردود عربية مختصرة، صوت عند الحاجة، وتحويل بشري واضح لما المحادثة تحتاج موظف.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/register" className="btn-primary h-12 px-6 text-base">
                  ابدأ الآن
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <Link to="/login" className="btn-secondary h-12 px-6 text-base">
                  <Play className="h-5 w-5" />
                  شاهد التجربة
                </Link>
              </div>

              <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
                {[
                  ["4", "قنوات رئيسية"],
                  ["24/7", "ردود تلقائية"],
                  ["1", "صندوق موحد"],
                ].map(([value, label]) => (
                  <div key={label} className="surface-soft px-4 py-3">
                    <div className="text-2xl font-black text-gray-950 dark:text-white">{value}</div>
                    <div className="mt-1 text-xs font-bold text-gray-500 dark:text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <ProductPreview />
          </div>
        </section>

        <section id="channels" className="py-16">
          <div className="app-container">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Connect</p>
                <h2 className="mt-2 text-3xl font-black text-gray-950 dark:text-white">زر واحد لكل قناة مهمة</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-gray-500 dark:text-slate-400">
                الواجهة مصممة للعميل غير التقني: يرى القناة، يضغط ربط، ويتابع حالة الربط بدون مصطلحات معقدة.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {channels.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="surface p-5">
                    <div className="flex items-center justify-between">
                      <span className="grid h-12 w-12 place-items-center rounded-lg bg-gray-50 dark:bg-slate-800">
                        <Icon className={`h-6 w-6 ${item.tone}`} />
                      </span>
                      <CheckCircle2 className="h-5 w-5 text-mint-600" />
                    </div>
                    <h3 className="mt-5 text-lg font-black text-gray-950 dark:text-white">{item.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">{item.status}</p>
                    <div className="mt-5 rounded-lg bg-gray-50 px-3 py-2 text-xs font-bold text-gray-500 dark:bg-slate-950 dark:text-slate-400">
                      ربط واضح، حالة مباشرة، وتحويل للمحادثات داخل الصندوق.
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="border-y border-gray-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-950/50">
          <div className="app-container">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Workflow</p>
              <h2 className="mt-2 text-3xl font-black text-gray-950 dark:text-white">رحلة بسيطة من الربط لأول رد</h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="surface p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-mint-50 text-mint-600 dark:bg-mint-500/10 dark:text-mint-300">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-sm font-black text-gray-400">0{index + 1}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-black text-gray-950 dark:text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-gray-500 dark:text-slate-400">{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="handoff" className="py-16">
          <div className="app-container grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow">Human handoff</p>
              <h2 className="mt-2 text-3xl font-black text-gray-950 dark:text-white">
                لما المحادثة تحتاج إنسان، تظهر بوضوح
              </h2>
              <p className="mt-4 text-sm leading-8 text-gray-500 dark:text-slate-400">
                التحويل البشري ليس خطأ. هو مسار واضح: سبب التحويل، خطورة الحالة، مسودة رد، وزر استلام للموظف.
              </p>
              <Link to="/register" className="btn-primary mt-6">
                جهز حسابك
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>

            <div className="surface p-4">
              <div className="grid gap-3">
                {[
                  ["شكوى", "خطر 82%", "العميل غاضب ويحتاج موظف"],
                  ["طلب استرجاع", "خطر 64%", "لا تترك الذكاء الاصطناعي يقرر وحده"],
                  ["سؤال عام", "خطر 12%", "الرد الذكي مناسب"],
                ].map(([title, risk, text]) => (
                  <div key={title} className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-black text-gray-950 dark:text-white">{title}</div>
                      <span className="status-pill bg-mint-50 text-mint-700 dark:bg-mint-500/10 dark:text-mint-300">{risk}</span>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="app-container flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-slate-400">
          <div className="font-bold text-gray-700 dark:text-slate-200">Masarjo AI Support Platform</div>
          <div className="flex gap-5">
            <Link to="/terms" className="hover:text-mint-600">الشروط</Link>
            <Link to="/privacy" className="hover:text-mint-600">الخصوصية</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
