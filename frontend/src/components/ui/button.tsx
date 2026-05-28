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
        "focus-visible:ring-2 focus-visible:ring-brand/70",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-13 px-6 py-4 text-base",
        variant === "primary" &&
          "bg-brand text-white hover:bg-brand-hover shadow-glow hover:shadow-glow-lg",
        variant === "secondary" &&
          "border border-border bg-surface-hover text-primary hover:-translate-y-0.5 hover:bg-surface",
        variant === "ghost" && "text-secondary hover:bg-surface hover:text-primary",
        variant === "danger" &&
          "border border-red-500/20 bg-red-500/10 text-red-500 hover:-translate-y-0.5 hover:bg-red-500/20",
        className
      )}
      {...props}
    />
  );
}
