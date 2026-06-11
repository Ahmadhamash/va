"use client";

import Link from "next/link";
import { Bell, MessageCircle, Search, Menu } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { languageLabels, useLanguageStore } from "@/store/use-language-store";

export function Topbar({
  title,
  subtitle,
  actionLabel,
  onMenuToggle
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onMenuToggle?: () => void;
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { token } = useAuthStore();
  const language = useLanguageStore((state) => state.language);
  const labels = languageLabels[language];
  const isRtl = language === "ar";
  const { data: conversations = [] } = useQuery({
    queryKey: ["topbar-conversations"],
    queryFn: async () => {
      const res = await apiClient.get("/conversations?limit=100");
      return res.data.conversations || [];
    },
    enabled: !!token,
    refetchInterval: 15000,
  });
  const notificationCount = useMemo(() => {
    return conversations.reduce((sum: number, item: any) => sum + (item.unreadCount || 0), 0);
  }, [conversations]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = query.trim();
    router.push(clean ? `/inbox?q=${encodeURIComponent(clean)}` : "/inbox");
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/70 backdrop-blur-2xl">
      <div className="flex min-h-20 items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuToggle}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label={labels.openMenu}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className={cn(isRtl ? "text-right" : "text-left")}>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-white/45">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <LanguageToggle />
        </div>
        <div className="hidden min-w-80 items-center gap-3 md:flex">
          <form className="relative flex-1" onSubmit={submitSearch}>
            <Search
              className={cn(
                "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-white/30",
                isRtl ? "right-3" : "left-3",
              )}
            />
            <Input
              className={cn(isRtl ? "pr-9 text-right" : "pl-9 text-left")}
              placeholder={labels.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          <LanguageToggle />
          <ThemeToggle />
          <Link href="/inbox?status=NEEDS_HUMAN" aria-label={labels.notifications}>
            <Button variant="secondary" size="sm" className="relative">
              <Bell className="h-4 w-4" />
              {notificationCount > 0 ? (
                <span className={cn(
                  "absolute -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white",
                  isRtl ? "-left-1" : "-right-1",
                )}>
                  {notificationCount > 99 ? "99+" : notificationCount}
                </span>
              ) : null}
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button size="sm">
              <MessageCircle className="h-4 w-4" />
              {actionLabel || labels.connectChannel}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
