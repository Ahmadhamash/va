import Link from "next/link";
import {
  BarChart3,
  Bot,
  CreditCard,
  Home,
  Inbox,
  MessageCircle,
  Settings,
  Sparkles,
  Users,
  WalletCards
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/knowledge", label: "Knowledge", icon: WalletCards },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/team", label: "Team", icon: Users },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-white/10 bg-ink-950/82 p-5 backdrop-blur-2xl lg:block">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-emeraldx-500 text-ink-950 shadow-glow">
          <MessageCircle className="h-6 w-6" />
        </span>
        <span>
          <span className="block text-lg font-semibold text-white">AgentFlow</span>
          <span className="block text-xs text-white/42">Official WhatsApp API</span>
        </span>
      </Link>

      <div className="mt-8 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
          <Sparkles className="h-4 w-4" />
          Setup progress
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/10">
          <div className="h-full w-3/4 rounded-full bg-emeraldx-500" />
        </div>
        <p className="mt-3 text-xs leading-5 text-white/50">Your agent is almost ready. Connect production when your Meta setup is approved.</p>
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
    </aside>
  );
}
