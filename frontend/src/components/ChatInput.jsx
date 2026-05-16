import { useRef, useState } from "react";

export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [recording, setRecording] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);

  function pickImage(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImage(f);
    setImagePreview(URL.createObjectURL(f));
  }

  function clearImage() {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function submit(e) {
    e.preventDefault();
    if (disabled) return;
    if (!text.trim() && !image) return;
    onSend({ message: text.trim(), file: image, mediaType: image ? "image" : "text" });
    setText("");
    clearImage();
  }

  async function startRecording() {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (blob.size > 0) {
          const file = new File([blob], `voice_${Date.now()}.webm`, {
            type: "audio/webm",
          });
          onSend({ message: "", file, mediaType: "audio" });
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="border-t border-gray-200 bg-white p-3 space-y-2"
    >
      {imagePreview && (
        <div className="relative inline-block">
          <img
            src={imagePreview}
            alt="preview"
            className="h-20 rounded-md border border-gray-200"
          />
          <button
            type="button"
            onClick={clearImage}
            className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-5 h-5 text-xs"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={pickImage}
          className="hidden"
          id="chat-image-input"
        />
        <label
          htmlFor="chat-image-input"
          title="Attach image"
          className="cursor-pointer px-3 py-2 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
        >
          🖼
        </label>

        <button
          type="button"
          title="Hold to record voice"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`px-3 py-2 rounded-md border ${
            recording
              ? "bg-red-600 text-white border-red-600 animate-pulse"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {recording ? "● Recording…" : "🎤"}
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "Assistant is thinking…" : "Type a message…"}
          disabled={disabled}
          dir="auto"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100"
        />

        <button
          type="submit"
          disabled={disabled}
          className="bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-60"
        >
          Send
        </button>
      </div>
      <p className="text-xs text-gray-400">
        Hold the mic button to record; release to send.
      </p>
    </form>
  );
}
