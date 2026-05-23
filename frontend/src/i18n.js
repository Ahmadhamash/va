import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslations from "./locales/en.json";
import arTranslations from "./locales/ar.json";

const resources = {
  ar: { translation: arTranslations },
  en: { translation: enTranslations }
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
