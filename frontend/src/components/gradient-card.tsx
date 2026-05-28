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
        "glass-card relative overflow-hidden rounded-3xl p-5",
        "before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brand/50 before:to-transparent",
        "after:absolute after:-right-16 after:-top-16 after:h-40 after:w-40 after:rounded-full after:bg-brand/10 after:blur-3xl",
        className
      )}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}
