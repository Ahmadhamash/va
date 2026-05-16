import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../services/api";

const EMPTY = {
  name: "",
  description: "",
  category: "",
  price: "",
  currency: "USD",
  available: true,
};

function imgSrc(url) {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

export default function ItemForm({ initial, onSubmit, onCancel, onImageUpload }) {
  const [form, setForm] = useState(EMPTY);
  const [meta, setMeta] = useState([]); // [{k,v}]
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
      });
      const m = initial.metadata || {};
      setMeta(Object.keys(m).map((k) => ({ k, v: String(m[k]) })));
    } else {
      setForm(EMPTY);
      setMeta([]);
    }
  }, [initial]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const metadata = {};
      meta.forEach(({ k, v }) => {
        if (k.trim()) metadata[k.trim()] = v;
      });
      await onSubmit({
        ...form,
        price: form.price === "" ? null : Number(form.price),
        metadata,
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save item");
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
      setError(err?.response?.data?.detail || "Image upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold">
        {initial ? "Edit item" : "Add new item"}
      </h2>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
            dir="auto"
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description / extra info
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            dir="auto"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <input
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            dir="auto"
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <input
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.available}
            onChange={(e) => update("available", e.target.checked)}
          />
          Available
        </label>
      </div>

      {/* Extra info (metadata key/value) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">
            Extra details
          </label>
          <button
            type="button"
            onClick={() => setMeta([...meta, { k: "", v: "" }])}
            className="text-xs text-brand-600"
          >
            + add field
          </button>
        </div>
        <div className="space-y-2">
          {meta.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="label (e.g. اللون)"
                value={row.k}
                dir="auto"
                onChange={(e) => {
                  const c = [...meta];
                  c[i] = { ...c[i], k: e.target.value };
                  setMeta(c);
                }}
                className={inputCls + " flex-1"}
              />
              <input
                placeholder="value"
                value={row.v}
                dir="auto"
                onChange={(e) => {
                  const c = [...meta];
                  c[i] = { ...c[i], v: e.target.value };
                  setMeta(c);
                }}
                className={inputCls + " flex-1"}
              />
              <button
                type="button"
                onClick={() => setMeta(meta.filter((_, j) => j !== i))}
                className="text-gray-400 hover:text-red-600 px-2"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Image upload (existing items only) */}
      {initial && onImageUpload && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Product image
          </label>
          <div className="flex items-center gap-3">
            {initial.image_url && (
              <img
                src={imgSrc(initial.image_url)}
                alt=""
                className="h-16 w-16 rounded-lg object-cover border"
              />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={pickImage}
              className="text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700"
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-300 text-gray-700 rounded-lg px-4 py-2 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
      {!initial && (
        <p className="text-xs text-gray-400">
          Save the item first, then edit it to upload a product image.
        </p>
      )}
    </form>
  );
}
