'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { CaseReviewPanel } from '@/components/CaseReviewPanel';
import { CaseTable } from '@/components/CaseRow';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { useApiQuery } from '@/lib/api/hooks';
import { sentenceCase } from '@/lib/api/labels';
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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <section className="min-w-0 space-y-3" aria-labelledby="queue-heading">
          <div>
            <Link href={`/trials/${encodeURIComponent(trialId)}/monitor`} className="btn-ghost -ml-3 mb-1">← Safety</Link>
            <h2 id="queue-heading" className="text-xl">Review cases</h2>
            <p className="text-ink-muted">Safety findings that need a decision from a person. The Clinical Lead acknowledges, investigates, resolves and closes cases.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="case-status">Status</label>
              <select id="case-status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value as CaseStatus | '')}>
                <option value="">All statuses</option>
                {STATUS_FILTERS.map((s) => <option key={s} value={s}>{sentenceCase(s)}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Assigned to me</label>
            <button type="button" className="btn-secondary mb-0.5" onClick={cases.reload}>Refresh</button>
          </div>
          {cases.loading && !cases.data && <LoadingSkeleton rows={4} label="Loading cases" />}
          {cases.error ? <ErrorPanel error={cases.error} context="Cases" onRetry={cases.reload} /> : null}
          {cases.data && cases.data.items.length === 0 && <EmptyState title="No cases">No cases match. A case opens when a safety finding is recorded for a participating patient.</EmptyState>}
          {cases.data && cases.data.items.length > 0 && (
            <CaseTable trialId={trialId} cases={cases.data.items} selectedId={selected} onSelect={select} />
          )}
        </section>
        <aside className="min-w-0">
          {selected
            ? <div className="card card-pad"><CaseReviewPanel key={selected} trialId={trialId} caseId={selected} timeZone={trial.data?.site_timezone} onUpdated={cases.reload} /></div>
            : <EmptyState title="Select a case">Choose a case to see what happened, the evidence and the review history.</EmptyState>}
        </aside>
      </div>
    </div>
  );
}

export default function CasesPage() {
  return <Suspense fallback={<LoadingSkeleton rows={4} />}><CasesInner /></Suspense>;
}
