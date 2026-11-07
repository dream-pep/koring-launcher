import type { TcProfile } from "@/api/terracotta";
import { cn } from "@/lib/utils";

const KIND_META: Record<TcProfile["kind"], { label: string; cls: string }> = {
  HOST: {
    label: "房主",
    cls: "border-primary/25 bg-primary/10 text-primary",
  },
  LOCAL: {
    label: "本机",
    cls: "border-green-500/25 bg-green-500/10 text-green-600 dark:text-green-400",
  },
  GUEST: {
    label: "成员",
    cls: "border-border/40 bg-foreground/[0.05] text-muted-foreground dark:border-white/[0.08]",
  },
};

/** 房间成员列表（host-ok / guest-ok 共用） */
export function MemberList({
  profiles,
  className,
}: {
  profiles: TcProfile[];
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/40 bg-foreground/[0.02] p-4 dark:border-white/[0.06]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-semibold text-foreground">房间成员</h4>
        <span className="text-[11px] text-muted-foreground">{profiles.length} 人</span>
      </div>
      {profiles.length === 0 ? (
        <p className="mt-2 text-[12px] text-muted-foreground">暂无成员，等待好友加入…</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {profiles.map((profile, index) => {
            const meta = KIND_META[profile.kind] ?? KIND_META.GUEST;
            return (
              <li
                key={`${profile.machineId || "member"}-${index}`}
                className="flex items-center gap-2.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {(profile.name || "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {profile.name || "未知玩家"}
                  </p>
                  {profile.vendor ? (
                    <p className="truncate text-[11px] text-muted-foreground">{profile.vendor}</p>
                  ) : null}
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                    meta.cls,
                  )}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
