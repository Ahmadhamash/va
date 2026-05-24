import { Bot, MessageCircle } from "lucide-react";
import { GradientCard } from "@/components/gradient-card";

export function AgentPreview({
  tone = "ودود",
  strictness = "متوازن"
}: {
  tone?: string;
  strictness?: string;
}) {
  return (
    <GradientCard>
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-3xl bg-violetrx-500/20 text-violet-200">
          <Bot className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">هكذا سيبدو صوت الوكيل</h3>
          <p className="text-sm text-white/45">أسلوب {tone} · معرفة {strictness}</p>
        </div>
      </div>
      <div className="mt-5 rounded-3xl bg-white/[0.06] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emeraldx-400">
          <MessageCircle className="h-4 w-4" />
          معاينة الرد
        </div>
        <p className="text-sm leading-7 text-white/72">
          أهلا! عنا ربط واتساب وفيسبوك وإنستغرام وصندوق محادثات موحد. احكيلي بأي قناة حاب تبدأ؟
        </p>
      </div>
    </GradientCard>
  );
}
