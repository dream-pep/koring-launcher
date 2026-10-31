"use client"

/**
 * shadcn 风格 ContextMenu（基于 @base-ui/react/context-menu，与项目 select/switch/radio 同底座）。
 * 用法：
 *   <ContextMenu>
 *     <ContextMenuTrigger render={<button type="button">…</button>} />
 *     <ContextMenuContent>
 *       <ContextMenuItem onClick={…}>重命名</ContextMenuItem>
 *       <ContextMenuSeparator />
 *       <ContextMenuItem className="text-destructive">删除</ContextMenuItem>
 *     </ContextMenuContent>
 *   </ContextMenu>
 */

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

import { cn } from "@/lib/utils"

function ContextMenu(props: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({ className, ...props }: ContextMenuPrimitive.Trigger.Props) {
  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      className={cn(className)}
      {...props}
    />
  )
}

function ContextMenuContent({
  className,
  sideOffset = 4,
  ...props
}: ContextMenuPrimitive.Popup.Props & { sideOffset?: number }) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner sideOffset={sideOffset} className="z-50 outline-none">
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            "min-w-[11rem] max-h-96 overflow-y-auto scroll-area rounded-xl border border-border/50 bg-background p-1.5 text-[13px] text-foreground shadow-xl outline-none origin-[var(--transform-origin)] transition-[scale,transform,opacity] duration-150 ease-spring-soft data-starting-style:opacity-0 data-starting-style:scale-95 data-ending-style:opacity-0 data-ending-style:scale-95",
            className
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

function ContextMenuItem({ className, ...props }: ContextMenuPrimitive.Item.Props) {
  return (
    <ContextMenuPrimitive.Item
      data-slot="context-menu-item"
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-foreground outline-none select-none",
        "data-highlighted:bg-muted",
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground/70",
        className
      )}
      {...props}
    />
  )
}

function ContextMenuSeparator({ className, ...props }: ContextMenuPrimitive.Separator.Props) {
  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function ContextMenuGroup(props: ContextMenuPrimitive.Group.Props) {
  return <ContextMenuPrimitive.Group data-slot="context-menu-group" {...props} />
}

function ContextMenuLabel({ className, ...props }: ContextMenuPrimitive.GroupLabel.Props) {
  return (
    <ContextMenuPrimitive.GroupLabel
      data-slot="context-menu-label"
      className={cn("px-2.5 py-1.5 text-[12px] text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuGroup,
  ContextMenuLabel,
}
