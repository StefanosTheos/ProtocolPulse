'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useActor } from '@/components/ActorContext';
import { CriterionMatrix } from '@/components/CriterionMatrix';
import { ErrorPanel } from '@/components/ErrorBoundary';
import { EvidencePanel } from '@/components/EvidencePanel';
import { EvidenceTimeline } from '@/components/EvidenceTimeline';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { MedicationTimeline } from '@/components/MedicationTimeline';
import { PatientActions } from '@/components/PatientActions';
import { PatientSections } from '@/components/PatientSections';
import { CANDIDATE_LABEL, CandidateStatusPill, Pill } from '@/components/StatusPill';
import { TrialHeader, useTrial } from '@/components/TrialHeader';
import { ApiError } from '@/lib/api/client';
import { useApiQuery } from '@/lib/api/hooks';
import { criteriaSummary, plainReason, sentenceCase } from '@/lib/api/labels';
import { forgetRun, getLastRun } from '@/lib/api/lastRun';
import { factsByEvidenceId } from '@/lib/api/patient';
import { getApi } from '@/lib/api/runtime';
import type { Criterion, PatientAssessment } from '@/lib/api/types';

// No GET-assessment-by-ID route exists, so the assessment is located in its run. The same pass
// finds the neighbouring patients with the same result, for Previous / Next.
interface RunPosition { assessment: PatientAssessment | null; previousId: string | null; nextId: string | null; index: number; total: number }
async function findInRun(runId: string, patientId: string): Promise<RunPosition> {
  const all: PatientAssessment[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 20; i++) {
    const { data } = await getApi().listAssessments(runId, { limit: 100, cursor });
    all.push(...data.items);
    if (!data.page.next_cursor) break;
    cursor = data.page.next_cursor;
  }
  const assessment = all.find((a) => a.patient_id === patientId) ?? null;
  const peers = all.filter((a) => a.candidate_status === assessment?.candidate_status).sort((x, y) => x.patient_id.localeCompare(y.patient_id));
  const index = peers.findIndex((a) => a.patient_id === patientId);
  return { assessment, previousId: peers[index - 1]?.patient_id ?? null, nextId: peers[index + 1]?.patient_id ?? null, index, total: peers.length };
}

function PatientInner() {
  const { trialId, patientId } = useParams<{ trialId: string; patientId: string }>();
  const search = useSearchParams();
  const [rememberedRun, setRememberedRun] = useState<string | null>(null);
  useEffect(() => { setRememberedRun(getLastRun(trialId)); }, [trialId]);
  const runId = search?.get('run') ?? rememberedRun;
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const tz = trial.data?.site_timezone;
  const patient = useApiQuery(() => getApi().getPatient360(trialId, patientId).then((r) => r.data), [trialId, patientId, actor.actor_id]);
  const activeId = trial.data?.active_protocol_version_id ?? null;
  const protocol = useApiQuery(activeId ? () => getApi().getProtocol(trialId, activeId).then((r) => r.data) : null, [trialId, activeId, actor.actor_id]);
  const position = useApiQuery(runId ? () => findInRun(runId, patientId) : null, [runId, patientId, actor.actor_id]);
  const assessment = { ...position, data: position.data ? position.data.assessment : position.data };
  // A remembered run the backend no longer has is dropped rather than shown as an error.
  const urlRun = search?.get('run') ?? null;
  useEffect(() => {
    if (!urlRun && rememberedRun && position.error instanceof ApiError && position.error.status === 404) {
      forgetRun(trialId, rememberedRun);
      setRememberedRun(null);
    }
  }, [urlRun, rememberedRun, position.error, trialId]);
  const [selected, setSelected] = useState<string | null>(null);

  const criteriaById = useMemo(() => Object.fromEntries((protocol.data?.criteria ?? []).map((c) => [c.criterion_id, c])) as Record<string, Criterion>, [protocol.data]);
  const facts = useMemo(() => (patient.data ? factsByEvidenceId(patient.data) : new Map()), [patient.data]);
  const results = assessment.data?.criteria ?? [];
  const selectedResult = results.find((r) => r.criterion_id === selected) ?? results.find((r) => r.status !== 'PASS') ?? results[0] ?? null;
  const base = `/trials/${encodeURIComponent(trialId)}`;

  const patientHref = (id: string) => `${base}/patients/${encodeURIComponent(id)}?run=${encodeURIComponent(runId ?? '')}`;
  const statusLabel = assessment.data?.candidate_status ? CANDIDATE_LABEL[assessment.data.candidate_status].toLowerCase() : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {runId ? <Link href={`${base}/selector?run=${encodeURIComponent(runId)}`} className="btn-ghost">← All candidates</Link> : <span />}
        {position.data && position.data.index >= 0 && statusLabel && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-ink-muted">Patient {position.data.index + 1} of {position.data.total} · {statusLabel}</span>
            {position.data.previousId ? <Link className="btn-secondary" href={patientHref(position.data.previousId)}>Previous patient</Link> : <button type="button" className="btn-secondary" disabled>Previous patient</button>}
            {position.data.nextId ? <Link className="btn-secondary" href={patientHref(position.data.nextId)}>Next patient</Link> : <button type="button" className="btn-secondary" disabled>Next patient</button>}
          </div>
        )}
      </div>

      {patient.loading && <LoadingSkeleton rows={6} label="Loading patient" />}
      {patient.error ? <ErrorPanel error={patient.error} context="Patient record" onRetry={patient.reload} /> : null}

      {patient.data && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <section className="card card-pad space-y-2" aria-labelledby="verdict-heading">
              <div className="flex flex-wrap items-center gap-3">
                <h2 id="verdict-heading" className="text-2xl font-bold">Patient {patientId}</h2>
                {assessment.data && <CandidateStatusPill status={assessment.data.candidate_status} />}
                {assessment.data?.stale && <Pill tone="unknown">Out of date</Pill>}
              </div>
              {assessment.data && <p className="text-base">{plainReason(assessment.data, criteriaById)}. <span className="text-ink-muted">{criteriaSummary(assessment.data.criteria)}.</span></p>}
              <p className="text-ink-muted">
                {assessment.data?.screening_date ? `Screened for ${assessment.data.screening_date} · ` : ''}
                {patient.data.participation_status === 'PARTICIPATING' ? 'Currently participating' : sentenceCase(patient.data.participation_status)}
              </p>
              {!assessment.data && <p className="text-ink-muted">{runId ? 'Loading screening result…' : 'Open this patient from the candidate list to see the screening result.'}</p>}
            </section>
            <PatientActions trialId={trialId} patient={patient.data} assessment={assessment.data ?? null} protocolVersionId={activeId} onChanged={patient.reload} />
          </div>

          <section className="card" aria-labelledby="criteria-heading">
            <div className="border-b border-line px-5 py-3">
              <h2 id="criteria-heading">Eligibility criteria</h2>
              <p className="text-xs text-ink-muted">Criteria that are not met or unclear are listed first. Select a source to see the evidence.</p>
            </div>
            {assessment.error ? <div className="p-4"><ErrorPanel error={assessment.error} context="Screening result" onRetry={position.reload} /></div> : null}
            {runId && assessment.data === null && !assessment.loading && !assessment.error && <p className="p-4 text-unknown-fg">Patient {patientId} was not part of this screening.</p>}
            {assessment.data?.evaluation_state === 'EVALUATION_ERROR' && <p className="p-4 text-fail-fg">This patient could not be evaluated, so no result is assigned. This is a system error, not an unclear clinical finding.</p>}
            {results.length > 0 && <CriterionMatrix results={results} criteriaById={criteriaById} selectedId={selectedResult?.criterion_id ?? null} onSelect={setSelected} />}
          </section>

          {selectedResult && (
            <EvidencePanel trialId={trialId} result={selectedResult} criterion={criteriaById[selectedResult.criterion_id]} factsByEvidence={facts} timeZone={tz} />
          )}

          <details className="card">
            <summary className="px-5 py-3"><h2 id="timeline-heading" className="inline">Evidence timeline</h2></summary>
            <div className="space-y-3 border-t border-line p-5">
              <p className="text-xs text-ink-muted">In order of clinical date. The date each entry was recorded is shown separately; undated entries come last.</p>
              <EvidenceTimeline patient={patient.data} timeZone={tz} />
            </div>
          </details>

          <details className="card">
            <summary className="px-5 py-3 text-lg font-semibold">Medications</summary>
            <div className="border-t border-line p-5">
              <MedicationTimeline medications={patient.data.medications} openItems={patient.data.open_items} timeZone={tz} />
            </div>
          </details>

          <details className="card">
            <summary className="px-5 py-3"><h2 className="inline">Record sections</h2></summary>
            <div className="border-t border-line p-5">
              <PatientSections patient={patient.data} timeZone={tz} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

export default function PatientPage() {
  return <Suspense fallback={<LoadingSkeleton rows={6} />}><PatientInner /></Suspense>;
}
