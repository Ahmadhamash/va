import { useEffect, useState } from "react";
import api, { API_BASE } from "../services/api";

const PLATFORMS = [
  { id: "widget", label: "Web widget", creds: [] },
  {
    id: "webhook",
    label: "Generic webhook",
    creds: [{ k: "webhook_secret", label: "Shared secret (optional)" }],
  },
  {
    id: "messenger",
    label: "Facebook Messenger",
    creds: [
      { k: "page_access_token", label: "Page access token" },
      { k: "app_secret", label: "App secret" },
      { k: "verify_token", label: "Verify token (you choose)" },
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    creds: [
      { k: "page_access_token", label: "Page access token" },
      { k: "app_secret", label: "App secret" },
      { k: "verify_token", label: "Verify token (you choose)" },
    ],
  },
  {
    id: "whatsapp",
    label: "WhatsApp Cloud API",
    creds: [
      { k: "phone_number_id", label: "Phone Number ID" },
      { k: "access_token", label: "Permanent Access Token" },
      { k: "waba_id", label: "WhatsApp Business Account ID" },
      { k: "verify_token", label: "Webhook Verify Token (you choose)" },
    ],
  },
];

function fullUrl(path) {
  if (!path || typeof path !== "string" || !path.startsWith("/")) return path;
  return `${API_BASE}${path}`;
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState([]);
  const [platform, setPlatform] = useState("widget");
  const [creds, setCreds] = useState({});
  const [err, setErr] = useState("");

  async function load() {
    const { data } = await api.get("/channels");
    setChannels(data);
  }

  useEffect(() => {
    load();
  }, []);

  const def = PLATFORMS.find((p) => p.id === platform);

  async function create(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.post("/channels", { platform, credentials: creds });
      setCreds({});
      await load();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Could not create channel");
    }
  }

  async function toggle(id) {
    await api.patch(`/channels/${id}/toggle`);
    await load();
  }

  async function remove(id) {
    if (!window.confirm("Delete this channel?")) return;
    await api.delete(`/channels/${id}`);
    await load();
  }

  function copy(text) {
    navigator.clipboard?.writeText(text);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Channels</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect Messenger, Instagram, a generic webhook, or embed a web chat
          widget. The same AI brain (your catalog + your voice) answers
          everywhere.
        </p>
      </div>

      <form onSubmit={create} className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="font-semibold">Add a channel</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Platform
          </label>
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setCreds({});
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {PLATFORMS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {def.creds.map((c) => (
          <div key={c.k}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {c.label}
            </label>
            <input
              value={creds[c.k] || ""}
              onChange={(e) =>
                setCreds({ ...creds, [c.k]: e.target.value })
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}

        {err && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2">
            {err}
          </div>
        )}

        <button className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium">
          Create channel
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Connected channels ({channels.length})</h2>
        {channels.length === 0 && (
          <p className="text-sm text-gray-400">No channels yet.</p>
        )}
        {channels.map((ch) => (
          <div key={ch.id} className="bg-white rounded-xl shadow p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold capitalize">{ch.platform}</span>
                <span
                  className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    ch.is_active
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {ch.is_active ? "active" : "disabled"}
                </span>
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => toggle(ch.id)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 hover:bg-gray-50"
                >
                  {ch.is_active ? "Disable" : "Enable"}
                </button>
                <button
                  onClick={() => remove(ch.id)}
                  className="border border-red-300 text-red-600 rounded-md px-3 py-1.5 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>

            {ch.configured_keys.length > 0 && (
              <p className="text-xs text-gray-400">
                Configured: {ch.configured_keys.join(", ")}
              </p>
            )}

            <div className="space-y-2">
              {Object.entries(ch.endpoints || {}).map(([k, v]) =>
                k === "note" ? (
                  <p key={k} className="text-xs text-gray-500">
                    {v}
                  </p>
                ) : (
                  <div
                    key={k}
                    className="flex items-center gap-2 bg-gray-50 rounded-md px-3 py-2 text-xs"
                  >
                    <span className="text-gray-500 w-28 shrink-0">{k}</span>
                    <code className="flex-1 break-all">{fullUrl(v)}</code>
                    <button
                      onClick={() => copy(fullUrl(v))}
                      className="text-brand-600 shrink-0"
                    >
                      copy
                    </button>
                  </div>
                )
              )}
            </div>

            {ch.platform === "widget" && (
              <div className="bg-gray-900 text-gray-100 rounded-md p-3 text-xs overflow-x-auto">
                <code>
                  {`<script src="${fullUrl(
                    ch.endpoints?.script_url
                  )}" async></script>`}
                </code>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
