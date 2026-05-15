import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const linkClass = (path) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      pathname === path
        ? "bg-brand-600 text-white"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  const links =
    user?.role === "admin"
      ? [{ to: "/", label: "Clients" }]
      : [
          { to: "/", label: "Catalog" },
          { to: "/training", label: "AI Voice" },
          { to: "/channels", label: "Channels" },
          { to: "/chat", label: "Chat" },
        ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="mx-auto max-w-6xl px-4 flex h-14 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-brand-600">AI Assistant</span>
          {user?.role === "admin" && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              Admin
            </span>
          )}
          <span className="text-gray-300">|</span>
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={linkClass(l.to)}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 hidden sm:inline">
            {user?.business_name || user?.username}
          </span>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
