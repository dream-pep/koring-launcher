import { type ReactNode } from "react";

export function GlassCard({ children }: { children: ReactNode }) {
  return <div className="glass-card px-5 py-4">{children}</div>;
}

export function SettingRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[13px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function PageHeader({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
    </div>
  );
}
