import { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  FileWarning,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "@/lib/toast";
import {
  analyzeInstanceCrash,
  type CrashAnalysisResult,
  type CrashConfidence,
  type CrashFinding,
  type CrashSeverity,
} from "@/api/crash-analysis";

interface LogsTabProps {
  instancePath: string;
}

const SEVERITY_STYLE: Record<CrashSeverity, { wrap: string; icon: typeof AlertCircle; label: string }> = {
  fatal: {
    wrap: "border-destructive/40 bg-destructive/[0.06]",
    icon: AlertCircle,
    label: "致命",
  },
  error: {
    wrap: "border-amber-500/40 bg-amber-500/[0.07]",
    icon: AlertTriangle,
    label: "错误",
  },
  warning: {
    wrap: "border-border/50 bg-foreground/[0.03] dark:bg-white/[0.03]",
    icon: FileWarning,
    label: "警告",
  },
};

const CONFIDENCE_LABEL: Record<CrashConfidence, string> = { high: "高置信度", medium: "中置信度", low: "低置信度" };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function FindingCard({ finding }: { finding: CrashFinding }) {
  const style = SEVERITY_STYLE[finding.severity];
  const Icon = style.icon;
  return (
    <div className={clsx("rounded-xl border px-3.5 py-3", style.wrap)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-current opacity-80" />
        <span className="text-[13px] font-semibold text-foreground">{finding.title}</span>
        <span className="rounded bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground dark:bg-white/[0.08]">
          {style.label} · {CONFIDENCE_LABEL[finding.confidence]}
        </span>
      </div>

      {finding.evidence.length > 0 && (
        <div className="mt-2 space-y-0.5 rounded-lg bg-black/[0.04] px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground dark:bg-black/30">
          {finding.evidence.map((line, index) => (
            <p key={index} className="break-all">
              {line}
            </p>
          ))}
        </div>
      )}

      <p className="mt-2 text-[12px] leading-relaxed text-foreground/85">建议：{finding.suggestion}</p>
    </div>
  );
}

export function LogsTab({ instancePath }: LogsTabProps) {
  const [result, setResult] = useState<CrashAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTail, setShowTail] = useState(false);

  const load = useCallback(
    async (fileName?: string) => {
      setLoading(true);
      setError(null);
      try {
        setResult(await analyzeInstanceCrash(instancePath, fileName));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [instancePath]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const copySummary = () => {
    if (!result) return;
    const lines = [
      `崩溃分析：${result.source ?? "无日志"}`,
      result.summary,
      ...result.findings.map((finding) => `- [${finding.title}] ${finding.suggestion}`),
    ];
    void navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => toast.success("结论已复制"))
      .catch(() => toast.error("复制失败"));
  };

  if (loading && !result) {
    return (
      <div className="flex items-center gap-2 py-10 text-[12px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在读取日志并匹配崩溃特征…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <AlertCircle className="h-5 w-5 text-muted-foreground/40" />
        <p className="text-[12px] text-muted-foreground">崩溃分析失败</p>
        <p className="max-w-md text-center text-[11px] text-muted-foreground/60">{error}</p>
        <Button size="sm" variant="ghost" onPress={() => void load()}>
          重试
        </Button>
      </div>
    );
  }

  if (!result || result.files.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/40 py-12 dark:border-white/[0.08]">
        <ShieldCheck className="h-6 w-6 text-emerald-500/60" />
        <p className="text-[12px] text-muted-foreground">没有找到崩溃报告或日志</p>
        <p className="text-[11px] text-muted-foreground/60">实例启动过游戏后，crash-reports / logs 才会出现文件</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 顶部：结论 + 操作 */}
      <div className="rounded-xl border border-border/40 px-4 py-3 dark:border-white/[0.08]">
        <div className="flex items-start gap-2">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">{result.summary}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              分析文件：{result.source} · 耗时 {result.elapsedMs}ms · 共 {result.files.length} 个日志文件
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={() => void load(result.source ?? undefined)} isDisabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              重新分析
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onPress={copySummary}>
              <ClipboardCopy className="h-3.5 w-3.5" />
              复制结论
            </Button>
          </div>
        </div>

        {result.files.length > 1 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground/70">切换文件：</span>
            <select
              value={result.source ?? ""}
              onChange={(event) => void load(event.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border border-border/40 bg-transparent px-1.5 text-[11px] text-muted-foreground dark:border-white/[0.08]"
            >
              {result.files.map((file) => (
                <option key={file.filePath} value={file.fileName}>
                  {file.fileName} · {formatSize(file.sizeBytes)} · {formatDate(file.mtime)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 环境信息 */}
      {(result.meta.minecraftVersion ||
        result.meta.javaVersion ||
        result.meta.loader ||
        result.meta.description ||
        result.meta.causedBy ||
        result.meta.exitCode) && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl border border-border/40 px-4 py-3 text-[11px] dark:border-white/[0.08] md:grid-cols-3">
          {result.meta.minecraftVersion && <p className="text-muted-foreground">MC 版本：<span className="text-foreground">{result.meta.minecraftVersion}</span></p>}
          {result.meta.loader && <p className="text-muted-foreground">加载器：<span className="text-foreground">{result.meta.loader}</span></p>}
          {result.meta.javaVersion && <p className="text-muted-foreground">Java：<span className="text-foreground">{result.meta.javaVersion}</span></p>}
          {result.meta.memory && <p className="text-muted-foreground">内存：<span className="text-foreground">{result.meta.memory}</span></p>}
          {result.meta.exitCode && <p className="text-muted-foreground">退出码：<span className="text-foreground">{result.meta.exitCode}</span></p>}
          {result.meta.description && <p className="col-span-2 truncate text-muted-foreground md:col-span-3">描述：<span className="text-foreground">{result.meta.description}</span></p>}
        </div>
      )}

      {/* 结论列表 */}
      <div className="space-y-2">
        {result.findings.map((finding) => (
          <FindingCard key={finding.id} finding={finding} />
        ))}
      </div>

      {/* 日志尾部 */}
      <div className="rounded-xl border border-border/40 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={() => setShowTail((value) => !value)}
          className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[12px] text-muted-foreground hover:text-foreground"
        >
          <Terminal className="h-3.5 w-3.5" />
          日志尾部（最近 {result.tail.length} 行）
          {showTail ? <ChevronUp className="ml-auto h-3.5 w-3.5" /> : <ChevronDown className="ml-auto h-3.5 w-3.5" />}
        </button>
        {showTail && (
          <pre className="scroll-area max-h-72 overflow-auto border-t border-border/30 bg-black/[0.05] px-3 py-2 font-mono text-[10.5px] leading-relaxed text-muted-foreground dark:border-white/[0.05] dark:bg-black/40">
            {result.tail.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
