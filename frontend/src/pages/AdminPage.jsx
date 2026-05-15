import { useEffect, useState } from "react";
import ChatMessage from "../components/ChatMessage.jsx";
import api from "../services/api";

export default function AdminPage() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("persona");
  const [persona, setPersona] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);

  async function loadClients() {
    const { data } = await api.get("/admin/clients");
    setClients(data);
  }

  useEffect(() => {
    loadClients();
  }, []);

  async function selectClient(c) {
    setSelected(c);
    setTab("persona");
    setPersona(c.ai_persona || "");
    setBusinessName(c.business_name || "");
    setMsg("");
    setItems([]);
    setSessions([]);
    setActiveSession(null);
    setMessages([]);
  }

  async function savePersona(e) {
    e.preventDefault();
    setMsg("");
    await api.put(`/admin/clients/${selected.id}/persona`, {
      ai_persona: persona,
      business_name: businessName || null,
    });
    setMsg("Saved");
    await loadClients();
    setTimeout(() => setMsg(""), 2000);
  }

  async function toggleActive() {
    const { data } = await api.patch(`/admin/clients/${selected.id}/active`, {
      is_active: !selected.is_active,
    });
    setSelected({ ...selected, is_active: data.is_active });
    await loadClients();
  }

  async function openCatalog() {
    setTab("catalog");
    const { data } = await api.get(`/admin/clients/${selected.id}/items`);
    setItems(data);
  }

  async function openConversations() {
    setTab("chats");
    setActiveSession(null);
    setMessages([]);
    const { data } = await api.get(`/admin/clients/${selected.id}/sessions`);
    setSessions(data);
  }

  async function openSession(s) {
    setActiveSession(s);
    const { data } = await api.get(
      `/admin/clients/${selected.id}/sessions/${s.id}/messages`
    );
    setMessages(data);
  }

  const tabBtn = (key, label) => (
    <button
      onClick={() => {
        if (key === "persona") setTab("persona");
        else if (key === "catalog") openCatalog();
        else openConversations();
      }}
      className={`px-3 py-1.5 rounded-md text-sm ${
        tab === key
          ? "bg-brand-600 text-white"
          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        {/* Clients list */}
        <aside className="bg-white rounded-xl shadow p-3">
          <h2 className="font-semibold px-2 py-1">Clients ({clients.length})</h2>
          <div className="space-y-1 mt-2">
            {clients.length === 0 && (
              <p className="text-xs text-gray-400 px-2">
                No client accounts yet. They appear here after they register.
              </p>
            )}
            {clients.map((c) => (
              <div
                key={c.id}
                onClick={() => selectClient(c)}
                className={`px-3 py-2 rounded-md cursor-pointer text-sm ${
                  selected?.id === c.id
                    ? "bg-brand-50 text-brand-700"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="font-medium flex items-center gap-2">
                  {c.business_name || c.username}
                  {!c.is_active && (
                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">
                      disabled
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {c.email} · {c.item_count} items · {c.session_count} chats ·{" "}
                  {c.style_sample_count} voice
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Detail */}
        <main className="bg-white rounded-xl shadow p-6 min-h-[400px]">
          {!selected ? (
            <p className="text-gray-400 text-sm">
              Select a client to manage their AI persona and review their data.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-lg font-bold">
                    {selected.business_name || selected.username}
                  </h1>
                  <p className="text-sm text-gray-500">{selected.email}</p>
                </div>
                <button
                  onClick={toggleActive}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50"
                >
                  {selected.is_active ? "Disable account" : "Enable account"}
                </button>
              </div>

              <div className="flex gap-2">
                {tabBtn("persona", "AI Persona")}
                {tabBtn("catalog", "Catalog")}
                {tabBtn("chats", "Conversations")}
              </div>

              {tab === "persona" && (
                <form onSubmit={savePersona} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business name
                    </label>
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      AI persona
                    </label>
                    <textarea
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      rows={5}
                      placeholder="How should the assistant talk for this business?"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium">
                      Save persona
                    </button>
                    {msg && (
                      <span className="text-sm text-green-600">{msg}</span>
                    )}
                  </div>
                </form>
              )}

              {tab === "catalog" && (
                <div>
                  {items.length === 0 ? (
                    <p className="text-sm text-gray-400">No items.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((it) => (
                        <div
                          key={it.id}
                          className="border border-gray-200 rounded-lg p-3 text-sm"
                        >
                          <div className="flex justify-between">
                            <span className="font-medium">{it.name}</span>
                            <span
                              className={
                                it.available
                                  ? "text-green-600"
                                  : "text-gray-400"
                              }
                            >
                              {it.available ? "available" : "unavailable"}
                            </span>
                          </div>
                          <div className="text-gray-500">
                            {it.category || "—"} ·{" "}
                            {it.price != null
                              ? `${it.price} ${it.currency}`
                              : "no price"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "chats" && (
                <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-3">
                  <div className="space-y-1">
                    {sessions.length === 0 && (
                      <p className="text-sm text-gray-400">No conversations.</p>
                    )}
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => openSession(s)}
                        className={`px-3 py-2 rounded-md cursor-pointer text-sm ${
                          activeSession?.id === s.id
                            ? "bg-brand-50 text-brand-700"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="truncate">{s.title || "Chat"}</div>
                        <div className="text-[11px] text-gray-400">
                          {s.channel}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-[420px] overflow-y-auto space-y-2">
                    {messages.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        Select a conversation.
                      </p>
                    ) : (
                      messages.map((m) => (
                        <ChatMessage key={m.id} message={m} />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
