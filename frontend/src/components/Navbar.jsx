import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user?.role === "client") {
      const poll = () => api.get("/escalations/count").then(({ data }) => setPendingCount(data.pending || 0)).catch(() => {});
      poll();
      const iv = setInterval(poll, 30000);
      return () => clearInterval(iv);
    }
  }, [user]);

  function handleLogout() { logout(); navigate("/login"); }

  const linkCls = (path) => `px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${pathname === path ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"}`;

  const links = user?.role === "admin" ? [{ to: "/", label: "العملاء" }] : [
    { to: "/", label: "الكاتالوج" },
    { to: "/delivery", label: "التوصيل" },
    { to: "/policies", label: "السياسات" },
    { to: "/offers", label: "العروض" },
    { to: "/bookings", label: "الحجوزات" },
    { to: "/payments", label: "الدفع" },
    { to: "/escalations", label: "التحويلات", badge: pendingCount },
    { to: "/workflows", label: "الأتمتة" },
    { to: "/training", label: "صوت AI" },
    { to: "/channels", label: "القنوات" },
    { to: "/chat", label: "المحادثة" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200" dir="rtl">
      <div className="mx-auto max-w-6xl px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="font-bold text-brand-600 shrink-0">مساعد الأعمال</span>
          {user?.role === "admin" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">مدير</span>}
          <span className="text-gray-300 shrink-0">|</span>
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={linkCls(l.to)}>
              {l.label}
              {l.badge > 0 && <span className="mr-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full">{l.badge}</span>}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          <span className="text-gray-500 hidden sm:inline">{user?.business_name || user?.username}</span>
          <button onClick={handleLogout} className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">خروج</button>
        </div>
      </div>
    </nav>
  );
}
