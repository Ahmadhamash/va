import { ArrowRight, CheckCircle2, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { StatusBadge } from "@/components/status-badge";
import type { ConnectionStatus } from "@/lib/types";

export function WhatsAppConnectionCard({
  status = "DEMO_MODE"
}: {
  status?: ConnectionStatus;
}) {
  return (
    <GradientCard className="border-emeraldx-400/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-3xl bg-emeraldx-500 text-ink-950 shadow-glow">
            <MessageCircle className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold text-white">Connect WhatsApp Business</h3>
              <StatusBadge status={status} />
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/58">
              Connect your official WhatsApp Business account to let your AI agent reply to customer conversations.
            </p>
          </div>
        </div>
        <Button>
          Start Official Setup
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          "Designed for customer support",
          "Official Cloud API structure",
          "Demo Mode available now"
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/7 px-3 py-2 text-sm text-white/68">
            {item.includes("Official") ? (
              <ShieldCheck className="h-4 w-4 text-cyanx-400" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emeraldx-400" />
            )}
            {item}
          </div>
        ))}
      </div>
    </GradientCard>
  );
}
