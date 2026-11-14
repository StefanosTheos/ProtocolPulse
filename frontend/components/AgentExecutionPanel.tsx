'use client';

import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { AgentStatusPill, Pill } from './StatusPill';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { AgentExecution } from '@/lib/api/types';

// Shows only the backend-recorded summarised tool trace: tool name, reference IDs, result
// code and elapsed time. There is no model reasoning to show and none is fabricated.
export function AgentExecutionView({ execution: e, timeZone }: { execution: AgentExecution; timeZone?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AgentStatusPill status={e.status} />
        <span className="mono">{e.execution_id}</span>
        <Pill tone="neutral">{e.role}</Pill>
        <span className="text-xs text-ink-muted">model {e.model_id ?? 'none'}</span>
      </div>
      {e.status === 'UNAVAILABLE' && (
        <p className="rounded border border-line bg-canvas p-2 text-xs">
          Agent capability unavailable{e.error_code ? <> (<span className="mono">{e.error_code}</span>)</> : null}. No model ran and no tool trace exists. Deterministic screening, monitoring and case workflow are unaffected.
        </p>
      )}
      {e.status === 'FAILED' && (
        <p className="rounded border border-fail-line bg-fail-bg p-2 text-xs text-fail-fg">
          Agent execution failed{e.error_code ? <> with <span className="mono">{e.error_code}</span></> : null}. Any deterministic assessment remains valid; nothing below was concluded by the agent.
        </p>
      )}
      {e.status === 'PARTIAL' && <p className="rounded border border-unknown-line bg-unknown-bg p-2 text-xs text-unknown-fg">Partial result: some tools did not complete. Treat the summary as incomplete.</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-ink-muted">Patient</dt><dd className="mono">{e.patient_id ?? '—'}</dd>
        <dt className="text-ink-muted">Rules</dt><dd className="mono">{e.criterion_ids.join(', ') || '—'}</dd>
        <dt className="text-ink-muted">Event</dt><dd className="mono">{e.event_id ?? '—'}</dd>
        <dt className="text-ink-muted">Correlation</dt><dd className="mono">{e.correlation_id}</dd>
        <dt className="text-ink-muted">Started</dt><dd>{formatInstant(e.created_at, timeZone)}</dd>
        <dt className="text-ink-muted">Finished</dt><dd>{formatInstant(e.finished_at, timeZone)}</dd>
      </dl>
      {e.summary && (
        <div className="rounded border border-info-line bg-info-bg p-2 text-xs">
          <p className="font-semibold text-info-fg">AI-drafted summary (not a clinical decision)</p>
          <p className="mt-1 text-ink">{e.summary}</p>
        </div>
      )}
      {e.unknown_reasons.length > 0 && <p className="text-xs"><span className="text-ink-muted">Unknown reasons:</span> <span className="mono">{e.unknown_reasons.join(', ')}</span></p>}
      {e.verification_questions.length > 0 && (
        <div className="text-xs"><p className="text-ink-muted">Verification questions proposed for humans:</p><ul className="list-disc pl-5">{e.verification_questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
      )}
      {e.trace.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>#</th><th>Tool</th><th>Input refs</th><th>Output refs</th><th>Result</th><th>Elapsed</th></tr></thead>
            <tbody>
              {e.trace.map((t, i) => (
                <tr key={i}>
                  <td className="text-xs">{i + 1}</td>
                  <td className="mono">{t.tool_name}</td>
                  <td className="mono text-2xs">{t.input_reference_ids.join(', ') || '—'}</td>
                  <td className="mono text-2xs">{t.output_reference_ids.join(', ') || '—'}</td>
                  <td className="mono text-2xs">{t.result_code}{t.error_code ? ` / ${t.error_code}` : ''}</td>
                  <td className="whitespace-nowrap text-xs">{t.elapsed_ms} ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : e.status !== 'UNAVAILABLE' && <p className="text-xs text-ink-muted">No tool calls recorded.</p>}
      {e.evidence_refs.length > 0 && <p className="text-xs text-ink-muted">Cited evidence: <span className="mono">{e.evidence_refs.map((r) => r.evidence_id).join(', ')}</span></p>}
    </div>
  );
}

export function AgentExecutionPanel({ executionId, timeZone }: { executionId: string; timeZone?: string }) {
  const exec = useApiQuery(() => getApi().getAgentExecution(executionId).then((r) => r.data), [executionId]);
  if (exec.loading) return <LoadingSkeleton rows={2} label="Loading agent execution" />;
  if (exec.error) return <ErrorPanel error={exec.error} context={`Agent execution ${executionId}`} onRetry={exec.reload} />;
  return exec.data ? <AgentExecutionView execution={exec.data} timeZone={timeZone} /> : null;
}
