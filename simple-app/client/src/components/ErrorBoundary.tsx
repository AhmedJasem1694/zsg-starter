import React from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, errorInfo: info });
    console.error("[ErrorBoundary] Unhandled error:", error, info.componentStack);
  }

  handleGoBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/app/legal/dashboard";
    }
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-lg w-full rounded-xl border border-[#450A0A] bg-[#1F0A0A] px-8 py-10 text-center space-y-4">
            <AlertTriangle size={32} className="text-[#FCA5A5] mx-auto" />
            <div className="space-y-2">
              <div className="text-base font-semibold text-[#FCA5A5]">Something went wrong</div>
              <p className="text-xs text-[#FCA5A5]/70 leading-relaxed">
                An unexpected error occurred. Please refresh the page and try again.
                If this keeps happening, contact{" "}
                <a href="mailto:support@zanelegal.ai" className="underline">
                  support@zanelegal.ai
                </a>
              </p>
            </div>

            {/* Dev-only error details — shows exact crash on screen */}
            {isDev && this.state.error && (
              <details className="text-left mt-2">
                <summary className="text-xs text-[#FCA5A5]/60 cursor-pointer hover:text-[#FCA5A5]/80">
                  Error details (dev only)
                </summary>
                <div className="mt-2 space-y-2">
                  <pre className="text-[10px] text-[#FCA5A5]/80 bg-[#2A0505] rounded p-3 overflow-auto max-h-40 whitespace-pre-wrap text-left">
                    {this.state.error.toString()}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="text-[10px] text-[#FCA5A5]/60 bg-[#2A0505] rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap text-left">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => this.handleGoBack()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#450A0A] bg-transparent text-[#FCA5A5] text-sm font-semibold hover:bg-[#450A0A]/30 transition-colors"
              >
                Go back
              </button>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#450A0A] text-[#FCA5A5] text-sm font-semibold hover:bg-[#5A0E0E] transition-colors"
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
