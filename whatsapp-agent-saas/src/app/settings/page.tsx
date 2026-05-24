import { AlertTriangle, Bell, Building2, MessageCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Business profile, connection status, notifications, and safety controls.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-emeraldx-400" /> Business profile</CardTitle>
              <CardDescription>Keep business details accurate so the agent replies correctly.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input defaultValue="Amman Bistro" />
              <Input defaultValue="Restaurant" />
              <Input defaultValue="Amman, Jordan" />
              <Input defaultValue="Both" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emeraldx-400" /> WhatsApp Business connection</CardTitle>
              <CardDescription>Production can be connected through the official Cloud API adapter.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <StatusBadge status="DEMO_MODE" />
              <Button>Start Official Setup</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-cyanx-400" /> Notifications</CardTitle>
              <CardDescription>Decide when your team should be notified.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {["Human handoff created", "Connection error", "AI paused", "Daily summary"].map((item) => (
                <div key={item} className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-sm font-semibold text-white/65">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-red-400/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-100"><AlertTriangle className="h-5 w-5" /> Danger zone</CardTitle>
            <CardDescription>Actions here should require confirmation in production.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="danger" className="w-full justify-start">
              Disconnect WhatsApp Business
            </Button>
            <Button variant="danger" className="w-full justify-start">
              Delete demo conversations
            </Button>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emeraldx-400" />
                Safety note
              </div>
              <p className="text-sm leading-6 text-white/48">
                This product is designed for customer-initiated support conversations and business replies.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
