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
  PhoneCall,
  Scale,
  Settings,
  Sparkles,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";
import { languageLabels, useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

type NavKey = keyof typeof languageLabels.ar.nav;
type NavItem = { href: string; labelKey: NavKey; icon: LucideIcon };
type NavGroup = { titleKey: NavKey; items: NavItem[] };

const clientNavGroups: NavGroup[] = [
  {
    titleKey: "basics",
    items: [
      { href: "/dashboard", labelKey: "dashboard", icon: Home },
      { href: "/inbox", labelKey: "inbox", icon: Inbox },
      { href: "/analytics", labelKey: "analytics", icon: BarChart3 },
    ],
  },
  {
    titleKey: "ai",
    items: [
      { href: "/agent", labelKey: "agent", icon: Bot },
      { href: "/ai-monitor", labelKey: "monitor", icon: BrainCircuit },
      { href: "/knowledge", labelKey: "knowledge", icon: WalletCards },
    ],
  },
  {
    titleKey: "business",
    items: [
      { href: "/onboarding", labelKey: "onboarding", icon: MessageCircle },
      { href: "/bookings", labelKey: "bookings", icon: Calendar },
      { href: "/policies", labelKey: "policies", icon: Scale },
      { href: "/billing", labelKey: "billing", icon: CreditCard },
      { href: "/settings/voice", labelKey: "voice", icon: Mic },
      { href: "/settings/calls", labelKey: "calls", icon: PhoneCall },
      { href: "/settings", labelKey: "settings", icon: Settings },
    ],
  },
];

const adminNavGroups: NavGroup[] = [
  {
    titleKey: "platform",
    items: [
      { href: "/admin", labelKey: "admin", icon: Home },
      { href: "/team", labelKey: "team", icon: Users },
      { href: "/support", labelKey: "support", icon: Inbox },
      { href: "/settings", labelKey: "settings", icon: Settings },
    ],
  },
];

const supportNavGroups: NavGroup[] = [
  {
    titleKey: "support",
    items: [
      { href: "/inbox", labelKey: "inbox", icon: Inbox },
      { href: "/analytics", labelKey: "analytics", icon: BarChart3 },
      { href: "/settings", labelKey: "account", icon: Settings },
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
  const language = useLanguageStore((state) => state.language);
  const labels = languageLabels[language];
  const isRtl = language === "ar";
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
  const roleLabel = user?.role === "admin"
    ? labels.platformAdmin
    : user?.role === "support_agent"
      ? labels.supportAgent
      : user?.business_name || user?.username || labels.setupReady;

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
          "fixed inset-y-0 z-50 w-72 bg-ink-950/90 p-5 backdrop-blur-2xl transition-transform duration-300 lg:block lg:translate-x-0",
          isRtl ? "right-0 border-l border-white/10" : "left-0 border-r border-white/10",
          isOpen
            ? "translate-x-0"
            : isRtl
              ? "translate-x-full lg:translate-x-0"
              : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="mb-5 flex items-center justify-between lg:hidden">
          <span className="text-sm font-semibold text-white/50">{labels.menu}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={labels.closeMenu}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-500 text-white shadow-glow">
            <MessageCircle className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-semibold text-white">chatter</span>
            <span className="block text-xs text-white/42">{labels.brandHint}</span>
          </span>
        </Link>

        <div className="mt-8 rounded-2xl border border-primary-400/20 bg-primary-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-400">
            <Sparkles className="h-4 w-4" />
            {roleLabel}
          </div>
          <p className={cn("mt-3 text-xs leading-5 text-white/50", isRtl ? "text-right" : "text-left")}>
            {user?.role === "support_agent" ? labels.supportSummary : labels.clientSummary}
          </p>
        </div>

        <nav
          ref={navRef}
          onScroll={handleScroll}
          className={cn(
            "mt-6 max-h-[calc(100vh-300px)] space-y-6 overflow-y-auto pb-10 scrollbar-none",
            isRtl ? "pr-2" : "pl-2",
          )}
        >
          {navGroups.map((group) => (
            <div key={group.titleKey} className="space-y-2">
              <div className="px-3 text-[11px] font-bold text-white/30">
                {labels.nav[group.titleKey]}
              </div>
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
                          ? cn(
                              "bg-primary-500/10 text-white",
                              isRtl ? "border-r-2 border-primary-500" : "border-l-2 border-primary-500",
                            )
                          : "text-white/58 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 transition",
                          isActive ? "text-primary-400" : "text-white/38 group-hover:text-primary-400",
                        )}
                      />
                      {labels.nav[item.labelKey]}
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
              {labels.logout}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
