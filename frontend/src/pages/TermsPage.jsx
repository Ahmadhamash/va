import { useTranslation } from "react-i18next";
export default function TermsPage() {
  const {
    t
  } = useTranslation();
  return <div className="mx-auto max-w-4xl px-4 py-12 bg-white min-h-screen" dir="rtl">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">{t("txt_168")}</h1>
        <p className="text-gray-500">{t("txt_148")}</p>
        
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_169")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_170")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_171")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_172")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_173")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_174")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_175")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_176")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_177")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_178")}</p>
        </section>

      </div>
    </div>;
}