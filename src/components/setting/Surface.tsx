import { cn } from "@/lib/utils"

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "raised" | "flat" | "bordered"
  frost?: "none" | "sm" | "md" | "lg"
  padding?: "none" | "sm" | "md" | "lg"
}

const frostMap = {
  none: "",
  sm: "backdrop-blur-[6px]",
  md: "backdrop-blur-[12px]",
  lg: "backdrop-blur-[20px]",
}

const paddingMap = {
  none: "",
  sm: "px-3 py-2.5",
  md: "px-5 py-4",
  lg: "px-6 py-5",
}

function Surface({
  variant = "raised",
  frost = "none",
  padding = "md",
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      className={cn(
        "rounded-xl transition-colors duration-200",
        "bg-white/85 dark:bg-black/45",
        "border border-black/[0.06] dark:border-white/[0.07]",
        frostMap[frost],
        paddingMap[padding],
        variant === "raised" && "shadow-sm",
        variant === "bordered" && "shadow-none",
        variant === "flat" && "shadow-none bg-transparent border-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SurfaceHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="surface-header"
      className={cn(
        "flex items-center gap-2 mb-3 pb-3 border-b border-black/[0.06] dark:border-white/[0.06]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SurfaceContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="surface-content" className={cn("space-y-3", className)} {...props}>
      {children}
    </div>
  )
}

export { Surface, SurfaceHeader, SurfaceContent }
