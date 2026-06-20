import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

const enabled = import.meta.env.VITE_START_POP === "true";
const title = import.meta.env.VITE_START_POP_TITLE ?? "";
const info = import.meta.env.VITE_START_POP_INFO ?? "";
const buttonText = import.meta.env.VITE_START_POP_BOUTTON ?? "确定";

export function StartupPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (enabled) {
      setOpen(true);
    }
  }, []);

  if (!enabled) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mb-2 inline-flex size-10 items-center justify-center rounded-md bg-amber-500/10 sm:group-data-[size=default]/alert-dialog-content:row-span-2">
            <AlertTriangle className="size-5 text-amber-500" />
          </div>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{info}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => setOpen(false)}>
            {buttonText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
