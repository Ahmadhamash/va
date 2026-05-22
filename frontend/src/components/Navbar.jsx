import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const prevCount = useRef(0);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "ar" ? "en" : "ar");
  };

  useEffect(() => {
    if (user?.role === "client") {
      const poll = () => api.get("/escalations/count").then(({ data }) => {
        const newCount = data.pending || 0;
        if (newCount > prevCount.current) {
          setToast({ title: t("new_escalation"), message: t("escalation_message") });
          setTimeout(() => setToast(null), 5000);
        }
        prevCount.current = newCount;
        setPendingCount(newCount);
      }).catch(() => {});
      poll();
      const iv = setInterval(poll, 5000);
      return () => clearInterval(iv);
    }
  }, [user, t]);

  function handleLogout() { logout(); navigate("/login"); }

  const linkCls = (path) => `px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${pathname === path ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"}`;

  const links = user?.role === "admin" ? [{ to: "/", label: t("nav_clients") }] : [
    { to: "/", label: t("nav_catalog") },
    { to: "/delivery", label: t("nav_delivery") },
    { to: "/policies", label: t("nav_policies") },
    { to: "/offers", label: t("nav_offers") },
    { to: "/bookings", label: t("nav_bookings") },
    { to: "/payments", label: t("nav_payments") },
    { to: "/escalations", label: t("nav_escalations"), badge: pendingCount },
    { to: "/workflows", label: t("nav_workflows") },
    { to: "/training", label: t("nav_training") },
    { to: "/channels", label: t("nav_channels") },
    { to: "/chat", label: t("nav_chat") },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="md:hidden p-1 text-gray-500 hover:bg-gray-100 rounded" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="font-bold text-brand-600 shrink-0">{t("business_assistant")}</span>
          {user?.role === "admin" && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">{t("admin")}</span>}
          <span className="text-gray-300 hidden md:inline shrink-0">|</span>
          <div className="hidden md:flex items-center gap-1.5">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className={linkCls(l.to)}>
                {l.label}
                {l.badge > 0 && <span className="mr-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-red-500 text-white rounded-full">{l.badge}</span>}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm shrink-0">
          <button 
            onClick={toggleLanguage}
            className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded"
          >
            {i18n.language === "ar" ? "EN" : "عربي"}
          </button>
          {user ? (
            <>
              <span className="text-gray-500 hidden sm:inline">{user?.business_name || user?.username}</span>
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">{t("logout")}</button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 text-gray-600 hover:text-brand-600">{t("login")}</Link>
              <Link to="/register" className="px-3 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700">{t("register")}</Link>
            </>
          )}
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden px-4 pb-3 space-y-1">
          {links.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className={`block px-3 py-2 rounded-md text-sm font-medium ${pathname === l.to ? "bg-brand-50 text-brand-700" : "text-gray-700 hover:bg-gray-50"}`}>
              {l.label}
              {l.badge > 0 && <span className="mr-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">{l.badge}</span>}
            </Link>
          ))}
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-4 ${i18n.language === "ar" ? "left-4" : "right-4"} z-50 bg-white border border-gray-200 shadow-lg rounded-lg p-4 flex gap-3 animate-bounce`}>
          <div className="bg-red-100 text-red-600 p-2 rounded-full h-10 w-10 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{toast.title}</h4>
            <p className="text-sm text-gray-600">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}
    </nav>
  );
}
