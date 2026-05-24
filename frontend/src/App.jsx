import { Navigate, Route, Routes, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import Navbar from "./components/Navbar.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import AISafetyPage from "./pages/AISafetyPage.jsx";
import AutomationPage from "./pages/AutomationPage.jsx";
import OnboardingWizard from "./components/OnboardingWizard.jsx";
import BookingsPage from "./pages/BookingsPage.jsx";
import ChannelsPage from "./pages/ChannelsPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import DeliveryPage from "./pages/DeliveryPage.jsx";
import EscalationsPage from "./pages/EscalationsPage.jsx";
import HandoffInboxPage from "./pages/HandoffInboxPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import OffersPage from "./pages/OffersPage.jsx";
import PaymentSettingsPage from "./pages/PaymentSettingsPage.jsx";
import PoliciesPage from "./pages/PoliciesPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import TrainingPage from "./pages/TrainingPage.jsx";
import VoiceSettingsPage from "./pages/VoiceSettingsPage.jsx";
import WorkflowsPage from "./pages/WorkflowsPage.jsx";

function Shell({ children }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-950 dark:bg-[#0b1118] dark:text-slate-100">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="mt-auto border-t border-gray-200 bg-white/70 py-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="app-container flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-slate-400">
          <Link to="/terms" className="hover:text-brand-600 dark:hover:text-white">
            شروط الخدمة
          </Link>
          <Link to="/privacy" className="hover:text-brand-600 dark:hover:text-white">
            سياسة الخصوصية
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 dark:bg-[#0b1118] dark:text-slate-300">
        جاري التحميل...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  if (user.role === "client" && !user.business_name) {
    return <OnboardingWizard />;
  }

  return <Shell>{children}</Shell>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user } = useAuth();
  return user?.role === "admin" ? <AdminPage /> : <DashboardPage />;
}

function HomeGate() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 dark:bg-[#071015] dark:text-slate-300">
        جاري التحميل...
      </div>
    );
  }

  if (!user) return <LandingPage />;

  if (user.role === "client" && !user.business_name) {
    return <OnboardingWizard />;
  }

  return (
    <Shell>
      <Home />
    </Shell>
  );
}

export default function App() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
  }, [i18n.language]);

  useEffect(() => {
    const handleUnauthorized = () => {
      navigate("/login", { replace: true });
    };
    window.addEventListener("unauthorized", handleUnauthorized);
    return () => window.removeEventListener("unauthorized", handleUnauthorized);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route path="/terms" element={<Shell><TermsPage /></Shell>} />
      <Route path="/privacy" element={<Shell><PrivacyPage /></Shell>} />
      <Route path="/" element={<HomeGate />} />
      <Route path="/delivery" element={<Protected role="client"><DeliveryPage /></Protected>} />
      <Route path="/escalations" element={<Protected role="client"><EscalationsPage /></Protected>} />
      <Route path="/policies" element={<Protected role="client"><PoliciesPage /></Protected>} />
      <Route path="/offers" element={<Protected role="client"><OffersPage /></Protected>} />
      <Route path="/bookings" element={<Protected role="client"><BookingsPage /></Protected>} />
      <Route path="/payments" element={<Protected role="client"><PaymentSettingsPage /></Protected>} />
      <Route path="/training" element={<Protected role="client"><TrainingPage /></Protected>} />
      <Route path="/workflows" element={<Protected role="client"><WorkflowsPage /></Protected>} />
      <Route path="/channels" element={<Protected role="client"><ChannelsPage /></Protected>} />
      <Route path="/chat" element={<Protected role="client"><ChatPage /></Protected>} />
      <Route path="/ai-safety" element={<Protected role="client"><AISafetyPage /></Protected>} />
      <Route path="/handoff" element={<Protected><HandoffInboxPage /></Protected>} />
      <Route path="/voice-settings" element={<Protected role="client"><VoiceSettingsPage /></Protected>} />
      <Route path="/automation" element={<Protected role="client"><AutomationPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
