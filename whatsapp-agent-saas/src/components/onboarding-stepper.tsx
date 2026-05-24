import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = ["Business", "Connect", "Teach", "Behavior", "Test", "Done"];

export function OnboardingStepper({ current }: { current: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-6">
      {steps.map((step, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div
            key={step}
            className={cn(
              "rounded-2xl border p-3 transition",
              active && "border-emeraldx-400/60 bg-emeraldx-500/12",
              done && "border-emeraldx-400/20 bg-emeraldx-500/8",
              !active && !done && "border-white/10 bg-white/[0.04]"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white/55">0{index + 1}</span>
              {done ? <CheckCircle2 className="h-4 w-4 text-emeraldx-400" /> : null}
            </div>
            <div className={cn("mt-2 text-sm font-semibold", active || done ? "text-white" : "text-white/40")}>
              {step}
            </div>
          </div>
        );
      })}
    </div>
  );
}
