import { create } from "zustand";

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  countdown: number;
  showCountdown: boolean;
  onConfirm: () => void;
  openDialog: (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    countdown?: number;
    onConfirm: () => void;
  }) => void;
  closeDialog: () => void;
}

export const useConfirmDialogStore = create<ConfirmDialogState>((set) => ({
  open: false,
  title: "",
  description: "",
  confirmLabel: "确认",
  countdown: 0,
  showCountdown: false,
  onConfirm: () => {},
  openDialog: (opts) =>
    set({
      open: true,
      title: opts.title,
      description: opts.description,
      confirmLabel: opts.confirmLabel ?? "确认",
      countdown: opts.countdown ?? 0,
      showCountdown: (opts.countdown ?? 0) > 0,
      onConfirm: opts.onConfirm,
    }),
  closeDialog: () => set({ open: false }),
}));
