"use client";

import { useState, useEffect } from "react";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/store/use-auth-store";
import type { Product, KnowledgeItem } from "@/lib/types";
import { Loader2 } from "lucide-react";

const tabs = [
  { label: "معلومات النشاط", value: "business-info" },
  { label: "المنتجات / الخدمات", value: "products-services" },
  { label: "الأسئلة", value: "faqs" },
  { label: "السياسات", value: "policies" },
  { label: "الملفات", value: "files" }
];

export default function KnowledgeBasePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [policyTitle, setPolicyTitle] = useState("");
  const [policyContent, setPolicyContent] = useState("");
  const { token } = useAuthStore();

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
  }, [token]);

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
        setProducts((items) => [...items, data.product]);
        setProductName("");
        setProductPrice("");
        setProductDescription("");
        setShowForm(false);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function addPolicy(type: string) {
    if (!policyTitle.trim() || !policyContent.trim() || !token) return;

    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          title: policyTitle,
          body: policyContent,
          category: type
        })
      });
      const data = await res.json();
      if (data.ok && data.knowledgeItem) {
        setKnowledge((items) => [...items, data.knowledgeItem]);
        setPolicyTitle("");
        setPolicyContent("");
      }
    } catch (err) {
      console.error(err);
    }
  }

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
    <AppShell title="المعرفة" subtitle="علّم الوكيل كأنك تدرّب موظف خدمة عملاء جديد.">
      <Tabs defaultValue="business-info">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button onClick={() => setShowForm((value) => !value)}>
            <Plus className="h-4 w-4" />
            إضافة خدمة
          </Button>
        </div>

        {showForm ? (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>إضافة خدمة جديدة</CardTitle>
              <CardDescription>تظهر في جدول الخدمات ويستطيع الوكيل استخدامها في الردود.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="اسم الخدمة" />
              <Input value={productPrice} onChange={(event) => setProductPrice(event.target.value)} placeholder="السعر" />
              <Input value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="الوصف" />
              <Button className="md:col-span-3" onClick={addProduct}>حفظ الخدمة</Button>
            </CardContent>
          </Card>
        ) : null}

        <TabsContent value="business-info">
          <Card>
            <CardHeader>
              <CardTitle>معرفة النشاط</CardTitle>
              <CardDescription>حقائق محفوظة يستطيع الذكاء استخدامها بأمان.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <KnowledgeEditor />
              <div className="grid gap-3 md:grid-cols-2">
                {knowledge.filter(k => k.category === 'business-info' || !['faqs', 'policies'].includes(k.category || '')).map((item) => (
                  <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="text-xs font-semibold text-emeraldx-400">{item.category}</div>
                    <div className="mt-2 font-semibold text-white">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-white/50">{item.body}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products-services">
          <Card>
            <CardHeader>
              <CardTitle>المنتجات / الخدمات</CardTitle>
              <CardDescription>جدول بسيط يستطيع فريقك تعديله لاحقا.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <table className="w-full text-right text-sm">
                  <thead className="bg-white/[0.055] text-white/45">
                    <tr>
                      <th className="px-4 py-3">الاسم</th>
                      <th className="px-4 py-3">السعر</th>
                      <th className="px-4 py-3">التوفر</th>
                      <th className="px-4 py-3">الوصف</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-t border-white/10">
                        <td className="px-4 py-4 font-semibold text-white">{product.name}</td>
                        <td className="px-4 py-4 text-white/60">{product.price}</td>
                        <td className="px-4 py-4 text-emeraldx-400">{product.available ? "متاح" : "مخفي"}</td>
                        <td className="px-4 py-4 text-white/50">{product.description}</td>
                        <td className="px-4 py-4"><Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>تعديل</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {[
          { value: "faqs", title: "الأسئلة المتكررة" },
          { value: "policies", title: "السياسات" },
          { value: "files", title: "الملفات" }
        ].map((item) => (
          <TabsContent key={item.value} value={item.value}>
            <Card>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>أضف معرفة منظمة بدون أي إعداد تقني.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.04] p-10 text-center">
                  <div className="mx-auto max-w-md space-y-4">
                    <Input value={policyTitle} onChange={(e) => setPolicyTitle(e.target.value)} placeholder="العنوان (مثال: سياسة الاسترجاع)" />
                    <Textarea value={policyContent} onChange={(e) => setPolicyContent(e.target.value)} placeholder="أضف سؤالا أو سياسة مختصرة..." />
                    <Button onClick={() => addPolicy(item.value)}>حفظ</Button>
                  </div>
                  
                  <div className="mt-10 grid gap-3 text-right">
                    {knowledge.filter(k => k.category === item.value).map((k) => (
                      <div key={k.id} className="rounded-2xl bg-white/[0.02] p-4">
                        <div className="font-semibold text-white">{k.title}</div>
                        <div className="mt-1 text-sm text-white/60">{k.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
