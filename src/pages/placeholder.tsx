import { UnderConstruction } from "@/components/UnderConstruction";

/** 实例页占位（与资讯页相同的占位组件，临时使用） */
export function GalleryPlaceholder() {
  return (
    <UnderConstruction
      pageName="实例"
      description="管理您的游戏实例、版本与存档"
    />
  );
}

/** 资源页占位（与资讯页相同的占位组件，临时使用） */
export function StorePlaceholder() {
  return (
    <UnderConstruction
      pageName="资源"
      description="Minecraft 游戏版本、MOD 与整合包下载"
    />
  );
}
