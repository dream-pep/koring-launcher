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
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";

/**
 * 快速上手 Hero 页：版本激活校验通过后的引导入口，
 * 介绍接下来会看到的基础操作与功能入口。
 */
export function OobeQuickstart() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-3 px-6 text-center">
        <h2 className="text-2xl font-bold text-foreground">接下来让我们快速上手！</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          学习一些基础操作，并了解功能入口。
        </p>
      </div>

      <NextButton onClick={() => navigate("oobe/quickstart-list")} />
    </OobeLayout>
  );
}
