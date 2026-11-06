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
import { CheckCircle2 } from "lucide-react";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";

/** 快速上手结束页：引导完成后进入 OOBE 结束页。 */
export function OobeQuickstartEnd() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-3 px-6 text-center">
        <CheckCircle2 className="w-10 h-10 text-primary" />
        <h2 className="text-2xl font-bold text-foreground">你已经掌握了大部分诀窍！</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          您可以愉快的体验 Minecraft 了。
        </p>
      </div>

      <NextButton onClick={() => navigate("oobe/finish")} />
    </OobeLayout>
  );
}
