'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
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
import { REASON_LABEL } from '@/lib/api/labels';
import { forgetRun, getLastRun, rememberRun } from '@/lib/api/lastRun';
import { getApi } from '@/lib/api/runtime';
import { addDays, endOfScreeningDayWatermark, formatInstant } from '@/lib/api/time';
import type { AssessmentQuery, CandidateStatus, Criterion, UnknownReason } from '@/lib/api/types';

// "Needs review" comes first and is the default: those patients are the reviewer's work.
const TABS: { status: CandidateStatus | null; label: string }[] = [
  { status: 'NEEDS_REVIEW', label: CANDIDATE_LABEL.NEEDS_REVIEW },
  { status: 'POTENTIAL_MATCH', label: CANDIDATE_LABEL.POTENTIAL_MATCH },
  { status: 'PROTOCOL_CONFLICT', label: CANDIDATE_LABEL.PROTOCOL_CONFLICT },
  { status: null, label: 'All patients' },
];
const REASONS = Object.keys(REASON_LABEL) as UnknownReason[];
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
  const statusParam = search?.get('status') ?? null;
  const status: CandidateStatus | null = statusParam === 'ALL' ? null : (statusParam as CandidateStatus | null) ?? 'NEEDS_REVIEW';
  const reason = (search?.get('reason') as UnknownReason | null) ?? null;
  const sort = (search?.get('sort') as AssessmentQuery['sort'] | null) ?? 'patient_id';
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursorStack[cursorStack.length - 1];
  const [query, setQuery] = useState('');
  const [justRan, setJustRan] = useState(false);

  const base = `/trials/${encodeURIComponent(trialId)}`;
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(search?.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setCursorStack([undefined]);
    router.replace(`${base}/selector?${next.toString()}`);
  };

  const run = useApiQuery(runId ? () => getApi().getScreeningRun(runId).then((r) => r.data) : null, [runId, actor.actor_id]);
  const runComplete = run.data?.status === 'COMPLETE';

  // Opened from a tab or link without ?run=: show the last screening run instead of an empty page.
  useEffect(() => {
    if (runId) return;
    const remembered = getLastRun(trialId);
    if (remembered) setParams({ run: remembered });
    // setParams changes on every render; this should only run when the URL has no run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, trialId]);
  useEffect(() => {
    if (runId && runComplete) rememberRun(trialId, runId);
  }, [runId, runComplete, trialId]);
  useEffect(() => {
    // A remembered run the backend no longer has (for example after a reset) is dropped.
    if (runId && run.error instanceof ApiError && run.error.status === 404) {
      forgetRun(trialId, runId);
      setParams({ run: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.error, runId, trialId]);
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
  const criteriaById = useMemo(() => Object.fromEntries((protocol.data?.criteria ?? []).map((c) => [c.criterion_id, c])) as Record<string, Criterion>, [protocol.data]);

  async function startScreening() {
    if (!activeId || !date) return;
    setScreenError(null);
    setJustRan(false);
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
      setJustRan(true);
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
      <div className="space-y-5">
        <div>
          <h2 className="text-xl">Screen patients</h2>
          <p className="text-ink-muted">Next: Run screening, review each candidate’s evidence, then record the disposition and any externally confirmed participation from their patient page. Safety follows new events during recorded participation. A potential match does not enroll a patient.</p>
        </div>

        <section className="card card-pad space-y-3" aria-labelledby="run-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h3 id="run-heading" className="text-base">Baseline screening</h3>
              {run.data
                ? <p className="text-ink-muted">{run.data.patient_count} patients screened for {run.data.screening_date}{run.data.completed_at ? ` · Completed ${formatInstant(run.data.completed_at, tz)}` : ''}{run.data.stale && <> <Pill tone="unknown">Out of date</Pill></>}</p>
                : <p className="text-ink-muted">Uses records available up to the end of the screening day.</p>}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="label" htmlFor="screen-date">Screening date</label>
                <input id="screen-date" type="date" className="input" value={date} disabled={!canRun} onChange={(e) => { screenKey.reset(); setScreeningDate(e.target.value); }} />
              </div>
              <button type="button" className="btn-primary" disabled={!gate.allowed || !canRun || screenJob.running || !date} onClick={startScreening}>
                {screenJob.running ? 'Screening…' : 'Run screening'}
              </button>
            </div>
          </div>
          {protocol.loading && <LoadingSkeleton rows={1} />}
          {!gate.allowed && (
            <div className="rounded-lg border border-unknown-line bg-unknown-bg p-3 text-unknown-fg">
              <p className="font-semibold">Screening disabled</p>
              <ul className="list-disc pl-5">{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
              <Link href={`${base}/protocol`} className="mt-1 inline-block underline">Review protocol rules</Link>
            </div>
          )}
          {!canRun && <p className="note">Screening is run by the Clinical Lead.</p>}
          <JobProgress job={screenJob.job} error={screenJob.error} running={screenJob.running} label="Screening" />
          {screenError ? <ErrorPanel error={screenError} context="Screening" /> : null}
          {run.data?.error_code && <p className="text-fail-fg">Screening did not finish. Run it again.</p>}
          {run.data && (
            <details className="text-xs">
              <summary className="font-semibold text-ink-muted">Technical details</summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-ink-muted">Run</dt><dd className="mono break-all">{run.data.run_id}</dd>
                <dt className="text-ink-muted">Status</dt><dd>{run.data.status}</dd>
                <dt className="text-ink-muted">Records up to</dt><dd>{formatInstant(run.data.evidence_cutoff_at, tz)}</dd>
                <dt className="text-ink-muted">Protocol</dt><dd className="mono break-all">{run.data.protocol_version_id}</dd>
                <dt className="text-ink-muted">Rule-set hash</dt><dd className="mono break-all">{run.data.approved_set_hash}</dd>
                <dt className="text-ink-muted">Engine</dt><dd className="mono">{run.data.engine_version}</dd>
                <dt className="text-ink-muted">Terminology</dt><dd className="mono">{run.data.terminology_map_version}</dd>
                <dt className="text-ink-muted">Snapshot</dt><dd className="mono break-all">{run.data.evidence_snapshot_id}</dd>
                {run.data.error_code && <><dt className="text-ink-muted">Error</dt><dd className="mono">{run.data.error_code}</dd></>}
              </dl>
            </details>
          )}
        </section>

        {justRan && run.data && runComplete && (
          <div role="status" className="done-banner">
            <p className="font-semibold text-pass-fg">✓ Screening completed. {run.data.patient_count} patients checked, {run.data.counts.NEEDS_REVIEW} need review.</p>
            <button type="button" className="btn-primary" onClick={() => { setJustRan(false); setParams({ status: null }); }}>Next: Review these patients</button>
          </div>
        )}

        <section className="min-w-0 space-y-4" aria-labelledby="candidates-heading">
          <h2 id="candidates-heading">Candidates</h2>
          {!runId && <EmptyState title="No screening yet">Run baseline screening once the protocol is approved. Results appear when screening has finished.</EmptyState>}
          {run.loading && <LoadingSkeleton rows={4} />}
          {run.error ? <ErrorPanel error={run.error} context="Screening" onRetry={run.reload} /> : null}
          {run.data && !runComplete && (
            <p className="rounded-lg border border-unknown-line bg-unknown-bg p-3 text-unknown-fg">Screening is still in progress. Results appear when it has finished. <button type="button" className="underline" onClick={run.reload}>Refresh</button></p>
          )}
          {run.data && runComplete && (
            <>
              <div role="tablist" aria-label="Filter by result" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {TABS.map((t) => {
                  const count = t.status === null ? run.data!.patient_count : run.data!.counts[t.status];
                  const selected = status === t.status;
                  return (
                    <button key={t.label} role="tab" type="button" aria-selected={selected} onClick={() => setParams({ status: t.status ?? 'ALL' })}
                      className={`flex flex-col items-start rounded-xl border-2 px-4 py-3 text-left ${selected ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink hover:bg-canvas'}`}>
                      <span className="text-2xl font-bold tabular-nums leading-tight">{count}</span>
                      <span className="font-semibold">{t.label}</span>
                    </button>
                  );
                })}
              </div>
              {run.data.counts.EVALUATION_ERROR > 0 && <p><Pill tone="neutral">{run.data.counts.EVALUATION_ERROR} could not be evaluated</Pill></p>}
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[12rem] flex-1">
                  <label className="label" htmlFor="search">Find a patient (this page)</label>
                  <input id="search" type="search" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Patient ID, e.g. P-042" />
                </div>
                <div>
                  <label className="label" htmlFor="reason-filter">Reason</label>
                  <select id="reason-filter" className="input w-auto" value={reason ?? ''} onChange={(e) => setParams({ reason: e.target.value || null })}>
                    <option value="">Any reason</option>
                    {REASONS.map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sort">Sort</label>
                  <select id="sort" className="input w-auto" value={sort} onChange={(e) => setParams({ sort: e.target.value })}>
                    <option value="patient_id">Patient ID</option>
                    <option value="-evidence_completeness_percent">Most complete record first</option>
                  </select>
                </div>
              </div>
              {assessments.loading && <LoadingSkeleton rows={5} label="Loading patients" />}
              {assessments.error ? <ErrorPanel error={assessments.error} context="Patients" onRetry={assessments.reload} /> : null}
              {assessments.data && (
                <div className="card">
                  <CandidateTable trialId={trialId} runId={run.data.run_id} assessments={visible} criteriaById={criteriaById} />
                  <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-muted">
                    <span>
                      Page {cursorStack.length}
                      {assessments.data.page.total_count !== null && <> · {assessments.data.page.total_count} patients</>}
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
