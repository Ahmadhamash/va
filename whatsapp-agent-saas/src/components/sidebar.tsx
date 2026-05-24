"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  WalletCards
} from "lucide-react";
import { useAuthStore } from "@/store/use-auth-store";

const navItems = [
  { href: "/dashboard", label: "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629", icon: Home },
  { href: "/inbox", label: "\u0627\u0644\u0645\u062D\u0627\u062F\u062B\u0627\u062A", icon: Inbox },
  { href: "/agent", label: "\u0627\u0644\u0648\u0643\u064A\u0644 \u0627\u0644\u0630\u0643\u064A", icon: Bot },
  { href: "/knowledge", label: "\u0627\u0644\u0645\u0639\u0631\u0641\u0629", icon: WalletCards },
  { href: "/analytics", label: "\u0627\u0644\u062A\u062D\u0644\u064A\u0644\u0627\u062A", icon: BarChart3 },
  { href: "/team", label: "\u0627\u0644\u0641\u0631\u064A\u0642", icon: Users },
  { href: "/billing", label: "\u0627\u0644\u0628\u0627\u0642\u0627\u062A", icon: CreditCard },
  { href: "/settings", label: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A", icon: Settings }
];

export function Sidebar() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-30 hidden w-72 border-l border-white/10 bg-ink-950/82 p-5 backdrop-blur-2xl lg:block">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-emeraldx-500 text-ink-950 shadow-glow">
          <MessageCircle className="h-6 w-6" />
        </span>
        <span>
          <span className="block text-lg font-semibold text-white">{"\u0645\u0633\u0627\u0631"}</span>
          <span className="block text-xs text-white/42">{"\u0643\u0644 \u0642\u0646\u0648\u0627\u062A \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0628\u0645\u0643\u0627\u0646 \u0648\u0627\u062D\u062F"}</span>
        </span>
      </Link>

      <div className="mt-8 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
          <Sparkles className="h-4 w-4" />
          {user ? user.business_name || user.username : "\u062C\u0627\u0647\u0632\u064A\u0629 \u0627\u0644\u0631\u0628\u0637"}
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/10">
          <div className="h-full w-4/5 rounded-full bg-emeraldx-500" />
        </div>
        <div className="mt-4 flex gap-2 text-white/58">
          <MessageCircle className="h-4 w-4 text-emeraldx-400" />
          <Facebook className="h-4 w-4 text-cyanx-400" />
          <Instagram className="h-4 w-4 text-violet-200" />
        </div>
        <p className="mt-3 text-xs leading-5 text-white/50">{"\u0627\u0644\u0648\u0643\u064A\u0644 \u062C\u0627\u0647\u0632 \u0644\u0644\u062A\u062C\u0631\u0628\u0629. \u0627\u0631\u0628\u0637 \u0642\u0646\u0648\u0627\u062A Meta \u0627\u0644\u0631\u0633\u0645\u064A\u0629 \u0639\u0646\u062F \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A."}</p>
      </div>

      <nav className="mt-8 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.href}
              className="group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-white/58 transition hover:bg-white/8 hover:text-white"
            >
              <Icon className="h-5 w-5 text-white/38 transition group-hover:text-emeraldx-400" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="absolute bottom-5 left-5 right-5">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-red-400/70 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
            {"\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C"}
          </button>
        </div>
      )}
    </aside>
  );
}
