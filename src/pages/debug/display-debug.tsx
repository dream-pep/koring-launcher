import { useDevStore } from "@/stores/devStore";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { GlassCard, SettingRow, PageHeader } from "./components";

export function DisplayDebug() {
  const { forceDisableContentBlur, setForceDisableContentBlur } = useDevStore();

  return (
    <div className="max-w-2xl mx-auto p-8">
      <PageHeader title="显示效果调试" desc="调试背景遮罩、磨砂效果与视觉表现" />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            遮罩控制
          </h3>
          <div className="space-y-3">
            <GlassCard>
              <SettingRow
                label="强制关闭背景「强内容模式」"
                desc="覆盖系统设置，在所有页面禁用背景模糊遮罩，用于对比测试"
              >
                <Button
                  variant={forceDisableContentBlur ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setForceDisableContentBlur(!forceDisableContentBlur)
                  }
                >
                  {forceDisableContentBlur ? "已开启" : "已关闭"}
                </Button>
              </SettingRow>
            </GlassCard>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground/40 uppercase tracking-wider mb-3">
            通知预览
          </h3>
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
