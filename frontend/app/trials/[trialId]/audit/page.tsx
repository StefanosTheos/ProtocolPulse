'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { AgentExecutionPanel } from '@/components/AgentExecutionPanel';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Pill } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { useApiQuery } from '@/lib/api/hooks';
import { DEMO_ACTORS, getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';

export default function AuditPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const tz = trial.data?.site_timezone;
  const [action, setAction] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const audit = useApiQuery(
    () => getApi().listAudit(trialId, { action: action.trim() || undefined, actor_id: actorFilter || undefined, sort: '-occurred_at', limit: 50, cursor }).then((r) => r.data),
    [trialId, action, actorFilter, cursor, actor.actor_id],
  );
  const health = useApiQuery(() => getApi().getHealth().then((r) => r.data), []);
  const cases = useApiQuery(() => getApi().listCases(trialId, { limit: 100 }).then((r) => r.data), [trialId, actor.actor_id]);
  const [lookup, setLookup] = useState('');
  const [lookedUp, setLookedUp] = useState<string | null>(null);

  // No list-executions route exists; executions are discovered from cases and audit targets.
  const executionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of cases.data?.items ?? []) if (c.agent_execution_id) ids.add(c.agent_execution_id);
    for (const a of audit.data?.items ?? []) if (/AGENT/i.test(a.target_type)) ids.add(a.target_id);
    return [...ids];
  }, [cases.data, audit.data]);
  const [openExec, setOpenExec] = useState<string | null>(null);

  return (
    <div>
      <TrialHeader trialId={trialId} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section className="min-w-0 space-y-3" aria-labelledby="audit-heading">
          <div>
            <h2 id="audit-heading">Audit trail</h2>
            <p className="text-xs text-ink-muted">Append-only entries from the backend: actor, action, target, correlation and request IDs.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="a-action">Action (exact)</label>
              <input id="a-action" className="input w-56" value={action} onChange={(e) => { setCursorStack([undefined]); setAction(e.target.value); }} placeholder="e.g. PROTOCOL_APPROVED" />
            </div>
            <div>
              <label className="label" htmlFor="a-actor">Actor</label>
              <select id="a-actor" className="input w-auto" value={actorFilter} onChange={(e) => { setCursorStack([undefined]); setActorFilter(e.target.value); }}>
                <option value="">Any actor</option>
                {DEMO_ACTORS.map((a) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id}</option>)}
              </select>
            </div>
            <button type="button" className="btn-secondary mb-0.5" onClick={audit.reload}>Refresh</button>
          </div>
          {audit.loading && !audit.data && <LoadingSkeleton rows={5} label="Loading audit" />}
          {audit.error ? <ErrorPanel error={audit.error} context="Audit (auditor, investigator, monitor or sponsor-ops role required)" onRetry={audit.reload} /> : null}
          {audit.data && audit.data.items.length === 0 && <EmptyState title="No audit entries">Nothing has been recorded for these filters.</EmptyState>}
          {audit.data && audit.data.items.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th><th>Outputs</th><th>Correlation / request</th></tr></thead>
                <tbody>
                  {audit.data.items.map((a) => (
                    <tr key={a.audit_id}>
                      <td className="whitespace-nowrap text-xs">{formatInstant(a.occurred_at, tz)}</td>
                      <td><span className="mono">{a.actor_id}</span><div className="text-2xs text-ink-faint">{a.actor_role}</div></td>
                      <td className="mono">{a.action}</td>
                      <td><span className="text-2xs text-ink-faint">{a.target_type}</span><div className="mono">{a.target_id}{a.target_version ? ` @${a.target_version}` : ''}</div></td>
                      <td className="mono text-xs">{a.result_code}</td>
                      <td className="mono text-2xs">{a.output_ref_ids.join(', ') || '—'}</td>
                      <td className="mono text-2xs text-ink-faint">{a.correlation_id}<br />{a.request_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-ink-muted">
                <span>Page {cursorStack.length}</span>
                <span className="flex gap-2">
                  <button type="button" className="btn-secondary px-2 py-1" disabled={cursorStack.length === 1} onClick={() => setCursorStack((s) => s.slice(0, -1))}>Previous</button>
                  <button type="button" className="btn-secondary px-2 py-1" disabled={!audit.data.page.next_cursor} onClick={() => setCursorStack((s) => [...s, audit.data!.page.next_cursor!])}>Next</button>
                </span>
              </div>
            </div>
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="card card-pad space-y-2" aria-labelledby="agent-heading">
            <h2 id="agent-heading">Agent activity</h2>
            {health.data && (
              <p className="text-xs">
                LLM capability: <Pill tone={health.data.llm === 'enabled' ? 'info' : 'neutral'}>{health.data.llm}</Pill>
                {health.data.llm !== 'enabled' && <span className="ml-1 text-ink-muted">Agent investigations report UNAVAILABLE; deterministic workflows continue.</span>}
              </p>
            )}
            <p className="text-xs text-ink-muted">Summarised tool traces only: tool, reference IDs, result and duration. No chain-of-thought is stored or shown.</p>
            {executionIds.length === 0 && <p className="text-xs text-ink-muted">No agent executions referenced by cases or audit entries yet.</p>}
            <ul className="space-y-2">
              {executionIds.map((id) => (
                <li key={id} className="rounded border border-line p-2">
                  <button type="button" className="mono text-brand underline-offset-2 hover:underline" aria-expanded={openExec === id} onClick={() => setOpenExec((o) => (o === id ? null : id))}>{id}</button>
                  {openExec === id && <div className="mt-2"><AgentExecutionPanel executionId={id} timeZone={tz} /></div>}
                </li>
              ))}
            </ul>
            <form className="flex gap-2 pt-2" onSubmit={(e) => { e.preventDefault(); setLookedUp(lookup.trim() || null); }}>
              <label className="sr-only" htmlFor="exec-lookup">Agent execution ID</label>
              <input id="exec-lookup" className="input" value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="Execution ID" />
              <button type="submit" className="btn-secondary">Inspect</button>
            </form>
            {lookedUp && <AgentExecutionPanel key={lookedUp} executionId={lookedUp} timeZone={tz} />}
          </section>
        </aside>
      </div>
    </div>
  );
}
