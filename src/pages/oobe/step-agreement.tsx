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
import { ExternalLink } from "lucide-react";
import { useRouteStore } from "@/stores/routeStore";
import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";

const openLink = (url: string) => {
  window.electronAPI?.openExternal(url);
};

const AGREEMENT_LINKS = [
  {
    label: "用户协议与免责声明",
    desc: "Copyright © Shenzhen Prism Horizon Technology Co., Ltd.",
    url: "https://support.lingke.ink/Koring/系列产品用户协议与免责声明",
  },
  {
    label: "产品分发有限许可",
    desc: "除本许可明确授予的权利外，许可方保留软件及其相关知识产权中的全部权利。",
    url: "https://support.lingke.ink/Koring/系列产品分发有限许可",
  },
];

export function OobeAgreement() {
  const navigate = useRouteStore((s) => s.navigate);
  const [checked, setChecked] = useState(false);

  return (
    <OobeLayout>
      <div className="w-full max-w-lg flex flex-col items-center gap-5 px-6">
        {/* 标题 */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-foreground">确认产品协议</h2>
          <p className="text-xs text-muted-foreground">您需要同意以下协议才可以继续</p>
        </div>

        {/* 协议链接列表 */}
        <div className="w-full space-y-2">
          {AGREEMENT_LINKS.map((item) => (
            <div
              key={item.label}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-foreground/[0.03] border border-border/40 dark:border-white/[0.06]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-foreground">{item.label}</p>
                <p className="text-[11.5px] text-muted-foreground/70 mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
              <button
                onClick={() => openLink(item.url)}
                className="flex items-center gap-1 px-3 h-7 rounded-lg text-[12px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 cursor-pointer"
              >
                查看
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* 勾选框 */}
        <label className="flex items-start gap-2.5 cursor-pointer select-none group">
          <div className="relative mt-0.5">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-4 h-4 rounded border border-border/60 bg-foreground/[0.03] peer-checked:bg-primary peer-checked:border-primary transition-colors flex items-center justify-center">
              {checked && (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground/70 transition-colors">
            我已详细阅读以上协议，且同意其内容并签署此协议。
          </span>
        </label>
      </div>

      <NextButton onClick={() => navigate("oobe/legal")} disabled={!checked} />
    </OobeLayout>
  );
}
