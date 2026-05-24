"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function KnowledgeEditor() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState("");

  function saveKnowledge() {
    if (!title.trim() || !content.trim()) {
      setNotice("اكتب عنوان ومعلومة قبل الحفظ.");
      return;
    }
    setNotice(`تمت إضافة "${title}" إلى معرفة الوكيل.`);
    setTitle("");
    setCategory("");
    setContent("");
  }

  return (
    <div className="space-y-4">
      {notice ? <div className="rounded-2xl bg-emeraldx-500/10 px-4 py-3 text-sm font-semibold text-emeraldx-400">{notice}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="عنوان المعلومة أو السؤال" />
        <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="التصنيف" />
      </div>
      <Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="اكتب المعلومة الدقيقة التي يسمح للوكيل باستخدامها..." />
      <div className="flex flex-wrap gap-3">
        <Button onClick={saveKnowledge}>
          <Plus className="h-4 w-4" />
          إضافة معرفة
        </Button>
        <Button variant="secondary" onClick={() => setNotice("واجهة رفع الملفات جاهزة، وسيتم ربط التخزين لاحقا.")}>
          <Upload className="h-4 w-4" />
          رفع ملفات
        </Button>
      </div>
    </div>
  );
}
