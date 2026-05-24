"use client";

import { useState } from "react";
import { AlertTriangle, Bell, Building2, Facebook, Instagram, MessageCircle, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [notice, setNotice] = useState("");
  return (
    <AppShell title="الإعدادات" subtitle="ملف النشاط، القنوات، التنبيهات، وضوابط الأمان.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {notice ? <div className="rounded-3xl bg-cyanx-500/10 px-5 py-4 text-sm font-semibold text-cyanx-400">{notice}</div> : null}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-emeraldx-400" /> ملف النشاط</CardTitle>
              <CardDescription>اجعل بيانات النشاط دقيقة حتى تكون الردود دقيقة.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input defaultValue="مسار" />
              <Input defaultValue="منصة خدمة عملاء" />
              <Input defaultValue="عمّان، الأردن" />
              <Input defaultValue="العربية" />
              <Button className="md:col-span-2" onClick={() => setNotice("تم حفظ ملف النشاط في الديمو.")}>حفظ الملف</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="h-5 w-5 text-emeraldx-400" /> القنوات</CardTitle>
              <CardDescription>إعدادات الربط الرسمي لقنوات Meta عند توفر المفاتيح.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: MessageCircle, label: "واتساب بزنس", status: "DEMO_MODE" as const },
                { icon: Facebook, label: "فيسبوك ماسنجر", status: "SETUP_REQUIRED" as const },
                { icon: Instagram, label: "إنستغرام DM", status: "PENDING_VERIFICATION" as const }
              ].map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.label} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="flex items-center gap-3 font-semibold text-white">
                      <Icon className="h-5 w-5 text-emeraldx-400" />
                      {channel.label}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={channel.status} />
                      <Button size="sm" variant="secondary" onClick={() => setNotice(`تم فتح إعداد ${channel.label} التجريبي.`)}>إعداد</Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-cyanx-400" /> التنبيهات</CardTitle>
              <CardDescription>حدد متى يصل تنبيه لفريقك.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {["تحويل بشري جديد", "خطأ ربط", "إيقاف الذكاء", "ملخص يومي"].map((item) => (
                <button key={item} onClick={() => setNotice(`تم تحديث تنبيه: ${item}`)} className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-right text-sm font-semibold text-white/65 transition hover:bg-white/10">
                  {item}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="border-red-400/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-100"><AlertTriangle className="h-5 w-5" /> منطقة حساسة</CardTitle>
            <CardDescription>هذه الأفعال تحتاج تأكيد في النسخة الإنتاجية.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="danger" className="w-full justify-start" onClick={() => setNotice("تم إيقاف الربط في الديمو فقط، لم يتم حذف أي بيانات.")}>
              فصل القنوات
            </Button>
            <Button variant="danger" className="w-full justify-start" onClick={() => setNotice("تم تنظيف محادثات الديمو داخل الواجهة فقط.")}>
              حذف محادثات الديمو
            </Button>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-emeraldx-400" />
                ملاحظة أمان
              </div>
              <p className="text-sm leading-6 text-white/48">
                مسار مصمم لمحادثات الدعم التي يبدأها العميل، وليس للإرسال الجماعي أو الاستخدام غير الرسمي.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
