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

type BusinessType = "clothing" | "electronics" | "beauty" | "services" | "general";

const businessTypes: Array<{ id: BusinessType; label: string; hint: string }> = [
  { id: "clothing", label: "ملابس", hint: "قياسات، ألوان، خامة، استبدال" },
  { id: "electronics", label: "أجهزة", hint: "مواصفات، موديل، كفالة، صيانة" },
  { id: "beauty", label: "تجميل وعناية", hint: "استخدام، مكونات، تحذيرات" },
  { id: "services", label: "خدمات", hint: "مدة التنفيذ، المتطلبات، الحجز" },
  { id: "general", label: "عام", hint: "حقول مرنة لأي نشاط" },
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

function imageSrc(url?: string) {
  if (!url) return "";
  if (url.startsWith("/uploads/")) return `/api${url}`;
  return url;
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

export default function KnowledgeBasePage() {
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
  const [policyForm, setPolicyForm] = useState({ title: "", body: "", category: "policies" });
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [styleMyName, setStyleMyName] = useState("");
  const [styleUploading, setStyleUploading] = useState(false);
  const [styleStats, setStyleStats] = useState<{ total: number } | null>(null);

  const dynamicLabels = useMemo(() => {
    if (businessType === "clothing") {
      return [
        ["sizes", "القياسات المتاحة"],
        ["colors", "الألوان المتاحة"],
        ["material", "الخامة"],
        ["fit", "القصة أو المقاس"],
      ];
    }
    if (businessType === "electronics") {
      return [
        ["model", "الموديل"],
        ["specs", "المواصفات التقنية"],
        ["included", "محتويات العلبة"],
        ["notes", "ملاحظات صيانة أو استخدام"],
      ];
    }
    if (businessType === "services") {
      return [
        ["usage", "آلية الخدمة"],
        ["included", "ما يشمله السعر"],
        ["notes", "متطلبات قبل البدء"],
      ];
    }
    return [
      ["usage", "طريقة الاستخدام"],
      ["included", "المرفقات أو التفاصيل"],
      ["notes", "ملاحظات مهمة"],
    ];
  }, [businessType]);

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
      if (!res.ok || !data.ok) throw new Error(data.error || "تعذر حفظ المنتج.");

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
      setNotice("تم حفظ المنتج بنجاح.");
      setTimeout(() => setNotice(""), 3000);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!token || !confirm("حذف المنتج من قاعدة المعرفة؟")) return;
    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setProducts((current) => current.filter((product) => product.id !== id));
      setNotice("تم حذف المنتج.");
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
      if (!res.ok) throw new Error(data.detail || data.error || "تعذر قراءة الرابط.");
      setCandidates(data.candidates || []);
      setNotice((data.candidates || []).length ? "تم استخراج البيانات. راجعها وقم بحفظها." : "لم نجد بيانات منتج واضحة في الرابط.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء الاستيراد.");
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
    setNotice("تمت تعبئة النموذج للمراجعة.");
    setTimeout(() => setNotice(""), 3000);
  }

  async function addKnowledgeItem() {
    if (!token || !policyForm.title.trim() || !policyForm.body.trim()) return;
    const res = await fetch("/api/knowledge", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(policyForm),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      setPolicyForm({ title: "", body: "", category: "policies" });
      setNotice("تم حفظ المعلومة بنجاح.");
      setTimeout(() => setNotice(""), 3000);
      await load();
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
      if (!res.ok) throw new Error(data.detail || "تعذر رفع الملف.");
      
      setStyleFile(null);
      setStyleMyName("");
      setNotice(`تم رفع واستخراج ${data.added} رسالة لتدريب الذكاء الاصطناعي بنجاح.`);
      setTimeout(() => setNotice(""), 4000);
      await loadStyleStats();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء الرفع.");
    } finally {
      setStyleUploading(false);
    }
  }

  async function clearStyleSamples() {
    if (!token || !confirm("هل أنت متأكد من رغبتك في مسح كل عينات التدريب؟ سيفقد الذكاء الاصطناعي أسلوبك!")) return;
    setNotice("");
    try {
      const res = await fetch("/api/style/samples", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("تعذر مسح العينات.");
      setNotice("تم مسح كل عينات التدريب.");
      setTimeout(() => setNotice(""), 3000);
      await loadStyleStats();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "حدث خطأ أثناء المسح.");
    }
  }

  if (loading) {
    return (
      <AppShell title="قاعدة المعرفة" subtitle="المنتجات والسياسات التي يعتمد عليها الوكيل.">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="قاعدة المعرفة" subtitle="إدارة منتجاتك، سياساتك، والمعلومات التي يستند إليها الذكاء الاصطناعي لخدمة العملاء.">
      {notice && (
        <div className="mb-6 flex animate-in fade-in slide-in-from-top-2 items-center gap-2 rounded-2xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-4 py-3 text-sm font-medium text-emeraldx-400 shadow-lg">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      )}

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="w-full justify-start rounded-2xl border border-white/5 bg-white/[0.02] p-1">
          <TabsTrigger value="products" className="flex-1 py-2.5">المنتجات (الكتالوج)</TabsTrigger>
          <TabsTrigger value="import" className="flex-1 py-2.5">استيراد المنتجات</TabsTrigger>
          <TabsTrigger value="policies" className="flex-1 py-2.5">السياسات والمعلومات</TabsTrigger>
          <TabsTrigger value="style" className="flex-1 py-2.5">عينات الأسلوب</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-emeraldx-400" />
                <h2 className="text-xl font-semibold text-white">تخصيص الحقول حسب النشاط</h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {businessTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => saveBusinessType(type.id)}
                  className={`rounded-2xl border p-4 text-right transition-all duration-200 hover:-translate-y-0.5 ${
                    businessType === type.id
                      ? "border-emeraldx-400/40 bg-emeraldx-500/12 text-white shadow-glow"
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
                  <Plus className="h-5 w-5 text-emeraldx-400" />
                  <h2 className="text-lg font-semibold text-white">إضافة منتج جديد</h2>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-2">
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-xs text-white/60">اسم المنتج</label>
                    <Input className="text-right bg-white/[0.03]" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">الفئة (Category)</label>
                    <Input className="text-right bg-white/[0.03]" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">الكمية</label>
                    <Input type="number" className="text-right bg-white/[0.03]" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">العملة</label>
                    <Input dir="ltr" className="text-left bg-white/[0.03]" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-white/60">السعر</label>
                    <Input dir="ltr" className="text-left bg-white/[0.03]" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs text-white/60">الوصف العام والتفاصيل</label>
                  <Textarea className="min-h-24 text-right bg-white/[0.03]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                {dynamicLabels.length > 0 && (
                  <div className="rounded-xl border border-white/5 bg-white/[0.015] p-3">
                    <div className="mb-3 text-[11px] font-medium text-white/40">حقول مخصصة للنشاط: {businessTypes.find(t => t.id === businessType)?.label}</div>
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
                  <div className="mb-3 text-[11px] font-medium text-white/40">تفاصيل الكفالة (إن وجدت)</div>
                  <div className="grid gap-3 grid-cols-2">
                    <Input className="h-8 text-right text-xs bg-white/[0.03]" placeholder="المدة (مثال: سنة)" value={form.warranty_duration} onChange={(e) => setForm({ ...form, warranty_duration: e.target.value })} />
                    <Input className="h-8 text-right text-xs bg-white/[0.03]" placeholder="التغطية" value={form.warranty_coverage} onChange={(e) => setForm({ ...form, warranty_coverage: e.target.value })} />
                  </div>
                </div>

                <label className="group flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-3 text-sm text-white/55 transition hover:bg-white/[0.04]">
                  <span className="truncate pr-2 text-xs">{imageFile ? imageFile.name : "تحميل صورة للمنتج (اختياري)"}</span>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/5 text-white/70 transition group-hover:bg-emeraldx-500 group-hover:text-ink-950">
                    <ImagePlus className="h-4 w-4" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                </label>

                <Button className="w-full shadow-lg" onClick={addProduct} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
                  {saving ? "جاري الحفظ..." : "حفظ ورفع المنتج"}
                </Button>
              </div>
            </GradientCard>

            <GradientCard className="h-fit">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-emeraldx-400" />
                  <h2 className="text-xl font-semibold text-white">المنتجات الحالية</h2>
                </div>
                <div className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/80">
                  {products.length} منتج
                </div>
              </div>
              
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                  <Package className="mb-4 h-12 w-12 text-white/10" />
                  <div className="text-sm font-medium text-white/50">لا يوجد منتجات مضافة بعد</div>
                  <div className="mt-1 text-xs text-white/30">أضف أول منتج ليتعلمه الذكاء الاصطناعي</div>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {products.map((product) => (
                    <div key={product.id} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-white/20 hover:bg-white/[0.04]">
                      <div className="flex gap-3 p-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white/5">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageSrc(product.image_url)} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-110" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-white/20"><Package className="h-6 w-6" /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <h3 className="truncate text-sm font-semibold text-white">{product.name}</h3>
                              <p className="mt-0.5 text-[10px] text-white/40">{product.category || "بدون فئة"}</p>
                            </div>
                          </div>
                          <div className="mt-2 text-sm font-bold text-emeraldx-400">
                            {product.price || "-"} {product.currency}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.02] px-3 py-2">
                        <button type="button" onClick={() => toggleProduct(product.id)} className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${product.available ? "bg-emeraldx-500/15 text-emeraldx-400 hover:bg-emeraldx-500/25" : "bg-white/10 text-white/50 hover:bg-white/15"}`}>
                          {product.available ? (
                            <><span className="h-1.5 w-1.5 rounded-full bg-emeraldx-400" /> متاح</>
                          ) : (
                            <><span className="h-1.5 w-1.5 rounded-full bg-white/40" /> مخفي</>
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
                  <h2 className="text-xl font-semibold text-white">استيراد منتجات من رابط</h2>
                  <p className="text-xs text-white/50">قم بجلب بيانات المنتج مباشرة من روابط المتاجر أو الانستجرام.</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input dir="ltr" className="h-11 flex-1 text-left" placeholder="https://instagram.com/... أو رابط متجر" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
                <Button className="h-11 px-6 shadow-lg shadow-blue-500/20" onClick={importFromUrl} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "جلب البيانات"}
                </Button>
              </div>

              {candidates.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-sm font-medium text-white/80">المنتجات المستخرجة:</h3>
                  {candidates.map((candidate, index) => (
                    <div key={`${candidate.name}-${index}`} className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.05]">
                      <div className="flex items-center gap-4">
                        {candidate.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={candidate.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover border border-white/10" />
                        ) : (
                          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-white/20"><ImagePlus className="h-6 w-6" /></div>
                        )}
                        <div>
                          <h3 className="font-semibold text-white">{candidate.name || "بدون اسم"}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">{candidate.description || "الوصف غير واضح، ستحتاج لإكماله قبل الحفظ."}</p>
                          {candidate.price && (
                            <div className="mt-2 text-xs font-bold text-emeraldx-400">{candidate.price} {candidate.currency}</div>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" className="shrink-0" onClick={() => fillFromCandidate(candidate)}>
                        تعبئة للمراجعة
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
                <CheckCircle2 className="h-5 w-5 text-emeraldx-400" />
                <h2 className="text-xl font-semibold text-white">إضافة سياسة أو معلومة</h2>
              </div>
              <p className="mb-6 text-xs leading-5 text-white/50">
                أضف أي معلومات عامة أو سياسات يلتزم بها الوكيل للرد على العملاء (مثل سياسة الاستبدال، أوقات العمل، أو الأسئلة الشائعة).
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">عنوان المعلومة</label>
                  <Input className="h-10 text-right bg-white/[0.03]" placeholder="مثال: سياسة الاستبدال والاسترجاع" value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">التفاصيل</label>
                  <Textarea className="min-h-32 text-right leading-6 bg-white/[0.03]" placeholder="اكتب النص كامل لتوجيه الذكاء الاصطناعي بشكل سليم..." value={policyForm.body} onChange={(e) => setPolicyForm({ ...policyForm, body: e.target.value })} />
                </div>
                <Button className="w-full" onClick={addKnowledgeItem}>
                  <Plus className="h-4 w-4" />
                  حفظ في قاعدة المعرفة
                </Button>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-emeraldx-400" />
                  <h2 className="text-xl font-semibold text-white">السياسات الحالية</h2>
                </div>
                <span className="text-xs font-medium text-white/40">{knowledge.length} معلومات مسجلة</span>
              </div>

              {knowledge.length === 0 ? (
                <div className="flex h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
                  <Info className="mb-3 h-8 w-8 text-white/20" />
                  <div className="text-sm font-medium text-white/40">لا توجد سياسات مضافة بعد</div>
                </div>
              ) : (
                <div className="space-y-3 custom-scrollbar max-h-[500px] overflow-y-auto pr-2">
                  {knowledge.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
                      <div className="font-semibold text-white text-sm">{item.title}</div>
                      <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-white/50">{item.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </GradientCard>
          </div>
        </TabsContent>

        <TabsContent value="style" className="animate-in fade-in slide-in-from-bottom-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <GradientCard>
              <div className="mb-5 flex items-center gap-2">
                <Upload className="h-5 w-5 text-emeraldx-400" />
                <h2 className="text-xl font-semibold text-white">استيراد محادثات الواتساب</h2>
              </div>
              <p className="mb-6 text-xs leading-5 text-white/50">
                ارفع ملف (Export Chat) من الواتساب بصيغة .txt ليقوم النظام باستخراج أسلوبك في الرد وتدريب "وكيل الأنسنة" للرد بنفس لهجتك.
              </p>
              
              <form onSubmit={uploadStyleFile} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">ملف المحادثة (.txt, .json, .csv)</label>
                  <Input 
                    type="file" 
                    accept=".txt,.json,.csv"
                    className="h-10 text-right bg-white/[0.03] file:bg-white/[0.05] file:text-white file:border-0 file:py-1 file:px-3 file:rounded-xl file:mr-2 file:text-xs cursor-pointer" 
                    onChange={(e) => setStyleFile(e.target.files?.[0] || null)} 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">اسم المتجر / المتحدث (اختياري)</label>
                  <Input 
                    className="h-10 text-right bg-white/[0.03]" 
                    placeholder="ليتعرف الذكاء الاصطناعي على رسائلك في الملف" 
                    value={styleMyName} 
                    onChange={(e) => setStyleMyName(e.target.value)} 
                  />
                  <p className="mt-1.5 text-[10px] text-white/40">إذا تركت الحقل فارغاً، سيحاول النظام اكتشاف رسائل المبيعات تلقائياً.</p>
                </div>
                <Button className="w-full" type="submit" disabled={!styleFile || styleUploading}>
                  {styleUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  رفع وتدريب النظام
                </Button>
              </form>
            </GradientCard>

            <GradientCard>
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emeraldx-400" />
                  <h2 className="text-xl font-semibold text-white">إحصائيات التدريب</h2>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center py-8 text-center border border-white/5 rounded-2xl bg-white/[0.02]">
                <div className="text-4xl font-bold text-white mb-2">{styleStats?.total || 0}</div>
                <div className="text-sm font-medium text-white/50 mb-6">رسالة تدريب (Style Sample) مستخرجة</div>
                
                {(styleStats?.total || 0) > 0 ? (
                  <Button variant="destructive" size="sm" onClick={clearStyleSamples}>
                    <Trash2 className="h-4 w-4 ml-1.5" />
                    مسح كل العينات
                  </Button>
                ) : (
                  <div className="text-xs text-amber-400/80 bg-amber-500/10 px-3 py-1.5 rounded-lg">
                    الذكاء الاصطناعي لا يمتلك أمثلة للتدريب حالياً
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
