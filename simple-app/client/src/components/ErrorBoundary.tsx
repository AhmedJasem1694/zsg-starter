import React from "react";
import { AlertTriangle } from "lucide-react";

interface State { hasError: boolean; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full rounded-xl border border-[#450A0A] bg-[#1F0A0A] px-8 py-10 text-center space-y-4">
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
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#450A0A] text-[#FCA5A5] text-sm font-semibold hover:bg-[#5A0E0E] transition-colors"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
