import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BadgePercent,
  Bot,
  CalendarClock,
  Cable,
  CreditCard,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Mic2,
  Moon,
  PackageSearch,
  PanelRightOpen,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Sun,
  Truck,
  UserCheck,
  Workflow,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import api from "../services/api";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const prevCount = useRef(0);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user?.role === "client") {
      const poll = () =>
        api
          .get("/handoff/", { params: { status: "pending" } })
          .then(({ data }) => {
            const newCount = data.length || 0;
            if (newCount > prevCount.current) {
              setToast({ title: t("new_escalation"), message: t("escalation_message") });
              setTimeout(() => setToast(null), 5000);
            }
            prevCount.current = newCount;
            setPendingCount(newCount);
          })
          .catch(() => {});
      poll();
      const iv = setInterval(poll, 5000);
      return () => clearInterval(iv);
    }
  }, [user, t]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const groups =
    user?.role === "admin"
      ? [
          {
            title: "Admin",
            items: [{ to: "/", label: t("nav_clients"), icon: LayoutDashboard, hint: "Accounts" }],
          },
        ]
      : [
          {
            title: "مسار التشغيل",
            items: [
              { to: "/", label: t("nav_catalog"), icon: PackageSearch, hint: "المنتجات" },
              { to: "/channels", label: t("nav_channels"), icon: Cable, hint: "الربط" },
              { to: "/voice-settings", label: t("nav_voice_settings"), icon: Mic2, hint: "الصوت" },
              { to: "/automation", label: t("nav_automation"), icon: Workflow, hint: "التدفقات" },
            ],
          },
          {
            title: "خدمة العملاء",
            items: [
              { to: "/chat", label: t("nav_chat"), icon: MessageSquareText, hint: "تجربة" },
              { to: "/handoff", label: t("nav_handoff"), icon: UserCheck, hint: "تحويل", badge: pendingCount },
              { to: "/ai-safety", label: t("nav_ai_safety"), icon: ShieldCheck, hint: "مراقبة" },
            ],
          },
          {
            title: "العمليات",
            items: [
              { to: "/bookings", label: t("nav_bookings"), icon: CalendarClock, hint: "حجوزات" },
              { to: "/delivery", label: t("nav_delivery"), icon: Truck, hint: "توصيل" },
              { to: "/policies", label: t("nav_policies"), icon: ScrollText, hint: "سياسات" },
              { to: "/offers", label: t("nav_offers"), icon: BadgePercent, hint: "عروض" },
              { to: "/payments", label: t("nav_payments"), icon: CreditCard, hint: "دفع" },
            ],
          },
        ];

  const navItem = (item, compact = false) => {
    const active = pathname === item.to;
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to}
        className={cx(
          "group relative flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
          active
            ? "border-ink-900 bg-ink-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-ink-900"
            : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-white hover:text-gray-950 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white",
          compact && "w-full"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        {!compact && <span className="hidden text-[11px] font-medium opacity-60 xl:inline">{item.hint}</span>}
        {item.badge > 0 && (
          <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/92 backdrop-blur dark:border-slate-800 dark:bg-[#0b1118]/92">
      <div className="app-container flex min-h-16 items-center justify-between gap-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button className="icon-button md:hidden" onClick={() => setMenuOpen((open) => !open)} aria-label="فتح القائمة">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-900 text-white shadow-sm dark:bg-white dark:text-ink-900">
              <Bot className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-gray-950 dark:text-white">
                {t("business_assistant")}
              </span>
              <span className="hidden text-xs text-gray-500 dark:text-slate-400 sm:block">
                مركز تشغيل الردود والقنوات
              </span>
            </span>
          </Link>
          {user?.role === "admin" && (
            <span className="rounded-full bg-ember-50 px-2.5 py-1 text-xs font-bold text-ember-600 dark:bg-ember-500/10 dark:text-ember-300">
              {t("admin")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="icon-button" title={isDark ? "الوضع النهاري" : "الوضع الليلي"}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={toggleLanguage} className="btn-secondary hidden h-10 px-3 sm:inline-flex">
            <Globe2 className="h-4 w-4" />
            {i18n.language === "ar" ? t("english") : t("arabic")}
          </button>
          {user ? (
            <>
              <div className="hidden max-w-[180px] truncate text-sm font-semibold text-gray-700 dark:text-slate-200 lg:block">
                {user?.business_name || user?.username}
              </div>
              <button onClick={handleLogout} className="icon-button" title={t("logout")}>
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary hidden sm:inline-flex">
                {t("login")}
              </Link>
              <Link to="/register" className="btn-primary">
                {t("register")}
              </Link>
            </>
          )}
        </div>
      </div>

      {user && (
        <div className="hidden border-t border-gray-100 bg-gray-50/80 dark:border-slate-800 dark:bg-slate-950/50 md:block">
          <div className="app-container flex gap-5 overflow-x-auto py-2">
            {groups.map((group) => (
              <div key={group.title} className="flex items-center gap-2">
                <span className="whitespace-nowrap text-xs font-bold text-gray-400 dark:text-slate-500">
                  {group.title}
                </span>
                <div className="flex items-center gap-1">{group.items.map((item) => navItem(item))}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 dark:border-slate-800 dark:bg-[#0b1118] md:hidden">
          <div className="space-y-4 pt-3">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-400 dark:text-slate-500">
                  <PanelRightOpen className="h-3.5 w-3.5" />
                  {group.title}
                </div>
                <div className="grid gap-1.5">{group.items.map((item) => navItem(item, true))}</div>
              </div>
            ))}
            <button onClick={toggleLanguage} className="btn-secondary w-full">
              <Globe2 className="h-4 w-4" />
              {i18n.language === "ar" ? t("english") : t("arabic")}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-4 ${
            i18n.language === "ar" ? "left-4" : "right-4"
          } z-50 flex max-w-sm gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-xl animate-fadein dark:border-slate-700 dark:bg-slate-900`}
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-gray-950 dark:text-white">{toast.title}</h4>
            <p className="text-sm text-gray-600 dark:text-slate-300">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </header>
  );
}
