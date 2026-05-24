import { AgentPreview } from "@/components/agent-preview";
import { AppShell } from "@/components/app-shell";
import { ToggleSetting } from "@/components/toggle-setting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AgentSettingsPage() {
  return (
    <AppShell title="Agent Settings" subtitle="Keep the agent powerful, but easy to control.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agent basics</CardTitle>
              <CardDescription>Simple settings that shape every customer reply.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input placeholder="Agent name" defaultValue="Mira" />
              <Input placeholder="Reply language" defaultValue="Both" />
              <Input placeholder="Tone" defaultValue="Friendly" />
              <Input placeholder="Working hours" defaultValue="11 AM - 12 AM" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Knowledge strictness</CardTitle>
              <CardDescription>Choose how much freedom the agent has when answering.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {["Strict: answer only from saved info", "Balanced", "Creative"].map((mode) => (
                <button key={mode} className="rounded-3xl border border-white/10 bg-white/[0.055] p-4 text-left text-sm font-semibold text-white/72 transition hover:bg-emeraldx-500 hover:text-ink-950">
                  {mode}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Handoff Rules</CardTitle>
              <CardDescription>Protect the business by moving sensitive cases to humans.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleSetting title="Transfer angry customers" description="Escalate complaints, anger, or insults." />
              <ToggleSetting title="Transfer refund/cancellation requests" description="Let a human handle money-sensitive requests." />
              <ToggleSetting title="Ask before sending sensitive replies" description="Require review when the agent is uncertain." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fallback Message</CardTitle>
              <CardDescription>Used when the agent cannot answer confidently.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea defaultValue="I will connect you with a team member who can help." />
              <Button className="mt-4">Save settings</Button>
            </CardContent>
          </Card>
        </div>

        <AgentPreview tone="Friendly" strictness="Balanced" />
      </div>
    </AppShell>
  );
}
