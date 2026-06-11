"use client";

import { create } from "zustand";

export type Language = "ar" | "en";

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

export const languageLabels = {
  ar: {
    menu: "القائمة",
    closeMenu: "إغلاق القائمة",
    openMenu: "فتح القائمة",
    searchPlaceholder: "ابحث عن عميل أو محادثة...",
    connectChannel: "ربط قناة",
    notifications: "الإشعارات",
    lightMode: "نهاري",
    darkMode: "ليلي",
    toggleTheme: "تبديل الوضع الليلي والنهاري",
    switchLanguage: "English",
    logout: "تسجيل الخروج",
    platformAdmin: "مدير المنصة",
    supportAgent: "موظف دعم",
    setupReady: "جاهزية الربط",
    brandHint: "كل قنوات العملاء بمكان واحد",
    supportSummary: "هنا بتوصل المحادثات اللي تحتاج تدخل بشري.",
    clientSummary: "الوكيل جاهز للردود الذكية والتحويل البشري وقت الحاجة.",
    nav: {
      basics: "الأساسية",
      dashboard: "الرئيسية",
      inbox: "المحادثات",
      analytics: "التحليلات",
      ai: "الذكاء الاصطناعي",
      agent: "الوكيل الذكي",
      monitor: "مراقبة الذكاء",
      knowledge: "قاعدة المعرفة",
      workflows: "الأتمتة والردود",
      business: "إدارة العمل",
      onboarding: "ربط القنوات",
      bookings: "الحجوزات",
      policies: "سياسات العمل",
      billing: "الاشتراك والباقات",
      voice: "إعدادات الصوت",
      settings: "الإعدادات العامة",
      platform: "إدارة المنصة",
      admin: "لوحة الإشراف",
      team: "فريق العمل",
      support: "مركز الموظفين",
      account: "حسابي",
    },
  },
  en: {
    menu: "Menu",
    closeMenu: "Close menu",
    openMenu: "Open menu",
    searchPlaceholder: "Search customer or conversation...",
    connectChannel: "Connect channel",
    notifications: "Notifications",
    lightMode: "Light",
    darkMode: "Dark",
    toggleTheme: "Toggle light and dark mode",
    switchLanguage: "العربية",
    logout: "Log out",
    platformAdmin: "Platform admin",
    supportAgent: "Support agent",
    setupReady: "Setup ready",
    brandHint: "All customer channels in one place",
    supportSummary: "Conversations that need human support arrive here.",
    clientSummary: "The agent is ready for AI replies and human handoff when needed.",
    nav: {
      basics: "Core",
      dashboard: "Dashboard",
      inbox: "Conversations",
      analytics: "Analytics",
      ai: "AI",
      agent: "AI agent",
      monitor: "AI monitor",
      knowledge: "Knowledge base",
      workflows: "Automation and replies",
      business: "Business",
      onboarding: "Connect channels",
      bookings: "Bookings",
      policies: "Business policies",
      billing: "Billing and plans",
      voice: "Voice settings",
      settings: "General settings",
      platform: "Platform",
      admin: "Admin dashboard",
      team: "Team",
      support: "Staff center",
      account: "My account",
    },
  },
} as const;

const pageRoutes = [
  "/settings/voice",
  "/ai-monitor",
  "/dashboard",
  "/inbox",
  "/analytics",
  "/agent",
  "/knowledge",
  "/workflows",
  "/onboarding",
  "/bookings",
  "/policies",
  "/billing",
  "/settings",
  "/admin",
  "/team",
  "/support",
] as const;

type PageRoute = (typeof pageRoutes)[number];
type PageMeta = {
  title: string;
  subtitle: string;
};

const pageLabels: Record<Language, Record<PageRoute, PageMeta>> = {
  ar: {
    "/dashboard": {
      title: "الرئيسية",
      subtitle: "مركز تحكم بسيط لكل قنوات خدمة العملاء الذكية.",
    },
    "/inbox": {
      title: "المحادثات",
      subtitle: "صندوق موحد لرسائل واتساب وفيسبوك وإنستغرام مع الذكاء والتحويل البشري.",
    },
    "/analytics": {
      title: "التحليلات والأداء",
      subtitle: "بيانات وإحصائيات فورية توضح فاعلية الذكاء الاصطناعي وتوفير الجهد البشري.",
    },
    "/agent": {
      title: "الوكيل الذكي",
      subtitle: "إعدادات آمنة ومفهومة بدون تعريض إعدادات النظام الحساسة للعميل.",
    },
    "/ai-monitor": {
      title: "مراقبة الذكاء",
      subtitle: "قراءة تشغيلية لكل رد: التوجيه، الأدوات، التحقق، الإصلاح، والنتيجة النهائية.",
    },
    "/knowledge": {
      title: "قاعدة المعرفة",
      subtitle: "إدارة منتجاتك، سياساتك، والمعلومات التي يستند إليها الذكاء الاصطناعي.",
    },
    "/workflows": {
      title: "الأتمتة ومسارات العمل",
      subtitle: "أنشئ ردودًا تلقائية وتسلسلات بناءً على كلمات مفتاحية أو أحداث معينة.",
    },
    "/onboarding": {
      title: "ربط القنوات",
      subtitle: "جهز ManyChat أو اربط قناة مباشرة من Meta وواتساب والويبهوك.",
    },
    "/bookings": {
      title: "إدارة الحجوزات",
      subtitle: "مواعيد العملاء التي قام الوكيل الذكي بجدولتها.",
    },
    "/policies": {
      title: "السياسات وقواعد العمل",
      subtitle: "عرّف سياسات نشاطك التجاري ليجيب الوكيل على العملاء بوضوح.",
    },
    "/billing": {
      title: "الباقات والاشتراكات",
      subtitle: "اختر الخطة المناسبة لحجم عملك وتشغيل الوكيل الذكي على قنواتك.",
    },
    "/settings/voice": {
      title: "إعدادات الصوت",
      subtitle: "أصوات OpenAI وElevenLabs مع معاينة حقيقية قبل الحفظ.",
    },
    "/settings": {
      title: "الإعدادات",
      subtitle: "إدارة الملف التجاري، التنبيهات، الاشتراك، وضوابط الأمان.",
    },
    "/admin": {
      title: "لوحة الإشراف العام",
      subtitle: "إدارة العملاء، إحصائيات النظام، وإعدادات الذكاء الاصطناعي للمنصة.",
    },
    "/team": {
      title: "فريق العمل",
      subtitle: "موظفو المنصة الذين يستلمون المحادثات عند التحويل البشري.",
    },
    "/support": {
      title: "مركز الموظفين",
      subtitle: "المحادثات التي تحتاج تدخلًا بشريًا من فريق المنصة.",
    },
  },
  en: {
    "/dashboard": {
      title: "Dashboard",
      subtitle: "A simple control center for every AI customer support channel.",
    },
    "/inbox": {
      title: "Conversations",
      subtitle: "A unified inbox for WhatsApp, Facebook, and Instagram with AI and human handoff.",
    },
    "/analytics": {
      title: "Analytics and performance",
      subtitle: "Live metrics that show AI effectiveness and saved human effort.",
    },
    "/agent": {
      title: "AI agent",
      subtitle: "Safe, understandable controls without exposing sensitive system settings.",
    },
    "/ai-monitor": {
      title: "AI monitor",
      subtitle: "Operational visibility for routing, tools, validation, repair, and final replies.",
    },
    "/knowledge": {
      title: "Knowledge base",
      subtitle: "Manage the products, policies, and facts the AI uses for customer support.",
    },
    "/workflows": {
      title: "Automation and workflows",
      subtitle: "Build automated replies and sequences from keywords or specific events.",
    },
    "/onboarding": {
      title: "Connect channels",
      subtitle: "Prepare ManyChat or connect Meta, WhatsApp, and webhook channels directly.",
    },
    "/bookings": {
      title: "Bookings",
      subtitle: "Customer appointments scheduled by the AI agent.",
    },
    "/policies": {
      title: "Policies and business rules",
      subtitle: "Define your business policies so the agent answers customers clearly.",
    },
    "/billing": {
      title: "Plans and billing",
      subtitle: "Choose the plan that fits your business volume and active channels.",
    },
    "/settings/voice": {
      title: "Voice settings",
      subtitle: "OpenAI and ElevenLabs voices with real previews before saving.",
    },
    "/settings": {
      title: "Settings",
      subtitle: "Manage your business profile, alerts, subscription, and safety controls.",
    },
    "/admin": {
      title: "Admin dashboard",
      subtitle: "Manage customers, system metrics, and platform AI settings.",
    },
    "/team": {
      title: "Team",
      subtitle: "Platform employees who receive conversations during human handoff.",
    },
    "/support": {
      title: "Staff center",
      subtitle: "Conversations that need human support from the platform team.",
    },
  },
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: "ar",
  setLanguage: (language) => set({ language }),
  toggleLanguage: () =>
    set((state) => ({ language: state.language === "ar" ? "en" : "ar" })),
}));

export function directionForLanguage(language: Language) {
  return language === "ar" ? "rtl" : "ltr";
}

export function pageMetaForPath(language: Language, pathname: string | null) {
  if (!pathname) return null;
  const route = pageRoutes.find((item) => pathname === item || pathname.startsWith(`${item}/`));
  return route ? pageLabels[language][route] : null;
}
