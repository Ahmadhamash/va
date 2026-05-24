import Link from "next/link";
import { Bell, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Topbar({
  title,
  subtitle,
  actionLabel = "Connect WhatsApp Business"
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/70 backdrop-blur-2xl">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-white/45">{subtitle}</p> : null}
        </div>
        <div className="hidden min-w-80 items-center gap-3 md:flex">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <Input className="pl-9" placeholder="Search customers, products..." />
          </div>
          <Button variant="secondary" size="sm" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Link href="/onboarding">
            <Button size="sm">
              <MessageCircle className="h-4 w-4" />
              {actionLabel}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
