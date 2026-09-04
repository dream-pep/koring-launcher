"use client"

/**
 * shadcn 风格 Select（基于 @base-ui/react/select，与项目 switch/radio/slider 同底座）。
 * 用法：
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger aria-label="x"><SelectValue placeholder="请选择" /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">A</SelectItem>
 *     </SelectContent>
 *   </Select>
 */

import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"

function Select({
  className,
  ...props
}: SelectPrimitive.Root.Props<string>) {
  return (
    <SelectPrimitive.Root
      data-slot="select"
      className={cn("", className)}
      {...props}
    />
  )
}

function SelectValue({
  className,
  placeholder,
  ...props
}: SelectPrimitive.Value.Props & { placeholder?: string }) {
  if (placeholder) {
    return (
      <SelectPrimitive.Value
        placeholder={placeholder}
        data-slot="select-value"
        className={cn("text-[13px] text-foreground data-[placeholder]:text-muted-foreground/60", className)}
        {...props}
      />
    )
  }
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("text-[13px] text-foreground", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  ...props
}: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "inline-flex h-8 w-full shrink-0 items-center justify-between gap-2 rounded-lg border border-border/40 bg-white/60 px-3 text-[13px] text-foreground outline-none transition-colors select-none dark:bg-black/30 dark:border-white/[0.08] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 hover:border-ring/50",
        className
      )}
      {...props}
    />
  )
}

function SelectIcon({ className, ...props }: SelectPrimitive.Icon.Props) {
  return (
    <SelectPrimitive.Icon
      data-slot="select-icon"
      className={cn("shrink-0 text-muted-foreground/60", className)}
      {...props}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </SelectPrimitive.Icon>
  )
}

function SelectContent({
  className,
  position = "popper",
  side = "bottom",
  sideOffset = 4,
  ...props
}: SelectPrimitive.Popup.Props & {
  position?: "popper" | "item-aligned"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        className={cn(
          "z-50",
          position === "popper" &&
            "w-[var(--anchor-width)] min-w-[10rem]"
        )}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "relative max-h-72 min-w-[10rem] overflow-y-auto scroll-area rounded-xl border border-border/50 bg-background p-1.5 text-[13px] text-foreground shadow-xl outline-none",
            className
          )}
          {...props}
        />
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "group/item relative flex w-full cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-8 pl-2.5 text-[13px] text-foreground outline-none select-none",
        "data-highlighted:bg-muted data-selected:bg-primary/10 data-selected:text-primary",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 text-primary">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.Label.Props) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("px-2.5 py-1.5 text-[12px] text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectIcon,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
}
