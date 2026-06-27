import { create } from "zustand";
import { useConfigStore } from "./configStore";

export type DarkMode = "auto" | "light" | "dark";

interface ThemeState {
  darkMode: DarkMode;
  parallax: boolean;
  setDarkMode: (mode: DarkMode) => void;
  setParallax: (v: boolean) => void;
}

function setDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

async function resolveSystemDark(): Promise<boolean> {
  try {
    const theme = await window.electronAPI?.getTheme();
    if (theme !== null && theme !== undefined) return theme === "dark";
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyDarkMode(mode: DarkMode) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mode === "auto") setDark(mq.matches);
  else if (mode === "dark") setDark(true);
  else setDark(false);
}

async function applyDarkModeAsync(mode: DarkMode) {
  if (mode === "auto") {
    setDark(await resolveSystemDark());
  } else {
    applyDarkMode(mode);
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: "auto",
  parallax: true,

  setDarkMode: (mode) => {
    applyDarkMode(mode);
    set({ darkMode: mode });
    useConfigStore.getState().setTheme({ darkMode: mode });
  },

  setParallax: (v) => {
    set({ parallax: v });
    useConfigStore.getState().setTheme({ parallax: v });
  },
}));

const mq = window.matchMedia("(prefers-color-scheme: dark)");
const syncFromMedia = () => {
  if (useThemeStore.getState().darkMode === "auto") {
    setDark(mq.matches);
  }
};
syncFromMedia();
mq.addEventListener("change", syncFromMedia);

export function syncThemeFromConfig() {
  const { theme } = useConfigStore.getState().config;
  applyDarkModeAsync(theme.darkMode as DarkMode);
  useThemeStore.setState({ darkMode: theme.darkMode as DarkMode, parallax: theme.parallax });
}
