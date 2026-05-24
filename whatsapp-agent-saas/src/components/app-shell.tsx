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
  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-72">
        <Topbar title={title} subtitle={subtitle} actionLabel={actionLabel} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
