"use client";

import { AppShell } from "@/components/app-shell";
import { GradientCard } from "@/components/gradient-card";
import { Calendar, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export default function BookingsPage() {
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const res = await apiClient.get("/bookings");
      return res.data.bookings || [];
    },
  });

  return (
    <AppShell title="إدارة الحجوزات" subtitle="مواعيد العملاء التي قام الوكيل الذكي بجدولتها.">
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <GradientCard>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">الحجوزات القادمة</h3>
            </div>
            
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-white/50">جاري التحميل...</div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 text-white/50 border border-dashed border-white/10 rounded-3xl bg-white/[0.02]">
                  <Calendar className="h-8 w-8 mx-auto mb-3 text-white/20" />
                  لا توجد حجوزات مسجلة حالياً.
                </div>
              ) : (
                bookings.map((booking: any) => (
                  <div key={booking.id} className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyanx-500/10 text-cyanx-400">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-semibold text-white">{booking.customer_name}</div>
                        <div className="text-xs text-white/50 mt-1">{booking.service_name} • {new Date(booking.date).toLocaleDateString("ar-SA")} {booking.time}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-full bg-emeraldx-500/10 px-3 py-1.5 text-xs font-semibold text-emeraldx-400 flex items-center gap-1 hover:bg-emeraldx-500/20">
                        <CheckCircle2 className="h-4 w-4" /> تأكيد
                      </button>
                      <button className="rounded-full bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 flex items-center gap-1 hover:bg-red-500/20">
                        <XCircle className="h-4 w-4" /> إلغاء
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </GradientCard>
        </div>
        
        <div className="space-y-6">
          <GradientCard className="border-white/10 bg-white/5">
            <h3 className="text-lg font-semibold text-white mb-4">أوقات العمل المتاحة</h3>
            <p className="text-xs text-white/50 mb-4">
              الوكيل الذكي سيقوم بعرض هذه الأوقات للعملاء عند طلب حجز موعد.
            </p>
            <div className="space-y-3">
              {["الأحد - الخميس", "الجمعة", "السبت"].map((day, i) => (
                <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                  <div className="font-semibold text-white/80">{day}</div>
                  <div className="text-xs text-emeraldx-400 mt-1">{i === 1 ? "مغلق" : "09:00 ص - 05:00 م"}</div>
                </div>
              ))}
            </div>
          </GradientCard>
        </div>
      </div>
    </AppShell>
  );
}
