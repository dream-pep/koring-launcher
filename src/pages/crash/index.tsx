import { useState, useEffect } from "react";
import { VERSION } from "@/lib/version";

type CrashInfo = {
  type: string;
  message: string;
  timestamp: string;
};

export function CrashPage() {
  const [crashInfo, setCrashInfo] = useState<CrashInfo | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    const unsub = window.electronAPI?.on("crash:show", (...args: unknown[]) => {
      const info = args[0] as CrashInfo;
      setCrashInfo(info);
    });
    return () => { unsub?.(); };
  }, []);

  const handleClose = () => {
    window.electronAPI?.close();
  };

  const handleCopyLog = async () => {
    setCopying(true);
    try {
      const log = await window.electronAPI?.invoke("crash:readLog") as string;
      if (log) {
        await navigator.clipboard.writeText(log);
        setCopyDone(true);
        setTimeout(() => setCopyDone(false), 2000);
      }
    } catch {
    } finally {
      setCopying(false);
    }
  };

  const handleFactoryReset = async () => {
    await window.electronAPI?.invoke("crash:factoryReset");
  };

  const handleRestart = async () => {
    await window.electronAPI?.invoke("crash:restart");
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-background text-foreground select-none">
      {/* 顶栏 — 只有关闭按钮 */}
      <div
        className="h-[40px] flex items-center shrink-0 relative z-10"
        style={{
          WebkitAppRegion: "drag" as React.CSSProperties["WebkitAppRegion"],
          background: "var(--titlebar-bg, rgba(255,255,255,0.03))",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
          borderBottom: "1px solid var(--titlebar-border, rgba(255,255,255,0.06))",
        }}
      >
        <div className="flex items-center pl-3 shrink-0" style={{ WebkitAppRegion: "no-drag" as React.CSSProperties["WebkitAppRegion"] }}>
          <span className="text-sm font-semibold tracking-wide text-foreground/80">
            Koring Launcher
          </span>
        </div>

        <div className="flex items-center shrink-0 justify-end ml-auto pr-2" style={{ WebkitAppRegion: "no-drag" as React.CSSProperties["WebkitAppRegion"] }}>
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center justify-center w-[25px] h-[25px] rounded transition-colors cursor-default hover:bg-red-500 text-black/70 dark:text-white/70 hover:text-white"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        </div>
      </div>

      {/* 崩溃内容 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[520px] text-center space-y-6">
          {/* 图标 */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
          </div>

          {/* 标题 */}
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">
              程序发生崩溃
            </h1>
            <p className="text-sm text-muted-foreground">
              我们已记录此错误，接下来您想做什么？
            </p>
          </div>


          {/* 说明文字 */}
          <p className="text-sm text-muted-foreground leading-relaxed text-left">
            您可能是在一些奇怪的地方触发了内容导致崩溃，我们已准备好日志，你可以直接复制将其发送给支持人员，你也可以点击下方的重启按钮再次启动，如果还是不行您可以点击强还原配置按钮进行还原。（注意，还原只会清除启动器数据，并不会影响实例，请放心使用）
          </p>

          {/* 按钮组 */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopyLog}
              disabled={copying}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
            >
              {copyDone ? "已复制" : copying ? "复制中..." : "复制日志"}
            </button>

            <button
              type="button"
              onClick={handleFactoryReset}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition-colors"
            >
              强还原配置
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              重启
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
