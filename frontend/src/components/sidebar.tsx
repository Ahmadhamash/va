"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  BarChart3,
  Bot,
  BrainCircuit,
  Calendar,
  CreditCard,
  Home,
  Inbox,
  LogOut,
  MessageCircle,
  Mic,
  Scale,
  Settings,
  Sparkles,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";
import { cn } from "@/lib/utils";

const clientNavGroups = [
  {
    title: "الأساسية",
    items: [
      { href: "/dashboard", label: "الرئيسية", icon: Home },
      { href: "/inbox", label: "المحادثات", icon: Inbox },
      { href: "/analytics", label: "التحليلات", icon: BarChart3 },
    ],
  },
  {
    title: "الذكاء الاصطناعي",
    items: [
      { href: "/agent", label: "الوكيل الذكي", icon: Bot },
      { href: "/ai-monitor", label: "مراقبة الذكاء", icon: BrainCircuit },
      { href: "/knowledge", label: "قاعدة المعرفة", icon: WalletCards },
      { href: "/workflows", label: "الأتمتة والردود", icon: Zap },
    ],
  },
  {
    title: "إدارة العمل",
    items: [
      { href: "/onboarding", label: "ربط القنوات", icon: MessageCircle },
      { href: "/bookings", label: "الحجوزات", icon: Calendar },
      { href: "/policies", label: "سياسات العمل", icon: Scale },
      { href: "/billing", label: "الاشتراك والباقات", icon: CreditCard },
      { href: "/settings/voice", label: "إعدادات الصوت", icon: Mic },
      { href: "/settings", label: "الإعدادات العامة", icon: Settings },
    ],
  },
];

const adminNavGroups = [
  {
    title: "إدارة المنصة",
    items: [
      { href: "/admin", label: "لوحة الإشراف", icon: Home },
      { href: "/team", label: "فريق العمل", icon: Users },
      { href: "/support", label: "مركز الموظفين", icon: Inbox },
      { href: "/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];

const supportNavGroups = [
  {
    title: "مركز الموظفين",
    items: [
      { href: "/support", label: "المحادثات المسندة", icon: Inbox },
      { href: "/settings", label: "حسابي", icon: Settings },
    ],
  },
];

function groupsForRole(role?: string) {
  if (role === "admin") return adminNavGroups;
  if (role === "support_agent") return supportNavGroups;
  return clientNavGroups;
}

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const navRef = useRef<HTMLElement>(null);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  useEffect(() => {
    const savedScroll = sessionStorage.getItem("sidebarScroll");
    if (navRef.current && savedScroll) {
      navRef.current.scrollTop = parseInt(savedScroll, 10);
    }
  }, []);

  const handleScroll = (event: React.UIEvent<HTMLElement>) => {
    sessionStorage.setItem("sidebarScroll", event.currentTarget.scrollTop.toString());
  };

  const navGroups = groupsForRole(user?.role);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 border-l border-white/10 bg-ink-950/90 p-5 backdrop-blur-2xl transition-transform duration-300 lg:block lg:translate-x-0",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <span className="text-sm font-semibold text-white/50">القائمة</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emeraldx-500 text-white shadow-glow">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">chatter</span>
            <span className="block text-xs text-white/42">كل قنوات العملاء بمكان واحد</span>
          </span>
        </Link>

        <div className="mt-8 rounded-2xl border border-emeraldx-400/20 bg-emeraldx-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
            <Sparkles className="h-4 w-4" />
            {user?.role === "admin"
              ? "مدير المنصة"
              : user?.role === "support_agent"
                ? "موظف دعم"
                : user?.business_name || user?.username || "جاهزية الربط"}
          </div>
          <p className="mt-3 text-right text-xs leading-5 text-white/50">
            {user?.role === "support_agent"
              ? "هنا بتوصل المحادثات اللي تحتاج تدخل بشري."
              : "الوكيل جاهز للردود الذكية والتحويل البشري وقت الحاجة."}
          </p>
        </div>

        <nav
          ref={navRef}
          onScroll={handleScroll}
          className="mt-6 max-h-[calc(100vh-300px)] space-y-6 overflow-y-auto pb-10 pr-2 scrollbar-none"
        >
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="px-3 text-[11px] font-bold text-white/30">{group.title}</div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" &&
                      item.href !== "/admin" &&
                      item.href !== "/settings" &&
                      pathname?.startsWith(item.href));

                  return (
                    <Link
                      href={item.href}
                      key={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                        isActive
                          ? "border-r-2 border-emeraldx-500 bg-emeraldx-500/10 text-white"
                          : "text-white/58 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition",
                          isActive ? "text-emeraldx-400" : "text-white/38 group-hover:text-emeraldx-400",
                        )}
                      />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {user && (
          <div className="absolute bottom-5 left-5 right-5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-red-400/70 transition hover:bg-red-500/10 hover:text-red-400"
            >
              <LogOut className="h-5 w-5" />
              تسجيل الخروج
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
