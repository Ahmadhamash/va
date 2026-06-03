"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, ImagePlus, Link2, Loader2, Package, Plus, Trash2, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GradientCard } from "@/components/gradient-card";
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
    } finally {
      setLoading(false);
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
      setNotice("تم حفظ المنتج وتحديث قاعدة المعرفة.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "صار خطأ أثناء الحفظ.");
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
      setNotice((data.candidates || []).length ? "تم استخراج مرشحات. راجعها وكمل الناقص قبل الحفظ." : "لم نجد بيانات منتج واضحة في الرابط.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "صار خطأ أثناء الاستيراد.");
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
      setNotice("تم حفظ المعلومة.");
      await load();
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
    <AppShell title="قاعدة المعرفة" subtitle="منتجات، صور، كفالات، سياسات، ومعلومات مؤكدة بدون محاكاة.">
      {notice && (
        <div className="mb-6 rounded-2xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-4 py-3 text-sm text-emeraldx-400">
          {notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Package className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">نوع النشاط</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              {businessTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => saveBusinessType(type.id)}
                  className={`rounded-2xl border p-4 text-right transition ${
                    businessType === type.id
                      ? "border-emeraldx-400/40 bg-emeraldx-500/12 text-white shadow-glow"
                      : "border-white/10 bg-white/[0.035] text-white/65 hover:border-white/18 hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="font-semibold">{type.label}</div>
                  <div className="mt-2 text-xs leading-5 text-white/42">{type.hint}</div>
                </button>
              ))}
            </div>
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Upload className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">إضافة منتج</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input className="text-right" placeholder="اسم المنتج" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input className="text-right" placeholder="الفئة" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              <Input dir="ltr" placeholder="السعر" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <Input dir="ltr" placeholder="العملة" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              <Input dir="ltr" placeholder="رابط صورة المنتج" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
              <Input type="number" placeholder="الكمية بالمخزون" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            </div>
            <Textarea className="mt-3 min-h-24 text-right" placeholder="وصف المنتج، طريقة الاستخدام، أهم الملاحظات" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {dynamicLabels.map(([key, label]) => (
                <Input key={key} className="text-right" placeholder={label} value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input className="text-right" placeholder="مدة الكفالة" value={form.warranty_duration} onChange={(e) => setForm({ ...form, warranty_duration: e.target.value })} />
              <Input className="text-right" placeholder="ما الذي تغطيه الكفالة؟" value={form.warranty_coverage} onChange={(e) => setForm({ ...form, warranty_coverage: e.target.value })} />
              <Textarea className="text-right" placeholder="شروط الكفالة" value={form.warranty_terms} onChange={(e) => setForm({ ...form, warranty_terms: e.target.value })} />
              <Textarea className="text-right" placeholder="استثناءات الكفالة" value={form.warranty_exclusions} onChange={(e) => setForm({ ...form, warranty_exclusions: e.target.value })} />
            </div>

            <label className="mt-4 flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-4 py-3 text-sm text-white/55 hover:bg-white/[0.05]">
              <span>{imageFile ? imageFile.name : "تحميل صورة من الجهاز"}</span>
              <ImagePlus className="h-5 w-5 text-emeraldx-400" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </label>

            <Button className="mt-4 w-full" onClick={addProduct} disabled={saving}>
              <Plus className="h-4 w-4" />
              {saving ? "جاري الحفظ..." : "حفظ المنتج"}
            </Button>
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-xs text-white/40">{products.length} منتج</span>
              <h2 className="text-xl font-semibold text-white">المنتجات الحالية</h2>
            </div>
            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/12 py-10 text-center text-sm text-white/42">ما في منتجات مضافة حالياً.</div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {products.map((product) => (
                  <div key={product.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-right">
                    <div className="flex gap-3">
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white/8">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageSrc(product.image_url)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-white/25"><Package className="h-6 w-6" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button type="button" onClick={() => deleteProduct(product.id)} className="text-white/35 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div>
                            <h3 className="font-semibold text-white">{product.name}</h3>
                            <p className="mt-1 text-xs text-white/42">{product.category || "بدون فئة"}</p>
                          </div>
                        </div>
                        <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/50">{product.description || "بدون وصف"}</p>
                        <div className="mt-3 flex items-center justify-between">
                          <button type="button" onClick={() => toggleProduct(product.id)} className={`rounded-full px-2 py-1 text-xs ${product.available ? "bg-emeraldx-500/10 text-emeraldx-400" : "bg-white/8 text-white/45"}`}>
                            {product.available ? "متاح للرد" : "مخفي"}
                          </button>
                          <span className="text-sm font-semibold text-white">{product.price || "-"} {product.currency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GradientCard>
        </div>

        <div className="space-y-6">
          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <Link2 className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">استيراد من رابط</h2>
            </div>
            <Input dir="ltr" placeholder="https://instagram.com/... أو رابط موقع المنتج" value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
            <Button className="mt-3 w-full" onClick={importFromUrl} disabled={importing}>
              {importing ? "جاري القراءة..." : "قراءة الرابط"}
            </Button>
            {candidates.length > 0 && (
              <div className="mt-4 space-y-3">
                {candidates.map((candidate, index) => (
                  <div key={`${candidate.name}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-right">
                    <div className="flex gap-3">
                      {candidate.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={candidate.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-white">{candidate.name}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-white/45">{candidate.description || "الوصف غير واضح، كمله قبل الحفظ."}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" className="mt-3 w-full" onClick={() => fillFromCandidate(candidate)}>
                      تعبئة النموذج للمراجعة
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </GradientCard>

          <GradientCard>
            <div className="mb-5 flex items-center justify-between">
              <CheckCircle2 className="h-5 w-5 text-emeraldx-400" />
              <h2 className="text-xl font-semibold text-white">سياسات ومعلومات عامة</h2>
            </div>
            <Input className="text-right" placeholder="العنوان: سياسة الاستبدال" value={policyForm.title} onChange={(e) => setPolicyForm({ ...policyForm, title: e.target.value })} />
            <Textarea className="mt-3 min-h-24 text-right" placeholder="النص الذي يعتمد عليه الوكيل" value={policyForm.body} onChange={(e) => setPolicyForm({ ...policyForm, body: e.target.value })} />
            <Button className="mt-3 w-full" onClick={addKnowledgeItem}>حفظ المعلومة</Button>

            <div className="mt-4 space-y-2">
              {knowledge.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-2xl bg-white/[0.035] p-3 text-right">
                  <div className="font-semibold text-white text-sm">{item.title}</div>
                  <p className="mt-1 line-clamp-2 text-xs text-white/45">{item.body}</p>
                </div>
              ))}
            </div>
          </GradientCard>
        </div>
      </div>
    </AppShell>
  );
}
