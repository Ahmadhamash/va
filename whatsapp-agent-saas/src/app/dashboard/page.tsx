import {
  Bot,
  Clock3,
  Inbox,
  MessageCircle,
  PauseCircle,
  PenLine,
  TestTube2,
  UserPlus,
  Users
} from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { MetricCard } from "@/components/metric-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { WhatsAppConnectionCard } from "@/components/whatsapp-connection-card";
import { mockConnection, mockConversations } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <AppShell title="Dashboard" subtitle="A simple command center for your AI customer support agent.">
      <div className="space-y-6">
        <WhatsAppConnectionCard status={mockConnection.status} />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="WhatsApp status" value="Demo" hint="Ready" icon={MessageCircle} />
          <MetricCard label="AI Agent" value="Active" hint="Live" icon={Bot} />
          <MetricCard label="Today conversations" value="128" hint="+18%" icon={Inbox} />
          <MetricCard label="Human handoffs" value="11" hint="8.5%" icon={Users} />
          <MetricCard label="Avg response time" value="4.8s" hint="Fast" icon={Clock3} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Live Inbox preview</h2>
                <p className="mt-1 text-sm text-white/45">Recent customer conversations and handoff status.</p>
              </div>
              <Link href="/inbox">
                <Button variant="secondary">Open Inbox</Button>
              </Link>
            </div>
            <div className="space-y-3">
              {mockConversations.map((conversation) => (
                <div key={conversation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                  <div>
                    <div className="font-semibold text-white">{conversation.customerName}</div>
                    <div className="mt-1 text-sm text-white/45">{conversation.lastMessage}</div>
                  </div>
                  <StatusBadge status={conversation.status} />
                </div>
              ))}
            </div>
          </GradientCard>

          <div className="space-y-6">
            <GradientCard>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">Agent health</h2>
                  <p className="mt-1 text-sm text-white/45">Your agent is responding from saved knowledge.</p>
                </div>
                <StatusBadge status="ACTIVE" />
              </div>
              <div className="mt-6 space-y-3">
                {[
                  ["Knowledge coverage", "82%"],
                  ["Safe handoff rules", "6 active"],
                  ["Demo readiness", "Ready"]
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
                {[
                  { label: "Pause AI", icon: PauseCircle, href: "/agent" },
                  { label: "Edit knowledge", icon: PenLine, href: "/knowledge" },
                  { label: "Test agent", icon: TestTube2, href: "/onboarding" },
                  { label: "Invite team member", icon: UserPlus, href: "/team" },
                  { label: "Connect WhatsApp Business", icon: MessageCircle, href: "/onboarding" }
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
