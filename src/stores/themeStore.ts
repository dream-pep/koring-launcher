import { create } from "zustand";

export type DarkMode = "auto" | "light" | "dark";

interface ThemeState {
  darkMode: DarkMode;
  parallax: boolean;
  setDarkMode: (mode: DarkMode) => void;
  setParallax: (v: boolean) => void;
}

function applyDarkMode(mode: DarkMode) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  let dark = false;
  if (mode === "auto") dark = mq.matches;
  else if (mode === "dark") dark = true;
  document.documentElement.classList.toggle("dark", dark);
}

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: "auto",
  parallax: true,

  setDarkMode: (mode) => {
    applyDarkMode(mode);
    set({ darkMode: mode });
  },

  setParallax: (v) => set({ parallax: v }),
}));
