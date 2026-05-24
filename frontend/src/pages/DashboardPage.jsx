import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Cable,
  CheckCircle2,
  MessageSquareText,
  Mic2,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Workflow,
} from "lucide-react";
import ItemCard from "../components/ItemCard.jsx";
import ItemForm from "../components/ItemForm.jsx";
import api from "../services/api";

const journeyCards = [
  {
    to: "/channels",
    icon: Cable,
    title: "ربط القنوات",
    text: "واتساب، إنستغرام، ماسنجر، وودجت الموقع بواجهة واضحة للعميل.",
    action: "افتح الربط",
  },
  {
    to: "/voice-settings",
    icon: Mic2,
    title: "الصوت واللغة",
    text: "اختيار مزود الصوت، اللهجة، وسلوك الرد الصوتي بدون تعقيد.",
    action: "إعداد الصوت",
  },
  {
    to: "/handoff",
    icon: UserCheck,
    title: "التحويل البشري",
    text: "كل محادثة حساسة تظهر في صندوق واضح مع سبب التحويل.",
    action: "فتح الصندوق",
  },
  {
    to: "/ai-safety",
    icon: ShieldCheck,
    title: "الأمان",
    text: "مراقبة الردود، المخاطر، والقواعد التي تمنع إجابات غير مناسبة.",
    action: "مراجعة الأمان",
  },
  {
    to: "/automation",
    icon: Workflow,
    title: "المسارات",
    text: "تدفقات بسيطة للحجز، المتابعة، والتنبيهات حسب القناة.",
    action: "تنظيم التدفقات",
  },
  {
    to: "/chat",
    icon: MessageSquareText,
    title: "تجربة العميل",
    text: "اختبر الرد كما سيظهر للعميل النهائي قبل إطلاق القنوات.",
    action: "جرّب الآن",
  },
];

export default function DashboardPage() {
  const [items, setItems] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  async function loadItems() {
    setLoading(true);
    try {
      const [itemsResult, channelsResult] = await Promise.allSettled([
        api.get("/items"),
        api.get("/channels"),
      ]);
      if (itemsResult.status === "fulfilled") setItems(itemsResult.value.data || []);
      if (channelsResult.status === "fulfilled") setChannels(channelsResult.value.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) return loadItems();
    const { data } = await api.get("/items/search", { params: { q: search.trim() } });
    setItems(data);
  }

  async function handleCreate(payload) {
    await api.post("/items", payload);
    setShowForm(false);
    setEditing(null);
    await loadItems();
  }

  async function handleUpdate(payload) {
    await api.put(`/items/${editing.id}`, payload);
    setShowForm(false);
    setEditing(null);
    await loadItems();
  }

  async function handleDelete(item) {
    if (!window.confirm(`حذف "${item.name}"؟`)) return;
    await api.delete(`/items/${item.id}`);
    await loadItems();
  }

  async function handleToggle(item) {
    await api.patch(`/items/${item.id}/toggle`);
    await loadItems();
  }

  async function handleImageUpload(file) {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post(`/items/${editing.id}/image`, fd);
    setEditing(data);
    await loadItems();
  }

  const stats = useMemo(() => {
    const categories = new Set(items.map((item) => item.category).filter(Boolean));
    const activeChannels = channels.filter((channel) => channel.is_active).length;
    return {
      total: items.length,
      available: items.filter((item) => item.available).length,
      categories: categories.size,
      activeChannels,
    };
  }, [items, channels]);

  const readiness = [
    { done: stats.total > 0, label: "أضف منتجات أو خدمات" },
    { done: stats.activeChannels > 0, label: "اربط قناة تواصل" },
    { done: true, label: "اختبر تجربة العميل" },
    { done: true, label: "فعّل التحويل البشري" },
  ];
  const readinessScore = Math.round((readiness.filter((item) => item.done).length / readiness.length) * 100);

  return (
    <div className="py-7" dir="rtl">
      <div className="app-container space-y-7">
        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface overflow-hidden p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Control center</p>
                <h1 className="mt-2 text-2xl font-black text-gray-950 dark:text-white sm:text-3xl">
                  لوحة تشغيل مسار
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-slate-300">
                  كل ما يحتاجه العميل يظهر كمسار واضح: اربط القنوات، أضف المنتجات، اختبر الردود، واترك التحويل البشري للحالات الحساسة.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/channels" className="btn-primary">
                  <Cable className="h-4 w-4" />
                  ربط قناة
                </Link>
                <Link to="/chat" className="btn-secondary">
                  <MessageSquareText className="h-4 w-4" />
                  تجربة العميل
                </Link>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "المنتجات", value: stats.total, icon: PackageSearch, tone: "text-brand-600" },
                { label: "المتاح", value: stats.available, icon: CheckCircle2, tone: "text-mint-600" },
                { label: "التصنيفات", value: stats.categories, icon: Workflow, tone: "text-ember-600" },
                { label: "القنوات الفعالة", value: stats.activeChannels, icon: Cable, tone: "text-cyan-600" },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.label} className="surface-soft p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-gray-500 dark:text-slate-400">{card.label}</span>
                      <Icon className={`h-5 w-5 ${card.tone}`} />
                    </div>
                    <div className="mt-3 text-3xl font-black text-gray-950 dark:text-white">{card.value}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="surface p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Launch readiness</p>
                <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white">جاهزية الإطلاق</h2>
              </div>
              <span className="rounded-lg bg-mint-50 px-3 py-2 text-lg font-black text-mint-700 dark:bg-mint-500/10 dark:text-mint-300">
                {readinessScore}%
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-mint-500" style={{ width: `${readinessScore}%` }} />
            </div>
            <div className="mt-5 space-y-3">
              {readiness.map((item) => (
                <div key={item.label} className="flex items-center gap-3 text-sm">
                  <span className={`grid h-6 w-6 place-items-center rounded-lg ${item.done ? "bg-mint-50 text-mint-600 dark:bg-mint-500/10 dark:text-mint-300" : "bg-gray-100 text-gray-400 dark:bg-slate-800"}`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span className="font-bold text-gray-700 dark:text-slate-200">{item.label}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">End-user paths</p>
              <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white">مسارات تجربة العميل النهائي</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                كل بطاقة تفتح خطوة عملية، حتى يعرف صاحب العمل ماذا يفعل بعد تسجيل الدخول مباشرة.
              </p>
            </div>
            <Link to="/channels" className="btn-secondary">
              فتح صفحة الربط
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {journeyCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.title} to={card.to} className="surface group p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-700 transition group-hover:bg-mint-600 group-hover:text-white dark:bg-slate-800 dark:text-slate-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-black text-gray-950 dark:text-white">{card.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-slate-400">{card.text}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-mint-700 dark:text-mint-300">
                        {card.action}
                        <ArrowLeft className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="surface p-4 sm:p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Catalog</p>
              <h2 className="mt-2 text-xl font-black text-gray-950 dark:text-white">المنتجات والخدمات</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                المساعد يستخدم هذه القائمة للرد المختصر ثم يسأل العميل عن اهتمامه قبل التفاصيل.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form onSubmit={handleSearch} className="flex min-w-[260px] flex-1 gap-2 sm:flex-none">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث عن منتج أو خدمة"
                    dir="auto"
                    className="input-field pe-10"
                  />
                </div>
                <button className="btn-secondary" title="بحث">
                  <Search className="h-4 w-4" />
                </button>
              </form>
              <button onClick={loadItems} className="icon-button" title="تحديث">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="btn-primary"
              >
                <Plus className="h-4 w-4" />
                إضافة
              </button>
            </div>
          </div>

          {showForm && (
            <div className="mb-6">
              <ItemForm
                initial={editing}
                onSubmit={editing ? handleUpdate : handleCreate}
                onImageUpload={editing ? handleImageUpload : null}
                onCancel={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              />
            </div>
          )}

          {loading ? (
            <div className="surface-soft flex items-center justify-center gap-3 p-8 text-gray-500 dark:text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : items.length === 0 ? (
            <div className="surface-soft p-8 text-center">
              <PackagePlus className="mx-auto h-10 w-10 text-gray-400" />
              <h3 className="mt-3 font-black text-gray-950 dark:text-white">لا يوجد منتجات بعد</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                أضف أول منتج حتى يعرف المساعد ماذا تبيع ومتى يعطي تفاصيل.
              </p>
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="btn-primary mt-4"
              >
                <Sparkles className="h-4 w-4" />
                إضافة أول منتج
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={(it) => {
                    setEditing(it);
                    setShowForm(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
