import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import api from "../services/api";
export default function WorkflowsPage() {
  const { t } = useTranslation();
  const PRESET_TRIGGERS = [t("txt_179"), t("txt_180"), t("txt_181"), t("txt_182"), t("txt_183"), t("txt_184")];
  const ACTION_TYPES = [{
    value: "send_link",
    label: t("txt_185")
  }, {
    value: "send_form",
    label: t("txt_186")
  }, {
    value: "send_text",
    label: t("txt_187")
  }];
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWf, setEditingWf] = useState(null);
  const [triggerEvent, setTriggerEvent] = useState(PRESET_TRIGGERS[0]);
  const [customTrigger, setCustomTrigger] = useState("");
  const [actionType, setActionType] = useState("send_link");
  const [content, setContent] = useState("");
  async function load() {
    setLoading(true);
    const {
      data
    } = await api.get("/workflows");
    setWorkflows(data);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);
  function openModal(wf = null) {
    if (wf) {
      setEditingWf(wf);
      if (PRESET_TRIGGERS.includes(wf.trigger_event)) {
        setTriggerEvent(wf.trigger_event);
        setCustomTrigger("");
      } else {
        setTriggerEvent(t("txt_184"));
        setCustomTrigger(wf.trigger_event);
      }
      setActionType(wf.action_type);
      setContent(wf.content);
    } else {
      setEditingWf(null);
      setTriggerEvent(PRESET_TRIGGERS[0]);
      setCustomTrigger("");
      setActionType("send_link");
      setContent("");
    }
    setShowModal(true);
  }
  async function save() {
    const finalTrigger = triggerEvent === t("txt_184") ? customTrigger.trim() : triggerEvent;
    if (!finalTrigger) return alert(t("txt_188"));
    if (!content.trim()) return alert(t("txt_189"));
    const payload = {
      trigger_event: finalTrigger,
      action_type: actionType,
      content: content.trim(),
      is_active: true
    };
    if (editingWf) {
      await api.put(`/workflows/${editingWf.id}`, payload);
    } else {
      await api.post("/workflows", payload);
    }
    setShowModal(false);
    load();
  }
  async function remove(id) {
    if (!window.confirm(t("txt_190"))) return;
    await api.delete(`/workflows/${id}`);
    load();
  }
  async function toggleActive(wf) {
    await api.put(`/workflows/${wf.id}`, {
      ...wf,
      is_active: !wf.is_active
    });
    load();
  }
  return <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t("txt_191")}</h1>
        <button onClick={() => openModal()} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium">{t("txt_192")}</button>
      </div>

      <div className="bg-brand-50 border border-brand-100 text-brand-700 text-sm rounded-lg px-4 py-3">{t("txt_193")}</div>

      {loading ? <p className="text-gray-500">{t("txt_26")}</p> : workflows.length === 0 ? <p className="text-gray-500 text-center py-10">{t("txt_194")}</p> : <div className="grid gap-4 sm:grid-cols-2">
          {workflows.map(wf => <div key={wf.id} className={`bg-white rounded-xl shadow-sm p-4 border-r-4 ${wf.is_active ? "border-green-500" : "border-gray-300 opacity-70"} space-y-3`}>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-brand-600 font-semibold mb-1">{t("txt_195")}</p>
                  <p className="text-sm font-medium text-gray-800">
                    {wf.trigger_event}
                  </p>
                </div>
                <button onClick={() => toggleActive(wf)} className={`text-xs px-2 py-1 rounded-md ${wf.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {wf.is_active ? t("txt_196") : t("txt_197")}
                </button>
              </div>

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1 mt-2">
                <p className="text-xs text-gray-500 font-semibold mb-1">{t("txt_198")}</p>
                <p className="text-xs font-bold text-gray-700">
                  {ACTION_TYPES.find(a => a.value === wf.action_type)?.label || wf.action_type}
                </p>
                <p className="text-sm text-gray-800 break-all" dir="auto">
                  {wf.content}
                </p>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => openModal(wf)} className="text-xs text-gray-600 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50">{t("txt_58")}</button>
                <button onClick={() => remove(wf.id)} className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-md hover:bg-red-50">{t("txt_25")}</button>
              </div>
            </div>)}
        </div>}

      {showModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {editingWf ? t("txt_199") : t("txt_200")}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_201")}</label>
                <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none">
                  {PRESET_TRIGGERS.map(t => <option key={t} value={t}>
                      {t}
                    </option>)}
                </select>
                {triggerEvent === t("txt_184") && <input type="text" value={customTrigger} onChange={e => setCustomTrigger(e.target.value)} placeholder={t("txt_202")} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mt-2 focus:ring-2 focus:ring-brand-500 focus:outline-none" />}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_203")}</label>
                <select value={actionType} onChange={e => setActionType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none">
                  {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>
                      {a.label}
                    </option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("txt_204")}</label>
                <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="https://docs.google.com/forms/..." rows={4} dir="auto" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none" />
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg">{t("txt_23")}</button>
              <button onClick={save} className="px-6 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg">{t("txt_205")}</button>
            </div>
          </div>
        </div>}
    </div>;
}