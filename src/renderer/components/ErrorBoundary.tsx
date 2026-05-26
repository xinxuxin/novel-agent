import React from "react";
import type { ErrorInfo, ReactNode } from "react";

import { redactRenderableText } from "./quality-state-model";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    copied: false
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Renderer error boundary captured an error", {
      message: redactRenderableText(error.message),
      componentStack: redactRenderableText(errorInfo.componentStack ?? "")
    });
  }

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-graphite-950 p-6 text-slate-200">
        <section
          aria-label="Application error"
          className="w-full max-w-2xl rounded-xl border border-red-400/25 bg-black/40 p-5 shadow-glow"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-red-200">
            Redacted Error
          </p>
          <h1 className="mt-2 text-xl font-semibold text-white">WenForge needs a reload</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            A renderer error was caught before it could expose privileged state. The detail below is
            redacted and safe to include in a bug report.
          </p>
          <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-white/10 bg-graphite-900/80 p-3 text-xs text-slate-300">
            {redactRenderableText(this.state.error.message)}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={buttonClassName}
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload
            </button>
            <button
              className={buttonClassName}
              onClick={() => void this.copyDiagnostics()}
              type="button"
            >
              Copy redacted diagnostic info
            </button>
            {this.state.copied ? <span className="text-sm text-forge-mint">Copied</span> : null}
          </div>
        </section>
      </main>
    );
  }

  private async copyDiagnostics(): Promise<void> {
    const bundle = await window.wenforge.diagnostics.exportBundle();
    await navigator.clipboard?.writeText(JSON.stringify(bundle, null, 2));
    this.setState({ copied: true });
  }
}

const buttonClassName =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:border-forge-blue/40 hover:text-white focus:border-forge-blue/60 focus:outline-none";
