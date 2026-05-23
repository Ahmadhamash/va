import { useEffect, useState } from "react";
import api from "../services/api";

export default function AutomationPage() {
  const [rules, setRules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [runs, setRuns] = useState([]);
  const [tab, setTab] = useState("rules");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dryResult, setDryResult] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [r, t, ru] = await Promise.all([
        api.get("/automation/rules"),
        api.get("/automation/templates"),
        api.get("/automation/runs", { params: { limit: 30 } }),
      ]);
      setRules(r.data || []);
      setTemplates(t.data || []);
      setRuns(ru.data || []);
    } catch (e) {
      console.error("Failed to load automation", e);
    } finally {
      setLoading(false);
    }
  }

  async function toggleRule(id) {
    await api.post(`/automation/rules/${id}/toggle`);
    await load();
  }

  async function deleteRule(id) {
    if (!window.confirm("حذف هذه القاعدة؟")) return;
    await api.delete(`/automation/rules/${id}`);
    await load();
  }

  async function createFromTemplate(templateId) {
    setCreating(true);
    try {
      await api.post(`/automation/rules/from-template/${templateId}`);
      setTab("rules");
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || "فشل الإنشاء");
    } finally {
      setCreating(false);
    }
  }

  async function dryRun(ruleId) {
    setDryResult(null);
    try {
      const { data } = await api.post(`/automation/rules/${ruleId}/dry-run`, {
        trigger: "new_message",
        channel: "whatsapp",
        customer_name: "أحمد",
        message_text: "كم سعر هالمنتج؟",
        session_message_count: 1,
      });
      setDryResult(data);
    } catch (e) {
      setDryResult({ error: e?.response?.data?.detail || "فشل التجربة" });
    }
  }

  if (loading) return <div className="p-8 text-gray-400">جاري التحميل...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold">⚡ الأتمتة — Automation</h1>
        <p className="text-sm text-gray-500 mt-1">قواعد تلقائية تنفذ إجراءات عند حدوث أحداث معينة.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {[
          { id: "rules", label: "القواعد" },
          { id: "templates", label: "القوالب الجاهزة" },
          { id: "runs", label: "سجل التنفيذ" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 text-sm py-2 rounded-md transition ${
              tab === t.id ? "bg-white shadow font-medium" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {tab === "rules" && (
        <div className="space-y-3">
          {rules.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
              <p className="text-lg">لا توجد قواعد أتمتة</p>
              <p className="text-xs mt-2">ابدأ من القوالب الجاهزة أو أنشئ قاعدة جديدة</p>
            </div>
          ) : rules.map(r => (
            <div key={r.id} className="bg-white rounded-xl shadow p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${r.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{r.trigger_type}</span>
                </div>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => dryRun(r.id)} className="border border-gray-300 rounded px-3 py-1 hover:bg-gray-50">
                    🧪 تجربة
                  </button>
                  <button onClick={() => toggleRule(r.id)} className="border border-gray-300 rounded px-3 py-1 hover:bg-gray-50">
                    {r.is_active ? "إيقاف" : "تفعيل"}
                  </button>
                  <button onClick={() => deleteRule(r.id)} className="border border-red-300 text-red-600 rounded px-3 py-1 hover:bg-red-50">
                    حذف
                  </button>
                </div>
              </div>
              {r.description && <p className="text-sm text-gray-500">{r.description}</p>}
              <div className="text-xs text-gray-400">
                شروط: {r.conditions?.length || 0} • إجراءات: {r.actions?.length || 0} • أولوية: {r.priority}
              </div>
            </div>
          ))}

          {/* Dry Run Result */}
          {dryResult && (
            <div className="bg-gray-50 border rounded-xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-medium text-sm">🧪 نتيجة التجربة</h3>
                <button onClick={() => setDryResult(null)} className="text-xs text-gray-400">✕ إغلاق</button>
              </div>
              <pre className="text-xs bg-white rounded p-3 overflow-x-auto">{JSON.stringify(dryResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {tab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl shadow p-5 space-y-3">
              <h3 className="font-medium">{t.name}</h3>
              {t.name_en && <p className="text-xs text-gray-400">{t.name_en}</p>}
              <p className="text-sm text-gray-600">{t.description}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="bg-gray-100 px-2 py-0.5 rounded">{t.trigger_type}</span>
                <span>شروط: {t.conditions?.length || 0}</span>
                <span>إجراءات: {t.actions?.length || 0}</span>
              </div>
              <button
                onClick={() => createFromTemplate(t.id)}
                disabled={creating}
                className="bg-brand-600 text-white text-sm px-4 py-1.5 rounded-md hover:bg-brand-700 disabled:opacity-50"
              >
                ➕ إنشاء من هذا القالب
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Runs Tab */}
      {tab === "runs" && (
        <div className="space-y-2">
          {runs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">لا توجد سجلات تنفيذ بعد</p>
          ) : runs.map(r => (
            <div key={r.id} className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  r.status === "executed" ? "bg-green-500" : r.status === "loop_prevented" ? "bg-yellow-500" : "bg-gray-300"
                }`} />
                <span className="text-gray-700">{r.status}</span>
                {r.conditions_matched && <span className="text-xs text-green-600">✓ شروط متطابقة</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{r.execution_time_ms}ms</span>
                <span>{r.created_at ? new Date(r.created_at).toLocaleString("ar") : ""}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
