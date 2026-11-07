import { useEffect, useRef } from "react";
import type { TcProfile } from "@/api/terracotta";
import { toast } from "@/lib/toast";

/** 房主展示名兜底 */
function displayName(profile: TcProfile): string {
  const name = profile.name?.trim();
  return name || "有玩家";
}

/**
 * 新成员加入提醒（房主视角）。
 *
 * 实现要点：
 * - 只在 `active`（房主态 `host-ok`）时工作；进入/退出房主态都会重置基线，避免把「刚打开页面时
 *   已经在房间里的成员」误报成新加入。
 * - 基线用上一次的 machine_id 集合，配合 store 里「成员未变则复用数组引用」的稳定化，
 *   这个 effect 只会在成员真正变化时执行，不会跟着 500ms 轮询反复跑。
 * - 同一玩家重复进出用固定 toast id，避免通知堆叠。
 */
export function useJoinNotice(profiles: TcProfile[], active: boolean) {
  const knownRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!active) {
      knownRef.current = null;
      return;
    }

    const current = new Set(profiles.map((profile) => profile.machineId));
    const known = knownRef.current;
    knownRef.current = current;

    // 第一次观察（刚进入房主态）只建立基线，不提示
    if (!known) return;

    for (const profile of profiles) {
      if (profile.kind === "HOST") continue;
      if (known.has(profile.machineId)) continue;
      toast.info(`${displayName(profile)} 加入了房间`, {
        id: `terracotta-join-${profile.machineId}`,
      });
    }
  }, [profiles, active]);
}
