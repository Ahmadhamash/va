"use client";

import {
  Bot,
  Clock3,
  Facebook,
  Inbox,
  Instagram,
  MessageCircle,
  PauseCircle,
  PenLine,
  TestTube2,
  UserPlus,
  Users
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ChannelConnectionCard } from "@/components/channel-connection-card";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { ChannelProvider, Conversation } from "@/lib/types";
import { useAuthStore } from "@/store/use-auth-store";
import { Loader2 } from "lucide-react";

const channelNames: Record<ChannelProvider, string> = {
  WHATSAPP: "واتساب",
  FACEBOOK: "فيسبوك",
  INSTAGRAM: "إنستغرام"
};

export default function DashboardPage() {
  const [notice, setNotice] = useState("كل الأنظمة تعمل بشكل طبيعي.");
  const [aiPaused, setAiPaused] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuthStore();
  const [channels, setChannels] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const res = await fetch("/api/conversations", {
          headers: { Authorization: "Bearer " + token }
        });
        const data = await res.json();
        if (data.ok && data.conversations) {
          setConversations(data.conversations.slice(0, 5)); // show latest 5
        }
        
        const cRes = await fetch("/api/channels/connect", {
          headers: { Authorization: "Bearer " + token }
        });
        const cData = await cRes.json();
        if (cData.ok && cData.channels) {
            setChannels(cData.channels.map((c: any) => ({
                id: c.id,
                provider: c.platform.toUpperCase() as ChannelProvider,
                name: c.platform,
                handle: c.public_id,
                status: c.is_active ? "CONNECTED" : "SETUP_REQUIRED",
                description: "قناة مسجلة عبر الباك إند",
                metric: "..."
            })));
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function connect(provider: ChannelProvider) {
    if (!token) return;
    try {
        const res = await fetch("/api/channels/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ provider })
        });
        const data = await res.json();
        setNotice(data.message || `تم تجهيز مسار ربط ${channelNames[provider]}.`);
    } catch (e) {
        setNotice("حدث خطأ أثناء الربط.");
    }
  }

  return (
    <AppShell title="الرئيسية" subtitle="مركز تحكم بسيط لكل قنوات خدمة العملاء الذكية.">
      <div className="space-y-6">
        <ChannelConnectionCard channels={channels} onConnect={connect} />

        <div className="rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 px-5 py-4 text-sm font-semibold text-cyanx-400">
          {notice}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="القنوات النشطة" value="3" hint="Meta" icon={MessageCircle} />
          <MetricCard label="الوكيل الذكي" value={aiPaused ? "متوقف" : "نشط"} hint={aiPaused ? "Paused" : "Live"} icon={Bot} />
          <MetricCard label="محادثات اليوم" value="184" hint="+24%" icon={Inbox} />
          <MetricCard label="تحويل بشري" value="16" hint="8.6%" icon={Users} />
          <MetricCard label="سرعة الرد" value="3.9 ث" hint="سريع" icon={Clock3} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">آخر المحادثات</h2>
                <p className="mt-1 text-sm text-white/45">نظرة سريعة على العملاء والقناة وحالة المتابعة.</p>
              </div>
              <Link href="/inbox">
                <Button variant="secondary">افتح المحادثات</Button>
              </Link>
            </div>
            <div className="space-y-3 min-h-[200px]">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-cyanx-400" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-white/45 py-8">لا توجد محادثات حديثة</div>
              ) : (
                conversations.map((conversation) => (
                  <div key={conversation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-white">
                        {conversation.channel === "WHATSAPP" ? <MessageCircle className="h-4 w-4 text-emeraldx-400" /> : conversation.channel === "FACEBOOK" ? <Facebook className="h-4 w-4 text-cyanx-400" /> : <Instagram className="h-4 w-4 text-violet-200" />}
                        {conversation.customerName}
                      </div>
                      <div className="mt-1 text-sm text-white/45">{conversation.lastMessage}</div>
                    </div>
                    <StatusBadge status={conversation.status} />
                  </div>
                ))
              )}
            </div>
          </GradientCard>

          <div className="space-y-6">
            <GradientCard>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">صحة الوكيل</h2>
                  <p className="mt-1 text-sm text-white/45">يرد من معلومات محفوظة ويتوقف عند الحساسية.</p>
                </div>
                <StatusBadge status={aiPaused ? "PAUSED" : "ACTIVE"} />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  ["تغطية المعرفة", "88%"],
                  ["قواعد التحويل", "7 نشطة"],
                  ["جاهزية الديمو", "جاهز"]
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-white/[0.055] px-4 py-3 text-sm">
                    <span className="text-white/50">{label}</span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </GradientCard>

            <GradientCard>
              <h2 className="text-xl font-semibold text-white">إجراءات سريعة</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button variant="secondary" className="w-full justify-start" onClick={() => setAiPaused((value) => !value)}>
                  <PauseCircle className="h-4 w-4" />
                  {aiPaused ? "تشغيل الذكاء" : "إيقاف الذكاء"}
                </Button>
                {[
                  { label: "تعديل المعرفة", icon: PenLine, href: "/knowledge" },
                  { label: "اختبار الوكيل", icon: TestTube2, href: "/onboarding" },
                  { label: "دعوة موظف", icon: UserPlus, href: "/team" },
                  { label: "ربط قناة", icon: MessageCircle, href: "/onboarding" }
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.label} href={action.href}>
                      <Button variant="secondary" className="w-full justify-start">
                        <Icon className="h-4 w-4" />
                        {action.label}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </GradientCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
