'use client';

import { Component, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import { friendlyError, isNotFound } from '@/lib/api/errors';

export function ErrorPanel({ error, onRetry, context }: { error: unknown; onRetry?: () => void; context?: string }) {
  const e = friendlyError(error);
  // A permission refusal is not a fault, so it is shown in neutral colours.
  const neutral = error instanceof ApiError && (error.status === 403 || error.code === 'CANCELLED');
  return (
    <div role={neutral ? 'status' : 'alert'} className={`rounded-lg border p-3 ${neutral ? 'border-line bg-canvas text-ink-muted' : 'border-fail-line bg-fail-bg text-fail-fg'}`}>
      <p className="font-semibold">{context ? `${context}: ` : ''}{e.title}</p>
      <p className="mt-1 text-ink">{e.message}</p>
      {e.fieldMessages.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-ink">{e.fieldMessages.map((m) => <li key={m}>{m}</li>)}</ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        {onRetry && !isNotFound(error) && <button type="button" className="btn-secondary" onClick={onRetry}>Try again</button>}
        <details>
          <summary>Technical details</summary>
          <p className="mono mt-1 break-all">{e.technical}{e.requestId ? ` · Request ID ${e.requestId}` : ''}</p>
        </details>
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
