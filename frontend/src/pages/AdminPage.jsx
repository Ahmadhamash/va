import { useEffect, useState } from "react";
import ChatMessage from "../components/ChatMessage.jsx";
import DashboardCharts from "../components/DashboardCharts.jsx";
import api from "../services/api";

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="text-2xl font-bold text-brand-700">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AdminPage() {
  const [view, setView] = useState("clients"); // clients | settings
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("persona");
  const [persona, setPersona] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [msg, setMsg] = useState("");
  const [items, setItems] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newClient, setNewClient] = useState({
    username: "",
    email: "",
    password: "",
    business_name: "",
  });
  const [createErr, setCreateErr] = useState("");

  // Support Agents
  const [agents, setAgents] = useState([]);
  const [newAgent, setNewAgent] = useState({
    username: "",
    email: "",
    password: "",
    display_name: "",
    skills: "",
    max_concurrent_handoffs: 5,
  });
  const [createAgentErr, setCreateAgentErr] = useState("");

  // settings
  const [settings, setSettings] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [debounce, setDebounce] = useState(8);
  const [settingsMsg, setSettingsMsg] = useState("");

  async function loadStats() {
    const { data } = await api.get("/admin/stats");
    setStats(data);
  }
  async function loadClients(q = "") {
    const { data } = await api.get("/admin/clients", {
      params: q ? { q } : {},
    });
    setClients(data);
  }
  async function loadSettings() {
    const { data } = await api.get("/admin/settings");
    setSettings(data);
    setModel(data.ai_model);
    setDebounce(data.debounce_seconds);
    setApiKey("");
  }
  async function loadAgents() {
    try {
      const { data } = await api.get("/handoff/agents");
      setAgents(data);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    loadStats();
    loadClients();
    loadAgents();
  }, []);

  function selectClient(c) {
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
    setMsg("Saved ✓");
    await loadClients(search);
    setTimeout(() => setMsg(""), 2000);
  }

  async function toggleActive() {
    const { data } = await api.patch(`/admin/clients/${selected.id}/active`, {
      is_active: !selected.is_active,
    });
    setSelected({ ...selected, is_active: data.is_active });
    await loadClients(search);
    await loadStats();
  }

  async function resetPassword() {
    const pw = window.prompt("New password for this client (min 6 chars):");
    if (!pw) return;
    try {
      await api.post(`/admin/clients/${selected.id}/reset-password`, {
        new_password: pw,
      });
      setMsg("Password reset ✓");
      setTimeout(() => setMsg(""), 2500);
    } catch (e) {
      setMsg(e?.response?.data?.detail || "Reset failed");
    }
  }

  async function createClient(e) {
    e.preventDefault();
    setCreateErr("");
    try {
      await api.post("/admin/clients", newClient);
      setShowCreate(false);
      setNewClient({ username: "", email: "", password: "", business_name: "" });
      await loadClients(search);
      await loadStats();
    } catch (e2) {
      const d = e2?.response?.data?.detail;
      setCreateErr(typeof d === "string" ? d : "Could not create client");
    }
  }

  async function createAgent(e) {
    e.preventDefault();
    setCreateAgentErr("");
    try {
      const body = {
        ...newAgent,
        skills: newAgent.skills.split(",").map((s) => s.trim()).filter(Boolean),
        max_concurrent_handoffs: Number(newAgent.max_concurrent_handoffs),
      };
      await api.post("/handoff/agents", body);
      setShowCreate(false); // Can reuse or have separate state, but let's just use form reset
      setNewAgent({ username: "", email: "", password: "", display_name: "", skills: "", max_concurrent_handoffs: 5 });
      await loadAgents();
      await loadStats();
    } catch (e2) {
      setCreateAgentErr(e2?.response?.data?.detail || "Could not create agent");
    }
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

  async function saveSettings(e) {
    e.preventDefault();
    setSettingsMsg("");
    const body = { ai_model: model, debounce_seconds: Number(debounce) };
    if (apiKey.trim()) body.openai_api_key = apiKey.trim();
    const { data } = await api.put("/admin/settings", body);
    setSettings(data);
    setApiKey("");
    setSettingsMsg("Saved ✓");
    setTimeout(() => setSettingsMsg(""), 2500);
  }
  async function clearKey() {
    if (!window.confirm("Clear DB key and fall back to the .env key?")) return;
    const { data } = await api.put("/admin/settings", { openai_api_key: "" });
    setSettings(data);
    setSettingsMsg("Cleared ✓");
    setTimeout(() => setSettingsMsg(""), 2500);
  }

  const tabBtn = (key, label, fn) => (
    <button
      onClick={fn}
      className={`px-3 py-1.5 rounded-lg text-sm ${
        tab === key
          ? "bg-brand-600 text-white"
          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("clients")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            view === "clients" ? "bg-brand-600 text-white" : "bg-white shadow-sm"
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => {
            setView("settings");
            loadSettings();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            view === "settings" ? "bg-brand-600 text-white" : "bg-white shadow-sm"
          }`}
        >
          Platform Settings
        </button>
        <button
          onClick={() => {
            setView("agents");
            loadAgents();
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            view === "agents" ? "bg-brand-600 text-white" : "bg-white shadow-sm"
          }`}
        >
          Support Agents
        </button>
      </div>

      {stats && view === "clients" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <Stat label="Clients" value={stats.clients} />
            <Stat label="Active" value={stats.active_clients} />
            <Stat label="Items" value={stats.items} />
            <Stat label="Chats" value={stats.sessions} />
            <Stat label="Messages" value={stats.messages} />
            <Stat label="Voice samples" value={stats.style_samples} />
            <Stat label="Channels" value={stats.channels} />
          </div>
          <DashboardCharts stats={stats} />
        </>
      )}

      {view === "settings" && settings && (
        <form
          onSubmit={saveSettings}
          className="bg-white rounded-2xl shadow-sm p-6 space-y-4 max-w-xl"
        >
          <h2 className="text-lg font-semibold">Platform Settings</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API key
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Current:{" "}
              <code>{settings.openai_api_key_masked || "—"}</code> (source:{" "}
              <strong>{settings.key_source}</strong>)
            </p>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-…  (leave empty to keep current)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={clearKey}
              className="text-xs text-red-600 mt-1"
            >
              Clear DB key (use .env)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Debounce (seconds)
              </label>
              <input
                type="number"
                min="0"
                max="120"
                value={debounce}
                onChange={(e) => setDebounce(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 font-medium">
              Save settings
            </button>
            {settingsMsg && (
              <span className="text-sm text-green-600">{settingsMsg}</span>
            )}
          </div>
        </form>
      )}

      {view === "agents" && (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
          <aside className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold mb-4">Create Support Agent</h3>
            <form onSubmit={createAgent} className="space-y-3">
              {["username", "email", "password", "display_name", "skills"].map((f) => (
                <div key={f}>
                  <label className="block text-xs font-medium text-gray-700 mb-1 capitalize">
                    {f.replace("_", " ")}
                  </label>
                  <input
                    type={f === "password" ? "password" : "text"}
                    value={newAgent[f]}
                    onChange={(e) => setNewAgent({ ...newAgent, [f]: e.target.value })}
                    required={f !== "skills"}
                    placeholder={f === "skills" ? "e.g., technical, billing (comma separated)" : ""}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Max Concurrent Handoffs
                </label>
                <input
                  type="number"
                  min="1"
                  value={newAgent.max_concurrent_handoffs}
                  onChange={(e) => setNewAgent({ ...newAgent, max_concurrent_handoffs: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                />
              </div>
              {createAgentErr && <p className="text-xs text-red-600">{createAgentErr}</p>}
              <button className="w-full bg-brand-600 text-white rounded-md py-2 text-sm font-medium">
                Create Agent
              </button>
            </form>
          </aside>
          
          <main className="bg-white rounded-2xl shadow-sm p-6 min-h-[400px]">
            <h2 className="text-lg font-bold mb-4">Platform Support Agents</h2>
            <div className="space-y-3">
              {agents.length === 0 ? (
                <p className="text-gray-400 text-sm">No support agents found.</p>
              ) : (
                agents.map((a) => (
                  <div key={a.id} className="border rounded-lg p-4 flex justify-between items-center">
                    <div>
                      <div className="font-semibold">{a.display_name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Skills: {a.skills?.join(", ") || "none"}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full ${a.is_available ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {a.is_available ? "Available" : "Offline"}
                      </span>
                      <div className="text-xs text-gray-400 mt-1">
                        Max capacity: {a.max_concurrent_handoffs}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        </div>
      )}

      {view === "clients" && (
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
          <aside className="bg-white rounded-2xl shadow-sm p-3">
            <div className="flex gap-2 mb-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && loadClients(search)
                }
                placeholder="Search…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                onClick={() => loadClients(search)}
                className="px-3 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
              >
                Go
              </button>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 text-sm font-medium mb-3"
            >
              + New client
            </button>

            {showCreate && (
              <form
                onSubmit={createClient}
                className="border border-gray-200 rounded-lg p-3 mb-3 space-y-2"
              >
                {["username", "email", "password", "business_name"].map((f) => (
                  <input
                    key={f}
                    type={f === "password" ? "password" : "text"}
                    placeholder={f.replace("_", " ")}
                    value={newClient[f]}
                    onChange={(e) =>
                      setNewClient({ ...newClient, [f]: e.target.value })
                    }
                    required={f !== "business_name"}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                ))}
                {createErr && (
                  <p className="text-xs text-red-600">{createErr}</p>
                )}
                <button className="w-full bg-gray-900 text-white rounded-md py-1.5 text-sm">
                  Create
                </button>
              </form>
            )}

            <div className="space-y-1">
              {clients.length === 0 && (
                <p className="text-xs text-gray-400 px-2">No clients.</p>
              )}
              {clients.map((c) => (
                <div
                  key={c.id}
                  onClick={() => selectClient(c)}
                  className={`px-3 py-2 rounded-lg cursor-pointer text-sm ${
                    selected?.id === c.id
                      ? "bg-brand-50 text-brand-700"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="font-medium flex items-center gap-2" dir="auto">
                    {c.business_name || c.username}
                    {!c.is_active && (
                      <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded-full">
                        disabled
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.email} · {c.item_count} items · {c.session_count} chats
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main className="bg-white rounded-2xl shadow-sm p-6 min-h-[400px]">
            {!selected ? (
              <p className="text-gray-400 text-sm">
                Select a client to manage their AI persona and review data.
              </p>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-lg font-bold" dir="auto">
                      {selected.business_name || selected.username}
                    </h1>
                    <p className="text-sm text-gray-500">{selected.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={resetPassword}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={toggleActive}
                      className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                    >
                      {selected.is_active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  {tabBtn("persona", "AI Persona", () => setTab("persona"))}
                  {tabBtn("catalog", "Catalog", openCatalog)}
                  {tabBtn("chats", "Conversations", openConversations)}
                </div>

                {tab === "persona" && (
                  <form onSubmit={savePersona} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Business name
                      </label>
                      <input
                        value={businessName}
                        dir="auto"
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        AI persona
                      </label>
                      <textarea
                        value={persona}
                        dir="auto"
                        onChange={(e) => setPersona(e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg px-4 py-2 font-medium">
                        Save
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
                            dir="auto"
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
                        <p className="text-sm text-gray-400">
                          No conversations.
                        </p>
                      )}
                      {sessions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => openSession(s)}
                          className={`px-3 py-2 rounded-lg cursor-pointer text-sm ${
                            activeSession?.id === s.id
                              ? "bg-brand-50 text-brand-700"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <div className="truncate" dir="auto">
                            {s.title || "Chat"}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {s.channel}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-[460px] overflow-y-auto space-y-2">
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
      )}
    </div>
  );
}
