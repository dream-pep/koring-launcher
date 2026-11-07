import { create } from "zustand";

/** 深链投递的房间加入请求（来自 koring://room-join?code=…） */
export interface DeepLinkRoomJoin {
  code: string;
  /** 主进程生成的投递 id，用于去重（事件 + 队列消费可能重复送达） */
  id: string;
}

interface DeepLinkState {
  /** 待处理的加入请求；由联机页消费 */
  pending: DeepLinkRoomJoin | null;
  /** 已处理过的投递 id（有上限，避免无限增长） */
  seen: string[];
  /** 登记一条加入请求（同 id 只处理一次） */
  requestRoomJoin: (payload: DeepLinkRoomJoin) => void;
  /** 联机页处理完成后清空 */
  consumeRoomJoin: () => void;
}

const SEEN_LIMIT = 50;

export const useDeepLinkStore = create<DeepLinkState>((set, get) => ({
  pending: null,
  seen: [],
  requestRoomJoin: ({ code, id }) => {
    if (!code || !id) return;
    if (get().seen.includes(id)) return;
    set((state) => ({
      pending: { code, id },
      seen: [...state.seen, id].slice(-SEEN_LIMIT),
    }));
  },
  consumeRoomJoin: () => set({ pending: null }),
}));
