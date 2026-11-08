import { create } from "zustand";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  /**
   * 可选的次要操作按钮（放在「取消」与确认按钮之间）。
   * 例如「登录过期」弹窗里的「仍然创建」——给用户一条绕过校验的出口。
   */
  secondaryLabel: string;
  countdown: number;
  showCountdown: boolean;
  /** 确认按钮样式：破坏性操作用 destructive（默认），普通提示可用 default */
  confirmVariant: "default" | "destructive";
  onConfirm: () => void;
  onSecondary: () => void;
  openDialog: (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    secondaryLabel?: string;
    confirmVariant?: "default" | "destructive";
    countdown?: number;
    onConfirm: () => void;
    onSecondary?: () => void;
  }) => void;
  closeDialog: () => void;
}

export const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  open: false,
  title: "",
  description: "",
  confirmLabel: "确认",
  secondaryLabel: "",
  countdown: 0,
  showCountdown: false,
  confirmVariant: "destructive",
  onConfirm: () => {},
  onSecondary: () => {},
  openDialog: (opts) =>
    set({
      open: true,
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.confirmLabel ?? "确认",
      secondaryLabel: opts.secondaryLabel ?? "",
      countdown: opts.countdown ?? 0,
      showCountdown: (opts.countdown ?? 0) > 0,
      confirmVariant: opts.confirmVariant ?? "destructive",
      onConfirm: opts.onConfirm,
      onSecondary: opts.onSecondary ?? (() => {}),
    }),
  closeDialog: () => set({ open: false }),
}));
