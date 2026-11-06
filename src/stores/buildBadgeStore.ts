import { create } from "zustand";

/**
 * 构建模式徽章（顶栏 DEV / BETA）的「临时隐藏」状态。
 *
 * 刻意不写入配置（Koring.yml / config.startup 等）：只存在本次运行的窗口会话里，
 * 关掉启动器再打开就会恢复显示。用 sessionStorage 只是为了让开发时的热重载
 * 不把状态清掉，新窗口（= 重启启动器）依然从「显示」开始。
 */
const STORAGE_KEY = "koring-build-badge-hidden";

function readInitialHidden(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface BuildBadgeState {
  /** 是否暂时隐藏非正式版提示徽章 */
  hidden: boolean;
  /** 隐藏徽章（本次运行有效） */
  hideBadge: () => void;
  /** 恢复显示徽章 */
  showBadge: () => void;
}

export const useBuildBadgeStore = create<BuildBadgeState>((set) => ({
  hidden: readInitialHidden(),
  hideBadge: () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // 隐私模式等场景下 sessionStorage 不可用：退化为纯内存状态
    }
    set({ hidden: true });
  },
  showBadge: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // 同上
    }
    set({ hidden: false });
  },
}));
