"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

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

  return (
    <div className="min-h-screen">
      <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />
      <div className="lg:pr-72">
        <Topbar
          title={title}
          subtitle={subtitle}
          actionLabel={actionLabel}
          onMenuToggle={() => setIsOpen(!isOpen)}
        />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
