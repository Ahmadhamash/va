"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  ImagePlus,
  Link2,
  Loader2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Store,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GradientCard } from "@/components/gradient-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/use-auth-store";
import { useLanguageStore } from "@/store/use-language-store";
import { cn } from "@/lib/utils";

type NoticeTone = "success" | "error" | "info";

type Product = {
  id: string;
  name: string;
  price?: string;
  currency?: string;
  category?: string;
  description?: string;
  image_url?: string;
  available?: boolean;
  metadata?: Record<string, unknown>;
  warranty_duration?: string;
  warranty_terms?: string;
  warranty_coverage?: string;
  warranty_exclusions?: string;
  stock_quantity?: string | number;
  stock_status?: string;
};

type KnowledgeItem = {
  id: string;
  title: string;
  body: string;
  category?: string;
};

const emptyProductForm = {
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

const emptyKnowledgeForm = {
  title: "",
  body: "",
  category: "business_profile",
};

type ProductForm = typeof emptyProductForm;

const knowledgeCategories = (isRtl: boolean) => [
  { value: "business_profile", label: isRtl ? "معلومات الحساب والبراند" : "Business profile" },
  { value: "faq", label: isRtl ? "أسئلة متكررة" : "Common questions" },
  { value: "ordering", label: isRtl ? "طريقة الطلب والدفع" : "Ordering and payment" },
  { value: "sales_points", label: isRtl ? "نقاط البيع والفروع" : "Sales points and branches" },
  { value: "offers", label: isRtl ? "عروض وباقات" : "Offers and bundles" },
  { value: "policy", label: isRtl ? "سياسات العمل" : "Business policies" },
  { value: "custom", label: isRtl ? "تصنيف آخر" : "Other category" },
];

const legacyCategoryLabels: Record<string, { ar: string; en: string }> = {
  FAQs: { ar: "أسئلة متكررة", en: "Common questions" },
  Policies: { ar: "سياسات العمل", en: "Business policies" },
  Documents: { ar: "معلومات عامة", en: "General facts" },
  URLs: { ar: "روابط ومصادر", en: "Links and sources" },
  "Product Info": { ar: "معلومات المنتجات", en: "Product information" },
  "Service Info": { ar: "معلومات الخدمات", en: "Service information" },
  business_profile: { ar: "معلومات الحساب والبراند", en: "Business profile" },
  faq: { ar: "أسئلة متكررة", en: "Common questions" },
  ordering: { ar: "طريقة الطلب والدفع", en: "Ordering and payment" },
  sales_points: { ar: "نقاط البيع والفروع", en: "Sales points and branches" },
  offers: { ar: "عروض وباقات", en: "Offers and bundles" },
  policy: { ar: "سياسات العمل", en: "Business policies" },
};

const knowledgeExamples = (isRtl: boolean) => [
  {
    category: "business_profile",
    title: isRtl ? "هوية الحساب" : "Account identity",
    body: isRtl
      ? "اسم الحساب:\nالموقع الإلكتروني:\nالتصنيف:\nوصف مختصر للبراند:"
      : "Account name:\nWebsite:\nCategory:\nShort brand description:",
  },
  {
    category: "sales_points",
    title: isRtl ? "نقاط البيع" : "Sales points",
    body: isRtl
      ? "اكتب كل نقطة بيع مع المنطقة، مثال:\n- اسم المحل: المنطقة\n- اسم المحل: المنطقة"
      : "List each location with area, for example:\n- Store name: area\n- Store name: area",
  },
  {
    category: "offers",
    title: isRtl ? "عروض الجمعات والعائلات" : "Gathering and family offers",
    body: isRtl
      ? "اسم العرض:\nماذا يحتوي:\nطريقة الطلب:\nملاحظات مهمة:"
      : "Offer name:\nWhat it includes:\nHow to order:\nImportant notes:",
  },
  {
    category: "ordering",
    title: isRtl ? "طريقة الطلب" : "How to order",
    body: isRtl
      ? "طريقة الطلب المتاحة:\nمدة الرد أو التجهيز:\nمناطق التوصيل:\nملاحظات الدفع:"
      : "Available ordering method:\nReply or preparation time:\nDelivery areas:\nPayment notes:",
  },
];

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

function listValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value == null) return "";
  return String(value);
}

function categoryLabel(category: string | undefined, isRtl: boolean) {
  if (!category) return isRtl ? "عام" : "General";
  return legacyCategoryLabels[category]?.[isRtl ? "ar" : "en"] || category;
}

function statusLabel(status: string | undefined, isRtl: boolean) {
  if (status === "out_of_stock") return isRtl ? "غير متوفر" : "Out of stock";
  if (status === "preorder") return isRtl ? "طلب مسبق" : "Preorder";
  return isRtl ? "متوفر" : "In stock";
}

export default function KnowledgeBasePage() {
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";
  const { token } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [form, setForm] = useState<ProductForm>(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [policyForm, setPolicyForm] = useState(emptyKnowledgeForm);
  const [customCategory, setCustomCategory] = useState("");
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
  const [structuredProfile, setStructuredProfile] = useState({
    website: "",
    brand_description: "",
    facebook: "",
    instagram: "",
    tiktok: "",
  });
  const [structuredFaq, setStructuredFaq] = useState({
    question: "",
    answer: "",
  });
  const [structuredBranches, setStructuredBranches] = useState<Array<{ branch_name: string; city: string; maps_link: string }>>([
    { branch_name: "", city: "", maps_link: "" }
  ]);
  const [structuredOffer, setStructuredOffer] = useState({
    offer_name: "",
    description: "",
    price: "",
    validity: "",
  });
  const [structuredOrdering, setStructuredOrdering] = useState({
    ordering_method: "",
    preparation_time: "",
    delivery_areas: "",
    payment_notes: "",
  });
  const [structuredGeneric, setStructuredGeneric] = useState({
    title: "",
    content: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: NoticeTone } | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [candidates, setCandidates] = useState<Product[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [styleFile, setStyleFile] = useState<File | null>(null);
  const [styleMyName, setStyleMyName] = useState("");
  const [styleUploading, setStyleUploading] = useState(false);
  const [styleStats, setStyleStats] = useState<{ total: number } | null>(null);
  const productFormRef = useRef<HTMLDivElement | null>(null);

  const dynamicLabels = useMemo<Array<[keyof ProductForm, string, string]>>(() => {
    return [
      ["sizes", isRtl ? "الحجم أو عدد القطع" : "Size or quantity", isRtl ? "مثال: 6 قطع، Small, Large" : "Example: 6 pieces, Small, Large"],
      ["colors", isRtl ? "الخيارات أو النكهات" : "Options or flavors", isRtl ? "مثال: مانجا، فراولة، أسود، أبيض" : "Example: mango, strawberry, black, white"],
      ["material", isRtl ? "المكونات أو التفاصيل" : "Ingredients or details", isRtl ? "مثال: شوكولاتة، فواكه طبيعية، قطن" : "Example: chocolate, natural fruit, cotton"],
      ["notes", isRtl ? "ملاحظات للعميل" : "Customer notes", isRtl ? "مثال: يحفظ مجمداً، متاح حسب الطلب" : "Example: keep frozen, available on request"],
    ];
  }, [isRtl]);

  const groupedKnowledge = useMemo(() => {
    const groups: Record<string, KnowledgeItem[]> = {};
    for (const item of knowledge) {
      const cat = item.category || "general";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [knowledge]);

  function showNotice(text: string, tone: NoticeTone = "success") {
    setNotice({ text, tone });
    window.setTimeout(() => setNotice(null), tone === "error" ? 5000 : 3000);
  }

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
      await loadStyleStats();
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
    } catch {
      // The style block is optional, so loading failures should not block the page.
    }
  }

  useEffect(() => {
    load();
  }, [token]);

  function metadataFromForm() {
    return {
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

  function resetProductForm() {
    setForm(emptyProductForm);
    setImageFile(null);
    setEditingProductId(null);
  }

  function startEditProduct(product: Product) {
    const metadata = product.metadata || {};
    setEditingProductId(product.id);
    setImageFile(null);
    setForm({
      ...emptyProductForm,
      name: product.name || "",
      description: product.description || "",
      category: product.category || "",
      price: product.price == null ? "" : String(product.price),
      currency: product.currency || "JOD",
      image_url: product.image_url || "",
      warranty_duration: product.warranty_duration || "",
      warranty_terms: product.warranty_terms || "",
      warranty_coverage: product.warranty_coverage || "",
      warranty_exclusions: product.warranty_exclusions || "",
      stock_quantity: product.stock_quantity == null ? "" : String(product.stock_quantity),
      stock_status: product.stock_status || "in_stock",
      sizes: listValue(metadata.sizes),
      colors: listValue(metadata.colors),
      material: listValue(metadata.material),
      fit: listValue(metadata.fit),
      model: listValue(metadata.model),
      specs: listValue(metadata.specs),
      usage: listValue(metadata.usage),
      included: listValue(metadata.included),
      notes: listValue(metadata.notes),
    });
    showNotice(isRtl ? `تم اختيار "${product.name}" للتعديل.` : `"${product.name}" is ready to edit.`, "info");
    productFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProduct() {
    if (!token || !form.name.trim()) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(editingProductId ? `/api/products/${editingProductId}` : "/api/products", {
        method: editingProductId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, metadata: metadataFromForm() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || (isRtl ? "تعذر حفظ المنتج." : "Could not save product."));
      }

      const productId = data.product?.id || editingProductId;
      if (imageFile && productId) {
        const body = new FormData();
        body.append("file", imageFile);
        const imageRes = await fetch(`/api/products/${productId}/image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body,
        });
        if (!imageRes.ok) {
          throw new Error(isRtl ? "تم حفظ المنتج، لكن تعذر رفع الصورة." : "Product saved, but the image could not be uploaded.");
        }
      }

      resetProductForm();
      showNotice(editingProductId ? (isRtl ? "تم تعديل المنتج." : "Product updated.") : (isRtl ? "تمت إضافة المنتج." : "Product added."));
      await load();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء الحفظ." : "Error occurred during save."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!token || !confirm(isRtl ? "حذف هذا المنتج؟" : "Delete this product?")) return;
    const res = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setProducts((current) => current.filter((product) => product.id !== id));
      if (editingProductId === id) resetProductForm();
      showNotice(isRtl ? "تم حذف المنتج." : "Product deleted.");
    } else {
      showNotice(isRtl ? "تعذر حذف المنتج." : "Could not delete product.", "error");
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
    } else {
      showNotice(isRtl ? "تعذر تغيير حالة المنتج." : "Could not change product status.", "error");
    }
  }

  async function importFromUrl() {
    if (!token || !importUrl.trim()) return;
    setImporting(true);
    setNotice(null);
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
      if (!res.ok) {
        throw new Error(data.detail || data.error || (isRtl ? "تعذر قراءة الرابط." : "Could not read the URL."));
      }
      setCandidates(data.candidates || []);
      showNotice(
        (data.candidates || []).length
          ? (isRtl ? "تم استخراج بيانات قابلة للمراجعة." : "Extracted data is ready to review.")
          : (isRtl ? "لم يتم العثور على بيانات منتج واضحة." : "No clear product data was found."),
        (data.candidates || []).length ? "success" : "info",
      );
    } catch (error) {
      showNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء الاستيراد." : "Error occurred during import."), "error");
    } finally {
      setImporting(false);
    }
  }

  function fillFromCandidate(candidate: Product) {
    resetProductForm();
    setForm({
      ...emptyProductForm,
      name: candidate.name || "",
      description: candidate.description || "",
      category: candidate.category || "",
      price: candidate.price || "",
      currency: candidate.currency || "JOD",
      image_url: candidate.image_url || "",
      notes: isRtl ? "تمت تعبئة المنتج من رابط خارجي. راجع التفاصيل قبل الحفظ." : "Filled from an external URL. Review details before saving.",
    });
    showNotice(isRtl ? "تمت تعبئة نموذج المنتج. افتح تبويب المنتجات للمراجعة والحفظ." : "Product form filled. Open Products to review and save.", "info");
  }

  function resetKnowledgeForm() {
    setPolicyForm(emptyKnowledgeForm);
    setCustomCategory("");
    setEditingKnowledgeId(null);
    setStructuredProfile({ website: "", brand_description: "", facebook: "", instagram: "", tiktok: "" });
    setStructuredFaq({ question: "", answer: "" });
    setStructuredBranches([{ branch_name: "", city: "", maps_link: "" }]);
    setStructuredOffer({ offer_name: "", description: "", price: "", validity: "" });
    setStructuredOrdering({ ordering_method: "", preparation_time: "", delivery_areas: "", payment_notes: "" });
    setStructuredGeneric({ title: "", content: "" });
  }

  function startEditKnowledge(item: KnowledgeItem) {
    const knownCategory = knowledgeCategories(isRtl).some((category) => category.value === item.category);
    setEditingKnowledgeId(item.id);
    
    let isJson = false;
    let parsedData: any = null;
    try {
      parsedData = JSON.parse(item.body);
      if (parsedData && typeof parsedData === "object") {
        isJson = true;
      }
    } catch (e) {
      isJson = false;
    }

    setPolicyForm({
      title: item.title || "",
      body: item.body || "",
      category: knownCategory ? item.category || "business_profile" : "custom",
    });
    setCustomCategory(knownCategory ? "" : item.category || "");
    
    if (isJson) {
      if (item.category === "business_profile") {
        setStructuredProfile({
          website: parsedData.website || "",
          brand_description: parsedData.brand_description || "",
          facebook: parsedData.facebook || "",
          instagram: parsedData.instagram || "",
          tiktok: parsedData.tiktok || "",
        });
      } else if (item.category === "faq") {
        setStructuredFaq({
          question: parsedData.question || "",
          answer: parsedData.answer || "",
        });
      } else if (item.category === "sales_points") {
        setStructuredBranches(
          parsedData.branches && Array.isArray(parsedData.branches)
            ? parsedData.branches
            : [{ branch_name: "", city: "", maps_link: "" }]
        );
      } else if (item.category === "offers") {
        setStructuredOffer({
          offer_name: parsedData.offer_name || "",
          description: parsedData.description || "",
          price: parsedData.price || "",
          validity: parsedData.validity || "",
        });
      } else if (item.category === "ordering") {
        setStructuredOrdering({
          ordering_method: parsedData.ordering_method || "",
          preparation_time: parsedData.preparation_time || "",
          delivery_areas: parsedData.delivery_areas || "",
          payment_notes: parsedData.payment_notes || "",
        });
      } else {
        setStructuredGeneric({
          title: parsedData.title || item.title || "",
          content: parsedData.content || parsedData.body || "",
        });
      }
    } else {
      setStructuredGeneric({
        title: item.title || "",
        content: item.body || "",
      });
    }
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveKnowledgeItem() {
    if (!token) return;
    const finalCategory = policyForm.category === "custom" ? (customCategory.trim() || "general") : policyForm.category;
    
    let finalBody = "";
    let finalTitle = policyForm.title;

    if (finalCategory === "business_profile") {
      finalBody = JSON.stringify(structuredProfile);
      finalTitle = isRtl ? "ملف البراند" : "Brand Profile";
    } else if (finalCategory === "faq") {
      finalBody = JSON.stringify(structuredFaq);
      finalTitle = structuredFaq.question || (isRtl ? "سؤال متكرر" : "FAQ");
    } else if (finalCategory === "sales_points") {
      const cleanBranches = structuredBranches.filter(b => b.branch_name.trim() || b.city.trim());
      finalBody = JSON.stringify({ branches: cleanBranches });
      finalTitle = isRtl ? "فروع المتجر ونقاط البيع" : "Store Branches";
    } else if (finalCategory === "offers") {
      finalBody = JSON.stringify(structuredOffer);
      finalTitle = structuredOffer.offer_name || (isRtl ? "عرض ترويجي" : "Promo Offer");
    } else if (finalCategory === "ordering") {
      finalBody = JSON.stringify(structuredOrdering);
      finalTitle = isRtl ? "طريقة الطلب والدفع" : "Ordering and Payment";
    } else {
      finalBody = JSON.stringify(structuredGeneric);
      finalTitle = structuredGeneric.title || finalTitle || (isRtl ? "سياسة عامة" : "General Policy");
    }

    if (!finalTitle.trim() || !finalBody.trim()) {
      showNotice(isRtl ? "يرجى تعبئة الحقول المطلوبة." : "Please fill in all required fields.", "error");
      return;
    }

    const res = await fetch(editingKnowledgeId ? `/api/knowledge/${editingKnowledgeId}` : "/api/knowledge", {
      method: editingKnowledgeId ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: finalTitle,
        body: finalBody,
        category: finalCategory,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      resetKnowledgeForm();
      showNotice(editingKnowledgeId ? (isRtl ? "تم تعديل المعلومة." : "Fact updated.") : (isRtl ? "تم حفظ المعلومة." : "Fact saved."));
      await load();
    } else {
      showNotice(data.error || (isRtl ? "تعذر حفظ المعلومة." : "Could not save fact."), "error");
    }
  }

  async function deleteKnowledgeItem(id: string) {
    if (!token || !confirm(isRtl ? "حذف هذه المعلومة؟" : "Delete this fact?")) return;
    const res = await fetch(`/api/knowledge/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      setKnowledge((current) => current.filter((item) => item.id !== id));
      if (editingKnowledgeId === id) resetKnowledgeForm();
      showNotice(isRtl ? "تم حذف المعلومة." : "Fact deleted.");
    } else {
      showNotice(data.error || (isRtl ? "تعذر حذف المعلومة." : "Could not delete fact."), "error");
    }
  }

  const isSaveDisabled = () => {
    const finalCategory = policyForm.category;
    if (finalCategory === "business_profile") {
      return !structuredProfile.brand_description.trim();
    }
    if (finalCategory === "faq") {
      return !structuredFaq.question.trim() || !structuredFaq.answer.trim();
    }
    if (finalCategory === "sales_points") {
      return structuredBranches.filter(b => b.branch_name.trim()).length === 0;
    }
    if (finalCategory === "offers") {
      return !structuredOffer.offer_name.trim() || !structuredOffer.description.trim();
    }
    if (finalCategory === "ordering") {
      return !structuredOrdering.ordering_method.trim();
    }
    return !structuredGeneric.title.trim() || !structuredGeneric.content.trim();
  };

  const renderFactBody = (item: KnowledgeItem) => {
    try {
      const data = JSON.parse(item.body);
      if (data && typeof data === "object") {
        if (item.category === "business_profile") {
          return (
            <div className="mt-2 space-y-1.5 text-xs text-white/60">
              {data.website && <div><strong>{isRtl ? "الموقع:" : "Website:"}</strong> <a href={data.website} target="_blank" rel="noreferrer" className="text-primary-400 hover:underline">{data.website}</a></div>}
              {data.brand_description && <div><strong>{isRtl ? "الوصف:" : "Description:"}</strong> {data.brand_description}</div>}
              {(data.facebook || data.instagram || data.tiktok) && (
                <div className="flex gap-3 mt-1 text-white/40">
                  {data.facebook && <span>FB: {data.facebook}</span>}
                  {data.instagram && <span>IG: {data.instagram}</span>}
                  {data.tiktok && <span>TT: {data.tiktok}</span>}
                </div>
              )}
            </div>
          );
        }
        if (item.category === "faq") {
          return (
            <div className="mt-2 rounded-xl bg-white/[0.02] p-3 border border-white/5 text-xs">
              <div className="font-semibold text-white/80">Q: {data.question}</div>
              <div className="mt-1 text-white/60">A: {data.answer}</div>
            </div>
          );
        }
        if (item.category === "sales_points" && data.branches && Array.isArray(data.branches)) {
          return (
            <div className="mt-2 space-y-2 text-xs">
              <div className="text-[11px] text-white/40 uppercase tracking-wider">{isRtl ? "الفروع ونقاط البيع:" : "Branches & Locations:"}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.branches.map((b: any, idx: number) => (
                  <div key={idx} className="rounded-xl bg-white/[0.02] p-2.5 border border-white/5">
                    <div className="font-medium text-white/85">{b.branch_name}</div>
                    <div className="text-white/50 text-[11px] mt-0.5">{b.city}</div>
                    {b.maps_link && (
                      <a href={b.maps_link} target="_blank" rel="noreferrer" className="text-[10px] text-primary-400 hover:underline block mt-1">
                        📍 {isRtl ? "خرائط جوجل" : "Google Maps"}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (item.category === "offers") {
          return (
            <div className="mt-2 rounded-xl bg-white/[0.02] p-3 border border-white/5 text-xs space-y-1">
              <div className="font-semibold text-white/85">{data.offer_name}</div>
              <div className="text-white/60">{data.description}</div>
              <div className="flex gap-4 mt-2 text-[11px] text-white/50">
                {data.price && <span>💰 {isRtl ? "السعر:" : "Price:"} {data.price}</span>}
                {data.validity && <span>📅 {isRtl ? "الصلاحية:" : "Validity:"} {data.validity}</span>}
              </div>
            </div>
          );
        }
        if (item.category === "ordering") {
          return (
            <div className="mt-2 space-y-1.5 text-xs text-white/60">
              {data.ordering_method && <div><strong>{isRtl ? "طريقة الطلب:" : "Ordering Method:"}</strong> {data.ordering_method}</div>}
              {data.preparation_time && <div><strong>{isRtl ? "مدة التجهيز والرد:" : "Prep Time:"}</strong> {data.preparation_time}</div>}
              {data.delivery_areas && <div><strong>{isRtl ? "مناطق التوصيل:" : "Delivery Areas:"}</strong> {data.delivery_areas}</div>}
              {data.payment_notes && <div><strong>{isRtl ? "ملاحظات الدفع:" : "Payment Notes:"}</strong> {data.payment_notes}</div>}
            </div>
          );
        }
        if (item.category === "policy" || item.category === "custom" || data.content || data.title) {
          return (
            <div className="mt-2 text-xs text-white/60">
              {data.content && <p className="whitespace-pre-wrap leading-6">{data.content}</p>}
            </div>
          );
        }
      }
    } catch (e) {
      // Not JSON
    }
    return <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-white/52">{item.body}</p>;
  };

  async function uploadStyleFile(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !styleFile) return;
    setStyleUploading(true);
    setNotice(null);
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
      showNotice(isRtl ? `تم استخراج ${data.added} رسالة من أسلوب الرد.` : `Extracted ${data.added} reply style sample(s).`);
      await loadStyleStats();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : (isRtl ? "حدث خطأ أثناء الرفع." : "Error occurred during upload."), "error");
    } finally {
      setStyleUploading(false);
    }
  }

  async function clearStyleSamples() {
    if (!token || !confirm(isRtl ? "مسح كل عينات أسلوب الرد؟" : "Clear all reply style samples?")) return;
    const res = await fetch("/api/style/samples", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      showNotice(isRtl ? "تم مسح عينات الأسلوب." : "Style samples cleared.");
      await loadStyleStats();
    } else {
      showNotice(isRtl ? "تعذر مسح العينات." : "Could not clear samples.", "error");
    }
  }

  if (loading) {
    return (
      <AppShell
        title={isRtl ? "بيانات المتجر والمنتجات" : "Store data and products"}
        subtitle={isRtl ? "كل ما يحتاجه المساعد للرد على العملاء بدقة." : "Everything the assistant needs to answer customers accurately."}
      >
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={isRtl ? "بيانات المتجر والمنتجات" : "Store data and products"}
      subtitle={isRtl ? "أضف المنتجات، نقاط البيع، العروض، وطريقة الطلب التي سيعتمد عليها المساعد." : "Add products, locations, offers, and ordering details the assistant will use."}
    >
      {notice && (
        <div
          className={cn(
            "mb-6 flex animate-in fade-in slide-in-from-top-2 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-lg",
            notice.tone === "error" && "border-red-400/20 bg-red-500/10 text-red-200",
            notice.tone === "info" && "border-blue-400/20 bg-blue-500/10 text-blue-200",
            notice.tone === "success" && "border-primary-400/20 bg-primary-500/10 text-primary-300",
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          {notice.text}
        </div>
      )}

      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {[
          { label: isRtl ? "منتجات محفوظة" : "Saved products", value: products.length, Icon: Package },
          { label: isRtl ? "معلومات للمساعد" : "Assistant facts", value: knowledge.length, Icon: BookOpenText },
          { label: isRtl ? "عينات أسلوب الرد" : "Reply style samples", value: styleStats?.total || 0, Icon: FileText },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-white/50">{label}</span>
              <Icon className="h-4 w-4 text-primary-400" />
            </div>
            <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="w-full rounded-2xl border border-white/5 bg-white/[0.02] p-1">
          <TabsTrigger value="products" className="flex-1 py-2.5">{isRtl ? "المنتجات" : "Products"}</TabsTrigger>
          <TabsTrigger value="facts" className="flex-1 py-2.5">{isRtl ? "معلومات المساعد" : "Assistant facts"}</TabsTrigger>
          <TabsTrigger value="import" className="flex-1 py-2.5">{isRtl ? "استيراد من رابط" : "Import from URL"}</TabsTrigger>
          <TabsTrigger value="style" className="flex-1 py-2.5">{isRtl ? "أسلوب الرد" : "Reply style"}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <div ref={productFormRef} className="scroll-mt-6">
              <GradientCard className="h-fit">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {editingProductId ? <Pencil className="h-5 w-5 text-primary-400" /> : <Plus className="h-5 w-5 text-primary-400" />}
                    <h2 className="text-lg font-semibold text-white">{editingProductId ? (isRtl ? "تعديل المنتج" : "Edit product") : (isRtl ? "إضافة منتج" : "Add product")}</h2>
                  </div>
                  {editingProductId && (
                    <Button type="button" variant="ghost" size="sm" onClick={resetProductForm} title={isRtl ? "إلغاء التعديل" : "Cancel edit"}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {editingProductId && (
                  <div className="mb-5 rounded-2xl border border-primary-400/25 bg-primary-500/10 p-3">
                    <div className="text-[11px] font-semibold text-primary-300">
                      {isRtl ? "المنتج المحدد للتعديل" : "Selected product"}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-white">{form.name}</div>
                    <div className="mt-1 text-[11px] leading-5 text-white/48">
                      {isRtl ? "عدّل البيانات هنا ثم اضغط حفظ التعديل." : "Edit the fields here, then save changes."}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "اسم المنتج" : "Product name"}</label>
                  <Input placeholder={isRtl ? "مثال: مانجا - 6 قطع" : "Example: Mango - 6 pieces"} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>

                <div className="grid grid-cols-[1fr_96px] gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "السعر" : "Price"}</label>
                    <Input inputMode="decimal" placeholder="0.00" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "العملة" : "Currency"}</label>
                    <Input dir="ltr" className="text-left" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "التصنيف" : "Category"}</label>
                  <Input placeholder={isRtl ? "مثال: نكهات، بوكسات، عروض" : "Example: flavors, boxes, offers"} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "وصف المنتج" : "Product description"}</label>
                  <Textarea placeholder={isRtl ? "اكتب التفاصيل التي تريد من المساعد ذكرها للعميل." : "Write the details the assistant can tell customers."} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {dynamicLabels.map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label className="mb-1.5 block text-xs font-medium text-white/70">{label}</label>
                      <Input placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "الكمية" : "Quantity"}</label>
                    <Input inputMode="numeric" placeholder={isRtl ? "اختياري" : "Optional"} value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "الحالة" : "Status"}</label>
                    <select
                      className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm text-white outline-none focus:border-primary-400/60"
                      value={form.stock_status}
                      onChange={(e) => setForm({ ...form, stock_status: e.target.value })}
                    >
                      <option className="bg-ink-950" value="in_stock">{isRtl ? "متوفر" : "In stock"}</option>
                      <option className="bg-ink-950" value="out_of_stock">{isRtl ? "غير متوفر" : "Out of stock"}</option>
                      <option className="bg-ink-950" value="preorder">{isRtl ? "طلب مسبق" : "Preorder"}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "رابط الصورة" : "Image URL"}</label>
                  <Input dir="ltr" className="text-left" placeholder="https://..." value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "رفع صورة" : "Upload image"}</label>
                  <Input type="file" accept="image/*" className="file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                </div>

                <Button className="w-full" onClick={saveProduct} disabled={saving || !form.name.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingProductId ? (isRtl ? "حفظ التعديل" : "Save changes") : (isRtl ? "حفظ المنتج" : "Save product")}
                </Button>
                </div>
              </GradientCard>
            </div>

            <GradientCard>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">{isRtl ? "قائمة المنتجات" : "Product list"}</h2>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">
                  {products.length} {isRtl ? "منتج" : "product(s)"}
                </span>
              </div>

              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-16 text-center">
                  <Package className="mb-4 h-12 w-12 text-white/12" />
                  <div className="text-sm font-medium text-white/50">{isRtl ? "لا توجد منتجات بعد" : "No products yet"}</div>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {products.map((product) => {
                    const isEditingThisProduct = product.id === editingProductId;
                    return (
                      <article
                        key={product.id}
                        className={cn(
                          "overflow-hidden rounded-2xl border transition",
                          isEditingThisProduct
                            ? "border-primary-400/60 bg-primary-500/10 shadow-lg shadow-primary-500/10"
                            : "border-white/10 bg-white/[0.025] hover:border-white/18",
                        )}
                      >
                        <div className="flex gap-3 p-3">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                            {product.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={imageSrc(product.image_url, token)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-white/20"><Package className="h-6 w-6" /></div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-white">{product.name}</h3>
                                <p className="mt-1 text-[11px] text-white/42">{product.category || (isRtl ? "بدون تصنيف" : "No category")}</p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                {isEditingThisProduct && (
                                  <span className="rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold text-ink-950">
                                    {isRtl ? "قيد التعديل" : "Editing"}
                                  </span>
                                )}
                                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", product.available !== false ? "bg-primary-500/15 text-primary-300" : "bg-white/10 text-white/45")}>
                                  {product.available !== false ? (isRtl ? "ظاهر" : "Visible") : (isRtl ? "مخفي" : "Hidden")}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 text-sm font-bold text-primary-300">
                              {product.price ? `${product.price} ${product.currency || ""}` : (isRtl ? "بدون سعر" : "No price")}
                            </div>
                            <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-white/48">{product.description || (isRtl ? "لا يوجد وصف." : "No description.")}</p>
                            <div className="mt-2 text-[10px] font-medium text-white/35">{statusLabel(product.stock_status, isRtl)}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-white/5 bg-white/[0.02] px-3 py-2">
                          <div className="flex gap-1">
                            <Button type="button" variant={isEditingThisProduct ? "secondary" : "ghost"} size="sm" onClick={() => startEditProduct(product)} title={isRtl ? "تعديل المنتج" : "Edit product"}>
                              <Pencil className="h-4 w-4" />
                              <span className="text-xs">{isEditingThisProduct ? (isRtl ? "محدد" : "Selected") : (isRtl ? "تعديل" : "Edit")}</span>
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => toggleProduct(product.id)} title={product.available !== false ? (isRtl ? "إخفاء المنتج" : "Hide product") : (isRtl ? "إظهار المنتج" : "Show product")}>
                              {product.available !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => deleteProduct(product.id)} className="text-red-300 hover:bg-red-500/10 hover:text-red-200" title={isRtl ? "حذف المنتج" : "Delete product"}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </GradientCard>
          </div>
        </TabsContent>

        <TabsContent value="facts" className="animate-in fade-in slide-in-from-bottom-2">
          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
            <GradientCard className="h-fit">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {editingKnowledgeId ? <Pencil className="h-5 w-5 text-primary-400" /> : <BookOpenText className="h-5 w-5 text-primary-400" />}
                  <h2 className="text-lg font-semibold text-white">{editingKnowledgeId ? (isRtl ? "تعديل المعلومة" : "Edit fact") : (isRtl ? "إضافة معلومة للمساعد" : "Add assistant fact")}</h2>
                </div>
                {editingKnowledgeId && (
                  <Button type="button" variant="ghost" size="sm" onClick={resetKnowledgeForm} title={isRtl ? "إلغاء التعديل" : "Cancel edit"}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "نوع المعلومة" : "Fact type"}</label>
                  <select
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm text-white outline-none focus:border-primary-400/60"
                    value={policyForm.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      setPolicyForm({ ...policyForm, category: cat });
                    }}
                  >
                    {knowledgeCategories(isRtl).map((cat) => (
                      <option key={cat.value} value={cat.value} className="bg-ink-950 text-white">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {policyForm.category === "custom" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "اسم التصنيف" : "Category name"}</label>
                    <Input placeholder={isRtl ? "مثال: معلومات التوزيع" : "Example: distribution details"} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                  </div>
                )}

                {policyForm.category === "business_profile" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "الموقع الإلكتروني" : "Website URL"}</label>
                      <Input placeholder="https://example.com" value={structuredProfile.website} onChange={(e) => setStructuredProfile({ ...structuredProfile, website: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "وصف مختصر للعلامة التجارية" : "Brand Description"}</label>
                      <Textarea placeholder={isRtl ? "اكتب نبذة سريعة عن براندك ومنتجاتك..." : "Write a brief description..."} value={structuredProfile.brand_description} onChange={(e) => setStructuredProfile({ ...structuredProfile, brand_description: e.target.value })} />
                    </div>
                    <div className="grid gap-2 grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-white/50">{isRtl ? "رابط فيسبوك" : "Facebook"}</label>
                        <Input placeholder="facebook.com/..." value={structuredProfile.facebook} onChange={(e) => setStructuredProfile({ ...structuredProfile, facebook: e.target.value })} className="text-xs h-9 px-2" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-white/50">{isRtl ? "يوزر إنستجرام" : "Instagram"}</label>
                        <Input placeholder="@username" value={structuredProfile.instagram} onChange={(e) => setStructuredProfile({ ...structuredProfile, instagram: e.target.value })} className="text-xs h-9 px-2" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-medium text-white/50">{isRtl ? "يوزر تيك توك" : "TikTok"}</label>
                        <Input placeholder="@username" value={structuredProfile.tiktok} onChange={(e) => setStructuredProfile({ ...structuredProfile, tiktok: e.target.value })} className="text-xs h-9 px-2" />
                      </div>
                    </div>
                  </div>
                )}

                {policyForm.category === "faq" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "السؤال الشائع" : "Question"}</label>
                      <Input placeholder={isRtl ? "مثال: هل يتوفر الشحن خارج العاصمة؟" : "Example: Do you ship internationally?"} value={structuredFaq.question} onChange={(e) => setStructuredFaq({ ...structuredFaq, question: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "الإجابة النموذجية" : "Answer"}</label>
                      <Textarea placeholder={isRtl ? "اكتب الإجابة المفصلة التي سيستخدمها البوت..." : "Write the answer..."} value={structuredFaq.answer} onChange={(e) => setStructuredFaq({ ...structuredFaq, answer: e.target.value })} className="min-h-24" />
                    </div>
                  </div>
                )}

                {policyForm.category === "sales_points" && (
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-white/70">{isRtl ? "الفروع ونقاط البيع" : "Branches list"}</label>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                      {structuredBranches.map((branch, idx) => (
                        <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 space-y-2 relative">
                          <div className="flex gap-2">
                            <Input
                              placeholder={isRtl ? "اسم الفرع (مثال: فرع خلدا)" : "Branch Name"}
                              value={branch.branch_name}
                              onChange={(e) => {
                                const newBranches = [...structuredBranches];
                                newBranches[idx].branch_name = e.target.value;
                                setStructuredBranches(newBranches);
                              }}
                              className="text-xs h-9"
                            />
                            <Input
                              placeholder={isRtl ? "المدينة (مثال: عمان)" : "City"}
                              value={branch.city}
                              onChange={(e) => {
                                const newBranches = [...structuredBranches];
                                newBranches[idx].city = e.target.value;
                                setStructuredBranches(newBranches);
                              }}
                              className="text-xs h-9 w-24 shrink-0"
                            />
                          </div>
                          <Input
                            placeholder={isRtl ? "رابط خرائط جوجل" : "Google Maps Link"}
                            value={branch.maps_link}
                            onChange={(e) => {
                              const newBranches = [...structuredBranches];
                              newBranches[idx].maps_link = e.target.value;
                              setStructuredBranches(newBranches);
                            }}
                            className="text-[10px] h-8"
                          />
                          {structuredBranches.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setStructuredBranches(structuredBranches.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-2 text-red-400 hover:text-red-300 text-[10px]"
                            >
                              {isRtl ? "حذف" : "Remove"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setStructuredBranches([...structuredBranches, { branch_name: "", city: "", maps_link: "" }])}
                      className="w-full h-9 border-dashed border-white/10 hover:border-primary-400/20"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {isRtl ? "إضافة فرع آخر" : "Add another branch"}
                    </Button>
                  </div>
                )}

                {policyForm.category === "offers" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "اسم العرض الترويجي" : "Offer name"}</label>
                      <Input placeholder={isRtl ? "مثال: باقة عروض الصيف" : "Example: Summer bundle offer"} value={structuredOffer.offer_name} onChange={(e) => setStructuredOffer({ ...structuredOffer, offer_name: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "تفاصيل العرض وما يشمله" : "What is included / Details"}</label>
                      <Textarea placeholder={isRtl ? "اكتب المنتجات المشمولة وشروط العرض..." : "Write what is included..."} value={structuredOffer.description} onChange={(e) => setStructuredOffer({ ...structuredOffer, description: e.target.value })} className="min-h-24" />
                    </div>
                    <div className="grid gap-2 grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/50">{isRtl ? "سعر العرض" : "Offer price"}</label>
                        <Input placeholder="50 JOD" value={structuredOffer.price} onChange={(e) => setStructuredOffer({ ...structuredOffer, price: e.target.value })} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-white/50">{isRtl ? "صلاحية العرض" : "Offer validity"}</label>
                        <Input placeholder={isRtl ? "مثال: حتى نهاية الشهر" : "Example: Valid until end of June"} value={structuredOffer.validity} onChange={(e) => setStructuredOffer({ ...structuredOffer, validity: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {policyForm.category === "ordering" && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "طرق الطلب المتاحة" : "Available Ordering Methods"}</label>
                      <Input placeholder={isRtl ? "مثال: موقع إلكتروني، رسائل واتساب" : "Example: Website, WhatsApp"} value={structuredOrdering.ordering_method} onChange={(e) => setStructuredOrdering({ ...structuredOrdering, ordering_method: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "مدة التجهيز والرد" : "Preparation and response time"}</label>
                      <Input placeholder={isRtl ? "مثال: خلال ٢٤ ساعة" : "Example: Within 24 hours"} value={structuredOrdering.preparation_time} onChange={(e) => setStructuredOrdering({ ...structuredOrdering, preparation_time: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "مناطق التوصيل المتوفرة" : "Delivery Areas"}</label>
                      <Input placeholder={isRtl ? "مثال: كافة مناطق المملكة" : "Example: All regions"} value={structuredOrdering.delivery_areas} onChange={(e) => setStructuredOrdering({ ...structuredOrdering, delivery_areas: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-white/60">{isRtl ? "ملاحظات الدفع" : "Payment Notes"}</label>
                      <Input placeholder={isRtl ? "مثال: الدفع عند الاستلام" : "Example: Cash on delivery"} value={structuredOrdering.payment_notes} onChange={(e) => setStructuredOrdering({ ...structuredOrdering, payment_notes: e.target.value })} />
                    </div>
                  </div>
                )}

                {(policyForm.category === "policy" || policyForm.category === "custom") && (
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "عنوان المعلومة" : "Title"}</label>
                      <Input placeholder={isRtl ? "مثال: سياسة الاستبدال" : "Example: return policy"} value={structuredGeneric.title} onChange={(e) => setStructuredGeneric({ ...structuredGeneric, title: e.target.value })} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "تفاصيل المعلومة كاملة" : "Full content"}</label>
                      <Textarea className="min-h-44" placeholder={isRtl ? "اكتب التفاصيل الكاملة هنا..." : "Write details here..."} value={structuredGeneric.content} onChange={(e) => setStructuredGeneric({ ...structuredGeneric, content: e.target.value })} />
                    </div>
                  </div>
                )}

                <Button className="w-full" onClick={saveKnowledgeItem} disabled={isSaveDisabled()}>
                  <Save className="h-4 w-4" />
                  {editingKnowledgeId ? (isRtl ? "حفظ التعديل" : "Save changes") : (isRtl ? "حفظ المعلومة" : "Save fact")}
                </Button>
              </div>
            </GradientCard>

            <GradientCard>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary-400" />
                  <h2 className="text-lg font-semibold text-white">{isRtl ? "المعلومات المحفوظة" : "Saved facts"}</h2>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/80">
                  {knowledge.length} {isRtl ? "معلومة" : "fact(s)"}
                </span>
              </div>

              {Object.keys(groupedKnowledge).length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
                  <BookOpenText className="mb-3 h-9 w-9 text-white/15" />
                  <div className="text-sm font-medium text-white/45">{isRtl ? "لا توجد معلومات محفوظة بعد" : "No facts saved yet"}</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedKnowledge).map(([category, items]) => {
                    const isOpen = openGroups[category] !== false;
                    return (
                      <section key={category} className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.015]">
                        <button
                          type="button"
                          onClick={() => setOpenGroups((prev) => ({ ...prev, [category]: !isOpen }))}
                          className="flex w-full items-center justify-between bg-white/[0.025] px-4 py-3 text-start text-xs font-semibold text-white/70 hover:bg-white/[0.04]"
                        >
                          <span>{categoryLabel(category, isRtl)}</span>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">{items.length}</span>
                        </button>

                        {isOpen && (
                          <div className="divide-y divide-white/5">
                            {items.map((item) => (
                              <article key={item.id} className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                                    {renderFactBody(item)}
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => startEditKnowledge(item)} title={isRtl ? "تعديل المعلومة" : "Edit fact"}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => deleteKnowledgeItem(item.id)} className="text-red-300 hover:bg-red-500/10 hover:text-red-200" title={isRtl ? "حذف المعلومة" : "Delete fact"}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </GradientCard>
          </div>
        </TabsContent>

        <TabsContent value="import" className="animate-in fade-in slide-in-from-bottom-2">
          <div className="mx-auto max-w-3xl">
            <GradientCard>
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/20 text-blue-300">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">{isRtl ? "استيراد منتج من رابط" : "Import product from URL"}</h2>
                  <p className="text-xs text-white/50">{isRtl ? "لروابط المتاجر أو المنشورات التي تحتوي بيانات منتج واضحة." : "For store links or posts with clear product details."}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input dir="ltr" className="h-11 flex-1 text-left" placeholder="https://..." value={importUrl} onChange={(e) => setImportUrl(e.target.value)} />
                <Button className="h-11 px-6" onClick={importFromUrl} disabled={importing || !importUrl.trim()}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {isRtl ? "جلب البيانات" : "Fetch data"}
                </Button>
              </div>

              {candidates.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-sm font-medium text-white/80">{isRtl ? "النتائج" : "Results"}</h3>
                  {candidates.map((candidate, index) => (
                    <article key={`${candidate.name}-${index}`} className="flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-4">
                        {candidate.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageSrc(candidate.image_url, token)} alt="" className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover" />
                        ) : (
                          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white/5 text-white/20"><ImagePlus className="h-6 w-6" /></div>
                        )}
                        <div>
                          <h3 className="font-semibold text-white">{candidate.name || (isRtl ? "بدون اسم" : "No name")}</h3>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/50">{candidate.description || (isRtl ? "الوصف غير واضح." : "Description unclear.")}</p>
                          {candidate.price && <div className="mt-2 text-xs font-bold text-primary-300">{candidate.price} {candidate.currency}</div>}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" className="shrink-0" onClick={() => fillFromCandidate(candidate)}>
                        <RotateCcw className="h-4 w-4" />
                        {isRtl ? "تعبئة النموذج" : "Fill form"}
                      </Button>
                    </article>
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
                <Upload className="h-5 w-5 text-primary-400" />
                <h2 className="text-lg font-semibold text-white">{isRtl ? "تدريب أسلوب الرد" : "Train reply style"}</h2>
              </div>
              <form onSubmit={uploadStyleFile} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "ملف محادثة" : "Chat file"}</label>
                  <Input
                    type="file"
                    accept=".txt,.json,.csv"
                    className="file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-white"
                    onChange={(e) => setStyleFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/70">{isRtl ? "اسم المتحدث أو المتجر" : "Speaker or store name"}</label>
                  <Input placeholder={isRtl ? "اختياري" : "Optional"} value={styleMyName} onChange={(e) => setStyleMyName(e.target.value)} />
                </div>
                <Button className="w-full" type="submit" disabled={!styleFile || styleUploading}>
                  {styleUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {styleUploading ? (isRtl ? "جاري الرفع" : "Uploading") : (isRtl ? "رفع الملف" : "Upload file")}
                </Button>
              </form>
            </GradientCard>

            <GradientCard>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="text-4xl font-bold text-white">{styleStats?.total || 0}</div>
                <div className="mt-2 text-sm font-medium text-white/50">{isRtl ? "عينة أسلوب محفوظة" : "saved style sample(s)"}</div>
                {(styleStats?.total || 0) > 0 && (
                  <Button variant="danger" size="sm" className="mt-6" onClick={clearStyleSamples}>
                    <Trash2 className="h-4 w-4" />
                    {isRtl ? "مسح العينات" : "Clear samples"}
                  </Button>
                )}
              </div>
            </GradientCard>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
