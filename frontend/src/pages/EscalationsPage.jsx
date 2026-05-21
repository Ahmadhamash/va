import { useEffect, useState, useRef } from "react";
import api from "../services/api";

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [showMessages, setShowMessages] = useState(null);
  
  // Reply states
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);

  async function load() {
    setLoading(true);
    try {
      const params = filter ? { status_filter: filter } : {};
      const { data } = await api.get("/escalations", { params });
      setEscalations(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [filter]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedMessages, showMessages]);

  async function handleAction(esc, status) {
    const notes =
      status === "handled"
        ? window.prompt("ملاحظات المعالجة (اختياري):")
        : null;
    if (status === "handled" && notes === null && !window.confirm("تأكيد المعالجة بدون ملاحظات؟")) {
      return;
    }
    
    await api.patch(`/escalations/${esc.id}`, {
      status,
      handler_notes: notes || null,
    });
    await load();
  }

  async function viewConversation(esc) {
    if (showMessages === esc.id) {
      setShowMessages(null);
      setSelectedMessages([]);
      setReplyText("");
      return;
    }
    try {
      const { data } = await api.get(
        `/chat/sessions/${esc.session_id}/messages`
      );
      setSelectedMessages(data);
      setShowMessages(esc.id);
      setReplyText("");
    } catch {
      setSelectedMessages([]);
      setShowMessages(esc.id);
    }
  }

  async function sendReply(esc) {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await api.post(`/escalations/${esc.id}/reply`, {
        message: replyText.trim(),
      });
      setReplyText("");
      // Refresh messages
      const { data } = await api.get(
        `/chat/sessions/${esc.session_id}/messages`
      );
      setSelectedMessages(data);
    } catch (err) {
      alert("حدث خطأ أثناء إرسال الرد.");
    } finally {
      setSendingReply(false);
    }
  }

  async function releaseToAi(esc) {
    if (!window.confirm("هل أنت متأكد من إرجاع المحادثة للمساعد الذكي؟ سيتم إغلاق التحويل.")) return;
    
    try {
      await api.post(`/escalations/${esc.id}/release`);
      alert("تم إرجاع المحادثة للمساعد الذكي بنجاح.");
      setShowMessages(null);
      await load();
    } catch (err) {
      alert("حدث خطأ أثناء إرجاع المحادثة.");
    }
  }

  const statusLabel = {
    pending: "قيد الانتظار",
    handled: "تمت المعالجة",
    dismissed: "تم التجاهل",
  };
  const statusColor = {
    pending: "bg-amber-100 text-amber-700",
    handled: "bg-green-100 text-green-700",
    dismissed: "bg-gray-100 text-gray-500",
  };

  const reasonLabel = {
    angry_customer: "زبون غاضب",
    return_request: "طلب إرجاع",
    cancel_request: "طلب إلغاء",
    payment_issue: "مشكلة دفع",
    repeated_question: "سؤال متكرر",
    low_confidence: "ثقة منخفضة",
    complaint: "شكوى",
    complex_query: "سؤال معقد",
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">التحويلات البشرية</h1>
        <div className="flex gap-2">
          {["", "pending", "handled", "dismissed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                filter === f
                  ? "bg-brand-600 text-white"
                  : "border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f === ""
                ? "الكل"
                : f === "pending"
                ? "قيد الانتظار"
                : f === "handled"
                ? "تمت المعالجة"
                : "تم التجاهل"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">
        عندما يواجه المساعد الذكي موقفاً لا يستطيع التعامل معه (زبون غاضب،
        طلب إرجاع، مشكلة دفع، إلخ) يقوم بتحويل المحادثة إليك هنا. راجع كل
        حالة وتابع مع الزبون.
      </div>

      {loading ? (
        <p className="text-gray-500">جاري التحميل…</p>
      ) : escalations.length === 0 ? (
        <p className="text-gray-500 text-center py-10">
          {filter
            ? "لا توجد تحويلات بهذه الحالة"
            : "لا توجد تحويلات حتى الآن 🎉"}
        </p>
      ) : (
        <div className="space-y-3">
          {escalations.map((esc) => (
            <div
              key={esc.id}
              className="bg-white rounded-xl shadow-sm p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        statusColor[esc.status] || ""
                      }`}
                    >
                      {statusLabel[esc.status] || esc.status}
                    </span>
                    <span className="text-sm font-medium text-gray-800">
                      {reasonLabel[esc.reason] || esc.reason}
                    </span>
                  </div>
                  {esc.details && (
                    <p className="text-sm text-gray-500" dir="auto">
                      {esc.details}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(esc.created_at).toLocaleString("ar-JO")}
                  </p>
                  {esc.handler_notes && (
                    <p className="text-xs text-green-600" dir="auto">
                      📝 {esc.handler_notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => viewConversation(esc)}
                    className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                  >
                    {showMessages === esc.id ? "إخفاء المحادثة" : "عرض المحادثة"}
                  </button>
                  {esc.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleAction(esc, "handled")}
                        className="text-xs bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700"
                      >
                        تمت المعالجة
                      </button>
                      <button
                        onClick={() => handleAction(esc, "dismissed")}
                        className="text-xs border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50"
                      >
                        تجاهل
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showMessages === esc.id && (
                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex flex-col">
                  {/* Messages Area */}
                  <div className="p-3 max-h-[300px] overflow-y-auto space-y-2 flex-grow">
                    {selectedMessages.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        لا توجد رسائل
                      </p>
                    ) : (
                      selectedMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-lg px-3 py-2 text-sm max-w-[80%] ${
                            m.role === "user"
                              ? "bg-brand-100 text-brand-800 mr-auto"
                              : "bg-white border border-gray-200 shadow-sm ml-auto"
                          }`}
                          dir="auto"
                        >
                          <div className="text-[10px] text-gray-400 mb-0.5">
                            {m.role === "user" ? "الزبون" : "المساعد الذكي / الموظف"}
                          </div>
                          {m.content}
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  {/* Reply Area (pending or dismissed — allow releasing back to AI) */}
                  {(esc.status === "pending" || esc.status === "dismissed") && (
                    <div className="bg-white border-t border-gray-200 p-3 space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") sendReply(esc);
                          }}
                          placeholder="اكتب ردك للزبون هنا (سيصل عبر المسنجر)..."
                          className="flex-grow text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none"
                          disabled={sendingReply}
                        />
                        <button
                          onClick={() => sendReply(esc)}
                          disabled={sendingReply || !replyText.trim()}
                          className="bg-brand-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                        >
                          {sendingReply ? "جاري الإرسال..." : "إرسال الرد"}
                        </button>
                      </div>
                      
                      <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                        <span className="text-xs text-gray-500">
                          الرد البشري يوقف المساعد الذكي مؤقتاً لتجنب التداخل.
                        </span>
                        <button
                          onClick={() => releaseToAi(esc)}
                          className="text-xs text-brand-600 border border-brand-200 bg-brand-50 rounded-lg px-3 py-1.5 hover:bg-brand-100"
                        >
                          إرجاع المحادثة للمساعد الذكي 🤖
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
