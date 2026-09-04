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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const snapshot = useResourceStore((s) => s.snapshot);
  const budgets = useResourceStore((s) => s.budgets);
  const clearFree = useResourceStore((s) => s.clearFree);
  const resetCounters = useResourceStore((s) => s.resetCounters);

  const sample = async () => {
    setHeap(readJsHeap());
    setDomNodes(document.querySelectorAll("*").length);
    try {
      const data = await getMemorySnapshot();
      setProc(data);
    } catch {
      setProc(null);
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
