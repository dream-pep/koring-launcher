import { create } from "zustand";
import {
  checkForUpdates,
  downloadAndInstall,
  type DownloadProgress,
} from "../api/update";

interface UpdateState {
  checking: boolean;
  downloading: boolean;
  installed: boolean;
  progress: DownloadProgress | null;
  update: { version: string; releaseNotes?: string } | null;
  error: string | null;
  check: () => Promise<void>;
  install: () => Promise<void>;
  reset: () => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  checking: false,
  downloading: false,
  installed: false,
  progress: null,
  update: null,
  error: null,

  check: async () => {
    set({ checking: true, error: null });
    try {
      const update = await checkForUpdates();
      set({ update, checking: false });
    } catch (e: any) {
      set({ error: e.message ?? String(e), checking: false });
    }
  },

  install: async () => {
    set({ downloading: true, error: null, progress: null });
    try {
      await downloadAndInstall((progress) => {
        set({ progress });
      });
      set({ downloading: false, installed: true });
    } catch (e: any) {
      set({ error: e.message ?? String(e), downloading: false });
    }
  },

  reset: () => set({ update: null, error: null, progress: null, installed: false }),
}));
