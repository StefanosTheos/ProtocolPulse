'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { CandidateTable } from '@/components/CandidateTable';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { JobProgress } from '@/components/JobProgress';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { CANDIDATE_LABEL, Pill } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { ApiError } from '@/lib/api/client';
import { screeningGate } from '@/lib/api/gates';
import { useApiQuery, useIdempotencyKey, useJobRunner } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import { addDays, endOfScreeningDayWatermark, formatInstant } from '@/lib/api/time';
import type { AssessmentQuery, CandidateStatus, UnknownReason } from '@/lib/api/types';

const TABS: { status: CandidateStatus | null; label: string }[] = [
  { status: null, label: 'All' },
  { status: 'POTENTIAL_MATCH', label: CANDIDATE_LABEL.POTENTIAL_MATCH },
  { status: 'NEEDS_REVIEW', label: CANDIDATE_LABEL.NEEDS_REVIEW },
  { status: 'PROTOCOL_CONFLICT', label: CANDIDATE_LABEL.PROTOCOL_CONFLICT },
];
const REASONS: UnknownReason[] = ['MISSING_LAB', 'OUTDATED_LAB', 'DATE_AMBIGUOUS', 'ORDER_ONLY', 'CONFLICTING_SOURCES', 'UNMAPPED_CODE', 'UNAPPROVED_RULE', 'INCOMPLETE_EXTRACTION', 'INSUFFICIENT_ABSENCE_EVIDENCE', 'UNIT_UNSUPPORTED', 'SOURCE_UNAVAILABLE'];
const PAGE_SIZE = 25;

function SelectorInner() {
  const { trialId } = useParams<{ trialId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const activeId = trial.data?.active_protocol_version_id ?? null;
  const protocol = useApiQuery(activeId ? () => getApi().getProtocol(trialId, activeId).then((r) => r.data) : null, [trialId, activeId, actor.actor_id]);

  const runId = search?.get('run') ?? null;
  const status = (search?.get('status') as CandidateStatus | null) ?? null;
  const reason = (search?.get('reason') as UnknownReason | null) ?? null;
  const sort = (search?.get('sort') as AssessmentQuery['sort'] | null) ?? 'patient_id';
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const [query, setQuery] = useState('');

  const base = `/trials/${encodeURIComponent(trialId)}`;
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search?.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setCursorStack([undefined]);
    router.replace(`${base}/selector?${next.toString()}`);
  };

  const run = useApiQuery(runId ? () => getApi().getScreeningRun(runId).then((r) => r.data) : null, [runId, actor.actor_id]);
  const runComplete = run.data?.status === 'COMPLETE';
  const assessments = useApiQuery(
    runId && runComplete ? () => getApi().listAssessments(runId, { status: status ?? undefined, reason: reason ?? undefined, sort, limit: PAGE_SIZE, cursor }).then((r) => r.data) : null,
    [runId, runComplete, status, reason, sort, cursor, actor.actor_id],
  );

  const defaultDate = trial.data ? addDays(trial.data.planned_start_date, -1) : '';
  const [screeningDate, setScreeningDate] = useState<string>('');
  const date = screeningDate || defaultDate;
  const tz = trial.data?.site_timezone ?? 'UTC';
  const cutoff = date ? endOfScreeningDayWatermark(date, tz) : '';
  const screenJob = useJobRunner({ intervalMs: 750, timeoutMs: 90_000 });
  const screenKey = useIdempotencyKey('screen');
  const [screenError, setScreenError] = useState<unknown>(null);

  const gate = screeningGate(trial.data, protocol.data);
  const canRun = actor.role === 'COORDINATOR' || actor.role === 'INVESTIGATOR';

  async function startScreening() {
    if (!activeId || !date) return;
    setScreenError(null);
    try {
      const receipt = await getApi().createScreening(trialId, { protocol_version_id: activeId, screening_date: date, evidence_cutoff_at: cutoff, patient_ids: null, purpose: 'BASELINE' }, screenKey.current());
      const job = await screenJob.run(receipt.data.job_id);
      if (!job) return;
      if (job.status !== 'SUCCEEDED') return;
      const newRunId = receipt.data.resource_id;
      if (!newRunId) throw new ApiError({ status: 0, code: 'BAD_RESPONSE', message: 'Screening job succeeded but returned no run ID.' });
      const finished = await getApi().getScreeningRun(newRunId);
      if (finished.data.status !== 'COMPLETE') {
        throw new ApiError({ status: 0, code: 'RUN_NOT_COMPLETE', message: `Job SUCCEEDED but screening run ${newRunId} is ${finished.data.status}. Results are not shown until the run is COMPLETE.` });
      }
      screenKey.reset();
      setParams({ run: newRunId, status: null, reason: null });
    } catch (e) {
      setScreenError(e);
    }
  }

  const visible = useMemo(() => {
    const items = assessments.data?.items ?? [];
    const q = query.trim().toLowerCase();
    return q ? items.filter((a) => a.patient_id.toLowerCase().includes(q)) : items;
  }, [assessments.data, query]);

  return (
    <div>
      <TrialHeader trialId={trialId} />
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-5">
          <section className="card card-pad space-y-3" aria-labelledby="run-heading">
            <h2 id="run-heading">Baseline screening</h2>
            <p className="text-xs text-ink-muted">Evaluates the five approved eligibility rules for all synthetic patients. A result is a pre-screen, not enrollment.</p>
            {protocol.loading && <LoadingSkeleton rows={1} />}
            {!gate.allowed && (
              <div className="rounded border border-unknown-line bg-unknown-bg p-2 text-xs text-unknown-fg">
                <p className="font-semibold">Screening disabled</p>
                <ul className="list-disc pl-4">{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                <Link href={`${base}/protocol`} className="mt-1 inline-block underline">Review protocol rules</Link>
              </div>
            )}
            <div>
              <label className="label" htmlFor="screen-date">Screening date ({tz})</label>
              <input id="screen-date" type="date" className="input" value={date} onChange={(e) => { screenKey.reset(); setScreeningDate(e.target.value); }} />
            </div>
            <div className="text-xs">
              <span className="text-ink-muted">End-of-screening-day evidence watermark</span>
              <div className="mono">{cutoff || '—'}</div>
              <div className="text-ink-faint">Next local midnight; not the medication-window end.</div>
            </div>
            <button type="button" className="btn-primary w-full" disabled={!gate.allowed || !canRun || screenJob.running || !date} onClick={startScreening}>
              {screenJob.running ? 'Screening…' : 'Run screening'}
            </button>
            {!canRun && <p className="text-xs text-unknown-fg">Coordinator or investigator role required.</p>}
            <JobProgress job={screenJob.job} error={screenJob.error} running={screenJob.running} label="Screening job" />
            {screenError ? <ErrorPanel error={screenError} context="Screening" /> : null}
          </section>

          {run.data && (
            <section className="card card-pad space-y-2 text-xs" aria-labelledby="run-meta">
              <h3 id="run-meta">Run <span className="mono font-normal">{run.data.run_id}</span></h3>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-ink-muted">Status</dt><dd>{run.data.status}{run.data.stale && <Pill tone="unknown">Stale</Pill>}</dd>
                <dt className="text-ink-muted">Screen date</dt><dd>{run.data.screening_date}</dd>
                <dt className="text-ink-muted">Watermark</dt><dd>{formatInstant(run.data.evidence_cutoff_at, tz)}</dd>
                <dt className="text-ink-muted">Protocol</dt><dd className="mono">{run.data.protocol_version_id}</dd>
                <dt className="text-ink-muted">Rule-set hash</dt><dd className="mono break-all">{run.data.approved_set_hash}</dd>
                <dt className="text-ink-muted">Engine</dt><dd className="mono">{run.data.engine_version}</dd>
                <dt className="text-ink-muted">Terminology</dt><dd className="mono">{run.data.terminology_map_version}</dd>
                <dt className="text-ink-muted">Snapshot</dt><dd className="mono">{run.data.evidence_snapshot_id}</dd>
                <dt className="text-ink-muted">Completed</dt><dd>{formatInstant(run.data.completed_at, tz)}</dd>
              </dl>
              {run.data.error_code && <p className="text-fail-fg">Run error: <span className="mono">{run.data.error_code}</span></p>}
            </section>
          )}
        </aside>

        <section className="min-w-0 space-y-3" aria-labelledby="candidates-heading">
          <h2 id="candidates-heading">Candidates</h2>
          {!runId && <EmptyState title="No screening run selected">Run baseline screening once the protocol is approved. Results appear only after the job SUCCEEDED and the run is COMPLETE.</EmptyState>}
          {run.loading && <LoadingSkeleton rows={4} />}
          {run.error ? <ErrorPanel error={run.error} context="Screening run" onRetry={run.reload} /> : null}
          {run.data && !runComplete && (
            <p className="rounded border border-unknown-line bg-unknown-bg p-3 text-unknown-fg">Run is {run.data.status}. Assessments are hidden until it is COMPLETE. <button type="button" className="underline" onClick={run.reload}>Refresh</button></p>
          )}
          {run.data && runComplete && (
            <>
              <div role="tablist" aria-label="Candidate status" className="flex flex-wrap gap-2">
                {TABS.map((t) => {
                  const count = t.status === null ? run.data!.patient_count : run.data!.counts[t.status];
                  const selected = status === t.status;
                  return (
                    <button key={t.label} role="tab" type="button" aria-selected={selected} onClick={() => setParams({ status: t.status })}
                      className={`rounded border px-3 py-1.5 text-sm ${selected ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-line-strong bg-surface text-ink hover:bg-canvas'}`}>
                      {t.label} <span className="ml-1 tabular-nums">{count}</span>
                    </button>
                  );
                })}
                {run.data.counts.EVALUATION_ERROR > 0 && (
                  <span className="self-center"><Pill tone="neutral">Evaluation errors {run.data.counts.EVALUATION_ERROR}</Pill></span>
                )}
              </div>
              <p className="text-xs text-ink-muted">Counts come from screening run <span className="mono">{run.data.run_id}</span> as reported by the API. &quot;Pre-screened potential match&quot; means a candidate for formal investigator screening, never enrollment.</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="label" htmlFor="reason-filter">Reason</label>
                  <select id="reason-filter" className="input w-auto" value={reason ?? ''} onChange={(e) => setParams({ reason: e.target.value || null })}>
                    <option value="">Any reason</option>
                    {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sort">Sort</label>
                  <select id="sort" className="input w-auto" value={sort} onChange={(e) => setParams({ sort: e.target.value })}>
                    <option value="patient_id">Patient ID</option>
                    <option value="-evidence_completeness_percent">Evidence completeness (high first)</option>
                  </select>
                </div>
                <div className="min-w-[12rem] flex-1">
                  <label className="label" htmlFor="search">Search patient ID (this page)</label>
                  <input id="search" type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. P-042" />
                </div>
              </div>
              {assessments.loading && <LoadingSkeleton rows={5} label="Loading assessments" />}
              {assessments.error ? <ErrorPanel error={assessments.error} context="Assessments" onRetry={assessments.reload} /> : null}
              {assessments.data && (
                <div className="card">
                  <CandidateTable trialId={trialId} runId={run.data.run_id} assessments={visible} />
                  <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-ink-muted">
                    <span>
                      Page {cursorStack.length}
                      {assessments.data.page.total_count !== null && <> · {assessments.data.page.total_count} matching</>}
                    </span>
                    <span className="flex gap-2">
                      <button type="button" className="btn-secondary px-2 py-1" disabled={cursorStack.length === 1} onClick={() => setCursorStack((s) => s.slice(0, -1))}>Previous</button>
                      <button type="button" className="btn-secondary px-2 py-1" disabled={!assessments.data.page.next_cursor} onClick={() => setCursorStack((s) => [...s, assessments.data!.page.next_cursor!])}>Next</button>
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

export default function SelectorPage() {
  return <Suspense fallback={<LoadingSkeleton rows={4} />}><SelectorInner /></Suspense>;
}
