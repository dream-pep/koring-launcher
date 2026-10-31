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
    <div className="relative h-full overflow-hidden">
      {/*
        底部感应区：
        - 默认：文字下移 gap+按钮占位高度（48px），底边恰好贴住底部内边距（自适应文字行数，单行/多行都贴底不裁切）
        - 按钮下移 64px 完全移出视口隐藏
        - 鼠标靠近：两者滑回原位，露出按钮
      */}
      <div className="group absolute inset-x-0 bottom-0 h-40 flex flex-col items-start justify-end gap-3 px-6 pb-6">
        <div className="translate-y-12 transition-transform duration-300 ease-spring-soft group-hover:translate-y-0">
          <InstanceTitle />
        </div>
        <div className="translate-y-16 transition-transform duration-300 ease-spring-soft group-hover:translate-y-0">
          <StartCard />
        </div>
      </div>
    </div>
  );
}
