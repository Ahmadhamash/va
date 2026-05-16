import { useEffect, useRef, useState } from "react";
import api from "../services/api";

export default function TrainingPage() {
  const [samples, setSamples] = useState([]);
  const [myName, setMyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  async function loadSamples() {
    const { data } = await api.get("/style/samples");
    setSamples(data);
  }

  useEffect(() => {
    loadSamples();
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    setErr("");
    setMsg("");
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Choose a .txt, .json or .csv export first");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    if (myName.trim()) fd.append("my_name", myName.trim());
    setBusy(true);
    try {
      const { data } = await api.post("/style/upload", fd);
      setMsg(`Added ${data.added} style samples (total ${data.total}).`);
      fileRef.current.value = "";
      await loadSamples();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSample(id) {
    await api.delete(`/style/samples/${id}`);
    await loadSamples();
  }

  async function clearAll() {
    if (!window.confirm("Remove ALL learned style samples?")) return;
    await api.delete("/style/samples");
    await loadSamples();
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">AI Voice — talk like you</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your past conversations (WhatsApp/Messenger export as{" "}
          <code>.txt</code>/<code>.json</code>, or a <code>.csv</code> with
          sender/text columns). The AI copies your tone and phrasing only — it
          still answers facts strictly from your catalog.
        </p>
      </div>

      <form onSubmit={handleUpload} className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your name as it appears in the chat (optional but recommended)
          </label>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="e.g. Ahmad"
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Used to pick out your replies so the AI learns your side of the
            conversation.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Conversation file
          </label>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.json,.csv"
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-brand-50 file:text-brand-700"
          />
        </div>

        {err && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2">
            {err}
          </div>
        )}
        {msg && (
          <div className="bg-green-50 text-green-700 text-sm rounded-md px-3 py-2">
            {msg}
          </div>
        )}

        <button
          disabled={busy}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60"
        >
          {busy ? "Processing…" : "Upload & learn"}
        </button>
      </form>

      <section className="bg-white rounded-xl shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">
            Learned style samples ({samples.length})
          </h2>
          {samples.length > 0 && (
            <button
              onClick={clearAll}
              className="text-sm text-red-600 border border-red-300 rounded-md px-3 py-1.5 hover:bg-red-50"
            >
              Clear all
            </button>
          )}
        </div>
        {samples.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nothing learned yet. Upload a conversation above.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[420px] overflow-y-auto">
            {samples.map((s) => (
              <li
                key={s.id}
                className="border border-gray-200 rounded-lg p-3 text-sm flex justify-between gap-3"
              >
                <pre className="whitespace-pre-wrap break-words font-sans text-gray-700">
                  {s.sample}
                </pre>
                <button
                  onClick={() => deleteSample(s.id)}
                  className="text-gray-400 hover:text-red-600 shrink-0"
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
