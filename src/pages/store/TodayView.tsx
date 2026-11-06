import { useState } from "react";
import { Search } from "lucide-react";

/**
 * 资源页 → Today 子页面。
 *
 * 目前只有「搜索入口」：居中一个胶囊形横向搜索框，上方一行提示文字。
 * 搜索结果区还没接（后续补），回车暂时只阻止表单默认提交。
 */
export function TodayView() {
  const [keyword, setKeyword] = useState("");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8">
      <p className="text-[15px] text-muted-foreground">你今天要搜什么？</p>

      <form
        className="w-full max-w-[560px]"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div
          className="group flex h-11 items-center gap-2.5 rounded-full border border-black/[0.06]
            bg-white/85 px-4 shadow-sm shadow-black/[0.03] backdrop-blur-[12px] transition-colors
            focus-within:border-primary/40 focus-within:bg-white/95
            dark:border-white/[0.07] dark:bg-black/45 dark:focus-within:bg-black/55"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-colors group-focus-within:text-foreground/70" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索模组、整合包、游戏版本…"
            aria-label="搜索资源"
            className="h-full w-full bg-transparent text-[14px] text-foreground outline-none
              placeholder:text-muted-foreground/50"
          />
        </div>
      </form>
    </div>
  );
}
