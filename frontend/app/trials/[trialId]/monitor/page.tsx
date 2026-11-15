'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { CaseTable } from '@/components/CaseRow';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { EventSimulator } from '@/components/EventSimulator';
import { EventTimeline } from '@/components/EventTimeline';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { CATEGORY_LABEL } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { FindingCategory, FindingPriority } from '@/lib/api/types';

const AUTO_REFRESH_MS = 10_000;

export default function MonitorPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const [category, setCategory] = useState<FindingCategory | ''>('');
  const [priority, setPriority] = useState<FindingPriority | ''>('');
  const [patientId, setPatientId] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<string | null>(null);
  const findings = useApiQuery(
    () => getApi().listFindings(trialId, { category: category || undefined, priority: priority || undefined, patient_id: patientId.trim() || undefined, sort: '-created_at', limit: 50 })
      .then((r) => { setLastLoaded(new Date().toISOString()); return r.data; }),
    [trialId, category, priority, patientId, actor.actor_id],
  );

  const cases = useApiQuery(() => getApi().listCases(trialId, { sort: '-updated_at', limit: 20 }).then((r) => r.data), [trialId, actor.actor_id]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(findings.reload, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, findings.reload]);

  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 space-y-3" aria-labelledby="findings-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="findings-heading" className="text-xl">Safety</h2>
              <p className="text-ink-muted">New records for participating patients are checked against the protocol. A finding is a prompt for review, not a diagnosis.</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} /> Auto-refresh (10s)</label>
              <button type="button" className="btn-secondary px-2 py-1" onClick={findings.reload}>Refresh</button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="f-cat">Finding type</label>
              <select id="f-cat" className="input w-auto" value={category} onChange={(e) => setCategory(e.target.value as FindingCategory | '')}>
                <option value="">All findings</option>
                {(Object.keys(CATEGORY_LABEL) as FindingCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-pri">Priority</label>
              <select id="f-pri" className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value as FindingPriority | '')}>
                <option value="">Any priority</option><option value="HIGH">High</option><option value="MEDIUM">Medium</option><option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="f-pat">Patient</label>
              <input id="f-pat" className="input w-32" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="P-042" />
            </div>
          </div>
          {lastLoaded && <p className="text-2xs text-ink-faint">Updated {formatInstant(lastLoaded, trial.data?.site_timezone)}</p>}
          {findings.loading && !findings.data && <LoadingSkeleton rows={4} label="Loading findings" />}
          {findings.error ? <ErrorPanel error={findings.error} context="Findings" onRetry={findings.reload} /> : null}
          {findings.data && findings.data.items.length === 0 && (
            <EmptyState title="No findings">No findings match. A finding appears when a new record for a participating patient conflicts with the protocol.</EmptyState>
          )}
          {findings.data && findings.data.items.length > 0 && (
            <EventTimeline trialId={trialId} findings={findings.data.items} timeZone={trial.data?.site_timezone} />
          )}
          <div className="space-y-3 pt-3">
            <h2 id="cases-heading">Review cases</h2>
            {cases.error ? <ErrorPanel error={cases.error} context="Cases" onRetry={cases.reload} /> : null}
            {cases.data && cases.data.items.length === 0 && <p className="note">No cases yet. A case opens with each finding.</p>}
            {cases.data && cases.data.items.length > 0 && <CaseTable trialId={trialId} cases={cases.data.items} />}
          </div>
        </section>
        <aside className="space-y-5">
          <EventSimulator trialId={trialId} onProcessed={() => { findings.reload(); cases.reload(); trial.reload(); }} />
          <section className="card card-pad text-xs text-ink-muted">
            <h3 className="mb-1 text-ink">Before you add a record</h3>
            <p>Safety checks apply only to patients recorded as participating. The investigator records participation on the patient page.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
