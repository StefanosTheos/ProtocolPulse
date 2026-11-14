'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { CriterionMatrix } from '@/components/CriterionMatrix';
import { ErrorPanel } from '@/components/ErrorBoundary';
import { EvidencePanel } from '@/components/EvidencePanel';
import { EvidenceTimeline } from '@/components/EvidenceTimeline';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { MedicationTimeline } from '@/components/MedicationTimeline';
import { PatientActions } from '@/components/PatientActions';
import { PatientSections } from '@/components/PatientSections';
import { CandidateStatusPill, Pill } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { useApiQuery } from '@/lib/api/hooks';
import { factsByEvidenceId } from '@/lib/api/patient';
import { getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { Criterion, PatientAssessment } from '@/lib/api/types';

// No GET-assessment-by-ID route exists, so the screening assessment is located in its run.
async function findAssessment(runId: string, patientId: string): Promise<PatientAssessment | null> {
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data } = await getApi().listAssessments(runId, { limit: 100, cursor });
    const hit = data.items.find((a) => a.patient_id === patientId);
    if (hit) return hit;
    if (!data.page.next_cursor) return null;
    cursor = data.page.next_cursor;
  }
  return null;
}

function PatientInner() {
  const { trialId, patientId } = useParams<{ trialId: string; patientId: string }>();
  const search = useSearchParams();
  const runId = search?.get('run') ?? null;
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const tz = trial.data?.site_timezone;
  const patient = useApiQuery(() => getApi().getPatient360(trialId, patientId).then((r) => r.data), [trialId, patientId, actor.actor_id]);
  const activeId = trial.data?.active_protocol_version_id ?? null;
  const protocol = useApiQuery(activeId ? () => getApi().getProtocol(trialId, activeId).then((r) => r.data) : null, [trialId, activeId, actor.actor_id]);
  const assessment = useApiQuery(runId ? () => findAssessment(runId, patientId) : null, [runId, patientId, actor.actor_id]);
  const [selected, setSelected] = useState<string | null>(null);

  const criteriaById = useMemo(() => Object.fromEntries((protocol.data?.criteria ?? []).map((c) => [c.criterion_id, c])) as Record<string, Criterion>, [protocol.data]);
  const facts = useMemo(() => (patient.data ? factsByEvidenceId(patient.data) : new Map()), [patient.data]);
  const results = assessment.data?.criteria ?? [];
  const selectedResult = results.find((r) => r.criterion_id === selected) ?? results.find((r) => r.status !== 'PASS') ?? results[0] ?? null;
  const base = `/trials/${encodeURIComponent(trialId)}`;

  return (
    <div>
      <TrialHeader trialId={trialId} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {runId && <Link href={`${base}/selector?run=${encodeURIComponent(runId)}`} className="btn-ghost">← Back to candidates</Link>}
        <h2 className="text-lg"><span className="mono">{patientId}</span></h2>
        <Pill tone="neutral">Synthetic record</Pill>
        {patient.data && <Pill tone={patient.data.participation_status === 'PARTICIPATING' ? 'info' : 'neutral'}>Participation: {patient.data.participation_status.replace('_', ' ')}</Pill>}
        {assessment.data && <CandidateStatusPill status={assessment.data.candidate_status} />}
        {assessment.data?.stale && <Pill tone="unknown">Stale assessment</Pill>}
      </div>

      {patient.loading && <LoadingSkeleton rows={6} label="Loading patient" />}
      {patient.error ? <ErrorPanel error={patient.error} context="Patient 360" onRetry={patient.reload} /> : null}

      {patient.data && (
        <div className="space-y-5">
          <section className="card" aria-labelledby="criteria-heading">
            <div className="border-b border-line px-4 py-3">
              <h2 id="criteria-heading">Eligibility rule results</h2>
              <p className="text-xs text-ink-muted">
                {assessment.data
                  ? <>Screening assessment <span className="mono">{assessment.data.assessment_id}</span> · screen date {assessment.data.screening_date} · evaluated {formatInstant(assessment.data.evaluation_at, tz)} · engine snapshot <span className="mono">{assessment.data.evidence_snapshot_id}</span>. Displayed exactly as computed by the backend.</>
                  : runId ? 'Loading assessment…' : 'Open this patient from a completed screening run to see rule results.'}
              </p>
            </div>
            {assessment.error ? <div className="p-4"><ErrorPanel error={assessment.error} context="Assessment" onRetry={assessment.reload} /></div> : null}
            {runId && assessment.data === null && !assessment.loading && !assessment.error && <p className="p-4 text-unknown-fg">Patient {patientId} has no assessment in run {runId}.</p>}
            {assessment.data?.evaluation_state === 'EVALUATION_ERROR' && <p className="p-4 text-fail-fg">Operational evaluation error: no authoritative candidate status for this run. This is not a clinical UNKNOWN.</p>}
            {results.length > 0 && <CriterionMatrix results={results} criteriaById={criteriaById} selectedId={selectedResult?.criterion_id ?? null} onSelect={setSelected} />}
          </section>

          {selectedResult && (
            <EvidencePanel trialId={trialId} result={selectedResult} criterion={criteriaById[selectedResult.criterion_id]} factsByEvidence={facts} timeZone={tz} />
          )}

          <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <section className="card card-pad space-y-3" aria-labelledby="timeline-heading">
              <h2 id="timeline-heading">Evidence timeline</h2>
              <p className="text-xs text-ink-muted">Ordered by clinical time. Recorded time is shown separately; undated entries are listed last, without invented dates.</p>
              <EvidenceTimeline patient={patient.data} timeZone={tz} />
            </section>
            <div className="space-y-5">
              <section className="card card-pad">
                <MedicationTimeline medications={patient.data.medications} openItems={patient.data.open_items} timeZone={tz} />
              </section>
              <PatientActions trialId={trialId} patient={patient.data} assessment={assessment.data ?? null} protocolVersionId={activeId} onChanged={patient.reload} />
            </div>
          </div>

          <h2>Record sections</h2>
          <PatientSections patient={patient.data} timeZone={tz} />
        </div>
      )}
    </div>
  );
}

export default function PatientPage() {
  return <Suspense fallback={<LoadingSkeleton rows={6} />}><PatientInner /></Suspense>;
}
