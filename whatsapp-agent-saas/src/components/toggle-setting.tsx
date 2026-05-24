"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function ToggleSetting({
  title,
  description,
  defaultChecked = true
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      onClick={() => setChecked((value) => !value)}
      className="flex w-full items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.075]"
    >
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-white/48">{description}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-emeraldx-500" : "bg-white/14"
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white transition",
            checked ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}
