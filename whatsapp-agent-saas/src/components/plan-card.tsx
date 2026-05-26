"use client";

import { CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { cn } from "@/lib/utils";

interface PlanCardProps {
  id: string;
  name: string;
  price: number | string;
  description: string;
  features: string[];
  highlighted?: boolean;
  isActive?: boolean;
  isLoading?: boolean;
  onSelect?: () => void;
}

export function PlanCard({
  id,
  name,
  price,
  description,
  features,
  highlighted = false,
  isActive = false,
  isLoading = false,
  onSelect
}: PlanCardProps) {
  return (
    <GradientCard className={cn(highlighted && "border-emeraldx-400/40 shadow-glow", "flex flex-col justify-between h-full")}>
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-white">{name}</h3>
            <p className="mt-2 text-sm leading-6 text-white/52">{description}</p>
          </div>
          {isActive ? (
            <span className="rounded-full bg-emeraldx-500 px-3 py-1 text-xs font-bold text-ink-950">
              الباقة الحالية
            </span>
          ) : highlighted ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              الأكثر شعبية
            </span>
          ) : null}
        </div>
        
        <div className="mt-7 text-4xl font-semibold text-white">
          ${price}
          <span className="text-sm font-normal text-white/40">/شهرياً</span>
        </div>

        <div className="mt-6 space-y-3">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm text-white/68">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emeraldx-400" />
              {feature}
            </div>
          ))}
        </div>
      </div>

      <Button
        variant={isActive ? "secondary" : highlighted ? "primary" : "secondary"}
        className={cn(
          "mt-8 w-full transition-all duration-200", 
          isActive && "bg-white/10 border-white/5 text-white/40 cursor-default hover:bg-white/10"
        )}
        disabled={isActive || isLoading}
        onClick={onSelect}
      >
        {isActive ? "باقة مفعلة" : isLoading ? "جاري الترقية..." : "ترقية الاشتراك"}
      </Button>
    </GradientCard>
  );
}

