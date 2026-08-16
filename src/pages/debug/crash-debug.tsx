import { useState } from "react";
import { AlertTriangle, TestTube, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard, SettingRow, PageHeader } from "./components";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";

export function CrashDebug() {
  const [log, setLog] = useState("");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("");
  const openDialog = useConfirmDialogStore((s) => s.openDialog);

  // 模拟渲染进程崩溃
  const handleSimulateCrash = async () => {
    setStatus("正在模拟崩溃...");
    await window.electronAPI?.simulateCrash();
  };

  // 直接弹出崩溃弹窗 UI（不真正崩溃）
  const handleTestDialog = async () => {
    setStatus("正在打开崩溃弹窗...");
    await window.electronAPI?.testCrashDialog();
    setStatus("崩溃弹窗已打开");
  };

  // 读取崩溃日志文件
  const handleReadLog = async () => {
    const result = await window.electronAPI?.invoke("crash:readLog") as string;
    setLog(result || "(空)");
    setStatus("日志已加载");
  };

  // 复制崩溃日志到剪贴板
  const handleCopyLog = async () => {
    if (!log) return;
    await navigator.clipboard.writeText(log);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 执行强还原配置
  const handleFactoryReset = async () => {
    setStatus("正在还原...");
    await window.electronAPI?.invoke("crash:factoryReset");
    setStatus("还原完成");
  };

  // 强还原前弹出确认对话框
  const confirmFactoryReset = () => {
    openDialog({
      title: "强还原配置",
      description:
        "确定要执行强还原配置吗？这将删除 Koring.yml、koring-auth.json 和背景缓存，但不会影响实例。",
      confirmLabel: "强还原",
      onConfirm: () => {
        void handleFactoryReset();
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="崩溃测试" desc="测试崩溃检测、崩溃弹窗与恢复功能" />

      <div className="space-y-6">
        {/* 模拟崩溃 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            模拟崩溃
          </h3>
          <GlassCard>
            <SettingRow
              label="模拟渲染进程崩溃"
              desc="调用 forcefullyCrashRenderer() 强制销毁渲染进程，触发 render-process-gone 事件，崩溃弹窗应自动弹出。"
            >
              <Button
                variant="destructive"
                size="sm"
                onClick={handleSimulateCrash}
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                模拟崩溃
              </Button>
            </SettingRow>
          </GlassCard>
        </div>

        {/* 测试崩溃弹窗 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            崩溃弹窗
          </h3>
          <GlassCard>
            <SettingRow
              label="测试崩溃弹窗"
              desc="不会真正崩溃，直接弹出崩溃弹窗 UI，用于验证窗口样式、按钮功能是否正常。"
            >
              <Button variant="outline" size="sm" onClick={handleTestDialog}>
                <TestTube className="w-3.5 h-3.5 mr-1.5" />
                测试崩溃弹窗
              </Button>
            </SettingRow>
          </GlassCard>
        </div>

        {/* 崩溃日志 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            崩溃日志
          </h3>
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  读取崩溃日志
                </p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  读取 koring-crash.log 文件内容，可复制发送给开发人员。
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={handleReadLog}>
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  读取
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLog}
                  disabled={!log}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  {copied ? "已复制" : "复制"}
                </Button>
              </div>
            </div>
            {log && (
              <pre className="mt-3 p-3 rounded-lg bg-foreground/[0.03] border border-border/50 text-xs text-foreground/70 overflow-auto max-h-40 font-mono">
                {log}
              </pre>
            )}
          </GlassCard>
        </div>

        {/* 强还原配置 */}
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            强还原配置
          </h3>
          <GlassCard>
            <SettingRow
              label="还原配置与缓存"
              desc="删除 Koring.yml、koring-auth.json 和背景缓存，不会影响实例数据。"
            >
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmFactoryReset}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                强还原
              </Button>
            </SettingRow>
          </GlassCard>
        </div>

        {/* 操作状态提示 */}
        {status && (
          <p className="text-xs text-muted-foreground/60">{status}</p>
        )}
      </div>
    </div>
  );
}
