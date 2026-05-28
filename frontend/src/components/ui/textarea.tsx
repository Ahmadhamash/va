import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-2xl border border-border bg-surface-hover px-4 py-3 text-right text-sm leading-6 text-primary outline-none transition placeholder:text-muted focus:border-brand/60 focus:ring-2 focus:ring-brand/15",
        className
      )}
      {...props}
    />
  );
}
