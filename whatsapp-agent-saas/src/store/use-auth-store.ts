"use client";

import { create } from "zustand";

interface User {
  id: string;
  username: string;
  email: string;
  business_name: string | null;
  business_type: string | null;
  role: string;
  chatwoot_account_id: string | null;
  chatwoot_user_token: string | null;
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("masarjo_token") : null,
  user: null,
  loading: true,
  setAuth: (token, user) => {
    localStorage.setItem("masarjo_token", token);
    set({ token, user, loading: false });
  },
  logout: () => {
    localStorage.removeItem("masarjo_token");
    set({ token: null, user: null, loading: false });
  },
  setLoading: (loading) => set({ loading }),
}));
