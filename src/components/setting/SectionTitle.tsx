export function PageHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <>
      <h2 className="text-xl font-bold text-foreground mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{desc}</p>
    </>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold text-foreground mb-3">{children}</h3>;
}
