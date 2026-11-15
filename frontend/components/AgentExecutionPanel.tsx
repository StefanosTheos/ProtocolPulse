'use client';

import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { AgentStatusPill } from './StatusPill';
import { REASON_LABEL, sentenceCase } from '@/lib/api/labels';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { AgentExecution, UnknownReason } from '@/lib/api/types';

// Shows the outcome of an automated summary in plain words. The step-by-step tool record
// (tool names, reference IDs, result codes) is technical detail and stays in the audit trail.
export function AgentExecutionView({ execution: e, timeZone }: { execution: AgentExecution; timeZone?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AgentStatusPill status={e.status} />
      </div>
      {e.status === 'UNAVAILABLE' && (
        <p className="rounded border border-line bg-canvas p-2 text-xs">
          Automated summary unavailable. No model ran, so there is nothing to show. Screening, safety checks and case review work as normal.
        </p>
      )}
      {e.status === 'FAILED' && (
        <p className="rounded border border-fail-line bg-fail-bg p-2 text-xs text-fail-fg">
          The automated summary didn&apos;t finish. Screening results are still valid. Nothing below was concluded by the automated summary.
        </p>
      )}
      {e.status === 'PARTIAL' && <p className="rounded border border-unknown-line bg-unknown-bg p-2 text-xs text-unknown-fg">Partial result: some steps did not complete. Treat the summary as incomplete.</p>}
      <p className="text-xs text-ink-muted">Ran {formatInstant(e.created_at, timeZone)}{e.patient_id ? ` for patient ${e.patient_id}` : ''}.</p>
      {e.summary && (
        <div className="rounded border border-info-line bg-info-bg p-2 text-xs">
          <p className="font-semibold text-info-fg">AI-drafted summary (not a clinical decision)</p>
          <p className="mt-1 text-ink">{e.summary}</p>
        </div>
      )}
      {e.unknown_reasons.length > 0 && <p className="text-xs"><span className="text-ink-muted">Open questions:</span> {e.unknown_reasons.map((r) => REASON_LABEL[r as UnknownReason] ?? sentenceCase(r)).join('. ')}</p>}
      {e.verification_questions.length > 0 && (
        <div className="text-xs"><p className="text-ink-muted">Verification questions proposed for humans:</p><ul className="list-disc pl-5">{e.verification_questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
      )}
      {e.evidence_refs.length > 0 && <p className="text-xs text-ink-muted">{e.evidence_refs.length} source record{e.evidence_refs.length === 1 ? '' : 's'} cited. The full step-by-step record is in the audit trail.</p>}
    </div>
  );
}

export function AgentExecutionPanel({ executionId, timeZone }: { executionId: string; timeZone?: string }) {
  const exec = useApiQuery(() => getApi().getAgentExecution(executionId).then((r) => r.data), [executionId]);
  if (exec.loading) return <LoadingSkeleton rows={2} label="Loading automated summary" />;
  if (exec.error) return <ErrorPanel error={exec.error} context="Automated summary" onRetry={exec.reload} />;
  return exec.data ? <AgentExecutionView execution={exec.data} timeZone={timeZone} /> : null;
}
