"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { pageMetaForPath, useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  title,
  subtitle,
  actionLabel
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const language = useLanguageStore((state) => state.language);
  const pathname = usePathname();
  const pageMeta = pageMetaForPath(language, pathname);
  const displayTitle = pageMeta?.title ?? title;
  const displaySubtitle = pageMeta?.subtitle ?? subtitle;

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div className={cn(language === "ar" ? "lg:pr-72" : "lg:pl-72")}>
        <Topbar
          title={displayTitle}
          subtitle={displaySubtitle}
          actionLabel={actionLabel}
          onMenuToggle={() => setIsOpen(!isOpen)}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
