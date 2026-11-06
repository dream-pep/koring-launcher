import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface WizardLayoutProps {
  children: ReactNode;
}

/** 内容区顶部最小留白（避免贴着窗口上沿） */
const MIN_TOP_GAP = 24;
/** 内容与底部 NextButton 之间需要保留的距离（按钮底部 48px + 按钮高度 48px + 间隙 16px） */
const BUTTON_CLEARANCE = 112;

/**
 * OOBE / UPVP 向导的通用布局框架。
 *
 * 布局策略（内容区顶部留白动态计算）：
 * - 内容放得下、且与底部 NextButton 之间仍有足够距离 → 垂直居中（paddingTop = (可用高度 - 内容高度) / 2）；
 * - 内容开始逼近按钮 → 不再向下挤，而是整体上移（内容向上扩展），
 *   内容底部与按钮始终保持 BUTTON_CLEARANCE 的距离；
 * - 内容仍然超高时，顶部留白收到 MIN_TOP_GAP 并让内容区自身滚动，溢出部分可滚动查看。
 *
 * NextButton 仍以绝对定位挂在底部居中（相对本布局），不随内容滚动。
 */
export function WizardLayout({ children }: WizardLayoutProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [paddingTop, setPaddingTop] = useState(MIN_TOP_GAP);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const update = () => {
      const available = viewport.clientHeight;
      const needed = content.offsetHeight;
      // 居中时需要的顶部留白
      const centered = (available - needed) / 2;
      // 保证内容底部与按钮留出距离时允许的最大顶部留白
      const maxTop = available - needed - BUTTON_CLEARANCE;
      const next = Math.max(MIN_TOP_GAP, Math.min(centered, maxTop));
      setPaddingTop((prev) => (Math.abs(prev - next) < 0.5 ? prev : Math.round(next)));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative h-full min-h-0 flex flex-col px-8">
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
      >
        <div style={{ paddingTop, paddingBottom: BUTTON_CLEARANCE }}>
          <div ref={contentRef} className="w-full flex flex-col items-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
