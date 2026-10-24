import { useEffect, useState } from "react";
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
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";

/**
 * 全局二次确认弹窗（RootLayout 挂载，useConfirmDialogStore 驱动）。
 *
 * - 复用 AlertDialog 原语：统一的 pop-in/pop-out、遮罩淡入淡出、指针 origin；
 * - 保留倒计时禁用逻辑（危险操作防误触）与「先关弹窗再执行 onConfirm」的顺序；
 * - 调用方只依赖 useConfirmDialogStore().openDialog，无需改动。
 */
export function ConfirmDialog() {
  const {
    open,
    title,
    description,
    confirmLabel,
    countdown: initCountdown,
    showCountdown,
    onConfirm,
    closeDialog,
  } = useConfirmDialogStore();

  const [countdown, setCountdown] = useState(initCountdown);

  useEffect(() => {
    if (!open) return;
    setCountdown(initCountdown);
  }, [open, initCountdown]);

  useEffect(() => {
    if (!open || !showCountdown || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, showCountdown, countdown]);

  const canConfirm = !showCountdown || countdown <= 0;
  const label =
    showCountdown && countdown > 0 ? `${confirmLabel} (${countdown}s)` : confirmLabel;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeDialog();
      }}
    >
      {/* z-[200]：保持覆盖页面内其他浮层（原自定义遮罩即 200），避免被 Sheet/更新弹窗盖住 */}
      <AlertDialogContent className="z-[200] max-w-[380px] gap-4 p-6">
        <AlertDialogHeader className="place-items-start gap-1.5 text-left">
          <AlertDialogTitle className="text-base font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="-mx-6 -mb-6 flex-row justify-end gap-2 rounded-b-xl border-t-0 bg-transparent px-6 py-4">
          <AlertDialogCancel onClick={closeDialog}>取消</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => {
              // 先关闭（让弹层开始退场），再执行真正的操作
              closeDialog();
              onConfirm();
            }}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
