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
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthRequired, LoadingPanel } from "@/components/auth-required";
import { ChannelConnectionCard } from "@/components/channel-connection-card";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api-client";
import {
  channelsToCards,
  providerToPlatform,
  sessionToConversation,
  type BackendChannel,
  type BackendChatSession
} from "@/lib/backend-mappers";
import type { ChannelProvider, Conversation } from "@/lib/types";

const channelNames: Record<ChannelProvider, string> = {
  WHATSAPP: "WhatsApp",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram"
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [notice, setNotice] = useState("Connected screens read from the FastAPI backend.");
  const [aiPaused, setAiPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [channels, setChannels] = useState<BackendChannel[]>([]);
  const [sessions, setSessions] = useState<BackendChatSession[]>([]);
  const [handoffCount, setHandoffCount] = useState(0);

  async function loadDashboard() {
    if (!user) return;
    setBusy(true);
    try {
      const [channelRows, sessionRows, handoffs] = await Promise.all([
        apiRequest<BackendChannel[]>("/channels"),
        apiRequest<BackendChatSession[]>("/chat/sessions"),
        apiRequest<Array<{ id: string }>>("/handoff/").catch(() => [])
      ]);
      setChannels(channelRows);
      setSessions(sessionRows);
      setHandoffCount(handoffs.length);
      setNotice(`Backend loaded for ${user.business_name || user.username}.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load backend dashboard data.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [user]);

  async function connect(provider: ChannelProvider) {
    const platform = providerToPlatform[provider];
    const existing = channels.find((channel) => channel.platform === platform);
    if (existing) {
      setNotice(`${channelNames[provider]} is already saved in the backend as ${existing.public_id}.`);
      return;
    }

    setNotice(`Creating ${channelNames[provider]} channel in the backend...`);
    try {
      await apiRequest<BackendChannel>("/channels", {
        method: "POST",
        body: {
          platform,
          credentials: {}
        }
      });
      await loadDashboard();
      setNotice(`${channelNames[provider]} channel was created. Add real Meta credentials in backend settings when ready.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create channel.");
    }
  }

  const channelCards = useMemo(() => channelsToCards(channels), [channels]);
  const conversations: Conversation[] = useMemo(() => sessions.slice(0, 5).map((session) => sessionToConversation(session)), [sessions]);
  const activeChannels = channels.filter((channel) => channel.is_active).length;

  return (
    <AppShell title="Dashboard" subtitle="Live view of backend channels, conversations, and handoffs.">
      {loading ? (
        <LoadingPanel />
      ) : !user ? (
        <AuthRequired />
      ) : (
        <div className="space-y-6">
          <ChannelConnectionCard channels={channelCards} onConnect={connect} />

          <div className="rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 px-5 py-4 text-sm font-semibold text-cyanx-400">
            {busy ? "Refreshing backend data..." : notice}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Active channels" value={String(activeChannels)} hint={`${channels.length} saved`} icon={MessageCircle} />
            <MetricCard label="AI agent" value={aiPaused ? "Paused" : "Active"} hint={aiPaused ? "Manual" : "Backend"} icon={Bot} />
            <MetricCard label="Conversations" value={String(sessions.length)} hint="Chat sessions" icon={Inbox} />
            <MetricCard label="Handoffs" value={String(handoffCount)} hint="Human review" icon={Users} />
            <MetricCard label="Response path" value="API" hint="FastAPI" icon={Clock3} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
            <GradientCard>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Recent conversations</h2>
                  <p className="mt-1 text-sm text-white/45">Loaded from `/api/chat/sessions`.</p>
                </div>
                <Link href="/inbox">
                  <Button variant="secondary">Open inbox</Button>
                </Link>
              </div>
              <div className="space-y-3">
                {conversations.length ? (
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
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-sm text-white/50">
                    No backend chat sessions yet. Send a test message from the inbox to create one.
                  </div>
                )}
              </div>
            </GradientCard>

            <div className="space-y-6">
              <GradientCard>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Agent health</h2>
                    <p className="mt-1 text-sm text-white/45">The backend answers from saved catalog and policy data.</p>
                  </div>
                  <StatusBadge status={aiPaused ? "PAUSED" : "ACTIVE"} />
                </div>
                <div className="mt-6 space-y-3">
                  {[
                    ["Catalog items", "Live"],
                    ["Channel storage", `${channels.length}`],
                    ["Auth role", user.role]
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl bg-white/[0.055] px-4 py-3 text-sm">
                      <span className="text-white/50">{label}</span>
                      <span className="font-semibold text-white">{value}</span>
                    </div>
                  ))}
                </div>
              </GradientCard>

              <GradientCard>
                <h2 className="text-xl font-semibold text-white">Quick actions</h2>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Button variant="secondary" className="w-full justify-start" onClick={() => setAiPaused((value) => !value)}>
                    <PauseCircle className="h-4 w-4" />
                    {aiPaused ? "Resume AI" : "Pause AI"}
                  </Button>
                  {[
                    { label: "Edit knowledge", icon: PenLine, href: "/knowledge" },
                    { label: "Test agent", icon: TestTube2, href: "/inbox" },
                    { label: "Invite teammate", icon: UserPlus, href: "/team" },
                    { label: "Connect channel", icon: MessageCircle, href: "/onboarding" }
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
      )}
    </AppShell>
  );
}
