//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useEffect, useMemo, useState } from "react";
import { Accordion, Button, Card, Input, Skeleton } from "@heroui/react";
import { Box, Search, ChevronDown, Plus, Sparkles, Beaker, RotateCcw } from "lucide-react";
import { getMinecraftVersionList, type VersionEntry, type VersionListResult } from "@/api/instance";
import { InstallDialog } from "./InstallDialog";
import clsx from "clsx";

// 版本类型分组标签
type VersionGroup = "release" | "snapshot" | "aprilfool";

// 版本号降序
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// 判断是否为愚人节版（如 3D Shareware v1.34、Love and Hugs、One Block、20w14∞ 等）
function isAprilFool(v: VersionEntry): boolean {
  const known = ["3D Shareware v1.34", "Love and Hugs Update", "One Block at a Time Update",
    "1.RV-Pre1", "15w14a", "2.0", "Java Edition 2.0", "20w14∞", "20w14infinite", "23w13a_or_b"];
  if (known.some((k) => v.id === k || v.id.toLowerCase().includes(k.toLowerCase()))) return true;
  // 负更新三叉戟版
  if (v.id.match(/^(?:1\.RV|2\.0|20w14|23w13a)/)) return true;
  return false;
}

// 格式化发布时间
function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// 折叠面板分组配置
const GROUPS: { group: VersionGroup; label: string; icon: React.ReactNode }[] = [
  { group: "release", label: "正式版", icon: <Sparkles className="w-4 h-4" /> },
  { group: "snapshot", label: "预览版", icon: <Beaker className="w-4 h-4" /> },
  { group: "aprilfool", label: "愚人节版", icon: <RotateCcw className="w-4 h-4" /> },
];

export function GameVersionView() {
  const [data, setData] = useState<VersionListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [installVersion, setInstallVersion] = useState<string | null>(null);

  // 折叠面板展开状态（默认展开正式版，可多选）
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set(["release"]));

  // 加载版本清单
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMinecraftVersionList()
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // 分组
  const { latestRelease, latestSnapshot, releaseVersions, snapshotVersions, aprilFoolVersions, allFiltered } = useMemo(() => {
    if (!data) return { latestRelease: null, latestSnapshot: null, releaseVersions: [] as VersionEntry[], snapshotVersions: [] as VersionEntry[], aprilFoolVersions: [] as VersionEntry[], allFiltered: [] as VersionEntry[] };
    const { versions, latest } = data;

    const filtered = query
      ? versions.filter((v) => v.id.toLowerCase().includes(query.toLowerCase()))
      : versions;

    const latestRel = versions.find((v) => v.id === latest.release) ?? null;
    const latestSnap = versions.find((v) => v.id === latest.snapshot) ?? null;

    const releases = filtered.filter((v) => v.type === "release" && !isAprilFool(v)).sort((a, b) => compareVersions(a.id, b.id));
    const snapshots = filtered.filter((v) => v.type === "snapshot" && !isAprilFool(v)).sort((a, b) => compareVersions(a.id, b.id));
    const aprilFools = filtered.filter((v) => isAprilFool(v)).sort((a, b) => compareVersions(a.id, b.id));

    // 全部合并（去重后用于搜索匹配）
    const seen = new Set<string>();
    const all: VersionEntry[] = [];
    const add = (arr: VersionEntry[]) => { for (const v of arr) { if (!seen.has(v.id)) { seen.add(v.id); all.push(v); } } };
    add([latestRel, latestSnap].filter(Boolean) as VersionEntry[]);
    add(releases);
    const restSnapshots = snapshots.filter((s) => s.id !== latest.snapshot);
    add(restSnapshots);

    return {
      latestRelease: latestRel,
      latestSnapshot: latestSnap,
      releaseVersions: releases,
      snapshotVersions: restSnapshots, // 排除最新预览版（已在顶部卡片展示）
      aprilFoolVersions: aprilFools,
      allFiltered: all,
    };
  }, [data, query]);

  // 各分组对应的版本列表
  const groupVersions: Record<VersionGroup, VersionEntry[]> = {
    release: releaseVersions,
    snapshot: snapshotVersions,
    aprilfool: aprilFoolVersions,
  };

  return (
    <div className="min-h-full setting-page-enter">
      {/* 顶部搜索框（无标题） */}
      <div className="relative w-full mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground/50 z-10 pointer-events-none" />
        <Input
          fullWidth
          className="h-10 pl-10 pr-4 rounded-xl w-full"
          placeholder="搜索 Minecraft 版本..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-48 w-full rounded-2xl" />
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </div>
      ) : !data ? (
        <div className="flex flex-col items-center gap-3 py-24">
          <Box className="w-8 h-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">无法获取版本列表</p>
        </div>
      ) : query ? (
        /* 搜索模式：直接展示匹配的结果列表 */
        <div className="flex flex-col gap-2">
          {allFiltered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">未找到与「{query}」匹配的版本</div>
          ) : (
            allFiltered.map((v, i) => (
              <VersionRow key={v.id} entry={v} index={i} onClick={() => setInstallVersion(v.id)} />
            ))
          )}
        </div>
      ) : (
        /* 默认模式：最新版本卡片 + 折叠面板 */
        <>
          {/* 最新版本卡片 */}
          <TopVersionCard
            label="最新正式版"
            icon={<Sparkles className="w-4.5 h-4.5" />}
            version={latestRelease}
            onClick={() => latestRelease && setInstallVersion(latestRelease.id)}
          />
          <TopVersionCard
            label="最新预览版"
            icon={<Beaker className="w-4.5 h-4.5" />}
            version={latestSnapshot}
            className="mt-3"
            onClick={() => latestSnapshot && setInstallVersion(latestSnapshot.id)}
          />

          {/* 折叠面板（HeroUI Accordion，默认展开正式版） */}
          <Accordion
            hideSeparator
            allowsMultipleExpanded
            expandedKeys={expandedKeys}
            onExpandedChange={(keys) => setExpandedKeys(new Set(keys as Set<string>))}
            className="mt-6 flex flex-col gap-3"
          >
            {GROUPS.map(({ group, label, icon }) => {
              const versions = groupVersions[group];
              return (
                <Accordion.Item
                  key={group}
                  id={group}
                  className="rounded-2xl border border-border/30 dark:border-white/[0.07] bg-white/60 dark:bg-black/25 overflow-hidden"
                >
                  <Accordion.Heading>
                    <Accordion.Trigger className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-foreground/[0.02]">
                      <span className="text-muted-foreground/60">{icon}</span>
                      <span className="flex-1 text-[13.5px] font-medium text-foreground">
                        {label}（{versions.length}）
                      </span>
                      <Accordion.Indicator>
                        <ChevronDown className="w-4 h-4 text-muted-foreground/50 transition-transform duration-200 data-[expanded]:rotate-180" />
                      </Accordion.Indicator>
                    </Accordion.Trigger>
                  </Accordion.Heading>
                  <Accordion.Panel>
                    {versions.length === 0 ? (
                      <p className="text-[12px] text-muted-foreground/60 px-4 pb-3">暂无此分类的版本</p>
                    ) : (
                      <Accordion.Body className="flex flex-col gap-1.5 px-2 pb-3">
                        {versions.map((v, i) => (
                          <VersionRow key={v.id} entry={v} index={i} onClick={() => setInstallVersion(v.id)} />
                        ))}
                      </Accordion.Body>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              );
            })}
          </Accordion>
        </>
      )}

      {/* 安装弹窗 */}
      <InstallDialog
        versionId={installVersion}
        onClose={() => setInstallVersion(null)}
      />
    </div>
  );
}

// 顶部版本信息卡片：显示最新正式版 / 预览版
function TopVersionCard({
  label, icon, version, className, onClick,
}: {
  label: string; icon: React.ReactNode; version: VersionEntry | null; className?: string; onClick: () => void;
}) {
  return (
    <Card.Root
      onClick={onClick}
      className={clsx(
        "setting-page-enter group relative flex flex-row items-center gap-5 px-5 py-4 rounded-2xl transition-all duration-150 cursor-pointer",
        "bg-gradient-to-br from-primary/[0.08] via-white/80 to-white/60",
        "dark:from-primary/[0.15] dark:via-black/50 dark:to-black/35",
        "border border-primary/15 dark:border-primary/20",
        "hover:shadow-lg hover:border-primary/30",
        className,
      )}
    >
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
        {version ? (
          <>
            <p className="text-[17px] font-bold text-foreground font-mono mt-0.5">{version.id}</p>
            <p className="text-[11.5px] text-muted-foreground/70 mt-0.5">发布于 {formatTime(version.releaseTime)}</p>
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground/60 mt-1">暂未获取到版本</p>
        )}
      </div>
      {/* HeroUI Button 会拦截 click 冒泡，必须用 onPress 触发 */}
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 bg-primary/10 text-primary hover:bg-primary/20"
        onPress={onClick}
      >
        <Plus className="w-3.5 h-3.5" />
        安装
      </Button>
    </Card.Root>
  );
}

// 单行版本项
function VersionRow({ entry, index = 0, onClick }: { entry: VersionEntry; index?: number; onClick: () => void }) {
  return (
    <Card.Root
      onClick={onClick}
      style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
      className="setting-page-enter group flex flex-row items-center gap-4 px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer
        bg-white/70 dark:bg-black/30 border border-border/30 dark:border-white/[0.06]
        hover:border-primary/25 hover:bg-foreground/[0.02]"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-semibold text-foreground font-mono">{entry.id}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
            {entry.type === "release" ? "正式版" : entry.type === "snapshot" ? "预览版" : entry.type}
          </span>
        </div>
        <p className="text-[11.5px] text-muted-foreground/70 mt-0.5">
          发布于 {formatTime(entry.releaseTime)}
        </p>
      </div>
      {/* HeroUI Button 会拦截 click 冒泡，必须用 onPress 触发 */}
      <Button
        size="sm"
        variant="secondary"
        className="shrink-0 h-7 text-[12px] bg-primary/8 text-primary hover:bg-primary/15 opacity-0 group-hover:opacity-100"
        onPress={onClick}
      >
        <Plus className="w-3 h-3" />
        安装
      </Button>
    </Card.Root>
  );
}
