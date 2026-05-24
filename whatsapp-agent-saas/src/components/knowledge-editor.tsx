"use client";

import { useState } from "react";
import { Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function KnowledgeEditor() {
  const [title, setTitle] = useState("");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Product, policy, or FAQ title" />
        <Input placeholder="Category" />
      </div>
      <Textarea placeholder="Write the exact information your AI agent can use when replying..." />
      <div className="flex flex-wrap gap-3">
        <Button>
          <Plus className="h-4 w-4" />
          Add knowledge
        </Button>
        <Button variant="secondary">
          <Upload className="h-4 w-4" />
          Upload files
        </Button>
      </div>
    </div>
  );
}
