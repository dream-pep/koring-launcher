//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { create } from "zustand";
import type { LauncherNotification } from "@/api/launcher-api";

// 交互通知（toast）历史条目
export interface ToastRecord {
  id: string;
  /** success / info / warning / error / loading / default */
  type: "success" | "info" | "warning" | "error" | "loading" | "default";
  message: string;
  description?: string;
  time: number;
}

// 历史上限，避免无限增长
const MAX_TOAST_HISTORY = 50;

interface NoticeState {
  /** 系统通知：启动校验 API（设备 + 版本）下发的全局公告 */
  systemNotices: LauncherNotification[];
  /** 交互通知历史：程序运行过程中产生的 toast */
  toastHistory: ToastRecord[];

  setSystemNotices: (notices: LauncherNotification[]) => void;
  pushToast: (record: ToastRecord) => void;
  clearToasts: () => void;
}

export const useNoticeStore = create<NoticeState>((set) => ({
  systemNotices: [],
  toastHistory: [],

  setSystemNotices: (notices) => set({ systemNotices: notices }),

  // 同 id 视为同一条通知（如 loading → success 原地变形），替换而非重复追加
  pushToast: (record) =>
    set((state) => {
      const rest = state.toastHistory.filter((t) => t.id !== record.id);
      return { toastHistory: [record, ...rest].slice(0, MAX_TOAST_HISTORY) };
    }),

  clearToasts: () => set({ toastHistory: [] }),
}));
