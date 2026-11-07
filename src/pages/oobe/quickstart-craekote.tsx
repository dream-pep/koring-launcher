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

const PLAYLINK_GIF = `${import.meta.env.BASE_URL}Helper-vedio/koring-help-v03-playlink.gif`;

/** 快速上手教程 3：陶瓦 & Koring Link 联机体验。 */
export function OobeQuickstartCraeKote() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <QuickstartTutorial
      title="使用联机功能与好友同乐！"
      description="使用 陶瓦联机 & Koring Link 联合服务，获得全新联机体验"
      gif={PLAYLINK_GIF}
      onNext={() => navigate("oobe/quickstart-end")}
    />
  );
}
