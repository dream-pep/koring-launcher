import { useDevStore } from "@/stores/devStore";
import { useRouteStore } from "@/stores/routeStore";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GlassCard, PageHeader, SettingRow } from "./components";

/**
 * 无文字录制模式。
 *
 * 打开后由 RootLayout 在根节点加 `textless-mode`，
 * `src/index.css` 把除顶栏与开发者工具页面之外的所有文字替换成方块（-webkit-text-security），
 * 布局与图标保持不变，适合录制演示视频时隐藏具体文案。
 * 状态只在内存（useDevStore），不写配置，重启后自动恢复。
 */
export function TextlessDebug() {
  const textlessMode = useDevStore((s) => s.textlessMode);
  const setTextlessMode = useDevStore((s) => s.setTextlessMode);
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader
        title="无文字录制模式"
        desc="开启后，除顶栏与开发者工具页面外，界面上的文字全部替换为方块，便于录制演示视频"
      />

      <div className="space-y-6">
        <GlassCard>
          <SettingRow
            label="无文字录制模式"
            desc="仅本次运行有效，不写入配置，重启启动器后自动关闭"
          >
            <Switch
              checked={textlessMode}
              onCheckedChange={setTextlessMode}
              aria-label="无文字录制模式"
            />
          </SettingRow>
        </GlassCard>

        <GlassCard>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">说明</p>
            <ul className="space-y-1 text-[13px] text-muted-foreground">
              <li>· 正文、侧边栏、按钮、弹窗与通知里的文字都会变成方块，布局与图标不变。</li>
              <li>· 顶栏（含窗口控制）与开发者工具内的页面保持可读，方便随时回来关闭。</li>
              <li>· 状态只存在内存中，不写入配置文件，关闭启动器后自动恢复。</li>
            </ul>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">预览效果</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                打开开关后跳到其他页面即可查看替换效果，回到本页可随时关闭
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate("home")}>
                去首页
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("setting")}>
                去设置
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
