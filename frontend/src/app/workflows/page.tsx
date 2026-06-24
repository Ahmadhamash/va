"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { ArrowLeft, ArrowRight, Bot, GitBranch, Inbox, Loader2, ShieldCheck, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguageStore } from "@/store/use-language-store";

export default function WorkflowsPage() {
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/workflows");
        return res.data.workflows || [];
      } catch {
        return [];
      }
    },
  });

  const coreSteps = [
    {
      title: isRtl ? "تشغيل أو إيقاف رد الذكاء" : "Turn AI replies on or off",
      text: isRtl ? "من الرئيسية" : "From dashboard",
      href: "/dashboard",
      icon: Bot,
    },
    {
      title: isRtl ? "تعديل المنتجات ومعلومات الحساب" : "Edit products and business facts",
      text: isRtl ? "من بيانات المتجر" : "From store data",
      href: "/knowledge",
      icon: ShieldCheck,
    },
    {
      title: isRtl ? "استلام المحادثات المحوّلة" : "Handle transferred conversations",
      text: isRtl ? "من المحادثات" : "From inbox",
      href: "/inbox",
      icon: Inbox,
    },
  ];

  const examples = [
    isRtl ? "كلمة محددة مثل موزع أو شكوى" : "A keyword like distributor or complaint",
    isRtl ? "رد مختلف خارج أوقات العمل" : "A different reply outside working hours",
    isRtl ? "تحويل فوري لموظف في حالات حساسة" : "Instant handoff for sensitive cases",
  ];

  return (
    <AppShell
      title={isRtl ? "ردود متقدمة" : "Advanced replies"}
      subtitle={isRtl ? "قواعد خاصة للحالات التي تحتاج سلوكاً مختلفاً عن الرد الذكي العادي." : "Special rules for cases that need behavior beyond normal AI replies."}
    >
      <div className="space-y-6">
        <GradientCard>
          <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary-400/20 bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-300">
                <Zap className="h-3.5 w-3.5" />
                {isRtl ? "مرحلة اختيارية" : "Optional stage"}
              </div>
              <h2 className="text-2xl font-semibold text-white">
                {isRtl ? "لا تحتاج هذه الصفحة لإضافة منتجات أو معلومات العميل" : "You do not need this page to add products or client information"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                {isRtl
                  ? "استخدم بيانات المتجر للمنتجات، العروض، نقاط البيع، وطريقة الطلب. استخدم هذه الصفحة فقط عندما تريد قاعدة خاصة لا تنطبق على كل المحادثات."
                  : "Use Store data for products, offers, locations, and ordering details. Use this page only when you need a special rule that does not apply to every conversation."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="text-xs font-semibold text-white/45">{isRtl ? "أمثلة مناسبة" : "Good examples"}</div>
              <div className="mt-3 space-y-2">
                {examples.map((example) => (
                  <div key={example} className="flex items-center gap-2 rounded-xl bg-white/[0.035] px-3 py-2 text-xs text-white/62">
                    <GitBranch className="h-3.5 w-3.5 text-primary-300" />
                    <span>{example}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GradientCard>

        <div className="grid gap-3 md:grid-cols-3">
          {coreSteps.map((step) => {
            const Icon = step.icon;
            return (
              <Link
                key={step.href}
                href={step.href}
                className="group rounded-2xl border border-white/10 bg-white/[0.045] p-4 transition hover:border-primary-400/30 hover:bg-primary-500/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <Icon className="h-5 w-5 text-primary-300" />
                  <ArrowIcon className="h-4 w-4 text-white/35 transition group-hover:text-primary-300" />
                </div>
                <div className="mt-4 text-sm font-semibold text-white">{step.title}</div>
                <div className="mt-1 text-xs text-white/45">{step.text}</div>
              </Link>
            );
          })}
        </div>

        <GradientCard>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-primary-400" />
              <h2 className="text-lg font-semibold text-white">{isRtl ? "القواعد الخاصة الحالية" : "Current special rules"}</h2>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-white/50">
              <Loader2 className="h-5 w-5 animate-spin text-primary-300" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
              <GitBranch className="mx-auto mb-3 h-8 w-8 text-white/18" />
              <div className="text-sm font-medium text-white/50">{isRtl ? "لا توجد قواعد خاصة مفعّلة" : "No special rules are active"}</div>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((wf: any) => (
                <div key={wf.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <div>
                    <div className="font-semibold text-white">{wf.name}</div>
                    <div className="mt-1 text-xs text-white/50">
                      {isRtl ? `الشرط: ${wf.trigger} - ${wf.steps_count} خطوة` : `Trigger: ${wf.trigger} - ${wf.steps_count} steps`}
                    </div>
                  </div>
                  <span className="rounded-full bg-primary-500/15 px-3 py-1 text-xs font-semibold text-primary-300">
                    {isRtl ? "مفعّل" : "Active"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GradientCard>
      </div>
    </AppShell>
  );
}
