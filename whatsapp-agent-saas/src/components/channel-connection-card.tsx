import { ArrowLeft, CheckCircle2, Facebook, Instagram, MessageCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GradientCard } from "@/components/gradient-card";
import { StatusBadge } from "@/components/status-badge";
import type { ChannelConnection, ChannelProvider } from "@/lib/types";

const channelIcons = {
  WHATSAPP: MessageCircle,
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram
} satisfies Record<ChannelProvider, typeof MessageCircle>;

export function ChannelConnectionCard({
  channels,
  onConnect
}: {
  channels: ChannelConnection[];
  onConnect?: (provider: ChannelProvider) => void;
}) {
  return (
    <GradientCard className="border-emeraldx-400/20">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-emeraldx-500 text-ink-950 shadow-glow">
              <MessageCircle className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">اربط قنوات العملاء</h3>
              <p className="mt-1 max-w-2xl text-sm leading-7 text-white/58">
                واتساب، فيسبوك، وإنستغرام من لوحة واحدة. التجربة الآن Mock، والربط الحقيقي جاهز ليتم توصيله بـ Meta APIs.
              </p>
            </div>
          </div>
        </div>
        <Button onClick={() => onConnect?.("WHATSAPP")}>
          ابدأ الربط الرسمي
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-3">
        {channels.map((channel) => {
          const Icon = channelIcons[channel.provider];
          return (
            <div key={channel.id} className="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
                  <Icon className="h-5 w-5" />
                </div>
                <StatusBadge status={channel.status} />
              </div>
              <div className="mt-4 text-base font-semibold text-white">{channel.name}</div>
              <div className="mt-1 text-xs font-semibold text-cyanx-400">{channel.handle}</div>
              <p className="mt-3 text-sm leading-6 text-white/55">{channel.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-white/55">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emeraldx-400" />
                  {channel.metric}
                </span>
                <button
                  type="button"
                  onClick={() => onConnect?.(channel.provider)}
                  className="rounded-full bg-white/8 px-3 py-1.5 text-white/70 transition hover:bg-emeraldx-500 hover:text-ink-950"
                >
                  إعداد
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {["رسائل العملاء فقط", "تكامل رسمي قابل للتوصيل", "تحويل بشري عند الحساسية"].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-2xl bg-white/7 px-3 py-2 text-sm text-white/68">
            <ShieldCheck className="h-4 w-4 text-cyanx-400" />
            {item}
          </div>
        ))}
      </div>
    </GradientCard>
  );
}
