import { useCallback, useEffect, useState } from "react";
import { VersionCard } from "@/components/VersionCard";
import { AboutVersion } from "@/components/about-version";
import { SectionTitle, SettingCard } from "@/components/setting";
import { Progress } from "@/components/ui/progress";
import { BUILD_MODE } from "@/lib/mode";
import {
  cancelUpdate,
  checkForUpdates,
  downloadUpdate,
  getReleaseNotes,
  getUpdateState,
  onUpdateStatus,
  pauseUpdate,
  quitAndInstall,
  resumeUpdate,
  type ReleaseNotesResult,
  type UpdateStatusPayload,
} from "@/api/update";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Button, Link } from "@heroui/react";
import { toast } from "sonner";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

const GITHUB_RELEASES = "https://github.com/dream-pep/koring-launcher/releases";

/** 主按钮颜色随构建模式：dev 橙 / beta 绿 / run 蓝（与 VersionCard 一致） */
const MODE_BUTTON_COLORS: Record<string, { bg: string; hover: string }> = {
  dev: { bg: "#F59E0B", hover: "#D97706" },
  beta: { bg: "#10B981", hover: "#059669" },
  run: { bg: "#3b82f6", hover: "#2563eb" },
};

const modeColors = MODE_BUTTON_COLORS[BUILD_MODE] ?? MODE_BUTTON_COLORS.run;

/** 主题 accent 为灰色系，内联覆盖按钮 CSS 变量 */
const BUTTON_STYLE = {
  "--button-bg": modeColors.bg,
  "--button-bg-hover": modeColors.hover,
  "--button-bg-pressed": modeColors.hover,
  "--button-fg": "#ffffff",
} as React.CSSProperties;

function formatMB(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 更新日志（独立页面，不走设置 layout）：
 * - 顶栏由路由切换为「返回 + 更新日志」（routeStore 的 titleInBar）
 * - 顶部 VersionCard（无按钮；更新操作由页面底部遮罩负责）
 * - 发布说明：默认当前版本；检测到可用更新后自动切到最新版本
 * - 底部遮罩：检查更新 → 下载（进度条 + 暂停/继续/取消）→ 安装更新
 * - 下载/安装进度由主进程写入 Koring.yml（update 段）
 */
export function UpdatePage() {
  // 发布说明：notesTag 为空 = 当前版本；有可用更新后切到对应 tag
  const [notes, setNotes] = useState<ReleaseNotesResult | null>(null);
  const [notesLoading, setNotesLoading] = useState(true);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesTag, setNotesTag] = useState<string | undefined>(undefined);

  // 更新状态：事件驱动，主进程为唯一真相源
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);

  useEffect(() => {
    const unsub = onUpdateStatus(setStatus);
    getUpdateState().then(setStatus).catch(() => {});
    return unsub;
  }, []);

  const loadNotes = useCallback(async (tag?: string) => {
    setNotesLoading(true);
    setNotesError(null);
    try {
      setNotes(await getReleaseNotes(tag));
    } catch (e) {
      setNotesError(e instanceof Error ? e.message : String(e));
    } finally {
      setNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes(notesTag);
  }, [notesTag, loadNotes]);

  // 检测到可用更新 → 发布说明切到最新版本（退出重进自动回到当前版本）
  useEffect(() => {
    if (status?.state === "available" && status.version && notesTag !== `v${status.version}`) {
      setNotesTag(`v${status.version}`);
    }
  }, [status, notesTag]);

  const st = status?.state ?? "idle";
  const pct = status?.percent ?? 0;
  const isDownloading = st === "downloading";
  const isPaused = st === "paused";

  // 底部遮罩滚动感知：向下滚动（阅读发布说明）自动收起，向上滚动/回顶恢复。
  // 下载/暂停/安装/检查等需要常驻进度条的状态下始终显示。
  const [barVisible, setBarVisible] = useState(true);
  useEffect(() => {
    const el = document.getElementById("app-content-scroll");
    if (!el) return;
    const busy = st === "downloading" || st === "paused" || st === "installing" || st === "checking";
    let lastY = el.scrollTop;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = el.scrollTop;
        const delta = y - lastY;
        if (busy) {
          setBarVisible(true);
        } else if (delta > 16 && y > 160) {
          setBarVisible(false);
        } else if (delta < -16 || y < 80) {
          setBarVisible(true);
        }
        lastY = y;
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [st]);

  const handleCheck = async () => {
    try {
      await checkForUpdates(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDownload = async () => {
    try {
      await downloadUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handlePause = async () => {
    try {
      await pauseUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleResume = async () => {
    try {
      await resumeUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCancel = async () => {
    try {
      await cancelUpdate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const handleInstall = async () => {
    try {
      await quitAndInstall();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const openGithub = () => {
    window.electronAPI?.openExternal(GITHUB_RELEASES);
  };

  const primaryAction =
    st === "available" ? handleDownload : st === "downloaded" ? handleInstall : handleCheck;

  const statusText =
    st === "checking"
      ? "正在检查更新..."
      : st === "available"
        ? `发现新版本 v${status?.version}`
        : st === "downloading"
          ? `正在下载 ${pct.toFixed(0)}% · ${formatMB(status?.transferred)} / ${formatMB(status?.total)}${status?.bytesPerSecond ? ` · ${formatMB(status.bytesPerSecond)}/s` : ""}`
          : st === "paused"
            ? `下载已暂停（${pct.toFixed(0)}%）`
            : st === "downloaded"
              ? status?.verified
                ? "更新已下载完成（安装包已核验，点击安装）"
                : "版本校验异常：可能是文件损坏或被替换，点击安装将弹出确认框"
              : st === "installing"
                ? "正在安装更新，应用即将重启..."
                : st === "error"
                  ? `更新失败：${status?.error ?? "未知错误"}`
                  : "";

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 pb-44">
      <div className="space-y-6">
        <VersionCard />

        {/* 版本卡片下方：当前版本更新内容速览（分类卡片） */}
        <AboutVersion />

        <div>
          <SectionTitle>更新内容</SectionTitle>

          {notesLoading ? (
            <SettingCard>
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                正在获取发布说明...
              </div>
            </SettingCard>
          ) : notesError ? (
            <SettingCard>
              <div className="py-6 text-center space-y-3">
                <p className="text-[13px] text-destructive">获取发布说明失败：{notesError}</p>
                <Button size="sm" variant="outline" onClick={() => loadNotes(notesTag)}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  重试
                </Button>
              </div>
            </SettingCard>
          ) : notes ? (
            <SettingCard>
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[12px] text-muted-foreground">
                  版本 v{notes.version}
                  {notesTag ? "（最新）" : "（当前）"}
                  <span className="ml-2 opacity-70">
                    · 来源：{notes.source === "github" ? "GitHub" : `加速源 ${notes.source}`}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => loadNotes(notesTag)}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  刷新
                </Button>
              </div>

              <div className="text-[13.5px] leading-relaxed text-foreground/80 space-y-3 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_a]:text-primary [&_a]:underline underline-offset-2 [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_pre]:bg-foreground/5 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_details]:border [&_details]:border-border/50 [&_details]:rounded-lg [&_details]:px-3 [&_details]:py-2 [&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-foreground [&_hr]:border-border/40 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {notes.notes}
                </ReactMarkdown>
              </div>
            </SettingCard>
          ) : (
            <SettingCard>
              <div className="py-6 text-center space-y-3">
                <p className="text-[13px] text-muted-foreground">
                  未获取到发布说明（GitHub 与加速源均不可用，或该版本尚未发布）
                </p>
                <Link onPress={openGithub} className="text-[13px]">
                  打开 GitHub Releases
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </SettingCard>
          )}
        </div>
      </div>

      {/* 底部遮罩：fixed 吸附底部，样式与顶栏一致；驱动整个更新流程。
          阅读时向下滚动自动收起（translate-y-full），向上滚动/回顶恢复 */}
      <div
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-20 transition-transform duration-300",
          barVisible ? "translate-y-0" : "translate-y-full",
        )}
        style={{
          background: "var(--titlebar-bg)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          borderTop: "1px solid var(--titlebar-border)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 py-3 space-y-2">
          {statusText && (
            <div className="text-center text-[13px] text-muted-foreground truncate">{statusText}</div>
          )}

          {isDownloading || isPaused ? (
            <div className="space-y-2">
              <Progress
                value={pct}
                className="w-full [&_[data-slot='progress-indicator']]:bg-blue-500"
              />
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  fullWidth
                  style={BUTTON_STYLE}
                  onPress={isPaused ? handleResume : handlePause}
                >
                  {isPaused ? "继续下载" : "暂停下载"}
                </Button>
                <Button size="sm" variant="outline" fullWidth onPress={handleCancel}>
                  取消下载
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="primary"
              fullWidth
              style={BUTTON_STYLE}
              isDisabled={st === "checking" || st === "installing"}
              onPress={primaryAction}
            >
              {st === "checking" && (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  检查中...
                </>
              )}
              {st === "available" && "下载版本更新"}
              {st === "downloaded" && "安装更新"}
              {st === "installing" && "安装中..."}
              {st === "error" && "重试"}
              {st === "not-available" && "已经是最新版"}
              {st === "idle" && "检查更新"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
