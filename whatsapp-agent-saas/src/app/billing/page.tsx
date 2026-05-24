import { AppShell } from "@/components/app-shell";
import { PlanCard } from "@/components/plan-card";

const plans = [
  {
    name: "Starter",
    price: "$29",
    description: "For small shops testing AI customer support.",
    features: ["Demo Mode", "1 official number placeholder", "500 AI replies", "Basic inbox"]
  },
  {
    name: "Growth",
    price: "$79",
    description: "For businesses ready to run daily customer support.",
    features: ["Official API setup path", "3 team members", "5,000 AI replies", "Human handoff", "Analytics"],
    highlighted: true
  },
  {
    name: "Pro",
    price: "$199",
    description: "For teams with higher volume and tighter controls.",
    features: ["Multiple branches", "Advanced handoff rules", "Priority support", "Custom onboarding"]
  }
];

export default function BillingPage() {
  return (
    <AppShell title="Billing" subtitle="Premium SaaS pricing presentation. Payment integration is a placeholder.">
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.name} {...plan} />
        ))}
      </div>
    </AppShell>
  );
}
