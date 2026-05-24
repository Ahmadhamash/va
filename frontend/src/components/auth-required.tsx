"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthRequired({
  title = "Sign in to connect the backend",
  description = "This screen reads real data from the FastAPI backend. Sign in with a platform account to continue."
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emeraldx-500 text-ink-950">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link href="/login">
          <Button>Sign in</Button>
        </Link>
        <Link href="/register">
          <Button variant="secondary">Create account</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function LoadingPanel({ label = "Loading backend data..." }: { label?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-8 text-center text-sm font-semibold text-white/55">
      {label}
    </div>
  );
}
