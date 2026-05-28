"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      loading: false, // loading can default to false when persisted
      setAuth: (token, user) => {
        set({ token, user, loading: false });
      },
      logout: () => {
        set({ token: null, user: null, loading: false });
      },
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: "masarjo_auth",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
