import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  text,
  action
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.04] p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/52">{text}</p>
      {action ? <Button className="mt-6">{action}</Button> : null}
    </div>
  );
}
