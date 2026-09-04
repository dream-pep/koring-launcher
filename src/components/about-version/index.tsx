// AboutVersion：展示当前版本的更新内容。
// 数据源：getReleaseNotes()（GitHub release-notes.md，主进程自动切加速源，回退最新版）。
// 不直接渲染 Markdown —— 解析后按提交类型（新增/修复/优化/重构/文档/其他）分组，
// 每组配图标，用卡片展示。
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Bug, Gauge, RefreshCw, FileText, Wrench, ExternalLink, GitCommitHorizontal } from "lucide-react";
import { getReleaseNotes, type ReleaseNotesResult } from "@/api/update";
import { VERSION } from "@/lib/version";
import { parseReleaseNotes, type ChangeType, type VersionChange } from "./parse";

const GITHUB_RELEASES = "https://github.com/dream-pep/koring-launcher/releases";

const CATEGORY_ORDER: ChangeType[] = ["feat", "fix", "perf", "refactor", "docs", "other"];

const CATEGORY_META: Record<ChangeType, { label: string; icon: React.ComponentType<{ className?: string }>; iconCls: string; dotCls: string }> = {
  feat: { label: "新增功能", icon: Sparkles, iconCls: "text-sky-600 dark:text-sky-400 bg-sky-500/10", dotCls: "bg-sky-500" },
  fix: { label: "修复", icon: Bug, iconCls: "text-red-600 dark:text-red-400 bg-red-500/10", dotCls: "bg-red-500" },
  perf: { label: "性能优化", icon: Gauge, iconCls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10", dotCls: "bg-emerald-500" },
  refactor: { label: "重构", icon: RefreshCw, iconCls: "text-violet-600 dark:text-violet-400 bg-violet-500/10", dotCls: "bg-violet-500" },
  docs: { label: "文档", icon: FileText, iconCls: "text-amber-600 dark:text-amber-400 bg-amber-500/10", dotCls: "bg-amber-500" },
  other: { label: "其他", icon: Wrench, iconCls: "text-foreground/60 bg-foreground/[0.06]", dotCls: "bg-foreground/40" },
};

/** 一条变更（含 commit 标）+ 短分隔条 */
function ChangeItem({ change }: { change: VersionChange }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5 first:pt-3 last:pb-3">
      {change.commit && (
        <span className="inline-flex items-center gap-1 shrink-0 mt-[3px] font-mono text-[10px] px-1.5 py-0.5 rounded bg-foreground/[0.05] dark:bg-white/[0.05] text-muted-foreground/80">
          <GitCommitHorizontal className="w-3 h-3" />
          {change.commit}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-foreground leading-snug">{change.title}</p>
        {change.description && (
          <p className="text-[12px] text-muted-foreground/80 leading-relaxed mt-0.5">{change.description}</p>
        )}
      </div>
    </div>
  );
}

/** 一个分类卡片：图标头部 + 该类型的变更列表 */
function CategoryCard({ type, items }: { type: ChangeType; items: VersionChange[] }) {
  const meta = CATEGORY_META[type];
  const Icon = meta.icon;
  return (
    <div className="rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.07] bg-white/85 dark:bg-black/45 backdrop-blur-[12px]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/[0.05] dark:border-white/[0.06]">
        <span className={`flex items-center justify-center w-6 h-6 rounded-md ${meta.iconCls}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-foreground">{meta.label}</span>
        <span className="text-[11px] text-muted-foreground/60 ml-auto tabular-nums">{items.length} 项</span>
      </div>
      <div className="divide-y divide-black/[0.04] dark:divide-white/[0.05]">
        {items.map((c, i) => (
          <ChangeItem key={`${c.commit ?? ""}-${i}`} change={c} />
        ))}
      </div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] dark:border-white/[0.07] bg-white/85 dark:bg-black/45 backdrop-blur-[12px] px-5 py-10 text-center">
      <p className="text-[13px] text-muted-foreground">{text}</p>
    </div>
  );
}

export function AboutVersion({ className }: { className?: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReleaseNotesResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getReleaseNotes();
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const parsed = result ? parseReleaseNotes(result.notes, result.version, result.tag) : null;

  const grouped = parsed
    ? CATEGORY_ORDER.map((t) => ({ type: t, items: parsed.changes.filter((c) => c.type === t) })).filter(
        (g) => g.items.length > 0,
      )
    : [];

  return (
    <div className={className}>
      {/* 头部：版本 + 来源 */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[12px] text-muted-foreground/80">
          {parsed ? (
            <>
              版本 v{parsed.version}
              {result?.isLatest && parsed.version !== VERSION && (
                <span className="ml-2 opacity-70">（当前版本暂无说明，展示最新版本内容）</span>
              )}
            </>
          ) : (
            <>版本 v{VERSION}</>
          )}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] rounded-xl bg-white/50 dark:bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <EmptyCard text="获取此版本的更新内容失败" />
      ) : !result || !parsed ? (
        <EmptyCard text="未能获取到发布说明（GitHub 与加速源均不可用，或该版本尚未发布）" />
      ) : (
        <div className="space-y-2.5">
          {parsed.noCommits && parsed.changes.length === 0 ? (
            <EmptyCard text="此版本暂无变更记录" />
          ) : grouped.length === 0 ? (
            <EmptyCard text="此版本暂无变更记录" />
          ) : (
            grouped.map((g) => <CategoryCard key={g.type} type={g.type} items={g.items} />)
          )}
        </div>
      )}

      {/* 底部操作 */}
      <div className="flex items-center gap-2 mt-3 px-1">
        {error && (
          <>
            <p className="text-[11px] text-destructive/80 flex-1 truncate">{error}</p>
            <button
              onClick={load}
              className="text-[12px] font-medium text-primary hover:underline shrink-0"
            >
              重试
            </button>
          </>
        )}
        <button
          onClick={() => window.electronAPI?.openExternal(GITHUB_RELEASES)}
          className="inline-flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors ml-auto shrink-0"
        >
          查看 GitHub Releases
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
