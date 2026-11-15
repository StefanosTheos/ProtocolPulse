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
import { KNOWN_ACTIONS, ROLE_LABEL, actionLabel, sentenceCase } from '@/lib/api/labels';
import { DEMO_ACTORS, getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { AuditEntry } from '@/lib/api/types';

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

  const items = audit.data?.items ?? [];
  // Entries grouped by calendar day in the site time zone, newest first (API order).
  const days = useMemo(() => {
    const groups: { day: string; entries: AuditEntry[] }[] = [];
    for (const a of audit.data?.items ?? []) {
      const day = formatInstant(a.occurred_at, tz).split(',')[0];
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.entries.push(a); else groups.push({ day, entries: [a] });
    }
    return groups;
  }, [audit.data, tz]);
  const who = (a: AuditEntry) => ROLE_LABEL[a.actor_role] ?? a.actor_role;

  function exportCsv() {
    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [['Time', 'Who', 'Activity', 'Result', 'Reference'], ...items.map((a) => [formatInstant(a.occurred_at, tz), who(a), actionLabel(a.action), a.result_code, a.target_id])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(quote).join(',')).join('\n')], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-trail-${trialId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="space-y-5">
        <section className="min-w-0 space-y-4" aria-labelledby="audit-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="audit-heading" className="text-xl">Audit trail</h2>
              <p className="text-ink-muted">A permanent record of who did what and when. Entries cannot be edited or removed.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={audit.reload}>Refresh</button>
              <button type="button" className="btn-secondary" disabled={items.length === 0} onClick={exportCsv}>Export CSV</button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="a-actor">Who</label>
              <select id="a-actor" className="input w-auto" value={actorFilter} onChange={(e) => { setCursorStack([undefined]); setActorFilter(e.target.value); }}>
                <option value="">Everyone</option>
                {DEMO_ACTORS.map((a) => <option key={a.actor_id} value={a.actor_id}>{ROLE_LABEL[a.role]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="a-action">Activity</label>
              <select id="a-action" className="input w-auto" value={action} onChange={(e) => { setCursorStack([undefined]); setAction(e.target.value); }}>
                <option value="">All activity</option>
                {KNOWN_ACTIONS.map((k) => <option key={k} value={k}>{actionLabel(k)}</option>)}
              </select>
            </div>
          </div>
          {audit.loading && !audit.data && <LoadingSkeleton rows={5} label="Loading audit trail" />}
          {audit.error ? <ErrorPanel error={audit.error} context="Audit trail (auditor, investigator, monitor or sponsor operations role required)" onRetry={audit.reload} /> : null}
          {audit.data && items.length === 0 && <EmptyState title="No entries">Nothing has been recorded for these filters. Choose &quot;Everyone&quot; or &quot;All activity&quot; to see more.</EmptyState>}
          {days.map((g) => (
            <div key={g.day} className="card overflow-x-auto" tabIndex={0} role="region" aria-label={`Audit entries for ${g.day}`}>
              <h3 className="px-5 pt-4 text-base">{g.day} <span className="font-normal text-ink-muted">· {g.entries.length} {g.entries.length === 1 ? 'entry' : 'entries'}</span></h3>
              <table className="data-table mt-2">
                <thead><tr><th>Time</th><th>Who</th><th>What happened</th><th>Technical details</th></tr></thead>
                <tbody>
                  {g.entries.map((a) => (
                    <tr key={a.audit_id}>
                      <td className="whitespace-nowrap tabular-nums text-ink-muted">{formatInstant(a.occurred_at, tz).split(',').slice(1).join(',').trim()}</td>
                      <td className="whitespace-nowrap font-semibold">{who(a)}</td>
                      <td className="min-w-[16rem]">{actionLabel(a.action)}{a.result_code !== 'OK' && <span className="text-ink-muted"> · {sentenceCase(a.result_code)}</span>}</td>
                      <td className="text-xs">
                        <details>
                          <summary className="text-ink-muted">Show</summary>
                          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2">
                            <dt className="text-ink-muted">Action</dt><dd className="mono">{a.action}</dd>
                            <dt className="text-ink-muted">By</dt><dd className="mono">{a.actor_id}</dd>
                            <dt className="text-ink-muted">Target</dt><dd className="mono break-all">{a.target_type} {a.target_id}{a.target_version ? ` @${a.target_version}` : ''}</dd>
                            <dt className="text-ink-muted">Outputs</dt><dd className="mono break-all">{a.output_ref_ids.join(', ') || '—'}</dd>
                            <dt className="text-ink-muted">Request</dt><dd className="mono break-all">{a.correlation_id} / {a.request_id}</dd>
                          </dl>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {audit.data && items.length > 0 && (
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>Page {cursorStack.length}</span>
              <span className="flex gap-2">
                <button type="button" className="btn-secondary px-2 py-1" disabled={cursorStack.length === 1} onClick={() => setCursorStack((s) => s.slice(0, -1))}>Previous</button>
                <button type="button" className="btn-secondary px-2 py-1" disabled={!audit.data.page.next_cursor} onClick={() => setCursorStack((s) => [...s, audit.data!.page.next_cursor!])}>Next</button>
              </span>
            </div>
          )}
        </section>

        <details className="card">
          <summary className="px-5 py-3 font-semibold">Technical details: automated case summaries</summary>
          <section className="space-y-2 border-t border-line p-5" aria-label="Automated case summaries">
            {health.data && (
              <p className="text-xs">
                Automated summaries: <Pill tone={health.data.llm === 'enabled' ? 'info' : 'neutral'}>{sentenceCase(health.data.llm)}</Pill>
                {health.data.llm !== 'enabled' && <span className="ml-1 text-ink-muted">Cases can be reviewed without them.</span>}
              </p>
            )}
            <p className="text-xs text-ink-muted">Each run lists the tools used, references, result and duration.</p>
            {executionIds.length === 0 && <p className="text-xs text-ink-muted">No automated summaries have been run yet.</p>}
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
        </details>
      </div>
    </div>
  );
}
