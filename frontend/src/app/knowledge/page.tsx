"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ImagePlus, Link2, Loader2, Package, Plus, Trash2, Upload, Settings2, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GradientCard } from "@/components/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";

type BusinessType = "clothing" | "electronics" | "beauty" | "services" | "general";

const businessTypes = (isRtl: boolean): Array<{ id: BusinessType; label: string; hint: string }> => [
  { id: "clothing", label: isRtl ? "ملابس" : "Clothing", hint: isRtl ? "قياسات، ألوان، خامة، استبدال" : "Sizes, colors, materials, returns" },
  { id: "electronics", label: isRtl ? "أجهزة" : "Electronics", hint: isRtl ? "مواصفات، موديل، كفالة، صيانة" : "Specs, model, warranty, repairs" },
  { id: "beauty", label: isRtl ? "تجميل وعناية" : "Beauty & Care", hint: isRtl ? "استخدام، مكونات، تحذيرات" : "Usage, ingredients, warnings" },
  { id: "services", label: isRtl ? "خدمات" : "Services", hint: isRtl ? "مدة التنفيذ، المتطلبات، الحجز" : "Execution period, requirements, booking" },
  { id: "general", label: isRtl ? "عام" : "General", hint: isRtl ? "حقول مرنة لأي نشاط" : "Flexible fields for any business" },
];

const emptyForm = {
  name: "",
  price: "",
  currency: "JOD",
  category: "",
  description: "",
  image_url: "",
  warranty_duration: "",
  warranty_terms: "",
  warranty_coverage: "",
  warranty_exclusions: "",
  stock_quantity: "",
  stock_status: "in_stock",
  sizes: "",
  colors: "",
  material: "",
  fit: "",
  model: "",
  specs: "",
  usage: "",
  included: "",
  notes: "",
};

function imageSrc(url?: string, token?: string | null) {
  if (!url) return "";
  const suffix = token ? `?access_token=${encodeURIComponent(token)}` : "";
  if (url.startsWith("/uploads/")) return `/api${url}${suffix}`;
  if (!url.startsWith("http") && !url.startsWith("/")) {
    return `/api/uploads/${url}${suffix}`;
  }
  return url;
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

const knowledgeCategories = (isRtl: boolean) => [
  { value: "FAQs", label: isRtl ? "الأسئلة الشائعة (FAQs)" : "FAQs" },
  { value: "Policies", label: isRtl ? "السياسات (Policies)" : "Policies" },
  { value: "Documents", label: isRtl ? "المستندات (Documents)" : "Documents" },
  { value: "URLs", label: isRtl ? "الروابط (URLs)" : "URLs" },
  { value: "Product Info", label: isRtl ? "معلومات المنتجات (Product Info)" : "Product Info" },
  { value: "Service Info", label: isRtl ? "معلومات الخدمات (Service Info)" : "Service Info" },
  { value: "Custom Category", label: isRtl ? "تصنيف مخصص (Custom Category)" : "Custom Category" },
];

export default function KnowledgeBasePage() {
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";
  const { token, user, setAuth } = useAuthStore();
  const [businessType, setBusinessType] = useState<BusinessType>((user?.business_type as BusinessType) || "general");
  const [products, setProducts] = useState<any[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [policyForm, setPolicyForm] = useState({ title: "", body: "", category: "FAQs" });
  const [customCategory, setCustomCategory] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [styleMyName, setStyleMyName] = useState("");
  const [styleUploading, setStyleUploading] = useState(false);
  const [styleStats, setStyleStats] = useState<{ total: number } | null>(null);

  const groupedKnowledge = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of knowledge) {
      const cat = item.category || (isRtl ? "عام" : "General");
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(item);
    }
    return groups;
  }, [knowledge]);

  const dynamicLabels = useMemo(() => {
    if (businessType === "clothing") {
      return [
        ["sizes", isRtl ? "القياسات المتاحة" : "Available Sizes"],
        ["colors", isRtl ? "الألوان المتاحة" : "Available Colors"],
        ["material", isRtl ? "الخامة" : "Material"],
        ["fit", isRtl ? "القصة أو المقاس" : "Fit or Size"],
      ];
    }
    if (businessType === "electronics") {
      return [
        ["model", isRtl ? "الموديل" : "Model"],
        ["specs", isRtl ? "المواصفات التقنية" : "Technical Specs"],
        ["included", isRtl ? "محتويات العلبة" : "Box Contents"],
        ["notes", isRtl ? "ملاحظات صيانة أو استخدام" : "Maintenance / Usage Notes"],
      ];
    }
    if (businessType === "services") {
      return [
        ["usage", isRtl ? "آلية الخدمة" : "Service Flow"],
        ["included", isRtl ? "ما يشمله السعر" : "What is Included"],
        ["notes", isRtl ? "متطلبات قبل البدء" : "Requirements Before Start"],
      ];
    }
    return [
      ["usage", isRtl ? "طريقة الاستخدام" : "Usage Instructions"],
      ["included", isRtl ? "المرفقات أو التفاصيل" : "Attachments / Details"],
      ["notes", isRtl ? "ملاحظات مهمة" : "Important Notes"],
    ];
  }, [businessType, isRtl]);

  async function load() {
    if (!token) return;
    setLoading(true);
    try {
      const [prodRes, knowRes] = await Promise.all([
        fetch("/api/products", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch("/api/knowledge", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);
      const prodData = await prodRes.json().catch(() => ({}));
      const knowData = await knowRes.json().catch(() => ({}));
      if (prodData.ok) setProducts(prodData.products || []);
      if (knowData.ok) setKnowledge(knowData.knowledge || []);
      loadStyleStats();
    } finally {
      setLoading(false);
    }
  }

  async function loadStyleStats() {
    if (!token) return;
    try {
      const res = await fetch("/api/style/samples", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setStyleStats({ total: data.length });
      }
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  async function saveBusinessType(nextType: BusinessType) {
    setBusinessType(nextType);
    if (!token) return;
    const res = await fetch("/api/auth/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ business_type: nextType }),
    });
    if (res.ok) {
      setAuth(token, await res.json());
    }
  }

  function metadataFromForm() {
    return {
      business_type: businessType,
      sizes: splitList(form.sizes),
      colors: splitList(form.colors),
      material: form.material,
      fit: form.fit,
      model: form.model,
      specs: form.specs,
      usage: form.usage,
      included: form.included,
      notes: form.notes,
    };
  }

  async function addProduct() {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, metadata: metadataFromForm() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || (isRtl ? "تعذر حفظ المنتج." : "Could not save product."));

      if (imageFile && data.product?.id) {
        const body = new FormData();
        body.append("file", imageFile);
        await fetch(`/api/products/${data.product.id}/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
      }

      setForm(emptyForm);
      setImageFile(null);
      setNotice(isRtl ? "تم حفظ المنتج بنجاح." : "Product saved successfully.");
      setTimeout(() => setNotice(""), 3000);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء الحفظ." : "Error occurred during save."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!token || !confirm(isRtl ? "حذف المنتج من قاعدة المعرفة؟" : "Delete product from knowledge base?")) return;
    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setProducts((current) => current.filter((product) => product.id !== id));
      setNotice(isRtl ? "تم حذف المنتج." : "Product deleted.");
      setTimeout(() => setNotice(""), 3000);
    }
  }

  async function toggleProduct(id: string) {
    if (!token) return;
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      setProducts((current) => current.map((product) => product.id === id ? data.product : product));
    }
  }

  async function importFromUrl() {
    if (!token || !importUrl.trim()) return;
    setImporting(true);
    setNotice("");
    try {
      const res = await fetch("/api/catalog-import/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: importUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.error || (isRtl ? "تعذر قراءة الرابط." : "Could not fetch URL."));
      setCandidates(data.candidates || []);
      setNotice((data.candidates || []).length ? (isRtl ? "تم استخراج البيانات. راجعها وقم بحفظها." : "Data extracted. Review and save it.") : (isRtl ? "لم نجد بيانات منتج واضحة في الرابط." : "No clear product data found in link."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء الاستيراد." : "Error occurred during import."));
    } finally {
      setImporting(false);
    }
  }

  function fillFromCandidate(candidate: any) {
    setForm({
      ...emptyForm,
      name: candidate.name || "",
      description: candidate.description || "",
      category: candidate.category || "",
      price: candidate.price || "",
      currency: candidate.currency || "JOD",
      image_url: candidate.image_url || "",
      notes: `مصدر البيانات: ${candidate.source_url || ""}`,
    });
    setNotice(isRtl ? "تمت تعبئة النموذج للمراجعة." : "Form populated for review.");
    setTimeout(() => setNotice(""), 3000);
  }

  async function addKnowledgeItem() {
    if (!token || !policyForm.title.trim() || !policyForm.body.trim()) return;
    const finalCategory = policyForm.category === "Custom Category" ? (customCategory.trim() || "Custom Category") : policyForm.category;
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...policyForm, category: finalCategory }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      setPolicyForm({ title: "", body: "", category: "FAQs" });
      setCustomCategory("");
      setNotice(isRtl ? "تم حفظ المعلومة بنجاح." : "Fact saved successfully.");
      setTimeout(() => setNotice(""), 3000);
      await load();
    }
  }

  async function deleteKnowledgeItem(id: string) {
    if (!token || !confirm(isRtl ? "حذف هذه المعلومة من قاعدة المعرفة؟" : "Delete this fact from knowledge base?")) return;
    setNotice("");
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setKnowledge((current) => current.filter((item) => item.id !== id));
        setNotice(isRtl ? "تم حذف المعلومة." : "Fact deleted.");
        setTimeout(() => setNotice(""), 3000);
      } else {
        throw new Error(data.error || (isRtl ? "تعذر حذف المعلومة." : "Could not delete fact."));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء الحذف." : "Error occurred during deletion."));
    }
  }

  async function uploadStyleFile(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !styleFile) return;
    setStyleUploading(true);
    setNotice("");
    try {
      const body = new FormData();
      body.append("file", styleFile);
      if (styleMyName) body.append("my_name", styleMyName);

      const res = await fetch("/api/style/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (isRtl ? "تعذر رفع الملف." : "Could not upload file."));
      
      setStyleFile(null);
      setStyleMyName("");
      setNotice(isRtl ? `تم رفع واستخراج ${data.added} رسالة لتدريب الذكاء الاصطناعي بنجاح.` : `Successfully uploaded and extracted ${data.added} message(s) for AI training.`);
      setTimeout(() => setNotice(""), 4000);
      await loadStyleStats();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء الرفع." : "Error occurred during upload."));
    } finally {
      setStyleUploading(false);
    }
  }

  async function clearStyleSamples() {
    if (!token || !confirm(isRtl ? "هل أنت متأكد من رغبتك في مسح كل عينات التدريب؟ سيفقد الذكاء الاصطناعي أسلوبك!" : "Are you sure you want to clear all training samples? The AI will lose your customized reply style!")) return;
    setNotice("");
    try {
      const res = await fetch("/api/style/samples", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(isRtl ? "تعذر مسح العينات." : "Could not clear samples.");
      setNotice(isRtl ? "تم مسح كل عينات التدريب." : "All training samples cleared.");
      setTimeout(() => setNotice(""), 3000);
      await loadStyleStats();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء المسح." : "Error occurred during clear."));
    }
  }

  if (loading) {
    return (
      <AppShell title={isRtl ? "قاعدة المعرفة" : "Knowledge Base"} subtitle={isRtl ? "المنتجات والسياسات التي يعتمد عليها الوكيل." : "Products and policies the agent relies on."}>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={isRtl ? "قاعدة المعرفة" : "Knowledge Base"} subtitle={isRtl ? "إدارة منتجاتك، سياساتك، والمعلومات التي يستند إليها الذكاء الاصطناعي لخدمة العملاء." : "Manage products, policies, and information that the AI relies on for customer support."}>
      {notice && (
        <div className="mb-6 flex animate-in fade-in slide-in-from-top-2 items-center gap-2 rounded-2xl border border-primary-400/20 bg-primary-500/10 px-4 py-3 text-sm font-medium text-primary-400 shadow-lg">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      )}

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="w-full justify-start rounded-2xl border border-white/5 bg-white/[0.02] p-1">
          <TabsTrigger value="products" className="flex-1 py-2.5">{isRtl ? "المنتجات (الكتالوج)" : "Products (Catalog)"}</TabsTrigger>
          <TabsTrigger value="import" className="flex-1 py-2.5">{isRtl ? "استيراد المنتجات" : "Import Products"}</TabsTrigger>
          <TabsTrigger value="policies" className="flex-1 py-2.5">{isRtl ? "السياسات والمعلومات" : "Policies & Facts"}</TabsTrigger>
          <TabsTrigger value="style" className="flex-1 py-2.5">{isRtl ? "عينات الأسلوب" : "Style Samples"}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary-400" />
                <h2 className="text-xl font-semibold text-white">{isRtl ? "تخصيص الحقول حسب النشاط" : "Customize fields by business type"}</h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {businessTypes(isRtl).map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => saveBusinessType(type.id)}
                  className={`rounded-2xl border p-4 text-right transition-all duration-200 hover:-translate-y-0.5 ${
                    businessType === type.id
                      ? "border-primary-400/40 bg-primary-500/12 text-white shadow-glow"
                      : "border-white/10 bg-white/[0.035] text-white/65 hover:border-white/18 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                  <div className="mt-2 text-[11px] leading-5 text-white/42">{type.hint}</div>
                </button>
              ))}
            </div>
          </GradientCard>

          <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
            <GradientCard className="h-fit">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">{isRtl ? "إضافة منتج جديد" : "Add New Product"}</h2>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-2">
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-xs text-white/60">{isRtl ? "اسم المنتج" : "Product Name"}</label>
                    <Input className="text-right bg-white/[0.03]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">{isRtl ? "الفئة (Category)" : "Category"}</label>
                    <Input className="text-right bg-white/[0.03]" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">{isRtl ? "الكمية" : "Quantity"}</label>
                    <Input type="number" className="text-right bg-white/[0.03]" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">{isRtl ? "العملة" : "Currency"}</label>
                    <Input dir="ltr" className="text-left bg-white/[0.03]" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">{isRtl ? "السعر" : "Price"}</label>
                    <Input dir="ltr" className="text-left bg-white/[0.03]" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-white/60">{isRtl ? "الوصف العام والتفاصيل" : "Description & Details"}</label>
                  <Textarea className="min-h-24 text-right bg-white/[0.03]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                {dynamicLabels.length > 0 && (
                  <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3">
                    <div className="mb-3 text-[11px] font-medium text-white/40">{isRtl ? "حقول مخصصة للنشاط: " : "Custom fields for: "} {businessTypes(isRtl).find(t => t.id === businessType)?.label}</div>
                    <div className="grid gap-3 grid-cols-2">
                      {dynamicLabels.map(([key, label]) => (
                        <div key={key}>
                          <label className="mb-1.5 block text-[10px] text-white/50">{label}</label>
                          <Input className="h-8 text-right text-xs bg-white/[0.03]" value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3">
                  <div className="mb-3 text-[11px] font-medium text-white/40">{isRtl ? "تفاصيل الكفالة (إن وجدت)" : "Warranty details (if any)"}</div>
                  <div className="grid gap-3 grid-cols-2">
                    <Input className="h-8 text-right text-xs bg-white/[0.03]" placeholder={isRtl ? "المدة (مثال: سنة)" : "Duration (e.g., 1 year)"} value={form.warranty_duration} onChange={(e) => setForm({ ...form, warranty_duration: e.target.value })} />
                    <Input className="h-8 text-right text-xs bg-white/[0.03]" placeholder={isRtl ? "التغطية" : "Coverage"} value={form.warranty_coverage} onChange={(e) => setForm({ ...form, warranty_coverage: e.target.value })} />
                  </div>
                </div>

                <label className="group flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-3 text-sm text-white/55 transition hover:bg-white/[0.04]">
                  <span className="truncate pr-2 text-xs">{imageFile ? imageFile.name : (isRtl ? "تحميل صورة للمنتج (اختياري)" : "Upload product image (optional)")}</span>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/70 transition group-hover:bg-primary-500 group-hover:text-ink-950">
                    <ImagePlus className="h-4 w-4" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                </label>

                <Button className="w-full shadow-lg" onClick={addProduct} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  {saving ? (isRtl ? "جاري الحفظ..." : "Saving...") : (isRtl ? "حفظ ورفع المنتج" : "Save & Upload Product")}
                </Button>
              </div>
            </GradientCard>

            <GradientCard className="h-fit">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary-400" />
                  <h2 className="text-xl font-semibold text-white">{isRtl ? "المنتجات الحالية" : "Current Products"}</h2>
                </div>
                <div className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                  {products.length} {isRtl ? "منتج" : "product(s)"}
                </div>
              </div>
              
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                  <Package className="mb-4 h-12 w-12 text-white/10" />
                  <div className="text-sm font-medium text-white/50">{isRtl ? "لا يوجد منتجات مضافة بعد" : "No products added yet"}</div>
                  <div className="mt-1 text-xs text-white/30">{isRtl ? "أضف أول منتج ليتعلمه الذكاء الاصطناعي" : "Add your first product so the AI can learn it"}</div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((product) => (
                    <div key={product.id} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-white/20 hover:bg-white/[0.04]">
                      <div className="flex gap-3 p-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageSrc(product.image_url, token)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-white/20"><Package className="h-6 w-6" /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <h3 className="truncate text-sm font-semibold text-white">{product.name}</h3>
                              <p className="mt-0.5 text-[10px] text-white/40">{product.category || (isRtl ? "بدون فئة" : "No category")}</p>
                            </div>
                          </div>
                          <div className="mt-2 text-sm font-bold text-primary-400">
                            {product.price || "-"} {product.currency}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-3 py-2">
                        <button type="button" onClick={() => toggleProduct(product.id)} className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${product.available ? "bg-primary-500/15 text-primary-400 hover:bg-primary-500/25" : "bg-white/10 text-white/50 hover:bg-white/15"}`}>
                          {product.available ? (
                            <><span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> {isRtl ? "متاح" : "Available"}</>
                          ) : (
                            <><span className="h-1.5 w-1.5 rounded-full bg-white/40" /> {isRtl ? "مخفي" : "Hidden"}</>
                          )}
                        </button>
                        
                        <button type="button" onClick={() => deleteProduct(product.id)} className="rounded p-1 text-white/30 transition hover:bg-red-500/10 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GradientCard>
          </div>
        </TabsContent>

        <TabsContent value="import" className="animate-in fade-in slide-in-from-bottom-2">
          <div className="mx-auto max-w-2xl">
            <GradientCard>
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/20 text-blue-400">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{isRtl ? "استيراد منتجات من رابط" : "Import Products from URL"}</h2>
                  <p className="text-xs text-white/50">{isRtl ? "قم بجلب بيانات المنتج مباشرة من روابط المتاجر أو الانستجرام." : "Fetch product details directly from store or Instagram links."}</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input dir="ltr" className="h-11 flex-1 text-left" placeholder={isRtl ? "https://instagram.com/... أو رابط متجر" : "https://instagram.com/... or store link"} value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
                <Button className="h-11 px-6 shadow-lg shadow-blue-500/20" onClick={importFromUrl} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRtl ? "جلب البيانات" : "Fetch Data")}
                </Button>
              </div>

              {candidates.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-sm font-medium text-white/80">{isRtl ? "المنتجات المستخرجة:" : "Extracted Products:"}</h3>
                  {candidates.map((candidate, index) => (
                    <div key={`${candidate.name}-${index}`} className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
                      <div className="flex items-center gap-4">
                        {candidate.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageSrc(candidate.image_url, token)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover border border-white/10" />
                        ) : (
                          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-white/20"><ImagePlus className="h-6 w-6" /></div>
                        )}
                        <div>
                          <h3 className="font-semibold text-white">{candidate.name || (isRtl ? "بدون اسم" : "No name")}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">{candidate.description || (isRtl ? "الوصف غير واضح، ستحتاج لإكماله قبل الحفظ." : "Description unclear, you will need to complete it before saving.")}</p>
                          {candidate.price && (
                            <div className="mt-2 text-xs font-bold text-primary-400">{candidate.price} {candidate.currency}</div>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" className="shrink-0" onClick={() => fillFromCandidate(candidate)}>
                        {isRtl ? "تعبئة للمراجعة" : "Fill for Review"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </GradientCard>
          </div>
        </TabsContent>

        <TabsContent value="policies" className="animate-in fade-in slide-in-from-bottom-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <GradientCard>
              <div className="mb-5 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary-400" />
                <h2 className="text-xl font-semibold text-white">{isRtl ? "إضافة سياسة أو معلومة" : "Add Policy or Fact"}</h2>
              </div>
              <p className="mb-6 text-xs leading-5 text-white/50">
                {isRtl ? "أضف أي معلومات عامة أو سياسات يلتزم بها الوكيل للرد على العملاء (مثل سياسة الاستبدال، أوقات العمل، أو الأسئلة الشائعة)." : "Add general facts or policies the agent will use to reply to clients (like return policies, work hours, or FAQs)."}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "تصنيف المعلومة" : "Information Category"}</label>
                  <select
                    className="w-full h-10 px-3 text-right bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white/80 focus:border-primary-400 focus:outline-none"
                    value={policyForm.category}
                    onChange={(e) => setPolicyForm({ ...policyForm, category: e.target.value })}
                  >
                    {knowledgeCategories(isRtl).map((cat) => (
                      <option key={cat.value} value={cat.value} className="bg-ink-950 text-white text-right">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {policyForm.category === "Custom Category" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "اسم التصنيف المخصص" : "Custom Category Name"}</label>
                    <Input
                      className="h-10 text-right bg-white/[0.03]"
                      placeholder={isRtl ? "اكتب تصنيف مخصص..." : "Type custom category..."}
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "عنوان المعلومة" : "Fact Title"}</label>
                  <Input className="h-10 text-right bg-white/[0.03]" placeholder={isRtl ? "مثال: سياسة الاستبدال والاسترجاع" : "e.g., Return & Exchange Policy"} value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "التفاصيل" : "Details"}</label>
                  <Textarea className="min-h-32 text-right leading-6 bg-white/[0.03]" placeholder={isRtl ? "اكتب النص كامل لتوجيه الذكاء الاصطناعي بشكل سليم..." : "Type full text to properly guide the AI..."} value={policyForm.body} onChange={(e) => setPolicyForm({ ...policyForm, body: e.target.value })} />
                </div>
                <Button className="w-full" onClick={addKnowledgeItem}>
                  <Plus className="h-4 w-4" />
                  {isRtl ? "حفظ في قاعدة المعرفة" : "Save to Knowledge Base"}
                </Button>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary-400" />
                  <h2 className="text-xl font-semibold text-white">{isRtl ? "السياسات الحالية" : "Current Policies"}</h2>
                </div>
                <span className="text-xs font-medium text-white/40">{knowledge.length} {isRtl ? "معلومات مسجلة" : "recorded facts"}</span>
              </div>

              {Object.keys(groupedKnowledge).length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
                  <Info className="mb-3 h-8 w-8 text-white/20" />
                  <div className="text-sm font-medium text-white/40">{isRtl ? "لا توجد سياسات مضافة بعد" : "No policies added yet"}</div>
                </div>
              ) : (
                <div className="space-y-4 custom-scrollbar max-h-[500px] overflow-y-auto pr-2">
                  {Object.entries(groupedKnowledge).map(([category, items]) => {
                    const isOpen = openGroups[category] !== false; // open by default
                    return (
                      <div key={category} className="border border-white/5 rounded-2xl bg-white/[0.01] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setOpenGroups(prev => ({ ...prev, [category]: !isOpen }))}
                          className="flex w-full items-center justify-between bg-white/[0.02] px-4 py-3 text-right text-xs font-semibold text-white/70 hover:bg-white/[0.04]"
                        >
                          <span className="text-xs text-primary-400 font-medium">({items.length})</span>
                          <span className="font-bold">{category}</span>
                        </button>
                        
                        {isOpen && (
                          <div className="p-3 space-y-3 bg-black/10">
                            {items.map((item: any) => (
                              <div key={item.id} className="relative rounded-xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.04] group">
                                <div className="flex justify-between items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => deleteKnowledgeItem(item.id)}
                                    className="opacity-0 group-hover:opacity-100 rounded p-1 text-white/30 transition hover:bg-red-500/10 hover:text-red-400"
                                    title={isRtl ? "حذف المعلومة" : "Delete Fact"}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="flex-1 text-right">
                                    <div className="font-semibold text-white text-sm">{item.title}</div>
                                    <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-white/50">{item.body}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </GradientCard>
          </div>
        </TabsContent>

        <TabsContent value="style" className="animate-in fade-in slide-in-from-bottom-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <GradientCard>
              <div className="mb-5 flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary-400" />
                <h2 className="text-xl font-semibold text-white">{isRtl ? "استيراد محادثات الواتساب" : "Import WhatsApp Chats"}</h2>
              </div>
              <p className="mb-6 text-xs leading-5 text-white/50">
                {isRtl ? "ارفع ملف (Export Chat) من الواتساب بصيغة .txt ليقوم النظام باستخراج أسلوبك في الرد وتدريب \"وكيل الأنسنة\" للرد بنفس لهجتك." : "Upload a WhatsApp Export Chat file (.txt) so the system extracts your response style and trains the Humanizing Agent to reply with your tone."}
              </p>
              
              <form onSubmit={uploadStyleFile} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "ملف المحادثة (.txt, .json, .csv)" : "Chat File (.txt, .json, .csv)"}</label>
                  <Input 
                    type="file" 
                    accept=".txt,.json,.csv"
                    className="h-10 text-right bg-white/[0.03] file:bg-white/[0.05] file:text-white file:border-0 file:py-1 file:px-3 file:rounded-xl file:mr-2 file:text-xs cursor-pointer" 
                    onChange={(e) => setStyleFile(e.target.files?.[0] || null)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "اسم المتجر / المتحدث (اختياري)" : "Store Name / Speaker (optional)"}</label>
                  <Input 
                    className="h-10 text-right bg-white/[0.03]" 
                    placeholder={isRtl ? "ليتعرف الذكاء الاصطناعي على رسائلك في الملف" : "To help the AI identify your messages in the file"} 
                    value={styleMyName} 
                    onChange={(e) => setStyleMyName(e.target.value)} 
                  />
                  <p className="mt-1.5 text-[10px] text-white/40">{isRtl ? "إذا تركت الحقل فارغاً، سيحاول النظام اكتشاف رسائل المبيعات تلقائياً." : "If left empty, the system will attempt to detect sales messages automatically."}</p>
                </div>
                <Button className="w-full" type="submit" disabled={!styleFile || styleUploading}>
                  {styleUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {styleUploading ? (isRtl ? "جاري الرفع..." : "Uploading...") : (isRtl ? "رفع وتدريب النظام" : "Upload & Train System")}
                </Button>
              </form>
            </GradientCard>

            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary-400" />
                  <h2 className="text-xl font-semibold text-white">{isRtl ? "إحصائيات التدريب" : "Training Statistics"}</h2>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-8 text-center border border-white/5 rounded-2xl bg-white/[0.02]">
                <div className="text-4xl font-bold text-white mb-2">{styleStats?.total || 0}</div>
                <div className="text-sm font-medium text-white/50 mb-6">{isRtl ? "رسالة تدريب (Style Sample) مستخرجة" : "extracted training style samples"}</div>
                
                {(styleStats?.total || 0) > 0 ? (
                  <Button variant="danger" size="sm" onClick={clearStyleSamples}>
                    <Trash2 className="h-4 w-4 ml-1.5" />
                    {isRtl ? "مسح كل العينات" : "Clear All Samples"}
                  </Button>
                ) : (
                  <div className="text-xs text-amber-400/80 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                    {isRtl ? "الذكاء الاصطناعي لا يمتلك أمثلة للتدريب حالياً" : "The AI currently has no style training samples"}
                  </div>
                )}
              </div>
            </GradientCard>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
