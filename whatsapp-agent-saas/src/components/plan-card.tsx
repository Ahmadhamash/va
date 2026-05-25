"use client";

import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { cn } from "@/lib/utils";

export function PlanCard({
  name,
  price,
  description,
  features,
  highlighted = false
}: {
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}) {
  const [selected, setSelected] = useState(false);
  return (
    <GradientCard className={cn(highlighted && "border-emeraldx-400/40 shadow-glow")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white">{name}</h3>
          <p className="mt-2 text-sm leading-6 text-white/52">{description}</p>
        </div>
        {highlighted ? (
          <span className="rounded-full bg-emeraldx-500 px-3 py-1 text-xs font-bold text-ink-950">
            الأفضل
          </span>
        ) : null}
      </div>
      <div className="mt-7 text-4xl font-semibold text-white">{price}</div>
      <Button variant={highlighted || selected ? "primary" : "secondary"} className="mt-6 w-full" onClick={() => setSelected(true)}>
        {selected ? "تم اختيار الباقة" : "اختيار الباقة"}
      </Button>
      <div className="mt-6 space-y-3">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-sm text-white/68">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emeraldx-400" />
            {feature}
          </div>
        ))}
      </div>
    </GradientCard>
  );
}
