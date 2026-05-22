import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE } from "../services/api";
import api from "../services/api";
const EMPTY = {
  name: "",
  description: "",
  category: "",
  price: "",
  currency: "USD",
  available: true,
  warranty_duration: "",
  warranty_terms: "",
  warranty_coverage: "",
  warranty_exclusions: "",
  stock_quantity: "",
  stock_status: "in_stock"
};
function imgSrc(url) {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}
export default function ItemForm({
  initial,
  onSubmit,
  onCancel,
  onImageUpload
}) {
  const {
    t
  } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState([]); // [{k,v}]
  const [variants, setVariants] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        description: initial.description || "",
        category: initial.category || "",
        price: initial.price ?? "",
        currency: initial.currency || "USD",
        available: initial.available ?? true,
        warranty_duration: initial.warranty_duration || "",
        warranty_terms: initial.warranty_terms || "",
        warranty_coverage: initial.warranty_coverage || "",
        warranty_exclusions: initial.warranty_exclusions || "",
        stock_quantity: initial.stock_quantity ?? "",
        stock_status: initial.stock_status || "in_stock"
      });
      const m = initial.metadata || {};
      setMeta(Object.keys(m).map(k => ({
        k,
        v: String(m[k])
      })));
      setVariants(initial.variants || []);
    } else {
      setForm(EMPTY);
      setMeta([]);
      setVariants([]);
    }
  }, [initial]);
  function update(field, value) {
    setForm(f => ({
      ...f,
      [field]: value
    }));
  }
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const metadata = {};
      meta.forEach(({
        k,
        v
      }) => {
        if (k.trim()) metadata[k.trim()] = v;
      });
      await onSubmit({
        ...form,
        price: form.price === "" ? null : Number(form.price),
        stock_quantity: form.stock_quantity === "" ? null : Number(form.stock_quantity),
        metadata
      });
    } catch (err) {
      setError(err?.response?.data?.detail || t("item_save_error"));
    } finally {
      setBusy(false);
    }
  }
  async function pickImage(e) {
    const f = e.target.files?.[0];
    if (!f || !onImageUpload) return;
    setBusy(true);
    try {
      await onImageUpload(f);
    } catch (err) {
      setError(err?.response?.data?.detail || t("image_upload_fail"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ─── Variant helpers ──────────────────────────────────────────────
  const [newVariant, setNewVariant] = useState({
    option_type: "",
    option_value: "",
    price_override: "",
    available: true
  });
  async function addVariant() {
    if (!initial || !newVariant.option_type || !newVariant.option_value) return;
    setBusy(true);
    try {
      const payload = {
        ...newVariant,
        price_override: newVariant.price_override === "" ? null : Number(newVariant.price_override)
      };
      const {
        data
      } = await api.post(`/items/${initial.id}/variants`, payload);
      setVariants([...variants, data]);
      setNewVariant({
        option_type: "",
        option_value: "",
        price_override: "",
        available: true
      });
    } catch (err) {
      setError(err?.response?.data?.detail || t("option_add_fail"));
    } finally {
      setBusy(false);
    }
  }
  async function deleteVariant(vid) {
    if (!initial) return;
    await api.delete(`/items/${initial.id}/variants/${vid}`);
    setVariants(variants.filter(v => v.id !== vid));
  }
  const inputCls = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500";
  return <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4" dir={t('dir', 'ltr')}>
      <h2 className="text-lg font-semibold">
        {initial ? t("edit_item") : t("add_new_item")}
      </h2>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>}

      {/* ─── Basic Info ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("name_required")}
          </label>
          <input value={form.name} onChange={e => update("name", e.target.value)} required dir="auto" className={inputCls} />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("description_extra")}
          </label>
          <textarea value={form.description} onChange={e => update("description", e.target.value)} rows={3} dir="auto" className={inputCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("category")}
          </label>
          <input value={form.category} onChange={e => update("category", e.target.value)} dir="auto" className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("price")}
            </label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={e => update("price", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("currency")}
            </label>
            <input value={form.currency} onChange={e => update("currency", e.target.value)} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.available} onChange={e => update("available", e.target.checked)} />{t("txt_206")}</label>
      </div>

      {/* ─── Stock ─── */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">{t("stock")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("quantity_blank")}
            </label>
            <input type="number" min="0" value={form.stock_quantity} onChange={e => update("stock_quantity", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("stock_status")}
            </label>
            <select value={form.stock_status} onChange={e => update("stock_status", e.target.value)} className={inputCls}>
              <option value="in_stock">{t("in_stock")}</option>
              <option value="out_of_stock">{t("out_of_stock")}</option>
              <option value="preorder">{t("preorder")}</option>
              <option value="coming_soon">{t("coming_soon")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── Warranty ─── */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">{t("warranty_section")}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("warranty_duration")}
            </label>
            <input value={form.warranty_duration} onChange={e => update("warranty_duration", e.target.value)} placeholder={t("warranty_duration_ph")} dir="auto" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("warranty_terms")}
            </label>
            <input value={form.warranty_terms} onChange={e => update("warranty_terms", e.target.value)} placeholder={t("warranty_terms_ph")} dir="auto" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("warranty_coverage")}
            </label>
            <textarea value={form.warranty_coverage} onChange={e => update("warranty_coverage", e.target.value)} placeholder={t("warranty_coverage_ph")} rows={2} dir="auto" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("warranty_exclusions")}
            </label>
            <textarea value={form.warranty_exclusions} onChange={e => update("warranty_exclusions", e.target.value)} placeholder={t("warranty_exclusions_ph")} rows={2} dir="auto" className={inputCls} />
          </div>
        </div>
      </div>

      {/* ─── Variants ─── */}
      {initial && <div className="border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">
            {t("options_section")}
          </h3>
          {variants.length > 0 && <div className="space-y-2 mb-3">
              {variants.map(v => <div key={v.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium text-gray-600">
                    {v.option_type}:
                  </span>
                  <span dir="auto">{v.option_value}</span>
                  {v.price_override != null && <span className="text-brand-600">
                      ({v.price_override} {form.currency})
                    </span>}
                  <span className={v.available ? "text-green-600" : "text-red-500"}>
                    {v.available ? "✓" : "✗"}
                  </span>
                  <button type="button" onClick={() => deleteVariant(v.id)} className="text-red-400 hover:text-red-600 mr-auto">
                    ×
                  </button>
                </div>)}
            </div>}
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("type")}
              </label>
              <select value={newVariant.option_type} onChange={e => setNewVariant({
            ...newVariant,
            option_type: e.target.value
          })} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">{t("select")}</option>
                <option value="color">{t("color")}</option>
                <option value="size">{t("size")}</option>
                <option value="flavor">{t("flavor")}</option>
                <option value="model">{t("model")}</option>
                <option value="material">{t("material")}</option>
                <option value="edition">{t("edition")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("value")}
              </label>
              <input value={newVariant.option_value} onChange={e => setNewVariant({
            ...newVariant,
            option_value: e.target.value
          })} placeholder={t("value_ph")} dir="auto" className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm w-32" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                {t("diff_price")}
              </label>
              <input type="number" step="0.01" min="0" value={newVariant.price_override} onChange={e => setNewVariant({
            ...newVariant,
            price_override: e.target.value
          })} placeholder={t("optional")} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm w-24" />
            </div>
            <button type="button" onClick={addVariant} disabled={!newVariant.option_type || !newVariant.option_value} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-3 py-1.5 text-sm disabled:opacity-40">
              {t("add_btn")}
            </button>
          </div>
          {!initial && <p className="text-xs text-gray-400 mt-2">
              {t("save_item_first")}
            </p>}
        </div>}

      {/* ─── Extra info (metadata key/value) ─── */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">
            {t("extra_details")}
          </label>
          <button type="button" onClick={() => setMeta([...meta, {
          k: "",
          v: ""
        }])} className="text-xs text-brand-600">
            {t("add_field")}
          </button>
        </div>
        <div className="space-y-2">
          {meta.map((row, i) => <div key={i} className="flex gap-2">
              <input placeholder={t("title_ph")} value={row.k} dir="auto" onChange={e => {
            const c = [...meta];
            c[i] = {
              ...c[i],
              k: e.target.value
            };
            setMeta(c);
          }} className={inputCls + " flex-1"} />
              <input placeholder={t("value_placeholder")} value={row.v} dir="auto" onChange={e => {
            const c = [...meta];
            c[i] = {
              ...c[i],
              v: e.target.value
            };
            setMeta(c);
          }} className={inputCls + " flex-1"} />
              <button type="button" onClick={() => setMeta(meta.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600 px-2">
                ×
              </button>
            </div>)}
        </div>
      </div>

      {/* ─── Image upload (existing items only) ─── */}
      {initial && onImageUpload && <div className="border-t pt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("product_image")}
          </label>
          <div className="flex items-center gap-3">
            {initial.image_url && <img src={imgSrc(initial.image_url)} alt="" className="h-16 w-16 rounded-lg object-cover border" />}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pickImage} className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700" />
          </div>
        </div>}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={busy} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-60">
          {busy ? t("saving") : t("save")}
        </button>
        <button type="button" onClick={onCancel} className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50">
          {t("cancel")}
        </button>
      </div>
      {!initial && <p className="text-xs text-gray-400">
          {t("save_item_first_image")}
        </p>}
    </form>;
}