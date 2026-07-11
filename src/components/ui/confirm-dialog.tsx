import { useState, useEffect } from "react";
import { useConfirmDialogStore } from "@/stores/confirmDialogStore";

export function ConfirmDialog() {
  const { open, title, description, confirmLabel, countdown: initCountdown, showCountdown, onConfirm, closeDialog } =
    useConfirmDialogStore();
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

  if (!open) return null;

  const canConfirm = !showCountdown || countdown <= 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="glass-card w-[380px] p-6 space-y-4">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={closeDialog}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium bg-foreground/[0.06] hover:bg-foreground/[0.12] text-foreground/60 hover:text-foreground transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => { closeDialog(); onConfirm(); }}
            disabled={!canConfirm}
            className="px-4 py-1.5 rounded-md text-[13px] font-medium bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {showCountdown && countdown > 0 ? `${confirmLabel} (${countdown}s)` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
