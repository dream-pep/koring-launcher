import { Card } from "@heroui/react";

export function SettingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card variant="transparent" className={`glass-card px-5 py-4 ${className ?? ""}`}>
      {children}
    </Card>
  );
}
