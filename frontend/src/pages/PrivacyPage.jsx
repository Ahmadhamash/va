import { useTranslation } from "react-i18next";
export default function PrivacyPage() {
  const {
    t
  } = useTranslation();
  return <div className="mx-auto max-w-4xl px-4 py-12 bg-white min-h-screen" dir="rtl">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">{t("txt_147")}</h1>
        <p className="text-gray-500">{t("txt_148")}</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_149")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_150")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_151")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_152")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_153")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_154")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_155")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_156")}</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-gray-800">{t("txt_157")}</h2>
          <p className="text-gray-700 leading-relaxed">{t("txt_158")}</p>
        </section>

      </div>
    </div>;
}