import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold outline-none transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:ring-2 focus-visible:ring-emeraldx-400/70",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-13 px-6 py-4 text-base",
        variant === "primary" &&
          "bg-emeraldx-500 text-ink-950 shadow-glow hover:-translate-y-0.5 hover:bg-emeraldx-400",
        variant === "secondary" &&
          "border border-white/12 bg-white/8 text-white hover:-translate-y-0.5 hover:bg-white/12",
        variant === "ghost" && "text-white/70 hover:bg-white/8 hover:text-white",
        variant === "danger" &&
          "border border-red-400/30 bg-red-500/12 text-red-100 hover:bg-red-500/20",
        className
      )}
      {...props}
    />
  );
}
