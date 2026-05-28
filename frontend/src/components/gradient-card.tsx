import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GradientCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-emeraldx-400/70 before:to-transparent",
        "after:absolute after:-right-16 after:-top-16 after:h-40 after:w-40 after:rounded-full after:bg-emeraldx-500/10 after:blur-3xl",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
