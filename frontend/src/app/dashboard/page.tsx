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
  Webhook,
  Code
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChannelConnectionCard } from "@/components/channel-connection-card";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/types";
import { useAuthStore } from "@/store/use-auth-store";
import { Loader2 } from "lucide-react";
import { useLanguageStore } from "@/store/use-language-store";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-hot-toast";

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

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

  const { data: autoReply = { enabled: true }, isLoading: loadingAutoReply } = useQuery({
    queryKey: ["autoReply"],
    queryFn: async () => {
      const res = await apiClient.get("/chat/auto-reply");
      return { enabled: res.data.enabled !== false };
    },
    enabled: !!token,
  });

  const aiPaused = autoReply.enabled === false;

  const toggleAutoReplyMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiClient.put("/chat/auto-reply", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autoReply"] });
      toast.success(
        aiPaused 
          ? (isRtl ? "تم تشغيل الرد الآلي." : "Auto-reply enabled.") 
          : (isRtl ? "تم إيقاف الرد الآلي." : "Auto-reply paused.")
      );
    },
    onError: () => {
      toast.error(isRtl ? "تعذر تحديث حالة الرد الآلي." : "Could not update auto-reply status.");
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (channelId: string) => {
      return apiClient.delete(`/integrations/connect/${channelId}`);
    },
    onSuccess: () => {
      toast.success(isRtl ? "تم حذف القناة بنجاح." : "Channel deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
    onError: () => {
      toast.error(isRtl ? "حدث خطأ أثناء حذف القناة." : "Error occurred while deleting channel.");
    },
  });

  async function deleteChannel(channelId: string) {
    if (!token) return;
    deleteChannelMutation.mutate(channelId);
  }

  const activeChannelsCount = channels.filter((c: any) => c.status === "CONNECTED").length;
  const pendingHandoffs = conversations.filter((c: any) => c.status === "NEEDS_HUMAN").length;
  const activeHandoffs = conversations.filter((c: any) => c.status === "HUMAN_ACTIVE").length;
  const loading = loadingConversations || loadingChannels || loadingAutoReply;

  return (
    <AppShell 
      title={isRtl ? "الرئيسية" : "Dashboard"} 
      subtitle={isRtl ? "مركز تحكم بسيط لكل قنوات خدمة العملاء الذكية." : "Simple control center for all smart customer service channels."}
    >
      <div className="space-y-6">
        <ChannelConnectionCard channels={channels} onDelete={deleteChannel} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard 
            label={isRtl ? "القنوات النشطة" : "Active Channels"} 
            value={String(activeChannelsCount)} 
            hint={channels.length > 0 ? (isRtl ? "نشط" : "Live") : (isRtl ? "لا توجد قنوات" : "No Channels")} 
            icon={MessageCircle} 
          />
          <MetricCard 
            label={isRtl ? "الوكيل الذكي" : "AI Agent"} 
            value={aiPaused ? (isRtl ? "متوقف" : "Paused") : (isRtl ? "نشط" : "Active")} 
            hint={aiPaused ? (isRtl ? "متوقف" : "Paused") : (isRtl ? "نشط" : "Live")} 
            icon={Bot} 
          />
          <MetricCard 
            label={isRtl ? "إجمالي المحادثات" : "Total Chats"} 
            value={String(conversations.length)} 
            hint={isRtl ? "في النظام" : "In system"} 
            icon={Inbox} 
          />
          <MetricCard 
            label={isRtl ? "بانتظار موظف" : "Awaiting Handoff"} 
            value={String(pendingHandoffs)} 
            hint={isRtl ? "تحويل بشري" : "Needs human"} 
            icon={Clock3} 
          />
          <MetricCard 
            label={isRtl ? "قيد المتابعة" : "In Progress"} 
            value={String(activeHandoffs)} 
            hint={isRtl ? "متابعة جارية" : "Ongoing support"} 
            icon={Clock3} 
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <GradientCard className="rtl:text-right ltr:text-left">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  {isRtl ? "آخر المحادثات" : "Recent Conversations"}
                </h2>
                <p className="mt-1 text-sm text-white/45">
                  {isRtl ? "نظرة سريعة على العملاء والقناة وحالة المتابعة." : "Quick look at customers, channels, and support status."}
                </p>
              </div>
              <Link href="/inbox">
                <Button variant="secondary">
                  {isRtl ? "افتح المحادثات" : "Open Inbox"}
                </Button>
              </Link>
            </div>
            <div className="space-y-3 min-h-[200px] flex flex-col justify-center">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-cyanx-400" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-white/45 py-8">
                  {isRtl ? "لا توجد محادثات حديثة" : "No recent conversations"}
                </div>
              ) : (
                conversations.slice(0, 5).map((conversation) => (
                  <div key={conversation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="rtl:text-right ltr:text-left">
                      <div className="flex items-center gap-2 font-semibold text-white">
                        {conversation.channel === "WHATSAPP" ? (
                          <MessageCircle className="h-4 w-4 text-primary-400" />
                        ) : conversation.channel === "FACEBOOK" || conversation.channel === "MESSENGER" ? (
                          <Facebook className="h-4 w-4 text-cyanx-400" />
                        ) : conversation.channel === "INSTAGRAM" ? (
                          <Instagram className="h-4 w-4 text-violet-200" />
                        ) : conversation.channel === "WEBHOOK" ? (
                          <Webhook className="h-4 w-4 text-amber-200" />
                        ) : conversation.channel === "WIDGET" ? (
                          <Code className="h-4 w-4 text-teal-200" />
                        ) : (
                          <MessageCircle className="h-4 w-4 text-primary-400" />
                        )}
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

          <div className="space-y-6 rtl:text-right ltr:text-left">
            <GradientCard>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">
                    {isRtl ? "صحة الوكيل" : "Agent Health"}
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    {isRtl ? "يرد من معلومات محفوظة ويتوقف عند الحساسية." : "Replies from documentation facts and pauses on sensitive chat."}
                  </p>
                </div>
                <StatusBadge status={aiPaused ? "PAUSED" : "ACTIVE"} />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  [isRtl ? "حقائق وقواعد المعرفة" : "Knowledge Base Facts", isRtl ? `${knowledgeCount} عناصر` : `${knowledgeCount} items`],
                  [isRtl ? "المنتجات والخدمات" : "Products and Services", isRtl ? `${productsCount} متاح` : `${productsCount} available`],
                  [isRtl ? "قواعد التحويل البشري" : "Human Handoff Rules", isRtl ? "مفعّل" : "Enabled"]
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between rounded-2xl bg-white/[0.055] px-4 py-3 text-sm">
                    <span className="text-white/50">{label}</span>
                    <span className="font-semibold text-white">{value}</span>
                  </div>
                ))}
              </div>
            </GradientCard>

            <GradientCard>
              <h2 className="text-xl font-semibold text-white">
                {isRtl ? "إجراءات سريعة" : "Quick Actions"}
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Button
                  variant="secondary"
                  className="w-full justify-start gap-2"
                  disabled={toggleAutoReplyMutation.isPending}
                  onClick={() => toggleAutoReplyMutation.mutate(aiPaused)}
                >
                  <PauseCircle className="h-4 w-4" />
                  {aiPaused ? (isRtl ? "تشغيل الذكاء" : "Resume AI") : (isRtl ? "إيقاف الذكاء" : "Pause AI")}
                </Button>
                {[
                  { label: isRtl ? "تعديل المعرفة" : "Edit Knowledge", icon: PenLine, href: "/knowledge" },
                  { label: isRtl ? "اختبار الوكيل" : "Test Agent", icon: TestTube2, href: "/onboarding" },
                  { label: isRtl ? "دعوة موظف" : "Invite Staff", icon: UserPlus, href: "/team" },
                  { label: isRtl ? "ربط قناة" : "Connect Channel", icon: MessageCircle, href: "/onboarding" }
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link key={action.label} href={action.href}>
                      <Button variant="secondary" className="w-full justify-start gap-2">
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
