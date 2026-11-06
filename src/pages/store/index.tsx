//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { useState } from "react";
import { Box, CalendarHeart, Package, Puzzle } from "lucide-react";
import { PageShell, type PageShellGroup } from "@/components/page-shell";
import { TodayView } from "./TodayView";

const iconCls = "w-[18px] h-[18px] shrink-0";

/**
 * 资源页侧边栏。
 *
 * 结构：Today / 原版游戏（无分组）+ 社区资源分组（Mod 模组 / 整合包）。
 * 内容区暂时留空（PageShellItem 不传 content），后续再逐个接入。
 */
const STORE_GROUPS: PageShellGroup[] = [
  {
    items: [
      {
        key: "today",
        label: "Today",
        icon: <CalendarHeart className={iconCls} />,
        content: <TodayView />,
      },
      { key: "vanilla", label: "原版游戏", icon: <Box className={iconCls} /> },
    ],
  },
  {
    title: "社区资源",
    items: [
      { key: "mod", label: "Mod 模组", icon: <Puzzle className={iconCls} /> },
      { key: "modpack", label: "整合包", icon: <Package className={iconCls} /> },
    ],
  },
];

export function Store() {
  const [section, setSection] = useState("today");

  return (
    <PageShell
      groups={STORE_GROUPS}
      value={section}
      onValueChange={setSection}
      navLabel="资源导航"
    />
  );
}
