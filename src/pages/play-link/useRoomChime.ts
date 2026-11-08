import { useEffect, useRef } from "react";
import { playJoinChime, playLeaveChime } from "@/lib/room-chime";
import type { TcProfile } from "@/api/terracotta";

/**
 * 房间成员进出提示音。
 *
 * 对比两次轮询的成员 machineId 集合：出现新成员播「有人加入」，成员消失播「有人退出」。
 * 首次进入房间（还没有上一份快照）不播放，离开房间后重置。
 */
export function useRoomChime(profiles: TcProfile[] | undefined, active: boolean): void {
  const previousIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!active) {
      previousIdsRef.current = null;
      return;
    }

    const currentIds = new Set(
      (profiles ?? []).map((profile) => profile.machineId).filter((id) => Boolean(id)),
    );
    const previousIds = previousIdsRef.current;
    previousIdsRef.current = currentIds;

    // 进入房间后的第一份快照只作为基准，不发声
    if (!previousIds) return;

    let joined = false;
    let left = false;
    for (const id of currentIds) {
      if (!previousIds.has(id)) {
        joined = true;
        break;
      }
    }
    if (!joined) {
      for (const id of previousIds) {
        if (!currentIds.has(id)) {
          left = true;
          break;
        }
      }
    }

    if (joined) playJoinChime();
    else if (left) playLeaveChime();
  }, [active, profiles]);
}
