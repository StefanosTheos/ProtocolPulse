'use client';

import { Component, type ReactNode } from 'react';
import { describeError } from '@/lib/api/client';

export function ErrorPanel({ error, onRetry, context }: { error: unknown; onRetry?: () => void; context?: string }) {
  const e = describeError(error);
  return (
    <div role="alert" className="rounded-md border border-fail-line bg-fail-bg p-3 text-fail-fg">
      <p className="font-semibold">{context ? `${context}: ` : ''}{e.title}</p>
      <p className="mt-1 text-ink">{e.message}</p>
      {e.details.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-ink">
          {e.details.map((d, i) => <li key={i}><span className="mono">{d.field}</span>: {d.reason}</li>)}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        {e.requestId && <span>Request ID <span className="mono">{e.requestId}</span></span>}
        {onRetry && <button type="button" className="btn-secondary" onClick={onRetry}>Retry</button>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-surface p-6 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 text-ink-muted">{children}</div>}
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4">
          <ErrorPanel error={this.state.error} context="This view failed to render" onRetry={() => this.setState({ error: null })} />
        </div>
      );
    }
    return this.props.children;
  }
}
