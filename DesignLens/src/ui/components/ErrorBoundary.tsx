import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("DesignLens UI crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="state-screen">
        <div className="state-icon" style={{ background: "var(--color-critical-soft)", color: "var(--color-critical)" }}>
          !
        </div>
        <div className="state-title">DesignLens hit an unexpected error</div>
        <div className="state-body">
          Open Plugins → Development → Open Console in Figma to see the full stack trace. The message below is a
          starting point.
        </div>
        <pre
          style={{
            maxWidth: 480,
            overflow: "auto",
            textAlign: "left",
            fontSize: 11,
            background: "var(--color-surface-alt)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: 12,
            whiteSpace: "pre-wrap"
          }}
        >
          {this.state.error.message}
        </pre>
        <button className="btn btn-primary" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
