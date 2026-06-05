/**
 * React Error Boundary — prevents full app crash from component errors.
 */
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-red-100 shadow-sm text-center space-y-4">
          <div className="p-3 bg-red-50 rounded-full border border-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-800">
              Something went wrong
            </h3>
            <p className="text-sm text-slate-500 max-w-md">
              {this.props.fallbackMessage ||
                "An unexpected error occurred in this section. Try refreshing."}
            </p>
            {this.state.error && (
              <p className="text-xs font-mono text-red-600 bg-red-50 border border-red-100 rounded px-3 py-1.5 mt-2 max-w-md">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
