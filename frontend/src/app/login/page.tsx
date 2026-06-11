"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Loader2, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/use-auth-store";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguageStore } from "@/store/use-language-store";

type BusinessTypeOption = {
  key: string;
  label: string;
  icon?: string;
  group?: string;
};

const fallbackBusinessTypes: BusinessTypeOption[] = [
  { key: "retail", label: "Retail / Ecommerce", group: "Commerce" },
  { key: "restaurant", label: "Restaurant / Cafe", group: "Food" },
  { key: "services", label: "Professional Services", group: "Services" },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const language = useLanguageStore((state) => state.language);
  const isRtl = language === "ar";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("retail");
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeOption[]>(fallbackBusinessTypes);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/business-types", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : fallbackBusinessTypes))
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length) {
          setBusinessTypes(data);
          if (!data.some((item: BusinessTypeOption) => item.key === businessType)) {
            setBusinessType(data[0].key);
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const body = mode === "login"
        ? { username, password }
        : { username, password, email, business_name: businessName, business_type: businessType };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "فشل تسجيل الدخول");
      }

      const data = await res.json();
      const token = data.access_token;

      const meRes = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await meRes.json();

      setAuth(token, user);
      if (user.role === "admin") router.push("/admin");
      else if (user.role === "support_agent") router.push("/inbox");
      else router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  const handleQuickLogin = (userType: "admin" | "shop") => {
    setError("");
    if (userType === "admin") {
      setUsername("admin");
      setPassword("admin123");
    } else {
      setUsername("shop");
      setPassword("shop123");
    }
    setTimeout(() => {
      const btn = document.getElementById("submit-btn");
      btn?.click();
    }, 150);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-ink-950 p-4">
      {/* Top Navigation Row */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
        >
          {isRtl ? <ArrowRight className="h-4 w-4 text-primary-400" /> : <ArrowLeft className="h-4 w-4 text-primary-400" />}
          {isRtl ? "الرئيسية" : "Home"}
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <div className="w-full max-w-md space-y-8 mt-12 sm:mt-0">
        <div className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-primary-500 text-ink-950 shadow-glow">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-6 text-2xl font-bold text-white">chatter</h1>
          <p className="mt-2 text-sm text-white/50">
            {mode === "login" 
              ? (isRtl ? "سجل دخولك لإدارة محادثاتك" : "Sign in to manage your chats") 
              : (isRtl ? "أنشئ حسابك الجديد" : "Create a new account")}
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-right">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            placeholder={isRtl ? "اسم المستخدم" : "Username"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="rtl:text-right ltr:text-left"
          />
          {mode === "register" && (
            <>
              <Input
                type="email"
                placeholder={isRtl ? "البريد الإلكتروني" : "Email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rtl:text-right ltr:text-left"
              />
              <Input
                placeholder={isRtl ? "اسم النشاط التجاري" : "Business Name"}
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="rtl:text-right ltr:text-left"
              />
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm text-white outline-none transition focus:border-primary-400/60 focus:ring-2 focus:ring-primary-400/15 rtl:text-right ltr:text-left"
              >
                {businessTypes.map((item) => (
                  <option key={item.key} value={item.key} className="bg-ink-900 text-white">
                    {item.group ? `${item.group} - ` : ""}{item.label}
                  </option>
                ))}
              </select>
            </>
          )}
          <Input
            type="password"
            placeholder={isRtl ? "كلمة المرور" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rtl:text-right ltr:text-left"
          />
          <Button id="submit-btn" type="submit" className="w-full h-11" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? (isRtl ? "تسجيل الدخول" : "Sign In") : (isRtl ? "إنشاء الحساب" : "Create Account")}
          </Button>
        </form>

        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="w-full text-center text-sm text-white/40 hover:text-white/70 transition"
        >
          {mode === "login" 
            ? (isRtl ? "ليس لديك حساب؟ سجل الآن" : "Don't have an account? Sign up") 
            : (isRtl ? "لديك حساب؟ سجل دخولك" : "Already have an account? Sign in")}
        </button>

        {/* Quick Demo Login Helper Card */}
        {mode === "login" && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right">
            <div className="flex items-center justify-end gap-2 text-xs font-semibold text-primary-400 mb-3">
              {isRtl ? "بيانات الدخول التجريبي السريع" : "Quick Demo Accounts"}
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="grid gap-2 grid-cols-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-[11px] h-9 whitespace-nowrap"
                onClick={() => handleQuickLogin("admin")}
                disabled={loading}
              >
                {isRtl ? "دخول كمسؤول المنصة" : "Login as Admin"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-[11px] h-9 whitespace-nowrap"
                onClick={() => handleQuickLogin("shop")}
                disabled={loading}
              >
                {isRtl ? "دخول كصاحب متجر" : "Login as Merchant"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
