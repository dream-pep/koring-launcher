import { useDevStore, type PreviewVersionLabel } from "@/stores/devStore";
import { VERSION } from "@/lib/version";
import { BUILD_MODE } from "@/lib/mode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VersionCard } from "@/components/VersionCard";
import { RotateCcw } from "lucide-react";
import { GlassCard, PageHeader } from "./components";

/** 构建模式内置配色（与 VersionCard 的 modeColors 保持一致） */
const MODE_PRESETS = [
  { key: "dev", label: "开发版", color: "#F59E0B" },
  { key: "beta", label: "测试版", color: "#10B981" },
  { key: "run", label: "发行版", color: "#3B82F6" },
] as const;

const LABEL_OPTIONS: PreviewVersionLabel[] = ["开发版", "测试版", "发行版"];

const UPDATE_STATE_OPTIONS = [
  { key: "latest", label: "最新版" },
  { key: "hasUpdate", label: "有更新" },
  { key: "installed", label: "已下载" },
] as const;

/** 分组小标题 */
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

/**
 * 临时修改版本卡状态与信息。
 *
 * 覆盖项只存在内存（useDevStore），不写入任何配置文件，关闭启动器后恢复；
 * 覆盖后设置页 / 更新页 / 弹窗里的 VersionCard 会同步显示成临时值。
 */
export function VersionPreviewDebug() {
  const previewVersion = useDevStore((s) => s.previewVersion);
  const setPreviewVersion = useDevStore((s) => s.setPreviewVersion);
  const previewModeColor = useDevStore((s) => s.previewModeColor);
  const setPreviewModeColor = useDevStore((s) => s.setPreviewModeColor);
  const previewVersionLabel = useDevStore((s) => s.previewVersionLabel);
  const setPreviewVersionLabel = useDevStore((s) => s.setPreviewVersionLabel);
  const previewUpdateState = useDevStore((s) => s.previewUpdateState);
  const setPreviewUpdateState = useDevStore((s) => s.setPreviewUpdateState);

  const defaultColor = MODE_PRESETS.find((m) => m.key === BUILD_MODE)?.color ?? MODE_PRESETS[0].color;

  const resetAll = () => {
    setPreviewVersion(null);
    setPreviewModeColor(null);
    setPreviewVersionLabel(null);
    setPreviewUpdateState(null);
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader
        title="临时修改版本卡状态与信息"
        desc="临时覆盖设置页对外显示的版本号、模式颜色与版本名称；只存在内存，不写配置，重启后恢复"
      />

      {/* 实时预览 */}
      <VersionCard className="mb-8" />

      <div className="space-y-6">
        {/* 版本号 */}
        <div>
          <GroupTitle>版本号</GroupTitle>
          <GlassCard>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={previewVersion ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setPreviewVersion(v ? v : null);
                  }}
                  placeholder={VERSION}
                  aria-label="版本号"
                  className="h-8 flex-1 font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={previewVersion === null}
                  onClick={() => setPreviewVersion(null)}
                >
                  恢复真实版本
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                真实版本号 v{VERSION}；清空输入框即恢复真实版本号
              </p>
            </div>
          </GlassCard>
        </div>

        {/* 模式颜色 */}
        <div>
          <GroupTitle>模式颜色</GroupTitle>
          <GlassCard>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {MODE_PRESETS.map((m) => (
                  <Button
                    key={m.key}
                    size="sm"
                    variant={previewModeColor === m.color ? "default" : "outline"}
                    onClick={() =>
                      setPreviewModeColor(previewModeColor === m.color ? null : m.color)
                    }
                    className="gap-1.5"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: m.color }}
                    />
                    {m.label}
                  </Button>
                ))}
                <span className="mx-1 h-4 w-px bg-border" />
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
                  自定义
                  <input
                    type="color"
                    value={previewModeColor ?? defaultColor}
                    onChange={(e) => setPreviewModeColor(e.target.value.toUpperCase())}
                    aria-label="自定义模式颜色"
                    className="h-6 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                </label>
                <span className="font-mono text-[12px] text-muted-foreground">
                  {previewModeColor ?? "跟随构建模式"}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={previewModeColor === null}
                  onClick={() => setPreviewModeColor(null)}
                >
                  恢复默认
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                修改卡片渐变与丝绸动画的底色
              </p>
            </div>
          </GlassCard>
        </div>

        {/* 版本名称 */}
        <div>
          <GroupTitle>版本名称</GroupTitle>
          <GlassCard>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {LABEL_OPTIONS.map((label) => (
                  <Button
                    key={label}
                    size="sm"
                    variant={previewVersionLabel === label ? "default" : "outline"}
                    onClick={() =>
                      setPreviewVersionLabel(previewVersionLabel === label ? null : label)
                    }
                  >
                    {label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={previewVersionLabel === null}
                  onClick={() => setPreviewVersionLabel(null)}
                >
                  恢复默认
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                卡片顶部的小字；默认跟随构建模式（当前为{" "}
                {MODE_PRESETS.find((m) => m.key === BUILD_MODE)?.label ?? BUILD_MODE}）
              </p>
            </div>
          </GlassCard>
        </div>

        {/* 更新状态 */}
        <div>
          <GroupTitle>更新状态</GroupTitle>
          <GlassCard>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {UPDATE_STATE_OPTIONS.map((s) => (
                  <Button
                    key={s.key}
                    size="sm"
                    variant={previewUpdateState === s.key ? "default" : "outline"}
                    onClick={() =>
                      setPreviewUpdateState(previewUpdateState === s.key ? null : s.key)
                    }
                  >
                    {s.label}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={previewUpdateState === null}
                  onClick={() => setPreviewUpdateState(null)}
                >
                  跟随实际
                </Button>
              </div>
              <p className="text-[12px] text-muted-foreground">
                显示卡片底部的更新提示（「有新的版本可用」/「更新已下载」）
              </p>
            </div>
          </GlassCard>
        </div>

        {/* 重置 */}
        <GlassCard>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">恢复全部</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                清除所有临时覆盖，回到真实的版本号、配色与更新状态
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={resetAll} className="gap-1.5 shrink-0">
              <RotateCcw className="h-3.5 w-3.5" />
              恢复全部
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
