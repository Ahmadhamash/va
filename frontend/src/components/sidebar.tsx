"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  CreditCard,
  Facebook,
  Home,
  Inbox,
  Instagram,
  LogOut,
  MessageCircle,
  Settings,
  Sparkles,
  Users,
  WalletCards,
  X,
  Mic,
  Calendar,
  Zap,
  Scale
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
    ]
  },
  {
    title: "الذكاء الاصطناعي",
    items: [
      { href: "/agent", label: "الوكيل الذكي", icon: Bot },
      { href: "/knowledge", label: "قاعدة المعرفة", icon: WalletCards },
      { href: "/workflows", label: "الأتمتة والردود", icon: Zap },
    ]
  },
  {
    title: "خدمة العملاء",
    items: [
      { href: "/bookings", label: "الحجوزات", icon: Calendar },
      { href: "/policies", label: "سياسات العمل", icon: Scale },
    ]
  },
  {
    title: "الإدارة",
    items: [
      { href: "/team", label: "فريق العمل", icon: Users },
      { href: "/billing", label: "الاشتراك والباقات", icon: CreditCard },
      { href: "/settings/voice", label: "إعدادات الصوت", icon: Mic },
      { href: "/settings", label: "الإعدادات العامة", icon: Settings }
    ]
  }
];

const adminNavGroups = [
  {
    title: "إدارة المنصة",
    items: [
      { href: "/admin", label: "لوحة الإشراف", icon: Home },
      { href: "/settings", label: "الإعدادات", icon: Settings }
    ]
  }
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  const navGroups = user?.role === "admin" ? adminNavGroups : clientNavGroups;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 border-l border-white/10 bg-ink-950/90 p-5 backdrop-blur-2xl transition-transform duration-300 lg:translate-x-0 lg:block",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex items-center justify-between lg:hidden mb-5">
          <span className="text-sm font-semibold text-white/50">القائمة</span>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-3xl bg-emeraldx-500 text-ink-950 shadow-glow">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">مسار</span>
            <span className="block text-xs text-white/42">كل قنوات العملاء بمكان واحد</span>
          </span>
        </Link>

        {user?.role === "admin" ? (
          <div className="mt-8 rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyanx-400">
              <Sparkles className="h-4 w-4 animate-pulse" />
              <span>مدير المنصة</span>
            </div>
            <p className="mt-3 text-xs leading-5 text-white/50 text-right">
              لديك صلاحيات كاملة لإدارة حسابات العملاء، مراجعة إحصائيات الاستخدام وتهيئة إعدادات الذكاء الاصطناعي للمنصة.
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
              <Sparkles className="h-4 w-4" />
              {user ? user.business_name || user.username : "جاهزية الربط"}
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/10">
              <div className="h-full w-4/5 rounded-full bg-emeraldx-500" />
            </div>
            <div className="mt-4 flex gap-2 text-white/58">
              <MessageCircle className="h-4 w-4 text-emeraldx-400" />
              <Facebook className="h-4 w-4 text-cyanx-400" />
              <Instagram className="h-4 w-4 text-violet-200" />
            </div>
            <p className="mt-3 text-xs leading-5 text-white/50 text-right">الوكيل جاهز للتجربة. اربط قنوات Meta الرسمية عند تفعيل الحسابات.</p>
          </div>
        )}

        <nav className="mt-6 space-y-6 overflow-y-auto max-h-[calc(100vh-320px)] scrollbar-none pb-10 pr-2">
          {navGroups.map((group, i) => (
            <div key={i} className="space-y-2">
              {group.title && (
                <div className="px-3 text-[11px] font-bold text-white/30">
                  {group.title}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  // Exact match for /settings so it doesn't highlight when on /settings/voice
                  const isActive = 
                    pathname === item.href || 
                    (item.href !== "/dashboard" && item.href !== "/admin" && item.href !== "/settings" && pathname?.startsWith(item.href));
                  
                  return (
                    <Link
                      href={item.href}
                      key={item.href}
                      onClick={onClose}
                      className={cn(
                        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                        isActive
                          ? "bg-emeraldx-500/10 text-white border-r-2 border-emeraldx-500"
                          : "text-white/58 hover:bg-white/8 hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition",
                          isActive ? "text-emeraldx-400" : "text-white/38 group-hover:text-emeraldx-400"
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
