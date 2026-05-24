"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockKnowledge, mockProducts } from "@/lib/mock-data";
import type { Product } from "@/lib/types";

const tabs = [
  { label: "معلومات النشاط", value: "business-info" },
  { label: "المنتجات / الخدمات", value: "products-services" },
  { label: "الأسئلة", value: "faqs" },
  { label: "السياسات", value: "policies" },
  { label: "الملفات", value: "files" }
];

export default function KnowledgeBasePage() {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");

  function addProduct() {
    if (!productName.trim()) return;
    setProducts((items) => [
      ...items,
      {
        id: `prod_${Date.now()}`,
        name: productName,
        price: productPrice || "حسب الطلب",
        available: true,
        description: productDescription || "وصف مختصر للخدمة."
      }
    ]);
    setProductName("");
    setProductPrice("");
    setProductDescription("");
    setShowForm(false);
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
                {mockKnowledge.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="text-xs font-semibold text-emeraldx-400">{item.type}</div>
                    <div className="mt-2 font-semibold text-white">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-white/50">{item.content}</p>
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
                  <Upload className="mx-auto h-10 w-10 text-white/35" />
                  <p className="mt-4 text-white/55">المساحة جاهزة للإضافة والربط لاحقا.</p>
                  <Textarea className="mt-5" placeholder="أضف سؤالا أو سياسة مختصرة..." />
                  <Button className="mt-4" onClick={() => setShowForm(false)}>حفظ</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
