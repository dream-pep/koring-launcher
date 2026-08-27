import { SettingSurface } from "./SettingSurface";

export function SettingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <SettingSurface className={`px-5 py-4 ${className ?? ""}`}>{children}</SettingSurface>;
}
