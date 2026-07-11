import { useRouteStore } from "@/stores/routeStore";
import { useConfigStore } from "@/stores/configStore";
import { OobeLayout } from "./layout";
import { AppleHelloEnglishEffect } from "@/components/ui/apple-hello-effect";

export function OobeFinish() {
  const navigate = useRouteStore((s) => s.navigate);
  const setOobe = useConfigStore((s) => s.setOobe);

  const handleFinish = () => {
    setOobe(false);
    navigate("home");
  };

  return (
    <OobeLayout>
      <div className="flex flex-col items-center gap-6">
        <AppleHelloEnglishEffect className="text-foreground" />
      </div>

      <div className="absolute bottom-12">
        <button
          onClick={handleFinish}
          className="h-12 px-6 rounded-full bg-foreground/[0.06] hover:bg-foreground/[0.12] flex items-center justify-center text-foreground/60 hover:text-foreground transition-all duration-200 text-sm font-medium"
        >
          前往首页
        </button>
      </div>
    </OobeLayout>
  );
}
