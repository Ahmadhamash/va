"use client";

import { useEffect, useState } from "react";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { AuthRequired, LoadingPanel } from "@/components/auth-required";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api-client";
import {
  itemToProduct,
  policyToKnowledge,
  type BackendItem,
  type BackendPolicy
} from "@/lib/backend-mappers";
import type { KnowledgeItem, Product } from "@/lib/types";

const tabs = [
  { label: "Business info", value: "business-info" },
  { label: "Products / services", value: "products-services" },
  { label: "FAQs", value: "faqs" },
  { label: "Policies", value: "policies" },
  { label: "Files", value: "files" }
];

function parsePrice(value: string) {
  const match = value.replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export default function KnowledgeBasePage() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadKnowledge() {
    if (!user) return;
    setBusy(true);
    try {
      const [items, policies] = await Promise.all([
        apiRequest<BackendItem[]>("/items"),
        apiRequest<BackendPolicy[]>("/policies")
      ]);
      setProducts(items.map(itemToProduct));
      setKnowledge(policies.map(policyToKnowledge));
      setNotice(`Loaded ${items.length} catalog items and ${policies.length} policy records from the backend.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load backend knowledge.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadKnowledge();
  }, [user]);

  async function addProduct() {
    if (!productName.trim()) return;
    setBusy(true);
    try {
      const created = await apiRequest<BackendItem>("/items", {
        method: "POST",
        body: {
          name: productName,
          price: parsePrice(productPrice),
          currency: productPrice.trim().includes("JD") ? "JOD" : "USD",
          description: productDescription || null,
          category: "service",
          available: true
        }
      });
      setProducts((items) => [itemToProduct(created), ...items]);
      setProductName("");
      setProductPrice("");
      setProductDescription("");
      setShowForm(false);
      setNotice("Product saved to `/api/items`.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setBusy(false);
    }
  }

  async function addKnowledge(payload: { title: string; category: string; content: string }) {
    const created = await apiRequest<BackendPolicy>("/policies", {
      method: "POST",
      body: {
        policy_type: payload.category || "faq",
        title: payload.title,
        content: payload.content,
        is_active: true
      }
    });
    setKnowledge((items) => [policyToKnowledge(created), ...items]);
  }

  return (
    <AppShell title="Knowledge" subtitle="Catalog and policy records connected to the FastAPI backend.">
      {loading ? (
        <LoadingPanel />
      ) : !user ? (
        <AuthRequired />
      ) : (
        <Tabs defaultValue="business-info">
          {notice ? <div className="mb-5 rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 px-5 py-4 text-sm font-semibold text-cyanx-400">{busy ? "Syncing with backend..." : notice}</div> : null}
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
              Add service
            </Button>
          </div>

          {showForm ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Add backend catalog item</CardTitle>
                <CardDescription>Saved through `POST /api/items`, scoped to the signed-in client.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <Input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Service name" />
                <Input value={productPrice} onChange={(event) => setProductPrice(event.target.value)} placeholder="Price" />
                <Input value={productDescription} onChange={(event) => setProductDescription(event.target.value)} placeholder="Description" />
                <Button className="md:col-span-3" onClick={addProduct} disabled={busy}>
                  Save service
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <TabsContent value="business-info">
            <Card>
              <CardHeader>
                <CardTitle>Backend knowledge</CardTitle>
                <CardDescription>Policies and FAQ-style records are stored through `/api/policies`.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <KnowledgeEditor onSave={addKnowledge} />
                <div className="grid gap-3 md:grid-cols-2">
                  {knowledge.length ? (
                    knowledge.map((item) => (
                      <div key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                        <div className="text-xs font-semibold text-emeraldx-400">{item.type}</div>
                        <div className="mt-2 font-semibold text-white">{item.title}</div>
                        <p className="mt-2 text-sm leading-6 text-white/50">{item.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 text-sm text-white/50">
                      No policy knowledge has been saved yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products-services">
            <Card>
              <CardHeader>
                <CardTitle>Products / services</CardTitle>
                <CardDescription>Rows come from `GET /api/items`.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-3xl border border-white/10">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-white/[0.055] text-white/45">
                      <tr>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Available</th>
                        <th className="px-4 py-3">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id} className="border-t border-white/10">
                          <td className="px-4 py-4 font-semibold text-white">{product.name}</td>
                          <td className="px-4 py-4 text-white/60">{product.price}</td>
                          <td className="px-4 py-4 text-emeraldx-400">{product.available ? "Available" : "Hidden"}</td>
                          <td className="px-4 py-4 text-white/50">{product.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {[
            { value: "faqs", title: "FAQs" },
            { value: "policies", title: "Policies" },
            { value: "files", title: "Files" }
          ].map((item) => (
            <TabsContent key={item.value} value={item.value}>
              <Card>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>Add structured backend knowledge without leaving this screen.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.04] p-10 text-center">
                    <Upload className="mx-auto h-10 w-10 text-white/35" />
                    <p className="mt-4 text-white/55">File upload is still handled by the backend style-training endpoint; typed records can be saved above.</p>
                    <Textarea className="mt-5" placeholder="Add a short FAQ or policy note..." />
                    <Button className="mt-4" onClick={() => setNotice("Use the Business info tab to save this as a backend policy record.")}>Save</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </AppShell>
  );
}
