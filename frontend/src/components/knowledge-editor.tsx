"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguageStore } from "@/store/use-language-store";

export function KnowledgeEditor() {
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [notice, setNotice] = useState("");

  function saveKnowledge() {
    if (!title.trim() || !content.trim()) {
      setNotice(isRtl ? "اكتب عنوان ومعلومة قبل الحفظ." : "Enter a title and description before saving.");
      return;
    }
    setNotice(
      isRtl
        ? `تمت إضافة "${title}" إلى معرفة الوكيل.`
        : `"${title}" has been successfully added to the agent's knowledge.`
    );
    setTitle("");
    setCategory("");
    setContent("");
  }

  return (
    <div className="space-y-4">
      {notice ? <div className="rounded-2xl bg-primary-500/10 px-4 py-3 text-sm font-semibold text-primary-400">{notice}</div> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Input 
          value={title} 
          onChange={(event) => setTitle(event.target.value)} 
          placeholder={isRtl ? "عنوان المعلومة أو السؤال" : "Knowledge Title or Question"} 
          className="rtl:text-right ltr:text-left"
        />
        <Input 
          value={category} 
          onChange={(event) => setCategory(event.target.value)} 
          placeholder={isRtl ? "التصنيف" : "Category"} 
          className="rtl:text-right ltr:text-left"
        />
      </div>
      <Textarea 
        value={content} 
        onChange={(event) => setContent(event.target.value)} 
        placeholder={isRtl ? "اكتب المعلومة الدقيقة التي يسمح للوكيل باستخدامها..." : "Write the specific information the agent is allowed to use..."} 
        className="rtl:text-right ltr:text-left"
      />
      <div className="flex flex-wrap gap-3">
        <Button onClick={saveKnowledge}>
          <Plus className="h-4 w-4" />
          {isRtl ? "إضافة معرفة" : "Add Knowledge"}
        </Button>
        <Button variant="secondary" onClick={() => setNotice(isRtl ? "واجهة رفع الملفات جاهزة، وسيتم ربط التخزين لاحقا." : "File upload interface is ready. Storage connection will be established soon.")}>
          <Upload className="h-4 w-4" />
          {isRtl ? "رفع ملفات" : "Upload Files"}
        </Button>
      </div>
    </div>
  );
}

