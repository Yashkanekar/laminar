import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackText: string;
}

interface State {
  hasError: boolean;
}

export class LaminarErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Laminar Stream Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="laminar-fallback" style={{ whiteSpace: "pre-wrap" }}>
          {this.props.fallbackText}
        </div>
      );
    }

    return this.props.children;
  }
}
