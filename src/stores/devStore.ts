import { create } from "zustand";

interface DevState {
  forceDisableContentBlur: boolean;
  setForceDisableContentBlur: (v: boolean) => void;
}

export const useDevStore = create<DevState>((set) => ({
  forceDisableContentBlur: false,

  setForceDisableContentBlur: (v) => set({ forceDisableContentBlur: v }),
}));
