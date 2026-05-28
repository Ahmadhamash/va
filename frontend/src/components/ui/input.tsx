import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-border bg-surface-hover px-4 text-right text-sm text-primary outline-none transition placeholder:text-muted focus:border-brand/60 focus:ring-2 focus:ring-brand/15",
        className
      )}
      {...props}
    />
  );
}
