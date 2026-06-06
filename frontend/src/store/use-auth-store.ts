"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

interface User {
  id: string;
  username: string;
  email: string;
  business_name: string | null;
  business_type: string | null;
  ai_persona: string | null;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

const authStorage: StateStorage = {
  getItem: (name) => {
    const current = localStorage.getItem(name);
    if (current) return current;
    if (name === "chatter_auth") {
      const legacy = localStorage.getItem("masarjo_auth");
      if (legacy) {
        localStorage.setItem(name, legacy);
        localStorage.removeItem("masarjo_auth");
        return legacy;
      }
    }
    return null;
  },
  setItem: (name, value) => {
    localStorage.setItem(name, value);
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      loading: false, // loading can default to false when persisted
      setAuth: (token, user) => {
        set({ token, user, loading: false });
      },
      logout: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch (e) {
          console.error("Logout error", e);
        }
        set({ token: null, user: null, loading: false });
      },
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: "chatter_auth",
      storage: createJSONStorage(() => authStorage),
    }
  )
);
