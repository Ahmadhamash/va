"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GradientCard } from "@/components/gradient-card";
import { useAuthStore } from "@/store/use-auth-store";

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
      if (!res.ok) throw new Error(data.detail || "تعذر إنشاء الموظف.");
      setNotice("تم إنشاء موظف الدعم بنجاح.");
      setForm({ username: "", email: "", password: "", display_name: "", skills: "", max_concurrent_handoffs: "5" });
      await loadAgents();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "صار خطأ أثناء إنشاء الموظف.");
    } finally {
      setLoading(false);
    }
  }

  if (user?.role !== "admin") {
    return (
      <AppShell title="فريق العمل" subtitle="هذه الصفحة مخصصة لمدير المنصة فقط.">
        <GradientCard>
          <div className="flex items-center gap-3 text-amber-300">
            <ShieldAlert className="h-5 w-5" />
            <span>ما عندك صلاحية لإدارة موظفي المنصة.</span>
          </div>
        </GradientCard>
      </AppShell>
    );
  }

  return (
    <AppShell title="فريق العمل" subtitle="موظفو المنصة الذين يستلمون المحادثات عند التحويل البشري.">
      {notice && (
        <div className="mb-6 rounded-2xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-4 py-3 text-sm text-emeraldx-400">
          {notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <GradientCard>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs text-white/40">{agents.length} موظف</span>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <Users className="h-5 w-5 text-emeraldx-400" />
              موظفو الدعم
            </h2>
          </div>

          {agents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/12 py-12 text-center text-sm text-white/45">
              ما في موظفين دعم مضافين بعد.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {agents.map((agent) => (
                <div key={agent.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-2 py-1 text-xs ${agent.is_available ? "bg-emeraldx-500/10 text-emeraldx-400" : "bg-white/8 text-white/45"}`}>
                      {agent.is_available ? "متاح" : "غير متاح"}
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{agent.display_name}</h3>
                      <p className="mt-1 text-xs text-white/40">{agent.max_concurrent_handoffs} محادثات كحد أقصى</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {(agent.skills || []).length ? (
                      agent.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-white/8 px-2 py-1 text-xs text-white/55">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-white/32">بدون مهارات محددة</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GradientCard>

        <GradientCard>
          <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-white">
            <UserPlus className="h-5 w-5 text-emeraldx-400" />
            إضافة موظف
          </h2>

          <div className="space-y-3">
            <Input placeholder="اسم المستخدم" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <Input type="email" placeholder="البريد الإلكتروني" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input type="password" placeholder="كلمة المرور المؤقتة" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <Input placeholder="الاسم الظاهر" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            <Input placeholder="مهارات مفصولة بفواصل: ملابس, أجهزة, شكاوى" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
            <Input type="number" min="1" max="30" placeholder="عدد المحادثات" value={form.max_concurrent_handoffs} onChange={(e) => setForm({ ...form, max_concurrent_handoffs: e.target.value })} />
            <Button className="w-full" onClick={createAgent} disabled={loading}>
              إنشاء حساب موظف
            </Button>
          </div>
        </GradientCard>
      </div>
    </AppShell>
  );
}
