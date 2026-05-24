import { Mail, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const members = [
  { name: "Demo Owner", email: "owner@demo.com", role: "Owner" },
  { name: "Support Agent", email: "support@demo.com", role: "Agent" },
  { name: "Evening Support", email: "evening@demo.com", role: "Support" }
];

export default function TeamPage() {
  return (
    <AppShell title="Team" subtitle="Invite people who can take over conversations when the AI needs help.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Team members</CardTitle>
            <CardDescription>Owner, agents, and support users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => (
              <div key={member.email} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/8 text-emeraldx-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{member.name}</div>
                    <div className="text-sm text-white/45">{member.email}</div>
                  </div>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/58">{member.role}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invite member</CardTitle>
            <CardDescription>Placeholder invite modal content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Full name" />
            <Input placeholder="Email address" />
            <Input placeholder="Role: Owner, Agent, Support" />
            <Button className="w-full">
              <UserPlus className="h-4 w-4" />
              Send invite
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <EmptyState icon={Mail} title="Invite flow is ready for integration" text="Hook this to your email provider when team invitations go live." />
      </div>
    </AppShell>
  );
}
