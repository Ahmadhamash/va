"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emeraldx-500 text-ink-950">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="font-semibold">Masar backend login</span>
          </Link>
          <ThemeToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the FastAPI account created for this deployment.</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
            <form className="space-y-4" onSubmit={submit}>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" autoComplete="username" required />
              <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" type="password" autoComplete="current-password" required />
              <Button className="w-full" disabled={busy}>
                {busy ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-white/48">
              Need an account?{" "}
              <Link className="font-semibold text-emeraldx-400" href="/register">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
