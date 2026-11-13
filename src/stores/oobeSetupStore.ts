import { create } from "zustand";

/** OOBE 启动方式：直接使用（跳过个性化步骤）/ 详细配置 */
export type OobeSetupMode = "quick" | "detailed";

interface OobeSetupState {
  mode: OobeSetupMode;
  setMode: (mode: OobeSetupMode) => void;
}

export const useOobeSetupStore = create<OobeSetupState>((set) => ({
  mode: "quick",
  setMode: (mode) => set({ mode }),
}));
