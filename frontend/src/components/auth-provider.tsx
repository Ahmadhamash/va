"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  getToken,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type BackendUser
} from "@/lib/api-client";

type AuthContextValue = {
  user: BackendUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (payload: {
    username: string;
    email: string;
    password: string;
    business_name?: string;
    business_type?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const me = await apiRequest<BackendUser>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("backend-unauthorized", handleUnauthorized);
    return () => window.removeEventListener("backend-unauthorized", handleUnauthorized);
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refreshUser,
      async login(username, password) {
        await loginRequest(username, password);
        await refreshUser();
      },
      async register(payload) {
        await registerRequest(payload);
        await refreshUser();
      },
      logout() {
        logoutRequest();
        setUser(null);
      }
    }),
    [loading, refreshUser, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
