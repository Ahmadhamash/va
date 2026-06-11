"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GradientCard } from "@/components/gradient-card";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";

type SupportAgent = {
  id: string;
  user_id: string;
  display_name: string;
  is_available: boolean;
  max_concurrent_handoffs: number;
  skills: string[];
};

export default function TeamPage() {
  const { token, user } = useAuthStore();
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    display_name: "",
    skills: "",
    max_concurrent_handoffs: "5",
  });

  async function loadAgents() {
    if (!token || user?.role !== "admin") return;
    const res = await fetch("/api/handoff/agents", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.ok) {
      setAgents(await res.json());
    }
  }

  useEffect(() => {
    loadAgents();
  }, [token, user?.role]);

  async function createAgent() {
    if (!token) return;
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/handoff/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.trim(),
          password: form.password,
          display_name: form.display_name.trim(),
          skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
          max_concurrent_handoffs: Number(form.max_concurrent_handoffs) || 5,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (isRtl ? "تعذر إنشاء الموظف." : "Could not create support agent."));
      setNotice(isRtl ? "تم إنشاء موظف الدعم بنجاح." : "Support agent created successfully.");
      setForm({ username: "", email: "", password: "", display_name: "", skills: "", max_concurrent_handoffs: "5" });
      await loadAgents();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (isRtl ? "صار خطأ أثناء إنشاء الموظف." : "Error occurred while creating the agent."));
    } finally {
      setLoading(false);
    }
  }

  if (user?.role !== "admin") {
    return (
      <AppShell 
        title={isRtl ? "فريق العمل" : "Team Members"} 
        subtitle={isRtl ? "هذه الصفحة مخصصة لمدير المنصة فقط." : "This page is restricted to platform admin only."}
      >
        <GradientCard>
          <div className="flex items-center gap-3 text-amber-300">
            <ShieldAlert className="h-5 w-5" />
            <span>{isRtl ? "ما عندك صلاحية لإدارة موظفي المنصة." : "You do not have permissions to manage staff."}</span>
          </div>
        </GradientCard>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title={isRtl ? "فريق العمل" : "Team Members"} 
      subtitle={isRtl ? "موظفو المنصة الذين يستلمون المحادثات عند التحويل البشري." : "Platform staff who receive conversations upon human handoff."}
    >
      {notice && (
        <div className="mb-6 rounded-2xl border border-primary-400/20 bg-primary-500/10 px-4 py-3 text-sm text-primary-400">
          {notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <GradientCard>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs text-white/40">
              {agents.length} {isRtl ? "موظف" : "agent(s)"}
            </span>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <Users className="h-5 w-5 text-primary-400" />
              {isRtl ? "موظفو الدعم" : "Support Agents"}
            </h2>
          </div>

          {agents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/12 py-12 text-center text-sm text-white/45">
              {isRtl ? "ما في موظفين دعم مضافين بعد." : "No support agents added yet."}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((agent) => (
                <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 rtl:text-right ltr:text-left">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${agent.is_available ? "bg-primary-500/10 text-primary-400" : "bg-white/8 text-white/45"}`}>
                      {agent.is_available ? (isRtl ? "متاح" : "Available") : (isRtl ? "غير متاح" : "Unavailable")}
                    </span>
                    <div className="rtl:text-right ltr:text-left">
                      <h3 className="font-semibold text-white">{agent.display_name}</h3>
                      <p className="mt-1 text-xs text-white/40">
                        {agent.max_concurrent_handoffs} {isRtl ? "محادثات كحد أقصى" : "max conversations"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 rtl:justify-end ltr:justify-start">
                    {(agent.skills || []).length ? (
                      agent.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-white/8 px-2 py-1 text-xs text-white/55">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/32">{isRtl ? "بدون مهارات محددة" : "No skills specified"}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GradientCard>

        <GradientCard>
          <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-white">
            <UserPlus className="h-5 w-5 text-primary-400" />
            {isRtl ? "إضافة موظف" : "Add Staff Member"}
          </h2>

          <div className="space-y-3 rtl:text-right ltr:text-left">
            <Input placeholder={isRtl ? "اسم المستخدم" : "Username"} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="rtl:text-right ltr:text-left" />
            <Input type="email" placeholder={isRtl ? "البريد الإلكتروني" : "Email"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rtl:text-right ltr:text-left" />
            <Input type="password" placeholder={isRtl ? "كلمة المرور المؤقتة" : "Temporary Password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rtl:text-right ltr:text-left" />
            <Input placeholder={isRtl ? "الاسم الظاهر" : "Display Name"} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="rtl:text-right ltr:text-left" />
            <Input placeholder={isRtl ? "مهارات مفصولة بفواصل: ملابس, أجهزة, شكاوى" : "Skills separated by commas: clothes, hardware, complaints"} value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} className="rtl:text-right ltr:text-left" />
            <Input type="number" min="1" max="30" placeholder={isRtl ? "عدد المحادثات" : "Max concurrent chats"} value={form.max_concurrent_handoffs} onChange={(e) => setForm({ ...form, max_concurrent_handoffs: e.target.value })} className="rtl:text-right ltr:text-left" />
            <Button className="w-full" onClick={createAgent} disabled={loading}>
              {isRtl ? "إنشاء حساب موظف" : "Create Staff Account"}
            </Button>
          </div>
        </GradientCard>
      </div>
    </AppShell>
  );
}

