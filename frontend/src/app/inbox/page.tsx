"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AuthRequired, LoadingPanel } from "@/components/auth-required";
import { ChatWindow } from "@/components/chat-window";
import { ConversationList } from "@/components/conversation-list";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api-client";
import {
  sessionToConversation,
  type BackendChatSession,
  type BackendMessage
} from "@/lib/backend-mappers";

type ChatSendResponse = {
  session_id: string;
  reply: string;
  transcription?: string | null;
};

export default function InboxPage() {
  const { user, loading } = useAuth();
  const [sessions, setSessions] = useState<BackendChatSession[]>([]);
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [newMessage, setNewMessage] = useState("Hello, what services do you offer?");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadSessions(preferredId?: string) {
    const rows = await apiRequest<BackendChatSession[]>("/chat/sessions");
    setSessions(rows);
    const nextId = preferredId || selectedId || rows[0]?.id || "";
    setSelectedId(nextId);
    return nextId;
  }

  async function loadMessages(sessionId: string) {
    if (!sessionId) {
      setMessages([]);
      return;
    }
    const rows = await apiRequest<BackendMessage[]>(`/chat/sessions/${sessionId}/messages`);
    setMessages(rows);
  }

  useEffect(() => {
    if (!user) return;
    setBusy(true);
    loadSessions()
      .catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load conversations."))
      .finally(() => setBusy(false));
  }, [user]);

  useEffect(() => {
    if (!selectedId || !user) return;
    loadMessages(selectedId).catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load messages."));
  }, [selectedId, user]);

  async function sendMessage(message: string, sessionId = selectedId) {
    const form = new FormData();
    form.set("message", message);
    if (sessionId) form.set("session_id", sessionId);

    const result = await apiRequest<ChatSendResponse>("/chat/send", {
      method: "POST",
      body: form
    });
    const nextId = await loadSessions(result.session_id);
    await loadMessages(nextId);
    return { reply: result.reply };
  }

  async function startConversation() {
    const body = newMessage.trim();
    if (!body) return;
    setBusy(true);
    try {
      await sendMessage(body, "");
      setNewMessage("");
      setNotice("Backend conversation created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create conversation.");
    } finally {
      setBusy(false);
    }
  }

  const conversations = useMemo(
    () => sessions.map((session) => sessionToConversation(session, session.id === selectedId ? messages : [])),
    [messages, selectedId, sessions]
  );
  const selectedSession = sessions.find((session) => session.id === selectedId) || sessions[0];
  const selected = selectedSession ? sessionToConversation(selectedSession, selectedSession.id === selectedId ? messages : []) : null;

  return (
    <AppShell title="Inbox" subtitle="Chat sessions and messages loaded from the FastAPI backend." actionLabel="Test backend chat">
      {loading ? (
        <LoadingPanel />
      ) : !user ? (
        <AuthRequired />
      ) : (
        <div className="space-y-5">
          {notice ? <div className="rounded-3xl border border-cyanx-400/20 bg-cyanx-500/10 px-5 py-4 text-sm font-semibold text-cyanx-400">{notice}</div> : null}
          {selected ? (
            <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
              <ConversationList conversations={conversations} selectedId={selected.id} onSelect={setSelectedId} />
              <ChatWindow
                conversation={selected}
                onSendMessage={sendMessage}
                onTakeover={() => setNotice("Human takeover is tracked locally in this UI; backend handoff records can be created from escalation rules.")}
                onReturnToAi={() => setNotice("AI handling restored for this UI session.")}
              />
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-6">
              <h2 className="text-xl font-semibold text-white">Create the first backend chat session</h2>
              <p className="mt-2 text-sm text-white/50">This sends a real multipart request to `/api/chat/send` and stores the conversation in the backend database.</p>
              <Textarea className="mt-5" value={newMessage} onChange={(event) => setNewMessage(event.target.value)} />
              <Button className="mt-4" onClick={startConversation} disabled={busy}>
                {busy ? "Sending..." : "Send test message"}
              </Button>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
