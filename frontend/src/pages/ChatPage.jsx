import { useEffect, useRef, useState } from "react";
import ChatInput from "../components/ChatInput.jsx";
import ChatMessage from "../components/ChatMessage.jsx";
import api from "../services/api";

export default function ChatPage() {
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  async function loadSessions() {
    const { data } = await api.get("/chat/sessions");
    setSessions(data);
    return data;
  }

  async function loadMessages(sessionId) {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    const { data } = await api.get(`/chat/sessions/${sessionId}/messages`);
    setMessages(data);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    loadMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function newChat() {
    setActiveId(null);
    setMessages([]);
  }

  async function deleteSession(id, e) {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    await api.delete(`/chat/sessions/${id}`);
    if (activeId === id) newChat();
    await loadSessions();
  }

  async function handleSend({ message, file, mediaType }) {
    setSending(true);

    // Optimistic echo of the user's message
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: message || (mediaType === "audio" ? "" : ""),
        media_type: mediaType,
        media_url: null,
      },
    ]);

    const fd = new FormData();
    if (message) fd.append("message", message);
    if (activeId) fd.append("session_id", activeId);
    if (file) fd.append("file", file);

    try {
      const { data } = await api.post("/chat/send", fd);
      let sid = data.session_id;
      if (!activeId) {
        await loadSessions();
        setActiveId(sid);
      }
      await loadMessages(sid);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            err?.response?.data?.detail ||
            "Something went wrong. Please try again.",
          media_type: "text",
          media_url: null,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 h-[calc(100vh-7rem)]">
        {/* Sessions sidebar */}
        <aside className="bg-white rounded-xl shadow p-3 flex flex-col">
          <button
            onClick={newChat}
            className="bg-brand-600 hover:bg-brand-700 text-white rounded-md py-2 text-sm font-medium mb-3"
          >
            + New chat
          </button>
          <div className="overflow-y-auto space-y-1">
            {sessions.length === 0 && (
              <p className="text-xs text-gray-400 px-2">No conversations yet</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-md text-sm cursor-pointer ${
                  activeId === s.id
                    ? "bg-brand-50 text-brand-700"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <span className="truncate">{s.title || "Conversation"}</span>
                <button
                  onClick={(e) => deleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        {/* Conversation */}
        <main className="bg-gray-50 rounded-xl shadow flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !sending && (
              <div className="h-full flex items-center justify-center text-center text-gray-400 text-sm">
                Ask the assistant about your products. It only answers from your
                catalog.
              </div>
            )}
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-white shadow rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-gray-400">
                  Assistant is thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <ChatInput onSend={handleSend} disabled={sending} />
        </main>
      </div>
    </div>
  );
}
