import { useEffect, useState } from "react";
import ItemCard from "../components/ItemCard.jsx";
import ItemForm from "../components/ItemForm.jsx";
import api from "../services/api";

export default function DashboardPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");

  async function loadItems() {
    setLoading(true);
    try {
      const { data } = await api.get("/items");
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!search.trim()) return loadItems();
    const { data } = await api.get("/items/search", {
      params: { q: search.trim() },
    });
    setItems(data);
  }

  async function handleCreate(payload) {
    await api.post("/items", payload);
    setShowForm(false);
    setEditing(null);
    await loadItems();
  }

  async function handleUpdate(payload) {
    await api.put(`/items/${editing.id}`, payload);
    setShowForm(false);
    setEditing(null);
    await loadItems();
  }

  async function handleDelete(item) {
    if (!window.confirm(`حذف "${item.name}"?`)) return;
    await api.delete(`/items/${item.id}`);
    await loadItems();
  }

  async function handleToggle(item) {
    await api.patch(`/items/${item.id}/toggle`);
    await loadItems();
  }

  async function handleImageUpload(file) {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post(`/items/${editing.id}/image`, fd);
    setEditing(data);
    await loadItems();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6" dir="rtl">
      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">
        شخصية المساعد الذكي يديرها مدير المنصة. استخدم{" "}
        <strong>صوت AI</strong> لتعليم المساعد أسلوب كلامك،
        و<strong>القنوات</strong> لربط Messenger / Instagram / ويدجت الموقع.
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold">الكاتالوج</h1>
          <div className="flex gap-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث…"
                dir="auto"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button className="border border-gray-300 rounded-md px-3 py-2 text-sm hover:bg-gray-50">
                بحث
              </button>
            </form>
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 text-sm font-medium"
            >
              + إضافة عنصر
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mb-6">
            <ItemForm
              initial={editing}
              onSubmit={editing ? handleUpdate : handleCreate}
              onImageUpload={editing ? handleImageUpload : null}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">جاري تحميل العناصر…</p>
        ) : items.length === 0 ? (
          <p className="text-gray-500">
            لا توجد عناصر بعد. أضف أول منتج أو خدمة.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={(it) => {
                  setEditing(it);
                  setShowForm(true);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
