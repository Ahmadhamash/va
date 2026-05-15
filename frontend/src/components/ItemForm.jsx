import { useEffect, useState } from "react";

const EMPTY = {
  name: "",
  description: "",
  category: "",
  price: "",
  currency: "USD",
  available: true,
  image_url: "",
};

export default function ItemForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || "",
        description: initial.description || "",
        category: initial.category || "",
        price: initial.price ?? "",
        currency: initial.currency || "USD",
        available: initial.available ?? true,
        image_url: initial.image_url || "",
      });
    } else {
      setForm(EMPTY);
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
      const payload = {
        ...form,
        price: form.price === "" ? null : Number(form.price),
      };
      await onSubmit(payload);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save item");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl shadow p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold">
        {initial ? "Edit item" : "Add new item"}
      </h2>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2">
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <input
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <input
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Image URL
          </label>
          <input
            value={form.image_url}
            onChange={(e) => update("image_url", e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
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

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-gray-300 text-gray-700 rounded-md px-4 py-2 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
