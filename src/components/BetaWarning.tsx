import { useEffect } from "react";
import { toast } from "sonner";
import { BUILD_MODE } from "@/lib/mode";
import { VERSION } from "@/lib/version";

export function BetaWarning() {
  useEffect(() => {
    if (BUILD_MODE === "beta" || BUILD_MODE === "dev") {
      toast.warning(`当前为 v${VERSION} BETA 测试版，不代表最终品质。`, {
        duration: Infinity,
        dismissible: true,
      });
    }
  }, []);

  return null;
}
