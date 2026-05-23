import { API_BASE } from "../services/api";

function mediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/api/uploads/")) return url;
  if (url.startsWith("/uploads/")) return `${API_BASE}${url}`;
  return `${API_BASE}/uploads/${url}`;
}

function isTemporaryMetaUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url, window.location.origin).hostname;
    return (
      host === "cdn.fbsbx.com" ||
      host.endsWith(".fbsbx.com") ||
      host.endsWith(".fbcdn.net")
    );
  } catch {
    return false;
  }
}

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const mediaSrc = mediaUrl(message.media_url);
  const temporaryMetaMedia = isTemporaryMetaUrl(mediaSrc);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-brand-600 text-white rounded-br-sm"
            : "bg-white text-gray-800 shadow rounded-bl-sm"
        }`}
      >
        {message.media_type === "image" && mediaSrc && !temporaryMetaMedia && (
          <img
            src={mediaSrc}
            alt="upload"
            className="rounded-lg mb-2 max-h-60 object-cover"
          />
        )}
        {message.media_type === "image" && temporaryMetaMedia && (
          <div className="rounded-lg mb-2 border border-dashed border-gray-300 px-3 py-2 text-xs opacity-70">
            Meta media expired
          </div>
        )}
        {message.content && (
          <p
            dir="auto"
            className="whitespace-pre-wrap break-words leading-relaxed"
            style={{ unicodeBidi: "plaintext" }}
          >
            {message.content}
          </p>
        )}
        {message.media_type === "audio" && mediaSrc && !temporaryMetaMedia && (
          <audio controls src={mediaSrc} className="mt-2 max-w-full h-10" />
        )}
        {message.media_type === "audio" && temporaryMetaMedia && (
          <p className="italic opacity-70">Meta voice message expired</p>
        )}
        {!message.content && message.media_type === "audio" && (
          <p className="italic opacity-70">Voice message</p>
        )}
      </div>
    </div>
  );
}
