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

const LIST_GIF = `${import.meta.env.BASE_URL}Helper-vedio/koring-help-v01-list.gif`;

/** 快速上手教程 1：List（任务与通知中心）。 */
export function OobeQuickstartList() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <QuickstartTutorial
      title="在 List 管理你当前的任务与通知"
      description="List是一个任务与通知中心，你可以在这里了解到 Launcher发生了什么。"
      gif={LIST_GIF}
      onNext={() => navigate("oobe/quickstart-game")}
    />
  );
}
