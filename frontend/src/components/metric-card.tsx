import type { LucideIcon } from "lucide-react";
import { GradientCard } from "@/components/gradient-card";

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}) {
  return (
    <GradientCard>
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-white/8 p-3 text-emeraldx-400">
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-xs font-semibold text-white/42">{hint}</span>
      </div>
      <div className="mt-6 text-3xl font-semibold tracking-tight text-white">{value}</div>
      <div className="mt-1 text-sm text-white/55">{label}</div>
    </GradientCard>
  );
}
