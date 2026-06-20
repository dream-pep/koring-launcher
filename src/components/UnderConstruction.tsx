import { Hammer } from "lucide-react";

interface UnderConstructionProps {
  pageName: string;
  description?: string;
}

export function UnderConstruction({ pageName, description }: UnderConstructionProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-foreground/[0.04] mb-5">
          <Hammer className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">{pageName}</h1>
        <p className="text-sm text-muted-foreground mb-1">此页面正在装修中，也许它很快就会与你见面</p>
        {description && (
          <p className="text-[13px] text-muted-foreground/60">{description}</p>
        )}
      </div>
    </div>
  );
}
