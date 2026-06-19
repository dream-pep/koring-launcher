import { Button } from "@/components/ui/button";

interface HomeProps {
  onNavigate: (page: "debug") => void;
}

export function Home({ onNavigate }: HomeProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Koring Launcher</h1>
        <p className="text-muted-foreground mb-6">Core 调试模式</p>
        <Button variant="outline" onClick={() => onNavigate("debug")}>
          Debug
        </Button>
      </div>
    </div>
  );
}
