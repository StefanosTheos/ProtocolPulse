'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { CaseReviewPanel } from '@/components/CaseReviewPanel';
import { CaseRow } from '@/components/CaseRow';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { CaseStatus } from '@/lib/api/types';

const STATUS_FILTERS: CaseStatus[] = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'REOPENED', 'RESOLVED', 'CLOSED'];

function CasesInner() {
  const { trialId } = useParams<{ trialId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const selected = search?.get('case') ?? null;
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [mine, setMine] = useState(false);
  const cases = useApiQuery(
    () => getApi().listCases(trialId, { status: status || undefined, assigned_actor_id: mine ? actor.actor_id : undefined, sort: '-updated_at', limit: 50 }).then((r) => r.data),
    [trialId, status, mine, actor.actor_id],
  );
  const select = (caseId: string) => router.replace(`/trials/${encodeURIComponent(trialId)}/cases?case=${encodeURIComponent(caseId)}`);

  return (
    <div>
      <TrialHeader trialId={trialId} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <section className="min-w-0 space-y-3" aria-labelledby="queue-heading">
          <div>
            <h2 id="queue-heading">Clinical review queue</h2>
            <p className="text-xs text-ink-muted">Cases opened by backend monitoring rules. Resolving and closing are investigator-only.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="case-status">Status</label>
              <select id="case-status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as CaseStatus | '')}>
                <option value="">All statuses</option>
                {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to {actor.actor_id}</label>
            <button type="button" className="btn-secondary mb-0.5" onClick={cases.reload}>Refresh</button>
          </div>
          {cases.loading && !cases.data && <LoadingSkeleton rows={4} label="Loading cases" />}
          {cases.error ? <ErrorPanel error={cases.error} context="Cases" onRetry={cases.reload} /> : null}
          {cases.data && cases.data.items.length === 0 && <EmptyState title="No cases">No review cases match. Cases open when the backend records a relevant monitoring finding.</EmptyState>}
          {cases.data && cases.data.items.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Case</th><th>Patient</th><th>Rule</th><th>Status</th><th>Priority</th><th>Owner</th><th>Updated</th></tr></thead>
                <tbody>{cases.data.items.map((c) => <CaseRow key={c.case_id} trialId={trialId} reviewCase={c} selected={c.case_id === selected} onSelect={select} />)}</tbody>
              </table>
            </div>
          )}
        </section>
        <aside className="min-w-0">
          {selected
            ? <div className="card card-pad"><CaseReviewPanel key={selected} trialId={trialId} caseId={selected} timeZone={trial.data?.site_timezone} onUpdated={cases.reload} /></div>
            : <EmptyState title="Select a case">Choose a case to inspect its evidence, summary, agent trace and decision history.</EmptyState>}
        </aside>
      </div>
    </div>
  );
}

export default function CasesPage() {
  return <Suspense fallback={<LoadingSkeleton rows={4} />}><CasesInner /></Suspense>;
}
