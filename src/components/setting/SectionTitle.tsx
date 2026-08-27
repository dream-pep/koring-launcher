import { Typography } from "@heroui/react";

export function PageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <Typography.Heading level={2} className="text-xl font-bold text-foreground mb-1">
        {title}
      </Typography.Heading>
      <Typography.Paragraph size="sm" className="text-sm text-muted-foreground mb-6">
        {desc}
      </Typography.Paragraph>
    </>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography.Heading level={3} className="text-lg font-bold text-foreground mb-3">
      {children}
    </Typography.Heading>
  );
}
