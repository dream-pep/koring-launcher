import { Typography } from "@heroui/react";

export function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <Typography.Paragraph className="text-sm font-medium text-foreground">{label}</Typography.Paragraph>
        {desc && (
          <Typography.Paragraph size="xs" className="text-[13px] text-muted-foreground mt-0.5">
            {desc}
          </Typography.Paragraph>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
