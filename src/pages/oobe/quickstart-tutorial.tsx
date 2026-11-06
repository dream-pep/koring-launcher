//  __         __     __   __     ______     __  __     ______        __   __     ______     ______
// /\ \       /\ \   /\ "-.\ \   /\  ___\   /\ \/ /    /\  ___\      /\ "-.\ \   /\  ___\   /\__  _\
// \ \ \____  \ \ \  \ \ \-.  \  \ \ \__ \  \ \  _"-.  \ \  __\      \ \ \-.  \  \ \  __\   \/_/\ \/
//  \ \_____\  \ \_\  \ \_\\"\_\  \ \_____\  \ \_\ \_\  \ \_____\     \ \_\\"\_\  \ \_____\    \ \_\
//   \/_____/   \/_/   \/_/ \/_/   \/_____/   \/_/\/_/   \/_____/      \/_/ \/_/   \/_____/     \/_/
//
// 所有权利归Lingke Network (china)所有 | dream_pep拥有其艺术改变权力
// 未经允许的情况下删除此版权头可能会受到民事指控
// 请勿在未经Lingke Network (china)允许的范围内修改代码并分发

import { OobeLayout } from "./layout";
import { NextButton } from "./next-button";

interface QuickstartTutorialProps {
  title: string;
  description: string;
  /** 媒体资源地址（public 下资源，需带 BASE_URL 前缀） */
  gif: string;
  /** 素材宽高比（CSS aspect-ratio 值），默认按教程 GIF 的 1350:1004 */
  aspectRatio?: string;
  onNext: () => void;
}

/** 快速上手教程页（标题 + 描述 + 演示素材）。 */
export function QuickstartTutorial({ title, description, gif, aspectRatio = "1350 / 1004", onNext }: QuickstartTutorialProps) {
  return (
    <OobeLayout>
      <div className="w-full max-w-4xl flex flex-col items-center gap-3 px-6">
        <div className="text-center space-y-1.5">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>

        {/* 素材按原始宽高比占位，在「窗口高度 - 布局留白 - 文案区」的剩余空间内尽量放大，
            避免留白边框与噪点感 */}
        <div className="w-full flex justify-center">
          <div
            className="w-full rounded-2xl overflow-hidden border border-border/40 dark:border-white/[0.06] bg-foreground/[0.02] shadow-lg"
            style={{
              maxWidth: `min(calc(68vh * ${aspectRatio}), calc((100vh - 260px) * ${aspectRatio}))`,
              aspectRatio,
            }}
          >
            <img src={gif} alt={title} className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      <NextButton onClick={onNext} />
    </OobeLayout>
  );
}
