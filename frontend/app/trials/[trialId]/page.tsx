'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useActor } from '@/components/ActorContext';
import { CaseRow } from '@/components/CaseRow';
import { ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ProtocolStatePill } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { Page, ReviewCase } from '@/lib/api/types';

function countLabel(page: Page<unknown>['page'], shown: number): string {
  if (page.total_count !== null) return String(page.total_count);
  return page.next_cursor ? `${shown}+` : String(shown);
}

export default function TrialOverviewPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const protocols = useApiQuery(() => getApi().listProtocols(trialId, { sort: '-created_at', limit: 10 }).then((r) => r.data), [trialId, actor.actor_id]);
  const openCases = useApiQuery(() => getApi().listCases(trialId, { status: 'OPEN', sort: '-updated_at', limit: 5 }).then((r) => r.data), [trialId, actor.actor_id]);
  const reopened = useApiQuery(() => getApi().listCases(trialId, { status: 'REOPENED', limit: 5 }).then((r) => r.data), [trialId, actor.actor_id]);

  const base = `/trials/${encodeURIComponent(trialId)}`;
  const latest = protocols.data?.items[0] ?? null;
  const active = protocols.data?.items.find((p) => p.state === 'ACTIVE') ?? null;
  const needsApproval = !active && latest && latest.state === 'EXTRACTION_REVIEW';
  const attentionCases: ReviewCase[] = [...(reopened.data?.items ?? []), ...(openCases.data?.items ?? [])];

  return (
    <div>
      <TrialHeader trialId={trialId} />
      <h2 className="mb-3">What needs a clinician&apos;s attention</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <section className="card card-pad" aria-labelledby="att-protocol">
          <h3 id="att-protocol" className="mb-2">Protocol rules</h3>
          {protocols.loading && <LoadingSkeleton rows={2} />}
          {protocols.error ? <ErrorPanel error={protocols.error} onRetry={protocols.reload} /> : null}
          {protocols.data && !latest && <p className="text-ink-muted">No protocol version uploaded.</p>}
          {latest && (
            <div className="space-y-2">
              <div className="flex items-center gap-2"><span className="mono">{latest.protocol_version_id}</span><ProtocolStatePill state={latest.state} /></div>
              {needsApproval && (
                <p className="text-unknown-fg">{latest.criteria.length} proposed rules and {latest.coverage.length} coverage sections await investigator review. Screening stays disabled until approval.</p>
              )}
              {latest.state === 'EXTRACTION_FAILED' && <p className="text-fail-fg">Extraction failed. Re-run or re-upload before review.</p>}
              {active && <p className="text-ink-muted">Approved set <span className="mono break-all">{active.approved_set_hash}</span></p>}
              <Link className="btn-secondary" href={`${base}/protocol`}>{needsApproval ? 'Review rules' : 'Open trial setup'}</Link>
            </div>
          )}
        </section>

        <section className="card card-pad" aria-labelledby="att-cases">
          <h3 id="att-cases" className="mb-2">Open review cases</h3>
          {(openCases.loading || reopened.loading) && <LoadingSkeleton rows={2} />}
          {openCases.error ? <ErrorPanel error={openCases.error} onRetry={openCases.reload} /> : null}
          {openCases.data && reopened.data && (
            <>
              <p className="text-2xl font-semibold">{countLabel(openCases.data.page, openCases.data.items.length)}<span className="ml-2 text-sm font-normal text-ink-muted">open</span>
                {reopened.data.items.length > 0 && <span className="ml-3 text-sm font-normal text-unknown-fg">+{countLabel(reopened.data.page, reopened.data.items.length)} reopened</span>}
              </p>
              <Link className="btn-secondary mt-2" href={`${base}/cases`}>Open review queue</Link>
            </>
          )}
        </section>

        <section className="card card-pad" aria-labelledby="att-monitor">
          <h3 id="att-monitor" className="mb-2">Monitoring findings</h3>
          {trial.data && (
            <>
              <p className="text-2xl font-semibold">{trial.data.finding_count}<span className="ml-2 text-sm font-normal text-ink-muted">findings on record</span></p>
              <p className="text-ink-muted">{trial.data.patient_count} synthetic patients in this trial.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link className="btn-secondary" href={`${base}/monitor`}>Safety monitor</Link>
                <Link className="btn-secondary" href={`${base}/selector`}>Patient selector</Link>
              </div>
            </>
          )}
        </section>
      </div>

      {attentionCases.length > 0 && (
        <section className="card mt-5 overflow-x-auto" aria-labelledby="att-list">
          <h3 id="att-list" className="px-4 pt-3">Cases awaiting human review</h3>
          <table className="data-table mt-2">
            <thead><tr><th>Case</th><th>Patient</th><th>Rule</th><th>Status</th><th>Priority</th><th>Owner</th><th>Updated</th></tr></thead>
            <tbody>{attentionCases.map((c) => <CaseRow key={c.case_id} trialId={trialId} reviewCase={c} />)}</tbody>
          </table>
        </section>
      )}
      {trial.data && <p className="mt-5 text-xs text-ink-faint">{trial.data.trial_notice}</p>}
    </div>
  );
}
