"use client";

import { useState, useEffect } from "react";
import { Plus, Upload, Trash2, FileText, CheckCircle2, RefreshCw, Sparkles, HelpCircle, BookOpen, ToggleLeft, ToggleRight, X, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/use-auth-store";
import type { Product, KnowledgeItem } from "@/lib/types";

interface MockFile {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  status: "INDEXING" | "INDEXED" | "FAILED";
}

const tabs = [
  { label: "معلومات النشاط", value: "business-info", icon: Sparkles },
  { label: "المنتجات / الخدمات", value: "products-services", icon: FileText },
  { label: "الأسئلة المتكررة", value: "faqs", icon: HelpCircle },
  { label: "السياسات", value: "policies", icon: BookOpen },
  { label: "الملفات المستندية", value: "files", icon: Upload }
];

export default function KnowledgeBasePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const { token } = useAuthStore();

  // Add Product Form
  const [showProductForm, setShowProductForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");

  // Add FAQ Form
  const [showFaqForm, setShowFaqForm] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");

  // Add Policy Form
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policyTitle, setPolicyTitle] = useState("");
  const [policyContent, setPolicyContent] = useState("");

  // Document Upload Simulator
  const [files, setFiles] = useState<MockFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  };

  useEffect(() => {
    async function load() {
      if (!token) return;
      try {
        const [prodRes, knowRes] = await Promise.all([
          fetch("/api/products", { headers: { Authorization: "Bearer " + token } }),
          fetch("/api/knowledge", { headers: { Authorization: "Bearer " + token } })
        ]);
        const prodData = await prodRes.json();
        const knowData = await knowRes.json();
        
        if (prodData.ok && prodData.products) setProducts(prodData.products);
        if (knowData.ok && knowData.knowledge) setKnowledge(knowData.knowledge);
      } catch (err) {
        console.error("Failed to load knowledge data", err);
      } finally {
        setLoading(false);
      }
    }
    load();

    // Initialize mock files
    const savedFiles = localStorage.getItem("mock_knowledge_files");
    if (savedFiles) {
      setFiles(JSON.parse(savedFiles));
    } else {
      const initialFiles: MockFile[] = [];
      setFiles(initialFiles);
      localStorage.setItem("mock_knowledge_files", JSON.stringify(initialFiles));
    }
  }, [token]);

  // Product CRUD
  async function addProduct() {
    if (!productName.trim() || !token) return;
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          name: productName,
          price: productPrice,
          description: productDescription
        })
      });
      const data = await res.json();
      if (data.ok && data.product) {
        const mappedProd = {
          id: data.product.id,
          name: data.product.name,
          price: String(data.product.price),
          available: data.product.available !== false,
          description: data.product.description || ""
        };
        setProducts((items) => [...items, mappedProd]);
        setProductName("");
        setProductPrice("");
        setProductDescription("");
        setShowProductForm(false);
        showNotice("✨ تم حفظ المنتج/الخدمة وتدريب الوكيل بنجاح!");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ فشل حفظ المنتج.");
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!token) return;
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        showNotice("🗑️ تم حذف المنتج بنجاح!");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ فشل حذف المنتج.");
    }
  }

  async function handleToggleProduct(id: string) {
    if (!token) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.ok && data.product) {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, available: data.product.available } : p));
        showNotice(`🔔 تم تعديل توفر المنتج إلى: ${data.product.available ? "متاح" : "غير متاح"}`);
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ فشل تحديث حالة التوفر.");
    }
  }

  // Knowledge CRUD
  async function addKnowledgeItem(category: string, title: string, body: string, callback: () => void) {
    if (!title.trim() || !body.trim() || !token) return;
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          title,
          body,
          category
        })
      });
      const data = await res.json();
      if (data.ok && data.knowledgeItem) {
        const item = data.knowledgeItem;
        setKnowledge((items) => [...items, {
          id: item.id,
          title: item.title,
          body: item.content,
          category: item.policy_type
        }]);
        callback();
        showNotice("✨ تم حفظ بند المعرفة وتدريب الوكيل بنجاح!");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ فشل حفظ المعلومة.");
    }
  }

  async function handleDeleteKnowledge(id: string) {
    if (!token) return;
    if (!confirm("هل أنت متأكد من حذف بند المعرفة هذا؟")) return;
    try {
      const res = await fetch(`/api/knowledge/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });
      const data = await res.json();
      if (data.ok) {
        setKnowledge(prev => prev.filter(k => k.id !== id));
        showNotice("🗑️ تم حذف بند المعرفة بنجاح!");
      }
    } catch (err) {
      console.error(err);
      showNotice("❌ فشل الحذف.");
    }
  }

  // Mock File Upload Simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    
    const file = fileList[0];
    setUploadingFile(true);
    setUploadProgress(0);

    // Progress timer simulation
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const newFile: MockFile = {
              id: `file-${Date.now()}`,
              name: file.name,
              size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              uploadedAt: new Date().toISOString().split("T")[0],
              status: "INDEXING"
            };

            setFiles(prevFiles => {
              const updated = [newFile, ...prevFiles];
              localStorage.setItem("mock_knowledge_files", JSON.stringify(updated));
              return updated;
            });
            setUploadingFile(false);
            showNotice("📤 تم رفع الملف، جاري الفهرسة بالذكاء الاصطناعي...");

            // Process indexing status simulation
            setTimeout(() => {
              setFiles(prevFiles => {
                const updated = prevFiles.map(f => f.id === newFile.id ? { ...f, status: "INDEXED" as const } : f);
                localStorage.setItem("mock_knowledge_files", JSON.stringify(updated));
                return updated;
              });
              showNotice("⚡ تم الانتهاء من فهرسة الملف وتدريب الوكيل بنجاح!");
            }, 3000);
          }, 300);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const handleDeleteFile = (id: string) => {
    if (!confirm("هل أنت متأكد من إزالة هذا المستند من معرفة الوكيل؟")) return;
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      localStorage.setItem("mock_knowledge_files", JSON.stringify(updated));
      return updated;
    });
    showNotice("🗑️ تم حذف المستند وتحديث معرفة الوكيل.");
  };

  if (loading) {
    return (
      <AppShell title="المعرفة" subtitle="علّم الوكيل كأنك تدرّب موظف خدمة عملاء جديد.">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emeraldx-400" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="المعرفة" subtitle="علّم الوكيل كأنك تدرّب موظف خدمة عملاء جديد وتتحكم بنجاح في مصادر معلوماته.">
      {notice && (
        <div className="mb-4 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-5 py-4 text-sm font-semibold text-emeraldx-400 text-right animate-pulse">
          {notice}
        </div>
      )}

      <Tabs defaultValue="business-info">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <TabsList className="bg-white/[0.03] border border-white/10 rounded-2xl p-1.5 flex gap-1.5 overflow-x-auto max-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab 1: Business Info */}
        <TabsContent value="business-info">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white flex items-center justify-end gap-2">
                <span>معلومات النشاط الأساسية</span>
                <Sparkles className="h-5 w-5 text-emeraldx-400" />
              </CardTitle>
              <CardDescription className="text-sm text-white/45">أدخل معلومات وقواعد شركتك ليعتمد عليها الوكيل في إجاباته الافتراضية.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border border-white/5 bg-white/[0.02] p-5 rounded-3xl">
                <KnowledgeEditor />
              </div>
              
              <div className="text-right">
                <h4 className="text-sm font-bold text-white/80 mb-3">الحقائق المخزنة حالياً للنشاط</h4>
                {knowledge.filter(k => k.category === 'business-info' || !['faqs', 'policies'].includes(k.category || '')).length === 0 ? (
                  <p className="text-xs text-white/35 py-4">لا توجد معلومات نشاط محفوظة حالياً.</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {knowledge.filter(k => k.category === 'business-info' || !['faqs', 'policies'].includes(k.category || '')).map((item) => (
                      <div key={item.id} className="relative rounded-3xl border border-white/10 bg-white/[0.045] p-5 text-right flex flex-col justify-between group hover:border-white/20 transition-all duration-300">
                        <button
                          type="button"
                          onClick={() => handleDeleteKnowledge(item.id)}
                          className="absolute left-4 top-4 text-white/30 hover:text-red-400 transition p-1.5 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div>
                          <div className="inline-flex bg-emeraldx-500/10 text-emeraldx-400 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2">
                            {item.category === "business-info" ? "معلومات عامة" : item.category}
                          </div>
                          <div className="font-semibold text-white text-sm mb-2">{item.title}</div>
                          <p className="text-xs leading-5 text-white/50">{item.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Products & Services */}
        <TabsContent value="products-services">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right flex flex-row items-center justify-between gap-4">
              <Button onClick={() => setShowProductForm(!showProductForm)} size="sm">
                <Plus className="h-4 w-4 ml-1" />
                {showProductForm ? "إلغاء الإضافة" : "إضافة خدمة أو منتج"}
              </Button>
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center justify-end gap-2">
                  <span>قائمة المنتجات والخدمات</span>
                  <FileText className="h-5 w-5 text-emeraldx-400" />
                </CardTitle>
                <CardDescription className="text-sm text-white/45">إدارة الخدمات والأسعار التي سيتحدث عنها الوكيل ويقوم بتسويقها.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showProductForm && (
                <Card className="border border-white/10 bg-white/[0.03] p-5 rounded-3xl">
                  <h4 className="text-sm font-bold text-white mb-3 text-right">إضافة منتج أو خدمة جديدة</h4>
                  <div className="grid gap-3 md:grid-cols-3 mb-4">
                    <Input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="اسم المنتج/الخدمة (مثال: عطر مسار)" className="text-right text-xs pr-3" />
                    <Input value={productPrice} onChange={(event) => setProductPrice(event.target.value)} placeholder="السعر بالدولار أو العملة المحددة" className="text-right text-xs pr-3" />
                    <Input value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="وصف الخدمة ومميزاتها بالتفصيل" className="text-right text-xs pr-3" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button onClick={addProduct} size="sm">حفظ وتدريب الوكيل</Button>
                    <Button onClick={() => setShowProductForm(false)} size="sm" variant="secondary">إلغاء</Button>
                  </div>
                </Card>
              )}

              {products.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                  <p className="text-sm text-white/40 mb-3">لا توجد منتجات أو خدمات مضافة حالياً.</p>
                  <Button onClick={() => setShowProductForm(true)} size="sm">إضافة منتجك الأول</Button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-white/10">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white/[0.045] text-white/45">
                      <tr>
                        <th className="px-5 py-3 text-right">الاسم</th>
                        <th className="px-5 py-3 text-right">السعر</th>
                        <th className="px-5 py-3 text-right">الحالة للوكيل</th>
                        <th className="px-5 py-3 text-right">الوصف التسويقي</th>
                        <th className="px-5 py-3 text-left">التحكم</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-t border-white/10 hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-4 font-semibold text-white text-right">{product.name}</td>
                          <td className="px-5 py-4 text-white/70 text-right">{product.price}</td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleProduct(product.id)}
                              className="inline-flex items-center gap-1.5 text-xs focus:outline-none"
                            >
                              {product.available ? (
                                <>
                                  <ToggleRight className="h-5 w-5 text-emeraldx-500" />
                                  <span className="text-emeraldx-400">نشط (يرد عليه)</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft className="h-5 w-5 text-white/30" />
                                  <span className="text-white/40">مخفي</span>
                                </>
                              )}
                            </button>
                          </td>
                          <td className="px-5 py-4 text-white/50 text-right max-w-xs truncate">{product.description || "-"}</td>
                          <td className="px-5 py-4 text-left">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-white/40 hover:text-red-400"
                              onClick={() => handleDeleteProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: FAQs */}
        <TabsContent value="faqs">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right flex flex-row items-center justify-between gap-4">
              <Button onClick={() => setShowFaqForm(!showFaqForm)} size="sm">
                <Plus className="h-4 w-4 ml-1" />
                {showFaqForm ? "إلغاء الإضافة" : "إضافة سؤال شائع"}
              </Button>
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center justify-end gap-2">
                  <span>الأسئلة الشائعة والإجابات (FAQs)</span>
                  <HelpCircle className="h-5 w-5 text-emeraldx-400" />
                </CardTitle>
                <CardDescription className="text-sm text-white/45">أضف الأسئلة المتكررة التي يطرحها العملاء وإجاباتها الدقيقة ليرد بها الوكيل.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showFaqForm && (
                <Card className="border border-white/10 bg-white/[0.03] p-5 rounded-3xl text-right">
                  <h4 className="text-sm font-bold text-white mb-3">إضافة سؤال شائع جديد</h4>
                  <div className="space-y-3 mb-4">
                    <Input value={faqQuestion} onChange={(e) => setFaqQuestion(e.target.value)} placeholder="السؤال (مثال: هل توفرون شحن مجاني؟)" className="text-right text-xs pr-3" />
                    <Textarea value={faqAnswer} onChange={(e) => setFaqAnswer(e.target.value)} placeholder="الإجابة المفصلة التي يعتمد عليها الوكيل..." className="text-right text-xs min-h-[80px]" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button onClick={() => addKnowledgeItem("faqs", faqQuestion, faqAnswer, () => {
                      setFaqQuestion("");
                      setFaqAnswer("");
                      setShowFaqForm(false);
                    })} size="sm">حفظ السؤال</Button>
                    <Button onClick={() => setShowFaqForm(false)} size="sm" variant="secondary">إلغاء</Button>
                  </div>
                </Card>
              )}

              {knowledge.filter(k => k.category === "faqs").length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                  <p className="text-sm text-white/40 mb-3">لا توجد أسئلة متكررة محفوظة حالياً.</p>
                  <Button onClick={() => setShowFaqForm(true)} size="sm">إضافة سؤال متكرر</Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {knowledge.filter(k => k.category === "faqs").map((faq) => (
                    <div key={faq.id} className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-right flex flex-col justify-between group hover:border-white/20 transition-all duration-300">
                      <button
                        type="button"
                        onClick={() => handleDeleteKnowledge(faq.id)}
                        className="absolute left-4 top-4 text-white/30 hover:text-red-400 transition p-1.5 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="pr-2">
                        <div className="font-bold text-white text-sm mb-2">س: {faq.title}</div>
                        <p className="text-xs leading-6 text-white/60">ج: {faq.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Policies */}
        <TabsContent value="policies">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right flex flex-row items-center justify-between gap-4">
              <Button onClick={() => setShowPolicyForm(!showPolicyForm)} size="sm">
                <Plus className="h-4 w-4 ml-1" />
                {showPolicyForm ? "إلغاء الإضافة" : "إضافة سياسة جديدة"}
              </Button>
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center justify-end gap-2">
                  <span>السياسات وشروط الخدمة</span>
                  <BookOpen className="h-5 w-5 text-emeraldx-400" />
                </CardTitle>
                <CardDescription className="text-sm text-white/45">حدد سياسات الاسترجاع، الشحن، الاستبدال والخصوصية للوكيل.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showPolicyForm && (
                <Card className="border border-white/10 bg-white/[0.03] p-5 rounded-3xl text-right">
                  <h4 className="text-sm font-bold text-white mb-3">إضافة سياسة نشاط جديدة</h4>
                  <div className="space-y-3 mb-4">
                    <Input value={policyTitle} onChange={(e) => setPolicyTitle(e.target.value)} placeholder="عنوان السياسة (مثال: سياسة الاستبدال والاسترجاع)" className="text-right text-xs pr-3" />
                    <Textarea value={policyContent} onChange={(e) => setPolicyContent(e.target.value)} placeholder="اكتب شروط وبنود السياسة بوضوح للوكيل..." className="text-right text-xs min-h-[90px]" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button onClick={() => addKnowledgeItem("policies", policyTitle, policyContent, () => {
                      setPolicyTitle("");
                      setPolicyContent("");
                      setShowPolicyForm(false);
                    })} size="sm">حفظ السياسة</Button>
                    <Button onClick={() => setShowPolicyForm(false)} size="sm" variant="secondary">إلغاء</Button>
                  </div>
                </Card>
              )}

              {knowledge.filter(k => k.category === "policies").length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-3xl bg-white/[0.01]">
                  <p className="text-sm text-white/40 mb-3">لا توجد سياسات محفوظة حالياً.</p>
                  <Button onClick={() => setShowPolicyForm(true)} size="sm">إضافة سياسة نشاط</Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {knowledge.filter(k => k.category === "policies").map((policy) => (
                    <div key={policy.id} className="relative rounded-3xl border border-white/10 bg-white/[0.045] p-5 text-right flex flex-col justify-between group hover:border-white/20 transition-all duration-300">
                      <button
                        type="button"
                        onClick={() => handleDeleteKnowledge(policy.id)}
                        className="absolute left-4 top-4 text-white/30 hover:text-red-400 transition p-1.5 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div>
                        <div className="font-bold text-white text-sm mb-2 flex items-center justify-end gap-1.5">
                          <span>{policy.title}</span>
                          <BookOpen className="h-4 w-4 text-emeraldx-400" />
                        </div>
                        <p className="text-xs leading-6 text-white/60">{policy.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Documents & Files Upload (Simulator & Manager) */}
        <TabsContent value="files">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white flex items-center justify-end gap-2">
                <span>الملفات المستندية ومصادر المعرفة</span>
                <Upload className="h-5 w-5 text-emeraldx-400" />
              </CardTitle>
              <CardDescription className="text-sm text-white/45">ارفع ملفات PDF، Word، أو نصوص ليقوم الذكاء الاصطناعي باستخراج المعلومات وفهرستها.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Drag and drop zone */}
              <div className="relative border-2 border-dashed border-white/15 rounded-3xl bg-white/[0.015] hover:bg-white/[0.035] hover:border-emeraldx-400/40 p-8 text-center transition-all duration-300">
                <input
                  type="file"
                  id="file-upload"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploadingFile}
                  accept=".pdf,.docx,.txt,.doc"
                  onChange={handleFileUpload}
                />
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 text-white/60">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">اسحب وأفلت مستنداتك هنا أو انقر للتصفح</p>
                    <p className="text-xs text-white/40 mt-1">يدعم ملفات PDF, Word, TXT حتى 10 ميغابايت</p>
                  </div>
                </div>
              </div>

              {uploadingFile && (
                <div className="bg-white/[0.03] border border-white/5 p-4 rounded-2xl text-right space-y-2">
                  <div className="flex justify-between items-center text-xs text-white/60">
                    <span className="font-semibold text-emeraldx-400">{uploadProgress}%</span>
                    <span>جاري رفع وفهرسة المستند...</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-emeraldx-500 rounded-full transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Uploaded files manager */}
              <div className="text-right">
                <h4 className="text-sm font-bold text-white/80 mb-3 flex items-center justify-end gap-1.5">
                  <span>المستندات المفهرسة حالياً للوكيل</span>
                  <FileText className="h-4 w-4 text-white/40" />
                </h4>
                
                {files.length === 0 ? (
                  <div className="text-center py-6 text-xs text-white/30 border border-white/5 rounded-3xl bg-white/[0.01]">
                    لا توجد مستندات مرفوعة حالياً لتأهيل الوكيل.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center justify-between border border-white/5 bg-white/[0.025] hover:bg-white/[0.045] p-4 rounded-2xl transition-all duration-200">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-white/40 hover:text-red-400"
                            onClick={() => handleDeleteFile(file.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs font-semibold text-white">{file.name}</div>
                            <div className="text-[10px] text-white/40 mt-0.5">{file.size} · رفع في {file.uploadedAt}</div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {file.status === "INDEXED" ? (
                              <span className="inline-flex items-center gap-1 bg-emeraldx-500/10 border border-emeraldx-500/20 text-emeraldx-400 text-[10px] px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" />
                                تم الاستخراج والفهرسة
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                جاري تحليل النصوص للوكيل...
                              </span>
                            )}
                            <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-white/60">
                              <FileText className="h-5 w-5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
