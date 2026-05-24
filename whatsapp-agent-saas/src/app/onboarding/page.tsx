"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  MessageCircle,
  PartyPopper,
  ShieldCheck,
  Upload,
  WalletCards
} from "lucide-react";
import Link from "next/link";
import { AgentPreview } from "@/components/agent-preview";
import { OnboardingStepper } from "@/components/onboarding-stepper";
import { StatusBadge } from "@/components/status-badge";
import { ToggleSetting } from "@/components/toggle-setting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const businessTypes = ["Restaurant", "Online Store", "Clinic", "Services", "Other"];
const languages = ["Arabic", "English", "Both"];
const tones = ["Friendly", "Professional", "Jordanian Arabic", "Short & Direct"];

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-white/72">{label}</span>
      {children}
    </label>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [testMessage, setTestMessage] = useState("Do you deliver to Khalda?");
  const [testReply, setTestReply] = useState("Yes, we deliver to Khalda. Delivery starts from 2 JOD. What would you like to order?");

  function next() {
    setStep((value) => Math.min(value + 1, 5));
  }

  function prev() {
    setStep((value) => Math.max(value - 1, 0));
  }

  function runTest() {
    if (testMessage.toLowerCase().includes("refund") || testMessage.toLowerCase().includes("cancel")) {
      setTestReply("This looks sensitive. I will connect the customer with a team member.");
      return;
    }
    setTestReply("Yes, we can help with that. Could you tell me which product or service you are interested in?");
  }

  const screens = [
    <div key="business" className="grid gap-5 lg:grid-cols-2">
      <FieldGroup label="Business name">
        <Input placeholder="Amman Bistro" />
      </FieldGroup>
      <FieldGroup label="Business type">
        <div className="grid grid-cols-2 gap-2">
          {businessTypes.map((type) => (
            <button key={type} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-semibold text-white/68 transition hover:bg-white/10" type="button">
              {type}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Main language">
        <div className="flex flex-wrap gap-2">
          {languages.map((language) => (
            <button key={language} className="rounded-2xl bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white/68 transition hover:bg-emeraldx-500 hover:text-ink-950" type="button">
              {language}
            </button>
          ))}
        </div>
      </FieldGroup>
      <FieldGroup label="Tone">
        <div className="flex flex-wrap gap-2">
          {tones.map((tone) => (
            <button key={tone} className="rounded-2xl bg-white/[0.07] px-4 py-2 text-sm font-semibold text-white/68 transition hover:bg-emeraldx-500 hover:text-ink-950" type="button">
              {tone}
            </button>
          ))}
        </div>
      </FieldGroup>
    </div>,

    <div key="connect" className="grid gap-4 lg:grid-cols-3">
      {[
        {
          icon: MessageCircle,
          title: "Connect Official WhatsApp Business API",
          description: "Best for real businesses and stable production usage.",
          button: "Start Official Setup",
          status: "Coming soon",
          action: () => null
        },
        {
          icon: Bot,
          title: "Use Demo Mode",
          description: "Test your AI agent with sample WhatsApp conversations before connecting a real number.",
          button: "Continue in Demo Mode",
          status: demoEnabled ? "Enabled" : "Ready",
          action: () => setDemoEnabled(true)
        },
        {
          icon: Clock,
          title: "Connect Later",
          description: "Finish setting up your AI agent now and connect WhatsApp later.",
          button: "Skip for Now",
          status: "Optional",
          action: next
        }
      ].map((option) => {
        const Icon = option.icon;
        return (
          <Card key={option.title} className="premium-ring">
            <CardHeader>
              <div className="mb-5 flex items-center justify-between">
                <div className="grid h-12 w-12 place-items-center rounded-3xl bg-white/8 text-emeraldx-400">
                  <Icon className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/48">{option.status}</span>
              </div>
              <CardTitle>{option.title}</CardTitle>
              <CardDescription>{option.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant={option.title.includes("Official") ? "secondary" : "primary"} onClick={option.action}>
                {option.button}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>,

    <div key="teach" className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <FieldGroup label="Business description">
          <Textarea placeholder="Tell the agent what your business does..." />
        </FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Opening hours" />
          <Input placeholder="Location" />
          <Input placeholder="Delivery areas" />
          <Input placeholder="Pricing notes" />
        </div>
        <Textarea placeholder="Return/refund policy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Products and files</CardTitle>
          <CardDescription>Add simple business knowledge now. You can edit everything later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="secondary" className="w-full justify-start">
            <Upload className="h-4 w-4" />
            Upload files placeholder
          </Button>
          <Input placeholder="Product or service name" />
          <Input placeholder="Price" />
          <Textarea placeholder="Description" />
          <Button className="w-full">
            <WalletCards className="h-4 w-4" />
            Add product/service
          </Button>
        </CardContent>
      </Card>
    </div>,

    <div key="behavior" className="grid gap-4 lg:grid-cols-2">
      <ToggleSetting title="Auto-reply enabled" description="Let AI reply to normal customer questions automatically." />
      <ToggleSetting title="Ask before sensitive replies" description="Require review for pricing conflict, legal, or policy-sensitive messages." />
      <ToggleSetting title="Transfer angry customers to human" description="Move angry or complaint conversations into human handoff." />
      <ToggleSetting title="Transfer refund/cancellation requests" description="Protect your business by escalating refund and cancellation requests." />
      <ToggleSetting title="Reply only from knowledge base" description="Avoid guessing when the answer is not saved." />
      <ToggleSetting title="Use short replies" description="Keep replies direct and customer-friendly." />
    </div>,

    <div key="test" className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Test your agent</CardTitle>
          <CardDescription>Type a customer message and see the suggested AI response.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={testMessage} onChange={(event) => setTestMessage(event.target.value)} />
          <Button onClick={runTest}>Run test</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>AI reply</CardTitle>
          <CardDescription>Demo Mode response using saved business knowledge.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-3xl bg-emeraldx-500 p-4 text-sm leading-7 text-ink-950">{testReply}</div>
          <Button className="mt-5 w-full" onClick={next}>
            Looks good, go live
          </Button>
        </CardContent>
      </Card>
    </div>,

    <div key="done" className="mx-auto max-w-2xl text-center">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-[2rem] bg-emeraldx-500 text-ink-950 shadow-glow">
        <PartyPopper className="h-10 w-10" />
      </div>
      <h2 className="mt-8 text-4xl font-semibold text-white">Your AI agent is ready</h2>
      <p className="mt-4 text-white/55">You can open the inbox, view settings, or test another message before going live.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/inbox"><Button>Open Inbox</Button></Link>
        <Link href="/agent"><Button variant="secondary">View Agent Settings</Button></Link>
        <Button variant="secondary" onClick={() => setStep(4)}>Test Another Message</Button>
      </div>
    </div>
  ];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 text-white/65 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <StatusBadge status={demoEnabled ? "DEMO_MODE" : "SETUP_REQUIRED"} />
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-white">Setup your AI WhatsApp agent</h1>
          <p className="mt-3 max-w-2xl text-white/55">A simple guided flow for business owners. Connect, teach, test, and go live.</p>
        </div>

        <OnboardingStepper current={step} />

        <Card className="mt-6 overflow-hidden">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.22 }}
              >
                {screens[step]}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>

        {step < 5 ? (
          <div className="mt-6 flex justify-between">
            <Button variant="secondary" onClick={prev} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button onClick={next}>
              Continue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        {step === 3 ? <div className="mt-6"><AgentPreview tone="Friendly" strictness="Balanced" /></div> : null}
      </div>
    </main>
  );
}
