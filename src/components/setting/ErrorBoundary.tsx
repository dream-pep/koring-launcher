import { Component, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; errorMsg: string; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMsg: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <AlertTriangle className="w-12 h-12 text-destructive/50" />
          <p className="text-sm text-muted-foreground text-center max-w-[320px]">
            页面渲染出错，请尝试刷新
          </p>
          <p className="text-[11px] text-muted-foreground/50 font-mono text-center max-w-[400px] break-all">
            {this.state.errorMsg}
          </p>
          <Button
            size="sm"
            variant="flat"
            onPress={() => this.setState({ hasError: false, errorMsg: "" })}
          >
            重试
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
