"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type BusinessType = {
  key: string;
  label: string;
  icon?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [types, setTypes] = useState<BusinessType[]>([]);
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    business_name: "",
    business_type: ""
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest<BusinessType[]>("/business-types", { auth: false }).then(setTypes).catch(() => setTypes([]));
  }, []);

  function update(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((value) => ({ ...value, [field]: event.target.value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emeraldx-500 text-ink-950">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="font-semibold">Masar backend account</span>
          </Link>
          <ThemeToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>The first account on a fresh backend becomes the platform admin; later accounts become clients.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
            <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
              <Input value={form.username} onChange={update("username")} placeholder="Username" autoComplete="username" required />
              <Input value={form.email} onChange={update("email")} placeholder="Email" type="email" autoComplete="email" required />
              <Input value={form.password} onChange={update("password")} placeholder="Password" type="password" autoComplete="new-password" required />
              <Input value={form.business_name} onChange={update("business_name")} placeholder="Business name" autoComplete="organization" />
              <select value={form.business_type} onChange={update("business_type")} className="sm:col-span-2 flex h-11 w-full rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-emeraldx-400/60 focus:bg-white/[0.075]">
                <option value="">Business type</option>
                {types.map((type) => (
                  <option key={type.key} value={type.key}>
                    {type.icon ? `${type.icon} ` : ""}
                    {type.label}
                  </option>
                ))}
              </select>
              <Button className="sm:col-span-2" disabled={busy}>
                {busy ? "Creating account..." : "Create account"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-white/48">
              Already registered?{" "}
              <Link className="font-semibold text-emeraldx-400" href="/login">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
