import { useDevStore } from "@/stores/devStore";
import { Button } from "@/components/ui/button";
import { VersionCard } from "@/components/VersionCard";
import { checkForUpdates } from "@/api/update";
import { GlassCard, PageHeader } from "./components";

const modeOptions = [
  { key: "dev", label: "开发版", color: "bg-amber-500" },
  { key: "beta", label: "测试版", color: "bg-emerald-500" },
  { key: "run", label: "正式版", color: "bg-blue-500" },
] as const;

const updateStateOptions = [
  { key: "latest", label: "最新版" },
  { key: "hasUpdate", label: "有更新" },
  { key: "installed", label: "已下载" },
] as const;

export function VersionCardDebug() {
  const {
    previewMode,
    setPreviewMode,
    previewUpdateState,
    setPreviewUpdateState,
  } = useDevStore();

  const resetPreview = () => {
    setPreviewMode(null);
    setPreviewUpdateState(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="版本卡片调试" desc="测试 VersionCard 在不同模式与状态下的表现" />

      <VersionCard
        className="mb-8"
        overrideMode={previewMode}
        overrideState={previewUpdateState}
      />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            模式颜色
          </h3>
          <GlassCard>
            <div className="flex items-center gap-2">
              {modeOptions.map((m) => (
                <Button
                  key={m.key}
                  size="sm"
                  variant={previewMode === m.key ? "default" : "outline"}
                  onClick={() =>
                    setPreviewMode(previewMode === m.key ? null : m.key)
                  }
                  className="gap-1.5"
                >
                  <span className={`inline-block w-2 h-2 rounded-full ${m.color}`} />
                  {m.label}
                </Button>
              ))}
            </div>
          </GlassCard>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            更新状态模拟
          </h3>
          <GlassCard>
            <div className="flex items-center gap-2">
              {updateStateOptions.map((s) => (
                <Button
                  key={s.key}
                  size="sm"
                  variant={previewUpdateState === s.key ? "default" : "outline"}
                  onClick={() =>
                    setPreviewUpdateState(
                      previewUpdateState === s.key ? null : s.key,
                    )
                  }
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </GlassCard>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            快捷操作
          </h3>
          <GlassCard>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">重置与检查</p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  重置模式与状态预览，或强制检查更新
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={resetPreview}>
                  重置
                </Button>
                <Button size="sm" onClick={() => checkForUpdates()}>
                  检查更新
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
