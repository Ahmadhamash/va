import { API_BASE } from "../services/api";

export default function ChatMessage({ message }) {
  const isUser = message.role === "user";
  const mediaSrc =
    message.media_url && `${API_BASE}/uploads/${message.media_url}`;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-brand-600 text-white rounded-br-sm"
            : "bg-white text-gray-800 shadow rounded-bl-sm"
        }`}
      >
        {message.media_type === "image" && mediaSrc && (
          <img
            src={mediaSrc}
            alt="upload"
            className="rounded-lg mb-2 max-h-60 object-cover"
          />
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
        {message.media_type === "audio" && mediaSrc && (
          <audio controls src={mediaSrc} className="mt-2 max-w-full h-10" />
        )}
        {!message.content && message.media_type === "audio" && (
          <p className="italic opacity-70">Voice message</p>
        )}
      </div>
    </div>
  );
}
