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
    <div
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col"
      dir={t('dir', 'ltr')}
    >
      {item.image_url ? (
        <img
          src={imgSrc(item.image_url)}
          alt={item.name}
          className="h-36 w-full object-cover rounded-md mb-3"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900" dir="auto">
          {item.name}
        </h3>
        <span
          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
            item.available
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {item.available ? t("available") : t("unavailable")}
        </span>
      </div>

      {item.category && (
        <span className="text-xs text-brand-600 mt-1">{item.category}</span>
      )}

      {item.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-3" dir="auto">
          {item.description}
        </p>
      )}

      <div className="mt-3 font-semibold text-gray-900">
        {item.price != null
          ? `${item.price} ${item.currency}`
          : t("no_price")}
      </div>

      {/* Stock & Warranty badges */}
      <div className="flex flex-wrap gap-1 mt-2">
        {item.stock_status && item.stock_status !== "in_stock" && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            📦 {stockLabel[item.stock_status] ? t(stockLabel[item.stock_status]) : item.stock_status}
          </span>
        )}
        {item.stock_quantity != null && (
          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
            {t("quantity")} {item.stock_quantity}
          </span>
        )}
        {item.warranty_duration && (
          <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
            🛡️ {item.warranty_duration}
          </span>
        )}
        {item.variants && item.variants.length > 0 && (
          <span className="text-[10px] bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
            🎨 {item.variants.length} {t("option")}
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2 text-sm">
        <button
          onClick={() => onEdit(item)}
          className="px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          {t("edit")}
        </button>
        <button
          onClick={() => onToggle(item)}
          className="px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50"
        >
          {item.available ? t("disable") : t("enable")}
        </button>
        <button
          onClick={() => onDelete(item)}
          className="px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 me-auto"
        >
          {t("delete")}
        </button>
      </div>
    </div>
  );
}
