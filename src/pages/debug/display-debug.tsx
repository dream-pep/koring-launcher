import { useDevStore } from "@/stores/devStore";
import { useThemeStore, type DarkMode } from "@/stores/themeStore";
import { useA11yStore } from "@/stores/a11yStore";
import { useBackgroundStore } from "@/stores/backgroundStore";
import { useConfigStore } from "@/stores/configStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/lib/toast";
import { GlassCard, SettingRow, PageHeader } from "./components";

// 深色模式选项
const darkModeOptions: { key: DarkMode; label: string }[] = [
  { key: "auto", label: "跟随系统" },
  { key: "light", label: "亮色" },
  { key: "dark", label: "暗色" },
];

// 分组小标题
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
      {children}
    </h3>
  );
}

export function DisplayDebug() {
  // 调试覆盖项
  const { forceDisableContentBlur, setForceDisableContentBlur } = useDevStore();
  // 主题与动效
  const { darkMode, setDarkMode, parallax, setParallax } = useThemeStore();
  // 无障碍
  const {
    reduceMotion,
    reduceTransparency,
    highContrast,
    contentBlurOpacity,
    setReduceMotion,
    setReduceTransparency,
    setHighContrast,
    setContentBlurOpacity,
  } = useA11yStore();
  // 背景参数
  const { blur, opacity, setBlur, setOpacity, reset: resetBackground } = useBackgroundStore();
  // 界面元素开关
  const ui = useConfigStore((s) => s.config.ui);
  const setUi = useConfigStore((s) => s.setUi);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="显示效果调试" desc="调试主题、遮罩、无障碍、背景参数与视觉表现" />

      <div className="space-y-6">
        {/* 遮罩控制 */}
        <div>
          <GroupTitle>遮罩控制</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="强制关闭背景「强内容模式」"
                desc="覆盖系统设置，在所有页面禁用背景模糊遮罩，用于对比测试"
              >
                <Switch
                  checked={forceDisableContentBlur}
                  onCheckedChange={setForceDisableContentBlur}
                />
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">内容遮罩强度</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      设置页内容区模糊遮罩的不透明度
                    </p>
                  </div>
                  <span className="text-[13px] text-muted-foreground tabular-nums shrink-0">
                    {contentBlurOpacity}%
                  </span>
                </div>
                <Slider
                  value={[contentBlurOpacity]}
                  onValueChange={(v) => setContentBlurOpacity(Array.isArray(v) ? v[0] : v)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </GlassCard>
          </div>
        </div>

        {/* 主题与动效 */}
        <div>
          <GroupTitle>主题与动效</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">深色模式</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    切换应用明暗主题，验证配色与对比度
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {darkModeOptions.map((o) => (
                    <Button
                      key={o.key}
                      size="sm"
                      variant={darkMode === o.key ? "default" : "outline"}
                      onClick={() => setDarkMode(o.key)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
              </div>
            </GlassCard>
            <GlassCard>
              <SettingRow label="视差效果" desc="背景跟随指针产生视差位移，用于验证视觉层次">
                <Switch checked={parallax} onCheckedChange={setParallax} />
              </SettingRow>
            </GlassCard>
          </div>
        </div>

        {/* 无障碍 */}
        <div>
          <GroupTitle>无障碍</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="减少动态效果" desc="降低动画时长与位移，模拟系统「减少动态效果」">
                <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow label="减少透明度" desc="降低半透明层次，模拟系统「减少透明度」">
                <Switch checked={reduceTransparency} onCheckedChange={setReduceTransparency} />
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow label="高对比度" desc="强化前景/背景对比，验证可读性">
                <Switch checked={highContrast} onCheckedChange={setHighContrast} />
              </SettingRow>
            </GlassCard>
          </div>
        </div>

        {/* 背景参数 */}
        <div>
          <GroupTitle>背景参数</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">背景模糊</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      调整背景图模糊强度
                    </p>
                  </div>
                  <span className="text-[13px] text-muted-foreground tabular-nums shrink-0">
                    {blur}px
                  </span>
                </div>
                <Slider
                  value={[blur]}
                  onValueChange={(v) => setBlur(Array.isArray(v) ? v[0] : v)}
                  min={0}
                  max={40}
                  step={1}
                />
              </div>
            </GlassCard>
            <GlassCard>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">背景不透明度</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                      调整背景图整体不透明度
                    </p>
                  </div>
                  <span className="text-[13px] text-muted-foreground tabular-nums shrink-0">
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
                <Slider
                  value={[Math.round(opacity * 100)]}
                  onValueChange={(v) => setOpacity((Array.isArray(v) ? v[0] : v) / 100)}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
            </GlassCard>
            <GlassCard>
              <SettingRow label="恢复默认背景" desc="同时重置背景模糊与不透明度">
                <Button size="sm" variant="outline" onClick={resetBackground}>
                  恢复默认
                </Button>
              </SettingRow>
            </GlassCard>
          </div>
        </div>

        {/* 界面元素 */}
        <div>
          <GroupTitle>界面元素</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow label="首页显示实例标题" desc="控制首页左下角实例名称标题的显示">
                <Switch
                  checked={ui?.showInstanceTitle ?? true}
                  onCheckedChange={(v) => setUi({ showInstanceTitle: v })}
                />
              </SettingRow>
            </GlassCard>
            <GlassCard>
              <SettingRow label="顶栏显示任务按钮" desc="控制标题栏右侧任务队列入口的显示">
                <Switch
                  checked={ui?.showTaskButton ?? true}
                  onCheckedChange={(v) => setUi({ showTaskButton: v })}
                />
              </SettingRow>
            </GlassCard>
          </div>
        </div>

        {/* 通知预览 */}
        <div>
          <GroupTitle>通知预览</GroupTitle>
          <div className="space-y-3">
            <GlassCard>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.success("操作成功", { description: "成功通知示例：已保存到本地" })
                  }
                >
                  成功
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.info("提示信息", { description: "信息通知示例：使用说明已更新" })
                  }
                >
                  信息
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.warning("需要注意", { description: "警告通知示例：部分文件已跳过" })
                  }
                >
                  警告
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.error("操作失败", { description: "错误通知示例：网络连接超时" })
                  }
                >
                  错误
                </Button>
              </div>
            </GlassCard>
            <GlassCard>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toast.loading("正在处理…", { id: "toast-demo" });
                    window.setTimeout(() => {
                      toast.success("处理完成", {
                        id: "toast-demo",
                        description: "同 id 会原地变形",
                      });
                    }, 1500);
                  }}
                >
                  加载 → 成功
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    toast.persistent("有可用更新", {
                      description: "演示常驻通知",
                      action: { label: "查看", onClick: () => {} },
                    })
                  }
                >
                  常驻 + 操作
                </Button>
                <Button size="sm" variant="outline" onClick={() => toast.dismiss()}>
                  全部关闭
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
