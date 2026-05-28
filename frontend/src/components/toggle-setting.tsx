import { useState } from "react";
import { cn } from "@/lib/utils";

export function ToggleSetting({
  title,
  description,
  defaultChecked = true,
  checked: controlledChecked,
  onChange
}: {
  title: string;
  description: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : internalChecked;

  const handleToggle = () => {
    const nextValue = !checked;
    if (onChange) {
      onChange(nextValue);
    }
    if (!isControlled) {
      setInternalChecked(nextValue);
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex w-full items-center justify-between gap-4 rounded-3xl border border-border bg-surface p-4 text-right transition hover:bg-surface-hover"
    >
      <span>
        <span className="block text-sm font-semibold text-primary">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted text-right">{description}</span>
      </span>
      <span
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition",
          checked ? "bg-brand" : "bg-border"
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
