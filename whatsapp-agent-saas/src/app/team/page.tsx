"use client";

import { useState } from "react";
import { Mail, UserPlus, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const initialMembers = [
  { name: "أحمد", email: "owner@masarjo.com", role: "مالك" },
  { name: "موظف الدعم", email: "support@masarjo.com", role: "موظف" },
  { name: "فريق المساء", email: "evening@masarjo.com", role: "دعم" }
];

export default function TeamPage() {
  const [members, setMembers] = useState(initialMembers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("موظف");
  const [notice, setNotice] = useState("");

  function invite() {
    if (!name.trim() || !email.trim()) {
      setNotice("اكتب الاسم والبريد قبل إرسال الدعوة.");
      return;
    }
    setMembers((items) => [...items, { name, email, role }]);
    setNotice(`تم تجهيز دعوة ${name}.`);
    setName("");
    setEmail("");
    setRole("موظف");
  }

  return (
    <AppShell title="الفريق" subtitle="أضف الأشخاص الذين يستلمون المحادثات عند التحويل البشري.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>أعضاء الفريق</CardTitle>
            <CardDescription>مالك، موظفون، ودعم.</CardDescription>
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
            <CardTitle>دعوة عضو</CardTitle>
            <CardDescription>واجهة جاهزة للربط مع البريد لاحقا.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {notice ? <div className="rounded-2xl bg-cyanx-500/10 px-4 py-3 text-sm font-semibold text-cyanx-400">{notice}</div> : null}
            <Input placeholder="الاسم الكامل" value={name} onChange={(event) => setName(event.target.value)} />
            <Input placeholder="البريد الإلكتروني" value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input placeholder="الدور" value={role} onChange={(event) => setRole(event.target.value)} />
            <Button className="w-full" onClick={invite}>
              <UserPlus className="h-4 w-4" />
              إرسال دعوة
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="mt-6">
        <EmptyState icon={Mail} title="نظام الدعوات جاهز للربط" text="اربطه بمزوّد البريد عند إطلاق حسابات الفريق الحقيقية." />
      </div>
    </AppShell>
  );
}
