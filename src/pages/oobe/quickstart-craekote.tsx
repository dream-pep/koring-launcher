//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useRouteStore } from "@/stores/routeStore";
import { QuickstartTutorial } from "./quickstart-tutorial";

const CRAEKOTE_IMAGE = `${import.meta.env.BASE_URL}KCAE-2.0.png`;

/** 快速上手教程 3：CraeKote 动画组件带来的直觉化操作体验。 */
export function OobeQuickstartCraeKote() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <QuickstartTutorial
      title="你可以按照直觉进行操作。"
      description="得益于 CraeKote 动画组件，动画都遵守从哪来到哪里去，并且所有功能入口都进行了特调。"
      gif={CRAEKOTE_IMAGE}
      aspectRatio="4 / 3"
      onNext={() => navigate("oobe/quickstart-end")}
    />
  );
}
