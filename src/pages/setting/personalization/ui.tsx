import { useState } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useBuildBadgeStore } from "@/stores/buildBadgeStore";
import { BUILD_MODE } from "@/lib/mode";
import { toast } from "@/lib/toast";
import {
  SettingCard,
  SettingRow,
  SettingSwitch,
  PageHeader,
  SectionTitle,
} from "@/components/setting";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function UiSetting() {
  const ui = useConfigStore((s) => s.config.ui);
  const setUi = useConfigStore((s) => s.setUi);

  // 非正式版徽章：只存在运行时状态里，不写配置文件（重启启动器即恢复显示）
  const badgeHidden = useBuildBadgeStore((s) => s.hidden);
  const hideBadge = useBuildBadgeStore((s) => s.hideBadge);
  const showBadge = useBuildBadgeStore((s) => s.showBadge);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div>
      <PageHeader title="主界面" desc="自定义启动器主界面的元素显示与交互方式" />

      <div className="space-y-6">
        <div>
          <SectionTitle>界面元素</SectionTitle>
          <div className="space-y-3">
            <SettingCard>
              <SettingSwitch
                label="首页实例标题"
                desc="在首页左下角显示当前实例的大标题（点击可进入实例管理）"
                checked={ui?.showInstanceTitle ?? true}
                onChange={(v) => setUi({ showInstanceTitle: v })}
              />
            </SettingCard>

            <SettingCard>
              <SettingSwitch
                label="任务队列按钮"
                desc="在标题栏右侧显示任务队列入口（安装/下载进度）"
                checked={ui?.showTaskButton ?? true}
                onChange={(v) => setUi({ showTaskButton: v })}
              />
            </SettingCard>

            {/* 仅测试版 / 开发版有徽章可隐藏；正式版不显示这一项 */}
            {BUILD_MODE !== "run" && (
              <SettingCard>
                <SettingRow
                  label="暂时关闭非正式版提示徽章"
                  desc="隐藏标题栏右侧的 DEV / BETA 徽章（仅本次运行有效，重启启动器后恢复显示）"
                >
                  <Button
                    size="sm"
                    variant={badgeHidden ? "outline" : "destructive"}
                    onClick={() => {
                      if (badgeHidden) {
                        showBadge();
                        toast.success("已恢复显示非正式版提示徽章");
                      } else {
                        setConfirmOpen(true);
                      }
                    }}
                  >
                    {badgeHidden ? "恢复" : "隐藏"}
                  </Button>
                </SettingRow>
              </SettingCard>
            )}
          </div>
        </div>

        <div>
          <SectionTitle>说明</SectionTitle>
          <SettingCard>
            <div className="space-y-1.5">
              <p className="text-[13px] text-muted-foreground">
                背景图片 / 模糊 / 透明度与视差效果请在「主题与背景」中调整。
              </p>
              <p className="text-[13px] text-muted-foreground">
                动画减弱、透明度减弱与高对比度请在「辅助功能」中调整。
              </p>
            </div>
          </SettingCard>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>您确定要隐藏吗？</AlertDialogTitle>
            <AlertDialogDescription>
              该徽章的目的是提醒您正在使用测试版本 Koring Launcher，您隐藏后重启启动器将会恢复显示，如果需要长期隐藏请更新至正式版。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              variant="secondary"
              onClick={() => {
                hideBadge();
                toast.success("已暂时隐藏非正式版提示徽章，重启启动器后恢复显示");
              }}
            >
              确认隐藏
            </AlertDialogAction>
            <AlertDialogCancel variant="destructive">取消隐藏</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
