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
  Users,
  Webhook,
  Code
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ChannelConnectionCard } from "@/components/channel-connection-card";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/types";
import { useAuthStore } from "@/store/use-auth-store";
import { Loader2 } from "lucide-react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-hot-toast";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [aiPaused, setAiPaused] = useState(false);
  const { token } = useAuthStore();

  const { data: conversations = [], isLoading: loadingConversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await apiClient.get("/conversations");
      const data = res.data.conversations || [];
      return [...data].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    },
    enabled: !!token,
  });

  const { data: channels = [], isLoading: loadingChannels } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const res = await apiClient.get("/integrations/connect");
      return res.data.channels || [];
    },
    enabled: !!token,
  });

  const { data: knowledgeCount = 0 } = useQuery({
    queryKey: ["knowledgeCount"],
    queryFn: async () => {
      const res = await apiClient.get("/knowledge");
      return res.data.knowledge?.length || 0;
    },
    enabled: !!token,
  });

  const { data: productsCount = 0 } = useQuery({
    queryKey: ["productsCount"],
    queryFn: async () => {
      const res = await apiClient.get("/products");
      return res.data.products?.length || 0;
    },
    enabled: !!token,
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return apiClient.delete(`/integrations/connect/${channelId}`);
    },
    onSuccess: () => {
      toast.success("تم حذف القناة بنجاح.");
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف القناة.");
    },
  });

  async function deleteChannel(channelId: string) {
    if (!token) return;
    deleteChannelMutation.mutate(channelId);
  }

  const activeChannelsCount = channels.filter((c: any) => c.status === "CONNECTED").length;
  const pendingHandoffs = conversations.filter((c: any) => c.status === "NEEDS_HUMAN").length;
  const activeHandoffs = conversations.filter((c: any) => c.status === "HUMAN_ACTIVE").length;
  const loading = loadingConversations || loadingChannels;

  return (
    <AppShell title="الرئيسية" subtitle="مركز تحكم بسيط لكل قنوات خدمة العملاء الذكية.">
      <div className="space-y-6">
        <ChannelConnectionCard channels={channels} onDelete={deleteChannel} />



        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="القنوات النشطة" value={String(activeChannelsCount)} hint={channels.length > 0 ? "نشط" : "لا توجد قنوات"} icon={MessageCircle} />
          <MetricCard label="الوكيل الذكي" value={aiPaused ? "متوقف" : "نشط"} hint={aiPaused ? "Paused" : "Live"} icon={Bot} />
          <MetricCard label="إجمالي المحادثات" value={String(conversations.length)} hint="في النظام" icon={Inbox} />
          <MetricCard label="بانتظار موظف" value={String(pendingHandoffs)} hint="تحويل بشري" icon={Users} />
          <MetricCard label="قيد المتابعة" value={String(activeHandoffs)} hint="متابعة جارية" icon={Clock3} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-primary">آخر المحادثات</h2>
                <p className="mt-1 text-sm text-secondary">نظرة سريعة على العملاء والقناة وحالة المتابعة.</p>
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
                <div className="text-center text-muted py-8">لا توجد محادثات حديثة</div>
              ) : (
                conversations.slice(0, 5).map((conversation) => (
                  <div key={conversation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-surface-hover p-4">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-primary">
                        {conversation.channel === "WHATSAPP" ? (
                          <MessageCircle className="h-4 w-4 text-brand" />
                        ) : conversation.channel === "FACEBOOK" || conversation.channel === "MESSENGER" ? (
                          <Facebook className="h-4 w-4 text-brand-accent" />
                        ) : conversation.channel === "INSTAGRAM" ? (
                          <Instagram className="h-4 w-4 text-violet-400" />
                        ) : conversation.channel === "WEBHOOK" ? (
                          <Webhook className="h-4 w-4 text-amber-400" />
                        ) : conversation.channel === "WIDGET" ? (
                          <Code className="h-4 w-4 text-teal-400" />
                        ) : (
                          <MessageCircle className="h-4 w-4 text-brand" />
                        )}
                        {conversation.customerName}
                      </div>
                      <div className="mt-1 text-sm text-secondary">{conversation.lastMessage}</div>
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
                  <h2 className="text-xl font-semibold text-primary">صحة الوكيل</h2>
                  <p className="mt-1 text-sm text-secondary">يرد من معلومات محفوظة ويتوقف عند الحساسية.</p>
                </div>
                <StatusBadge status={aiPaused ? "PAUSED" : "ACTIVE"} />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  ["حقائق وقواعد المعرفة", `${knowledgeCount} عناصر`],
                  ["المنتجات والخدمات", `${productsCount} متاح`],
                  ["قواعد التحويل البشري", "مفعّل"]
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-surface-hover border border-border px-4 py-3 text-sm">
                    <span className="text-secondary">{label}</span>
                    <span className="font-semibold text-primary">{value}</span>
                  </div>
                ))}
              </div>
            </GradientCard>

            <GradientCard>
              <h2 className="text-xl font-semibold text-primary">إجراءات سريعة</h2>
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
