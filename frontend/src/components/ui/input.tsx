import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-right text-sm text-white outline-none transition placeholder:text-white/28 focus:border-emeraldx-400/60 focus:ring-2 focus:ring-emeraldx-400/15",
        className
      )}
      {...props}
    />
  );
}
