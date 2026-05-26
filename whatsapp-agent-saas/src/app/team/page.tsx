"use client";

import { useState, useEffect } from "react";
import { UserPlus, Users, Trash2, Clock, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "مالك" | "مسؤول" | "موظف دعم" | "مشرف مبيعات";
  status: "ONLINE" | "BUSY" | "PENDING" | "OFFLINE";
  activeChats: number;
  lastActive: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Invite form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"مسؤول" | "موظف دعم" | "مشرف مبيعات">("موظف دعم");
  const [notice, setNotice] = useState("");

  // Load from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMembers = localStorage.getItem("masarjo_team_members");
      if (savedMembers) {
        setMembers(JSON.parse(savedMembers));
      } else {
        const initial: TeamMember[] = [
          { id: "m1", name: "أحمد حماش", email: "owner@masarjo.com", role: "مالك", status: "ONLINE", activeChats: 0, lastActive: "نشط الآن" },
          { id: "m2", name: "سارة العبد الله", email: "sara@masarjo.com", role: "موظف دعم", status: "ONLINE", activeChats: 3, lastActive: "قبل 5 دقائق" },
          { id: "m3", name: "خالد المصري", email: "khaled@masarjo.com", role: "مشرف مبيعات", status: "BUSY", activeChats: 1, lastActive: "قبل 14 دقيقة" }
        ];
        setMembers(initial);
        localStorage.setItem("masarjo_team_members", JSON.stringify(initial));
      }
      setIsLoaded(true);
    }
  }, []);

  const saveMembersToStorage = (updatedMembers: TeamMember[]) => {
    setMembers(updatedMembers);
    localStorage.setItem("masarjo_team_members", JSON.stringify(updatedMembers));
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4500);
  };

  const handleInvite = () => {
    if (!name.trim() || !email.trim()) {
      showNotice("⚠️ يرجى تعبئة الاسم والبريد الإلكتروني بشكل صحيح.");
      return;
    }

    if (members.some(m => m.email.toLowerCase() === email.toLowerCase())) {
      showNotice("⚠️ البريد الإلكتروني مسجل بالفعل لعضو آخر.");
      return;
    }

    const newMemberId = `m-${Date.now()}`;
    const newMember: TeamMember = {
      id: newMemberId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      status: "PENDING",
      activeChats: 0,
      lastActive: "بانتظار القبول"
    };

    const updated = [...members, newMember];
    saveMembersToStorage(updated);
    showNotice(`✨ تم إرسال بريد دعوة الانضمام بنجاح إلى ${name.trim()}!`);
    setName("");
    setEmail("");
    setRole("موظف دعم");

    // Simulate member accepting the invite after 6 seconds
    setTimeout(() => {
      setMembers(currentMembers => {
        const found = currentMembers.find(m => m.id === newMemberId);
        if (found && found.status === "PENDING") {
          const mapped = currentMembers.map(m =>
            m.id === newMemberId
              ? { ...m, status: "ONLINE" as const, lastActive: "نشط الآن" }
              : m
          );
          localStorage.setItem("masarjo_team_members", JSON.stringify(mapped));
          showNotice(`🎉 قبل العضو ${found.name} الدعوة بنجاح وانضم إلى فريقك!`);
          return mapped;
        }
        return currentMembers;
      });
    }, 6000);
  };

  const handleDeleteMember = (id: string, memberName: string) => {
    const member = members.find(m => m.id === id);
    if (member?.role === "مالك") {
      showNotice("⚠️ لا يمكن إزالة مالك الحساب الرئيسي.");
      return;
    }
    if (!confirm(`هل أنت متأكد من حذف العضو ${memberName} من فريق العمل؟`)) return;

    const updated = members.filter(m => m.id !== id);
    saveMembersToStorage(updated);
    showNotice(`🗑️ تم حذف العضو ${memberName} بنجاح.`);
  };

  const toggleAvailability = (id: string) => {
    const updated = members.map(m => {
      if (m.id === id) {
        if (m.role === "مالك") return m;
        let nextStatus: TeamMember["status"] = "ONLINE";
        if (m.status === "ONLINE") nextStatus = "BUSY";
        else if (m.status === "BUSY") nextStatus = "OFFLINE";
        else if (m.status === "OFFLINE") nextStatus = "ONLINE";
        
        return {
          ...m,
          status: nextStatus,
          lastActive: nextStatus === "ONLINE" ? "نشط الآن" : nextStatus === "BUSY" ? "مشغول" : "غير متصل"
        };
      }
      return m;
    });
    saveMembersToStorage(updated);
  };

  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`;
    }
    return fullName.slice(0, 2);
  };

  const statusLabel = {
    ONLINE: { text: "متاح للرد", class: "bg-emeraldx-500/10 text-emeraldx-400 border-emeraldx-500/20", dot: "bg-emeraldx-400" },
    BUSY: { text: "مشغول حالياً", class: "bg-amber-500/10 text-amber-400 border-amber-500/20", dot: "bg-amber-400" },
    OFFLINE: { text: "خارج العمل", class: "bg-white/5 text-white/40 border-white/10", dot: "bg-white/30" },
    PENDING: { text: "معلق (دعوة)", class: "bg-cyanx-500/10 text-cyanx-400 border-cyanx-500/20 animate-pulse", dot: "bg-cyanx-400" }
  };

  const roleStyles = {
    "مالك": "border-red-400/20 bg-red-500/10 text-red-300",
    "مسؤول": "border-violetrx-500/20 bg-violetrx-600/10 text-violet-200",
    "موظف دعم": "border-cyanx-400/20 bg-cyanx-500/10 text-cyanx-300",
    "مشرف مبيعات": "border-emeraldx-400/20 bg-emeraldx-500/10 text-emeraldx-300"
  };

  return (
    <AppShell title="إدارة فريق العمل" subtitle="أضف الموظفين ووزع الأدوار وحدد التوافر لإسناد المحادثات عند التحويل البشري تلقائياً.">
      {notice && (
        <div className="mb-6 rounded-3xl border border-emeraldx-400/20 bg-emeraldx-500/10 px-5 py-4 text-sm font-semibold text-emeraldx-400 text-right animate-pulse">
          {notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        {/* Left Column: Team Members list */}
        <div className="space-y-6">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white flex items-center justify-end gap-2">
                <span>أعضاء الفريق الحاليين</span>
                <Users className="h-5 w-5 text-emeraldx-400" />
              </CardTitle>
              <CardDescription className="text-sm text-white/45">
                تصفح حالة موظفيك النشطين، المحادثات التي يتولونها حالياً، وغير حالتهم عند بدء الاستراحة.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isLoaded ? (
                <div className="flex h-44 items-center justify-center">
                  <Clock className="h-6 w-6 animate-spin text-white/20" />
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-3xl">
                  <p className="text-xs text-white/35">لا يوجد موظفون مضافون بعد.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {members.map((member) => (
                    <Card key={member.id} className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.025] hover:bg-white/[0.05] transition-all duration-300 p-5 text-right flex flex-col justify-between group">
                      
                      {/* Top Controls: Role and Delete */}
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <span className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-bold",
                          roleStyles[member.role] || "border-white/10 bg-white/5 text-white/60"
                        )}>
                          {member.role}
                        </span>
                        
                        {member.role !== "مالك" && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(member.id, member.name)}
                            className="text-white/20 hover:text-red-400 transition p-1.5 rounded-full hover:bg-white/5 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      {/* Middle: Profile details */}
                      <div className="flex items-center gap-3 justify-end mb-4">
                        <div className="text-right">
                          <h4 className="font-bold text-sm text-white">{member.name}</h4>
                          <p className="text-[11px] text-white/40 mt-0.5 truncate max-w-[180px]">{member.email}</p>
                        </div>
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/8 text-emeraldx-400 font-bold text-base shadow-sm">
                          {getInitials(member.name)}
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-white/5 my-3" />

                      {/* Bottom: Activity Status and Active Chats count */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-left">
                          <span className="text-[10px] text-white/40">محادثات نشطة: </span>
                          <span className="text-xs font-bold text-white">{member.activeChats}</span>
                        </div>

                        {/* Interactive Status switch button */}
                        <button
                          type="button"
                          disabled={member.status === "PENDING" || member.role === "مالك"}
                          onClick={() => toggleAvailability(member.id)}
                          className={cn(
                            "flex items-center gap-1.5 border px-2.5 py-1 rounded-full text-[10px] font-bold focus:outline-none transition-all",
                            statusLabel[member.status].class,
                            member.role !== "مالك" && member.status !== "PENDING" && "hover:scale-[1.03] active:scale-[0.98]"
                          )}
                        >
                          <span>{statusLabel[member.status].text}</span>
                          <span className={cn("h-1.5 w-1.5 rounded-full", statusLabel[member.status].dot)} />
                        </button>
                      </div>

                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Invite Member Form */}
        <div className="space-y-6">
          <Card className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <CardHeader className="text-right">
              <CardTitle className="text-lg font-bold text-white flex items-center justify-end gap-2">
                <span>إرسال دعوة انضمام</span>
                <UserPlus className="h-5 w-5 text-emeraldx-400" />
              </CardTitle>
              <CardDescription className="text-sm text-white/45">
                أدخل بيانات الموظف ودوره لإرسال رابط انضمام فوري للفريق.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60">الاسم الكامل للموظف</label>
                <Input
                  className="text-right text-xs pr-3"
                  placeholder="مثال: رنا المومني"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60">البريد الإلكتروني للعمل</label>
                <Input
                  className="text-right text-xs pr-3"
                  placeholder="rana@masarjo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-xs font-semibold text-white/60">دور وصلاحيات العضو</label>
                <select
                  value={role}
                  onChange={(event) => setRole(event.target.value as any)}
                  className="w-full h-11 px-3 rounded-2xl border border-white/12 bg-white/5 hover:bg-white/10 transition text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-emeraldx-400/70"
                >
                  <option value="موظف دعم" className="bg-ink-950">موظف دعم (استلام محادثات)</option>
                  <option value="مشرف مبيعات" className="bg-ink-950">مشرف مبيعات (رد ومتابعة المنتجات)</option>
                  <option value="مسؤول" className="bg-ink-950">مسؤول (تحكم في الإعدادات وقاعدة المعرفة)</option>
                </select>
              </div>

              <Button className="w-full mt-4" onClick={handleInvite}>
                <UserPlus className="h-4 w-4" />
                إرسال دعوة انضمام
              </Button>
            </CardContent>
          </Card>

          {/* Invitation Integration Helper */}
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.015] p-5 text-right">
            <h4 className="text-xs font-bold text-white flex items-center justify-end gap-1.5 mb-1.5">
              <span>نظام دعوة الموظفين التلقائي</span>
            </h4>
            <p className="text-[10px] leading-5 text-white/45">
              عند إرسال دعوة، يقوم النظام بإرسال بريد يحتوي على رابط تفعيل فريد لتوليد كلمة مرور وكلمة سر مخصصة، ليتم فورياً إسناد العميل للوكيل وإتاحته للتحويل البشري.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
