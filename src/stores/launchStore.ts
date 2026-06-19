import { create } from "zustand";
import { launchGame, onGameEvent, diagnoseVersion } from "../api/launch";
import type { LaunchOptions, LaunchResult } from "../api/launch";

interface GameEvent {
  event: string;
  [key: string]: unknown;
}

interface LaunchState {
  launching: boolean;
  launched: boolean;
  gameResult: LaunchResult | null;
  events: GameEvent[];
  error: string | null;

  launch: (options: LaunchOptions) => Promise<void>;
  diagnose: (gamePath: string, version: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export const useLaunchStore = create<LaunchState>((set) => ({
  launching: false,
  launched: false,
  gameResult: null,
  events: [],
  error: null,

  launch: async (options: LaunchOptions) => {
    set({ launching: true, error: null, events: [] });
    try {
      const result = await launchGame(options);
      set({ gameResult: result, launching: false, launched: true });

      // Listen for game events
      const unlisten = await onGameEvent(result.requestId, (event) => {
        set((state) => ({
          events: [...state.events, event],
        }));

        if (event.event === "exit") {
          set({ launched: false });
          unlisten();
        }
      });
    } catch (e: any) {
      set({ error: e.message, launching: false });
    }
  },

  diagnose: async (gamePath: string, version: string) => {
    try {
      await diagnoseVersion(gamePath, version);
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  reset: () => {
    set({ launching: false, launched: false, gameResult: null, events: [] });
  },

  clearError: () => set({ error: null }),
}));
