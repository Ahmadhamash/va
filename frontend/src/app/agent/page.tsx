"use client";

import { useState } from "react";
import { AgentPreview } from "@/components/agent-preview";
import { AppShell } from "@/components/app-shell";
import { ToggleSetting } from "@/components/toggle-setting";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AgentSettingsPage() {
  const [notice, setNotice] = useState("");
  const [strictness, setStrictness] = useState("متوازن");
  const [tone, setTone] = useState("عربي ودود");

  return (
    <AppShell title="الوكيل الذكي" subtitle="تحكم بسيط بقوة الوكيل، لغته، وحدود الرد.">
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          {notice ? <div className="rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-5 py-4 text-sm font-semibold text-emeraldx-400">{notice}</div> : null}
          <Card>
            <CardHeader>
              <CardTitle>أساسيات الوكيل</CardTitle>
              <CardDescription>إعدادات بسيطة تؤثر على كل رد للعميل.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Input placeholder="اسم الوكيل" defaultValue="مساعد مسار" />
              <Input placeholder="لغة الرد" defaultValue="العربية" />
              <Input placeholder="اللهجة" value={tone} onChange={(event) => setTone(event.target.value)} />
              <Input placeholder="أوقات العمل" defaultValue="9 ص - 11 م" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>صرامة المعرفة</CardTitle>
              <CardDescription>حدد مساحة حرية الوكيل عند الإجابة.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {["صارم: من المعلومات المحفوظة فقط", "متوازن", "مرن"].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setStrictness(mode)}
                  className={strictness === mode ? "rounded-3xl bg-emeraldx-500 p-4 text-right text-sm font-semibold text-ink-950" : "rounded-3xl border border-white/10 bg-white/[0.055] p-4 text-right text-sm font-semibold text-white/72 transition hover:bg-white/10"}
                >
                  {mode}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>قواعد التحويل البشري</CardTitle>
              <CardDescription>احمِ النشاط من الردود غير المناسبة في الحالات الحساسة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleSetting title="تحويل العملاء الغاضبين" description="الشكاوى، الغضب، أو الكلام المسيء ينتقل لموظف." />
              <ToggleSetting title="تحويل الإلغاء والاسترجاع" description="طلبات المال والسياسات يتولاها فريقك." />
              <ToggleSetting title="مراجعة الردود الحساسة" description="عند الشك، الوكيل يطلب تدخل بشري." />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>رسالة fallback</CardTitle>
              <CardDescription>تستخدم عندما لا يعرف الوكيل الإجابة بثقة.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea defaultValue="لحظة من فضلك، رح أحولك لموظف يساعدك بشكل أفضل." />
              <Button className="mt-4" onClick={() => setNotice("تم حفظ إعدادات الوكيل في الديمو.")}>حفظ الإعدادات</Button>
            </CardContent>
          </Card>
        </div>

        <AgentPreview tone={tone} strictness={strictness} />
      </div>
    </AppShell>
  );
}
