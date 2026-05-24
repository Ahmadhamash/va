"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockKnowledge, mockProducts } from "@/lib/mock-data";

export default function KnowledgeBasePage() {
  const [products] = useState(mockProducts);
  return (
    <AppShell title="Knowledge Base" subtitle="Teach the agent like you would train a helpful new employee.">
      <Tabs defaultValue="business-info">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <TabsList>
            {["Business Info", "Products / Services", "FAQs", "Policies", "Files"].map((tab) => (
              <TabsTrigger key={tab} value={tab.toLowerCase().replaceAll(" ", "-").replace("/", "")}>
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
          <Button>
            <Plus className="h-4 w-4" />
            Add product
          </Button>
        </div>

        <TabsContent value="business-info">
          <Card>
            <CardHeader>
              <CardTitle>Business knowledge</CardTitle>
              <CardDescription>Saved facts the AI can safely use.</CardDescription>
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

        <TabsContent value="products--services">
          <Card>
            <CardHeader>
              <CardTitle>Products / Services</CardTitle>
              <CardDescription>A clean table your team can edit later.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-3xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.055] text-white/45">
                    <tr>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Availability</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-t border-white/10">
                        <td className="px-4 py-4 font-semibold text-white">{product.name}</td>
                        <td className="px-4 py-4 text-white/60">{product.price}</td>
                        <td className="px-4 py-4 text-emeraldx-400">{product.available ? "Available" : "Hidden"}</td>
                        <td className="px-4 py-4 text-white/50">{product.description}</td>
                        <td className="px-4 py-4"><Button size="sm" variant="secondary">Edit</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {["faqs", "policies", "files"].map((value) => (
          <TabsContent key={value} value={value}>
            <Card>
              <CardHeader>
                <CardTitle>{value === "faqs" ? "FAQs" : value === "policies" ? "Policies" : "Files"}</CardTitle>
                <CardDescription>Add structured knowledge without technical setup.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-3xl border border-dashed border-white/12 bg-white/[0.04] p-10 text-center">
                  <Upload className="mx-auto h-10 w-10 text-white/35" />
                  <p className="mt-4 text-white/55">Add entries here when you are ready.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AppShell>
  );
}
