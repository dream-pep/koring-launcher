import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronRight, Search } from "lucide-react";
import { allRoutes, routes, useRouteStore } from "@/stores/routeStore";
import type { RouteKey } from "@/stores/routeStore";
import { Input } from "@/components/ui/input";
import { PageHeader } from "./components";

type GroupKey = "main" | "app" | "debug" | "oobe" | "upvp";

const GROUPS: { key: GroupKey; title: string; desc: string }[] = [
  { key: "main", title: "主导航", desc: "顶部导航栏显示的页面" },
  { key: "app", title: "功能子页", desc: "从主导航进入的二级页面" },
  { key: "debug", title: "调试工具", desc: "开发者工具页面" },
  { key: "oobe", title: "OOBE 引导", desc: "首次启动开箱引导流程页面" },
  { key: "upvp", title: "更新引导", desc: "版本更新引导流程页面" },
];

/** 顶部导航的页面集合 */
const topLevelKeys = new Set<RouteKey>(routes.map((r) => r.key));

function groupOf(key: RouteKey): GroupKey {
  if (topLevelKeys.has(key)) return "main";
  if (key === "oobe" || key.startsWith("oobe/")) return "oobe";
  if (key === "upvp" || key.startsWith("upvp/")) return "upvp";
  if (key === "debug" || key.startsWith("debug-")) return "debug";
  return "app";
}

/** 页面跳转：列出全部已注册页面，点击即可跳转 */
export function RoutesDebug() {
  const current = useRouteStore((s) => s.current);
  const navigate = useRouteStore((s) => s.navigate);
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const buckets = new Map<GroupKey, typeof allRoutes>();
    for (const route of allRoutes) {
      if (q) {
        const hay = `${route.label} ${route.key} ${route.path}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const g = groupOf(route.key);
      const list = buckets.get(g) ?? [];
      list.push(route);
      buckets.set(g, list);
    }
    return GROUPS.map((g) => ({
      ...g,
      items: buckets.get(g.key) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const total = allRoutes.length;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader
        title="页面跳转"
        desc={`启动器当前注册了 ${total} 个页面，点击任意条目即可跳转预览`}
      />

      {/* 搜索过滤 */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索页面名称 / 路由 key / 路径…"
          className="pl-9"
        />
      </div>

      <div className="space-y-7">
        {grouped.map((group) => (
          <div key={group.key}>
            <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider">
              {group.title}
              <span className="ml-2 normal-case font-normal text-[12px] text-muted-foreground/60">
                {group.desc}
              </span>
            </h3>
            <div className="mt-2 space-y-1.5">
              {group.items.map((route) => {
                const active = route.key === current;
                return (
                  <button
                    key={route.key}
                    onClick={() => navigate(route.key)}
                    disabled={active}
                    className={clsx(
                      "glass-card w-full px-4 py-3 text-left flex items-center gap-3 transition-all",
                      !active &&
                        "hover:scale-[1.01] active:scale-[0.99] cursor-pointer group",
                      active && "opacity-80 cursor-default",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        {route.label}
                        {route.hidden && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.06] text-muted-foreground/70">
                            隐藏
                          </span>
                        )}
                        {active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.08] text-foreground/70">
                            当前
                          </span>
                        )}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground/70 mt-0.5 truncate">
                        {route.key} · {route.path}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 text-foreground/25 group-hover:text-foreground/50" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground/60 text-center py-10">
            没有匹配「{query.trim()}」的页面
          </p>
        )}
      </div>

      <p className="text-[12px] text-muted-foreground/50 mt-8 text-center">
        跳转到 OOBE / 更新引导等流程页面后，标题栏会切换为对应模式
      </p>
    </div>
  );
}
