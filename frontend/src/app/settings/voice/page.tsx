"use client";

import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { Button } from "@/components/ui/button";
import { Mic, PlayCircle, Settings2, Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toast } from "react-hot-toast";
import { useState, useEffect } from "react";

export default function VoiceSettingsPage() {
  const queryClient = useQueryClient();
  const [voiceSettings, setVoiceSettings] = useState({
    voice_id: "alloy",
    speed: 1.0,
    pitch: 1.0,
    greeting_message: "مرحباً، كيف يمكنني مساعدتك اليوم؟",
  });

  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ["voiceSettings"],
    queryFn: async () => {
      const res = await apiClient.get("/voice_settings");
      return res.data;
    },
  });

  useEffect(() => {
    if (currentSettings) {
      setVoiceSettings(currentSettings);
    }
  }, [currentSettings]);

  const saveMutation = useMutation({
    mutationFn: async (settings: typeof voiceSettings) => {
      return apiClient.put("/voice_settings", settings);
    },
    onSuccess: () => {
      toast.success("تم حفظ إعدادات الصوت بنجاح.");
      queryClient.invalidateQueries({ queryKey: ["voiceSettings"] });
    },
    onError: () => {
      toast.error("فشل حفظ إعدادات الصوت.");
    },
  });

  const handleSave = () => {
    saveMutation.mutate(voiceSettings);
  };

  return (
    <AppShell title="إعدادات الصوت والمكالمات" subtitle="خصص صوت واسم وأسلوب الوكيل في المكالمات الصوتية.">
      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <GradientCard>
            <div className="flex items-center gap-3 mb-6">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/20 text-violet-400">
                <Mic className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">إعدادات الصوت الأساسية</h3>
                <p className="text-sm text-white/50">اختر الصوت المناسب لهوية نشاطك التجاري.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white/70 block">الصوت المفضل</label>
                <select
                  value={voiceSettings.voice_id}
                  onChange={(e) => setVoiceSettings({ ...voiceSettings, voice_id: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emeraldx-500 focus:outline-none"
                >
                  <option value="alloy">Alloy (محايد)</option>
                  <option value="echo">Echo (رجل - هادئ)</option>
                  <option value="fable">Fable (رجل - حيوي)</option>
                  <option value="onyx">Onyx (رجل - عميق)</option>
                  <option value="nova">Nova (امرأة - محترفة)</option>
                  <option value="shimmer">Shimmer (امرأة - دافئة)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-white/70 block">رسالة الترحيب</label>
                <textarea
                  value={voiceSettings.greeting_message}
                  onChange={(e) => setVoiceSettings({ ...voiceSettings, greeting_message: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emeraldx-500 focus:outline-none h-24"
                  placeholder="الرسالة التي سيقولها الوكيل عند بدء المكالمة..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white/70 block">سرعة التحدث ({voiceSettings.speed}x)</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceSettings.speed}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, speed: parseFloat(e.target.value) })}
                    className="w-full accent-emeraldx-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-white/70 block">نبرة الصوت ({voiceSettings.pitch})</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={voiceSettings.pitch}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, pitch: parseFloat(e.target.value) })}
                    className="w-full accent-emeraldx-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3 justify-end">
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
                <Save className="h-4 w-4 mr-2" />
              </Button>
            </div>
          </GradientCard>
        </div>

        <div className="space-y-6">
          <GradientCard className="border-white/10 bg-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">تجربة الصوت</h3>
            <p className="text-sm text-white/50 mb-6">استمع لعينة من الصوت المختار לפני الحفظ النهائي.</p>
            
            <div className="rounded-3xl bg-black/20 p-6 flex flex-col items-center justify-center border border-white/5">
              <div className="h-16 w-16 rounded-full bg-emeraldx-500/20 text-emeraldx-400 flex items-center justify-center cursor-pointer hover:bg-emeraldx-500/30 transition shadow-glow">
                <PlayCircle className="h-8 w-8" />
              </div>
              <p className="mt-4 text-xs font-semibold text-white/70 text-center">
                &quot;{voiceSettings.greeting_message}&quot;
              </p>
            </div>
          </GradientCard>
        </div>
      </div>
    </AppShell>
  );
}
