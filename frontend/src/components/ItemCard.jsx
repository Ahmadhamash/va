import { Edit3, PackageCheck, Palette, ShieldCheck, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { API_BASE } from "../services/api";
import { useTranslation } from "react-i18next";

function imgSrc(url) {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

const stockLabel = {
  in_stock: "available",
  out_of_stock: "out_of_stock",
  preorder: "preorder",
  coming_soon: "coming_soon",
};

export default function ItemCard({ item, onEdit, onDelete, onToggle }) {
  const { t } = useTranslation();
  return (
    <div className="surface flex min-h-[280px] flex-col overflow-hidden" dir={t("dir", "ltr")}>
      {item.image_url ? (
        <img
          src={imgSrc(item.image_url)}
          alt={item.name}
          className="h-40 w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="grid h-24 place-items-center border-b border-gray-100 bg-gray-50 text-gray-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-700">
          <PackageCheck className="h-9 w-9" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-black text-gray-950 dark:text-white" dir="auto">
              {item.name}
            </h3>
            {item.category && <p className="mt-1 text-xs font-bold text-brand-600 dark:text-mint-300">{item.category}</p>}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
              item.available
                ? "bg-mint-50 text-mint-600 dark:bg-mint-500/10 dark:text-mint-300"
                : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {item.available ? t("available") : t("unavailable")}
          </span>
        </div>

        {item.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-slate-300" dir="auto">
            {item.description}
          </p>
        )}

        <div className="mt-4 text-lg font-black text-gray-950 dark:text-white">
          {item.price != null ? `${item.price} ${item.currency}` : t("no_price")}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.stock_status && item.stock_status !== "in_stock" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ember-50 px-2 py-1 text-[11px] font-bold text-ember-600 dark:bg-ember-500/10 dark:text-ember-300">
              <PackageCheck className="h-3 w-3" />
              {stockLabel[item.stock_status] ? t(stockLabel[item.stock_status]) : item.stock_status}
            </span>
          )}
          {item.stock_quantity != null && (
            <span className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-bold text-brand-600 dark:bg-brand-500/10 dark:text-brand-100">
              {t("quantity")} {item.stock_quantity}
            </span>
          )}
          {item.warranty_duration && (
            <span className="inline-flex items-center gap-1 rounded-full bg-mint-50 px-2 py-1 text-[11px] font-bold text-mint-600 dark:bg-mint-500/10 dark:text-mint-300">
              <ShieldCheck className="h-3 w-3" />
              {item.warranty_duration}
            </span>
          )}
          {item.variants && item.variants.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-600 dark:bg-slate-800 dark:text-slate-300">
              <Palette className="h-3 w-3" />
              {item.variants.length} {t("option")}
            </span>
          )}
        </div>

        <div className="mt-auto flex gap-2 pt-4">
          <button onClick={() => onEdit(item)} className="icon-button" title={t("edit")}>
            <Edit3 className="h-4 w-4" />
          </button>
          <button onClick={() => onToggle(item)} className="icon-button" title={item.available ? t("disable") : t("enable")}>
            {item.available ? <ToggleRight className="h-4 w-4 text-mint-600" /> : <ToggleLeft className="h-4 w-4" />}
          </button>
          <button onClick={() => onDelete(item)} className="icon-button ms-auto text-red-600 dark:text-red-300" title={t("delete")}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
