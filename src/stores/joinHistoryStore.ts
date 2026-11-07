import { create } from "zustand";

const STORAGE_KEY = "koring-terracotta-join-history";
const MAX_HISTORY = 12;

/** 一条「加入过的房间」记录 */
export interface JoinHistoryEntry {
  /** 房间码（已归一化大写，展示用，含 U/ 前缀） */
  code: string;
  /** 房主昵称（拿不到时为空串） */
  hostName: string;
  /** 加入时间戳（毫秒） */
  joinedAt: number;
}

function loadHistory(): JoinHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is JoinHistoryEntry =>
          !!item &&
          typeof item === "object" &&
          typeof (item as JoinHistoryEntry).code === "string" &&
          typeof (item as JoinHistoryEntry).joinedAt === "number",
      )
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(entries: JoinHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore quota errors */
  }
}

interface JoinHistoryState {
  entries: JoinHistoryEntry[];
  /** 记录一次成功加入（同房间码会提到最前并刷新时间） */
  record: (entry: { code: string; hostName?: string }) => void;
  /** 清空全部历史 */
  clear: () => void;
}

export const useJoinHistoryStore = create<JoinHistoryState>((set, get) => ({
  entries: loadHistory(),
  record: ({ code, hostName }) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;

    const previous = get().entries.find((item) => item.code === normalized);
    const next = [
      {
        code: normalized,
        hostName: hostName?.trim() || previous?.hostName || "",
        joinedAt: Date.now(),
      },
      ...get().entries.filter((item) => item.code !== normalized),
    ].slice(0, MAX_HISTORY);

    saveHistory(next);
    set({ entries: next });
  },
  clear: () => {
    saveHistory([]);
    set({ entries: [] });
  },
}));
