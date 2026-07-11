import { useState } from "react";
import { AlertTriangle, TestTube, RotateCcw, Copy, Trash2 } from "lucide-react";

export function CrashDebug() {
  const [log, setLog] = useState("");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");

  const handleSimulateCrash = async () => {
    setStatus("正在模拟崩溃...");
    await window.electronAPI?.simulateCrash();
  };

  const handleTestDialog = async () => {
    setStatus("正在打开崩溃弹窗...");
    await window.electronAPI?.testCrashDialog();
    setStatus("崩溃弹窗已打开");
  };

  const handleReadLog = async () => {
    const result = await window.electronAPI?.invoke("crash:readLog") as string;
    setLog(result || "(空)");
    setStatus("日志已加载");
  };

  const handleCopyLog = async () => {
    if (!log) return;
    await navigator.clipboard.writeText(log);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFactoryReset = async () => {
    if (!confirm("确定要执行强还原配置吗？这将删除 Koring.yml、koring-auth.json 和背景缓存，但不会影响实例。")) return;
    setStatus("正在还原...");
    await window.electronAPI?.invoke("crash:factoryReset");
    setStatus("还原完成");
  };

  const btnBase = "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer active:scale-[0.97]";

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-1">崩溃测试</h2>
      <p className="text-sm text-muted-foreground mb-6">测试崩溃检测、崩溃弹窗与恢复功能</p>

      <div className="space-y-6">
        {/* 模拟崩溃 */}
        <section className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-foreground">模拟渲染进程崩溃</h3>
          </div>
          <p className="text-[13px] text-muted-foreground">
            调用 <code className="px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/80 text-xs">forcefullyCrashRenderer()</code> 强制销毁渲染进程，触发 <code className="px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/80 text-xs">render-process-gone</code> 事件，崩溃弹窗应自动弹出。
          </p>
          <button onClick={handleSimulateCrash} className={`${btnBase} bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20`}>
            <AlertTriangle className="w-4 h-4" />
            模拟崩溃
          </button>
        </section>

        {/* 测试崩溃弹窗 */}
        <section className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <TestTube className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">测试崩溃弹窗</h3>
          </div>
          <p className="text-[13px] text-muted-foreground">
            不会真正崩溃，直接弹出崩溃弹窗 UI，用于验证窗口样式、按钮功能是否正常。
          </p>
          <button onClick={handleTestDialog} className={`${btnBase} bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20`}>
            <TestTube className="w-4 h-4" />
            测试崩溃弹窗
          </button>
        </section>

        {/* 崩溃日志 */}
        <section className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <Copy className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">崩溃日志</h3>
          </div>
          <p className="text-[13px] text-muted-foreground">
            读取 <code className="px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/80 text-xs">koring-crash.log</code> 文件内容，可复制发送给开发人员。
          </p>
          <div className="flex gap-2">
            <button onClick={handleReadLog} className={`${btnBase} bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20`}>
              <Copy className="w-4 h-4" />
              读取日志
            </button>
            <button onClick={handleCopyLog} disabled={!log} className={`${btnBase} bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 disabled:opacity-40`}>
              <Copy className="w-4 h-4" />
              {copied ? "已复制" : "复制到剪贴板"}
            </button>
          </div>
          {log && (
            <pre className="mt-2 p-3 rounded-lg bg-foreground/[0.03] border border-border/50 text-xs text-foreground/70 overflow-auto max-h-40 font-mono">
              {log}
            </pre>
          )}
        </section>

        {/* 强还原配置 */}
        <section className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <Trash2 className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-foreground">强还原配置</h3>
          </div>
          <p className="text-[13px] text-muted-foreground">
            删除 <code className="px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/80 text-xs">Koring.yml</code>、
            <code className="px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/80 text-xs">koring-auth.json</code> 和背景缓存。
            <strong className="text-foreground/80"> 不会影响实例数据。</strong>
          </p>
          <button onClick={handleFactoryReset} className={`${btnBase} bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20`}>
            <Trash2 className="w-4 h-4" />
            强还原配置
          </button>
        </section>

        {/* 状态 */}
        {status && (
          <p className="text-xs text-muted-foreground/60">{status}</p>
        )}
      </div>
    </div>
  );
}
