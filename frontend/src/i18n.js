import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  ar: {
    translation: {
      "business_assistant": "مساعد الأعمال",
      "admin": "مدير",
      "logout": "خروج",
      "login": "تسجيل الدخول",
      "register": "حساب جديد",
      "nav_clients": "العملاء",
      "nav_catalog": "الكاتالوج",
      "nav_delivery": "التوصيل",
      "nav_policies": "السياسات",
      "nav_offers": "العروض",
      "nav_bookings": "الحجوزات",
      "nav_payments": "الدفع",
      "nav_escalations": "التحويلات",
      "nav_workflows": "الأتمتة",
      "nav_training": "صوت AI",
      "nav_channels": "القنوات",
      "nav_chat": "المحادثة",
      "new_escalation": "تحويل جديد!",
      "escalation_message": "يوجد تحويل من الذكاء الاصطناعي يحتاج انتباهك."
    }
  },
  en: {
    translation: {
      "business_assistant": "Business Assistant",
      "admin": "Admin",
      "logout": "Logout",
      "login": "Login",
      "register": "Register",
      "nav_clients": "Clients",
      "nav_catalog": "Catalog",
      "nav_delivery": "Delivery",
      "nav_policies": "Policies",
      "nav_offers": "Offers",
      "nav_bookings": "Bookings",
      "nav_payments": "Payments",
      "nav_escalations": "Escalations",
      "nav_workflows": "Workflows",
      "nav_training": "AI Voice",
      "nav_channels": "Channels",
      "nav_chat": "Chat",
      "new_escalation": "New Escalation!",
      "escalation_message": "An AI escalation needs your attention."
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "ar",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
