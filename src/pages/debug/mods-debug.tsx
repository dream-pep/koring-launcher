//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { useConfigStore } from "@/stores/configStore";
import { searchMods, installMod, type ModSearchResult, type ModSearchIndex } from "@/api/mods";
import { GlassCard, SettingRow, PageHeader } from "./components";
import { Search, Download, Loader2 } from "lucide-react";

// 排序选项
const indexOptions: { key: ModSearchIndex; label: string }[] = [
  { key: "relevance", label: "相关度" },
  { key: "downloads", label: "下载量" },
  { key: "newest", label: "最新" },
];

// 分组小标题
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

// 下载量格式化
function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ModsDebug() {
  const gameDir = useConfigStore((s) => s.config.game.gameDir);

  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<ModSearchIndex>("relevance");
  const [results, setResults] = useState<ModSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);

  // 搜索 Modrinth
  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await searchMods(
        query.trim() || undefined,
        undefined,
        undefined,
        undefined,
        "mod",
        12,
        0,
        "modrinth",
        index,
      );
      setResults(res.hits);
      toast.success(`找到 ${res.hits.length} 个结果（共 ${res.total}）`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  };

  // 安装到游戏目录
  const handleInstall = async (project: ModSearchResult) => {
    setInstalling(project.id);
    try {
      const result = await installMod(project.id, undefined, gameDir, "modrinth");
      toast.success(`已安装：${result.filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setInstalling(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="资源搜索调试" desc="测试 Modrinth 搜索与模组安装到游戏目录" />

      <div className="space-y-6">
        {/* 搜索条件 */}
        <div>
          <GroupTitle>搜索条件</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="搜索关键词（如 sodium、iris；留空浏览热门）"
                    disabled={searching}
                    className="flex-1 min-w-0 rounded-lg border border-border/50 dark:border-white/[0.08] bg-white/60 dark:bg-black/30 px-3 py-1.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 transition-colors"
                  />
                  <Button size="sm" variant="default" onClick={handleSearch} disabled={searching}>
                    {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    搜索
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-muted-foreground/70">排序</span>
                  {indexOptions.map((o) => (
                    <Button
                      key={o.key}
                      size="sm"
                      variant={index === o.key ? "default" : "outline"}
                      onClick={() => setIndex(o.key)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
                <p className="text-[11.5px] text-muted-foreground/60">
                  安装目标：{gameDir || "未配置游戏目录"}
                </p>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* 搜索结果 */}
        <div>
          <GroupTitle>搜索结果（{results.length}）</GroupTitle>
          <div className="space-y-3">
            {results.length === 0 ? (
              <GlassCard>
                <p className="text-[13px] text-muted-foreground py-1">暂无结果，先执行一次搜索</p>
              </GlassCard>
            ) : (
              results.map((r) => (
                <GlassCard key={r.id}>
                  <SettingRow
                    label={r.name}
                    desc={`${formatDownloads(r.downloads)} 次下载${r.categories?.length ? ` · ${r.categories.slice(0, 3).join(" / ")}` : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      {r.latestVersion && (
                        <Badge variant="outline" className="font-mono">
                          {r.latestVersion}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInstall(r)}
                        disabled={installing !== null || !gameDir}
                      >
                        {installing === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        安装
                      </Button>
                    </div>
                  </SettingRow>
                </GlassCard>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
