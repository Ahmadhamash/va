import { AlertCircle, Bot, CircleCheck, Clock3, PauseCircle, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConnectionStatus, ConversationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: ConnectionStatus | ConversationStatus | "ACTIVE" | "PAUSED";
};

const labels: Record<string, string> = {
  DISCONNECTED: "غير مربوط",
  SETUP_REQUIRED: "يحتاج إعداد",
  PENDING_VERIFICATION: "بانتظار التحقق",
  CONNECTED: "مربوط",
  READY: "جاهز",
  ERROR: "خطأ",
  DEMO_MODE: "وضع تجريبي",
  AI_HANDLING: "الذكاء يتابع",
  NEEDS_HUMAN: "يحتاج موظف",
  HUMAN_ACTIVE: "موظف يتابع",
  CLOSED: "مغلق",
  ACTIVE: "نشط",
  PAUSED: "متوقف"
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const Icon =
    status === "READY" || status === "CONNECTED"
      ? CircleCheck
      : status === "DEMO_MODE" || status === "AI_HANDLING"
        ? Bot
        : status === "NEEDS_HUMAN" || status === "HUMAN_ACTIVE"
          ? UserCheck
          : status === "PAUSED"
            ? PauseCircle
            : status === "ERROR"
              ? AlertCircle
              : Clock3;

  return (
    <Badge
      className={cn(
        "border-transparent",
        ["READY", "CONNECTED", "ACTIVE"].includes(status) && "bg-emeraldx-500/14 text-emeraldx-400",
        status === "DEMO_MODE" && "bg-cyanx-500/14 text-cyanx-400",
        ["NEEDS_HUMAN", "HUMAN_ACTIVE"].includes(status) && "bg-violetrx-500/16 text-violet-200",
        ["DISCONNECTED", "SETUP_REQUIRED", "PENDING_VERIFICATION", "PAUSED"].includes(status) &&
          "bg-amber-500/14 text-amber-200",
        status === "ERROR" && "bg-red-500/16 text-red-200",
        status === "CLOSED" && "bg-white/10 text-white/58"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {labels[status] ?? status}
    </Badge>
  );
}
