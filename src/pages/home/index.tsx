import { useEffect } from "react";
import { useConfigStore } from "@/stores/configStore";
import { useInstanceStore } from "@/stores/instanceStore";
import { InstanceTitle } from "./InstanceTitle";
import { StartCard } from "./StartCard";

export function Home() {
  const gamePath = useConfigStore((state) => state.config.game.gameDir);
  const setCurrent = useInstanceStore((state) => state.setCurrent);

  // 启动时按配置恢复「当前选中的版本」：首页标题与启动按钮都跟随它
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const store = useInstanceStore.getState();
      if (store.instances.length === 0) {
        await store.fetchInstances(gamePath);
      }
      if (cancelled) return;

      const saved = useConfigStore.getState().config.game.selectedInstance;
      if (!saved) return;
      if (useInstanceStore.getState().currentInstance?.name === saved) return;

      const target = useInstanceStore.getState().instances.find((item) => item.name === saved);
      if (target) setCurrent(target);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [gamePath, setCurrent]);

  return (
    <div className="relative h-full flex flex-col justify-end items-start p-6 gap-3">
      <InstanceTitle />
      <StartCard />
    </div>
  );
}
