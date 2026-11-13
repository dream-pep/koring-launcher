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
import { SettingCard } from "@/components/setting";
import { Button } from "@heroui/react";

const LEGAL_ITEMS = [
  {
    label: "匿名数据收集",
    desc: "您在使用本产品时，可能会收集匿名数据，用于改进产品功能和用户体验。包括崩溃日志、崩溃操作路径与设备状态等脱敏信息。并上传至 Lenjing.Cloud 服务器。",
  },
  {
    label: "隐私声明与个人信息保护策略",
    desc: "本产品在现有版本下暂未进行收集任何隐私信息与个人信息。",
  },
  {
    label: "其他信息",
    desc: "Copyright © 深圳棱镜视界科技有限公司。\n违法违规行为举报信箱：support@lenjing.email",
  },
  {
    label: "如果不愿意遵守或者同意以上法律声明",
    desc: "请退出关闭，并卸载本产品。",
  },
];

export function OobeLegal() {
  const navigate = useRouteStore((s) => s.navigate);

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-3 px-6">
        {/* 标题 */}
        <div className="text-center space-y-1 mb-1">
          <h2 className="text-lg font-bold text-foreground">法律信息</h2>
          <p className="text-xs text-muted-foreground">请阅读以下法律声明</p>
        </div>

        {/* 法律信息列表 */}
        {LEGAL_ITEMS.map((item, i) => (
          <div
            key={item.label}
            className="w-full animate-list-item-in"
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <SettingCard className="w-full">
              <p className="text-[13.5px] font-medium text-foreground">{item.label}</p>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed whitespace-pre-line">
                {item.desc}
              </p>
            </SettingCard>
          </div>
        ))}
      </div>

      {/* 返回协议列表 */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10">
        <Button variant="outline" size="sm" onPress={() => navigate("oobe/agreement")}>
          返回协议列表
        </Button>
      </div>
    </OobeLayout>
  );
}
