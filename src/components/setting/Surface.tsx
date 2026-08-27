import { cn } from "@/lib/utils";
import { SettingSurface } from "./SettingSurface";

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "raised" | "flat" | "bordered";
  frost?: "none" | "sm" | "md" | "lg";
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "px-3 py-2.5",
  md: "px-5 py-4",
  lg: "px-6 py-5",
};

// Surface 是 SettingSurface 的兼容别名（保留原 API，样式与设置卡片统一）
function Surface({
  variant = "raised",
  frost = "none",
  padding = "md",
  className,
  children,
  ...props
}: SurfaceProps) {
  return (
    <SettingSurface
      variant={variant}
      frost={frost !== "none"}
      className={cn(
        paddingMap[padding],
        variant === "flat" && "bg-transparent border-0 backdrop-blur-none",
        className,
      )}
      {...props}
    >
      {children}
    </SettingSurface>
  );
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
  );
}

function SurfaceContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="surface-content" className={cn("space-y-3", className)} {...props}>
      {children}
    </div>
  );
}

export { Surface, SurfaceHeader, SurfaceContent }
