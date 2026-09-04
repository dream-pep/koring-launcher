import { useEffect, useRef, useState } from "react";
import { RefreshCw, Eraser, RotateCcw } from "lucide-react";
import { GlassCard, PageHeader, SettingRow } from "./components";
import { getMemorySnapshot, type ProcessMemoryMetric, type SystemMemorySnapshot } from "@/api/system";
import { useResourceStore } from "@/resources/store";
import type { ResourceKind } from "@/resources/types";

interface JsHeapInfo {
  used: number; // bytes
  total: number; // bytes
  limit: number; // bytes
}

function readJsHeap(): JsHeapInfo | null {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!m) return null;
  return { used: m.usedJSHeapSize, total: m.totalJSHeapSize, limit: m.jsHeapSizeLimit };
}

const fmtMB = (bytes: number, fraction = 1): string => `${(bytes / 1024 / 1024).toFixed(fraction)} MB`;

const KIND_LABELS: Record<ResourceKind, string> = {
  background: "背景图",
  image: "图片/图标",
  blob: "Blob",
  text: "文本",
};

export function ResourceDebug() {
  const [proc, setProc] = useState<SystemMemorySnapshot | null>(null);
  const [heap, setHeap] = useState<JsHeapInfo | null>(null);
  const [domNodes, setDomNodes] = useState(0);
  const [logInfo, setLogInfo] = useState<{ filePath: string | null; debugMode: boolean } | null>(null);
  const [hitInfo, setHitInfo] = useState<string[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const snapshot = useResourceStore((s) => s.snapshot);
  const budgets = useResourceStore((s) => s.budgets);
  const clearFree = useResourceStore((s) => s.clearFree);
  const resetCounters = useResourceStore((s) => s.resetCounters);

  /** 诊断「控件无法点击」：找出全屏覆盖且 pointer-events≠none 的元素，并采样几个点位的最上层元素 */
  const runHitTest = () => {
    const lines: string[] = [];
    const all = document.querySelectorAll<HTMLElement>("body *");
    // 1) 疑似全屏拦截层
    const seen = new Set<HTMLElement>();
    all.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const covers =
        rect.width >= window.innerWidth * 0.97 && rect.height >= window.innerHeight * 0.97;
      const clickable = cs.pointerEvents !== "none";
      if (!covers || !clickable || seen.has(el)) return;
      seen.add(el);
      const tag = el.tagName.toLowerCase();
      lines.push(
        `[全屏可点] <${tag}${el.id ? `#${el.id}` : ""}> pos=${cs.position} z=${cs.zIndex} class="${String(el.className).slice(0, 120)}"`,
      );
    });
    // 2) 采样几个位置的最上层元素
    const points: Array<[number, number, string]> = [
      [0.5, 0.5, "中央"],
      [0.5, 0.12, "标题栏下沿"],
      [0.25, 0.6, "内容区"],
      [0.75, 0.85, "内容区右下"],
    ];
    for (const [fx, fy, label] of points) {
      const el = document.elementFromPoint(Math.floor(innerWidth * fx), Math.floor(innerHeight * fy));
      if (!el || el === document.body) {
        lines.push(`[${label}] (${fx},${fy}) → 无元素/body`);
        continue;
      }
      const target = el as HTMLElement;
      const cs = getComputedStyle(target);
      const chain: string[] = [];
      let node: HTMLElement | null = target;
      for (let i = 0; node && i < 5; i++) {
        chain.push(
          `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${node.className ? `.${String(node.className).split(/\s+/).filter(Boolean).slice(0, 2).join(".")}` : ""}`,
        );
        node = node.parentElement;
      }
      lines.push(`[${label}] (${fx},${fy}) → ${chain.join(" < ")} | pe=${cs.pointerEvents}`);
    }
    if (lines.length === 0) lines.push("未发现明显拦截层（可再多点几个位置）");
    setHitInfo(lines);
  };

  const sample = async () => {
    setHeap(readJsHeap());
    setDomNodes(document.querySelectorAll("*").length);
    try {
      const data = await getMemorySnapshot();
      setProc(data);
    } catch {
      setProc(null);
    }
    try {
      const info = (await window.electronAPI?.invoke?.("log:getInfo")) as
        | { filePath: string | null; debugMode: boolean }
        | undefined;
      if (info) setLogInfo(info);
    } catch {
      // 忽略日志状态查询失败
    }
  };

  useEffect(() => {
    sample();
    timerRef.current = setInterval(sample, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byKind = snapshot.stats.byKind;
  const kinds = Object.keys(KIND_LABELS) as ResourceKind[];
  const processes = [...(proc?.metrics ?? [])].sort((a, b) => b.workingSetSize - a.workingSetSize);

  return (
    <div className="max-w-3xl mx-auto p-8">
      <PageHeader
        title="资源与内存"
        desc="启动器程序本体资源/内存监控（仅调试页可见）：JS 堆、进程工作集、资源注册表占用"
      />

      <div className="space-y-6">
        {/* 渲染进程堆 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            渲染进程 JS 堆（约 1s 采样）
          </h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="flex flex-wrap gap-x-8 gap-y-2">
                <div>
                  <p className="text-[12px] text-muted-foreground">已用堆</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {heap ? fmtMB(heap.used) : "不可用"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">堆上限</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {heap ? fmtMB(heap.limit) : "不可用"}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">DOM 节点</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{domNodes}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">采样时间</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {proc ? new Date(proc.timestamp).toLocaleTimeString() : "--"}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* 统一日志状态 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            统一日志（debug 模式才写文件，否则仅控制台）
          </h3>
          <GlassCard>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div>
                <p className="text-[12px] text-muted-foreground">调试模式</p>
                <p className="text-lg font-semibold text-foreground">
                  {logInfo?.debugMode ? "开启" : "关闭"}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">日志文件</p>
                <p className="text-sm font-medium text-foreground break-all">
                  {logInfo?.filePath ?? "（未开启 → 仅输出到控制台）"}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-muted-foreground">开启入口</p>
                <p className="text-sm font-medium text-foreground">设置 → 游戏 → 高级 → 调试模式</p>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* 点击拦截诊断 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            点击拦截诊断（控件点了没反应时使用）
          </h3>
          <GlassCard>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[13px] text-muted-foreground">
                找出「覆盖全屏且可接收指针」的元素，并采样 4 个点位的最上层元素
              </p>
              <button
                onClick={runHitTest}
                className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                检测
              </button>
            </div>
            {hitInfo && (
              <pre className="max-h-56 overflow-auto rounded-md bg-foreground/[0.04] p-3 text-[12px] leading-relaxed font-mono whitespace-pre-wrap text-foreground/80">
                {hitInfo.join("\n")}
              </pre>
            )}
          </GlassCard>
        </div>

        {/* 进程工作集 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            Electron 进程工作集（主进程返回，KB）
          </h3>
          <GlassCard>
            {proc === null ? (
              <p className="text-[13px] text-muted-foreground">主进程不可达（非 Electron 环境）</p>
            ) : processes.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">暂无进程数据</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-muted-foreground/70">
                      <th className="py-1 pr-4 font-medium">进程</th>
                      <th className="py-1 pr-4 font-medium text-right">PID</th>
                      <th className="py-1 pr-4 font-medium text-right">工作集</th>
                      <th className="py-1 font-medium text-right">峰值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {processes.map((p: ProcessMemoryMetric) => (
                      <tr key={`${p.type}-${p.pid}`} className="border-t border-foreground/5">
                        <td className="py-1.5 pr-4 text-foreground">{p.type}</td>
                        <td className="py-1.5 pr-4 text-right text-muted-foreground tabular-nums">{p.pid}</td>
                        <td className="py-1.5 pr-4 text-right tabular-nums">{fmtMB(p.workingSetSize * 1024)}</td>
                        <td className="py-1.5 text-right text-muted-foreground tabular-nums">
                          {fmtMB(p.peakWorkingSetSize * 1024)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        {/* 资源注册表 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            资源注册表（background:current:* = 当前背景 dataURL 估算）
          </h3>
          <div className="space-y-3">
            <GlassCard>
              <div className="flex flex-wrap gap-x-8 gap-y-2 mb-3">
                <div>
                  <p className="text-[12px] text-muted-foreground">缓存条目</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{snapshot.stats.entries}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">估算占用</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{fmtMB(snapshot.stats.totalBytes)}</p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">命中 / 未命中</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">
                    {snapshot.stats.hits} / {snapshot.stats.misses}
                  </p>
                </div>
                <div>
                  <p className="text-[12px] text-muted-foreground">LRU 逐出</p>
                  <p className="text-lg font-semibold text-foreground tabular-nums">{snapshot.stats.evictions}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {kinds.map((kind) => {
                  const group = byKind[kind];
                  return (
                    <span
                      key={kind}
                      className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 px-3 py-1 text-[12px]"
                    >
                      <span className="text-muted-foreground">{KIND_LABELS[kind]}</span>
                      <span className="tabular-nums font-medium">
                        {group ? `${group.count} / ${fmtMB(group.bytes)}` : "0 / 0 MB"}
                      </span>
                      <span className="text-muted-foreground/50">预算 {fmtMB(budgets[kind])}</span>
                    </span>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[13px] font-medium text-foreground">条目明细（按估算字节降序）</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => useResourceStore.getState().refresh()}
                    className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    刷新
                  </button>
                  <button
                    onClick={clearFree}
                    className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Eraser className="w-3 h-3" />
                    释放缓存
                  </button>
                  <button
                    onClick={resetCounters}
                    className="inline-flex items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    重置计数
                  </button>
                </div>
              </div>
              {snapshot.entries.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">暂无缓存条目（自定义背景图生效后此处可见 background:current:*）</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-muted-foreground/70">
                        <th className="py-1 pr-4 font-medium">Key</th>
                        <th className="py-1 pr-4 font-medium">类型</th>
                        <th className="py-1 pr-4 font-medium text-right">估算</th>
                        <th className="py-1 font-medium text-right">引用</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.entries.slice(0, 40).map((e) => (
                        <tr key={e.key} className="border-t border-foreground/5">
                          <td className="py-1.5 pr-4 font-mono text-[12px] text-foreground/80 max-w-[420px] truncate">
                            {e.key}
                          </td>
                          <td className="py-1.5 pr-4 text-muted-foreground">{KIND_LABELS[e.kind] ?? e.kind}</td>
                          <td className="py-1.5 pr-4 text-right tabular-nums">{fmtMB(e.bytes)}</td>
                          <td className="py-1.5 text-right tabular-nums">{e.refs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          </div>
        </div>

        <GlassCard>
          <SettingRow
            label="优化效果验证指引"
            desc="在首页空闲时记录 JS 堆与进程工作集 → 在设置里选择一张 ≥3MB 的大图作背景 → 观察 background:current 估算字节与 JS 堆；窗口最小化 Silk 动画停帧（GPU 占用回落）。"
          >
            <span aria-hidden="true" />
          </SettingRow>
        </GlassCard>
      </div>
    </div>
  );
}
