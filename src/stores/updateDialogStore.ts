import { create } from "zustand";

/**
 * "发现新版本"弹窗开关（渲染端共享）：
 * - UpdateAvailableDialog 自动弹窗（状态进入 available）与
 *   开发者工具的手动唤起都通过这里控制
 */
interface UpdateDialogState {
  open: boolean;
  /** 目标（新）版本号；为空时展示当前版本 */
  version: string;
  show: (version?: string) => void;
  hide: () => void;
}

export const useUpdateDialogStore = create<UpdateDialogState>((set) => ({
  open: false,
  version: "",
  show: (version = "") => set({ open: true, version }),
  hide: () => set({ open: false }),
}));
