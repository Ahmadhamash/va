"use client";

import { create } from "zustand";

type AppState = {
  aiPaused: boolean;
  demoMode: boolean;
  setAiPaused: (value: boolean) => void;
  setDemoMode: (value: boolean) => void;
};

export const useAppStore = create<AppState>((set) => ({
  aiPaused: false,
  demoMode: true,
  setAiPaused: (aiPaused) => set({ aiPaused }),
  setDemoMode: (demoMode) => set({ demoMode })
}));
