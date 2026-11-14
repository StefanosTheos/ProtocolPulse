'use client';

import { useState } from 'react';
import { useActor } from './ActorContext';
import { ConfirmReviewDialog } from './ConfirmReviewDialog';
import { ErrorPanel } from './ErrorBoundary';
import { SourceViewer } from './ProtocolCitation';
import { useIdempotencyKey } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { Patient360, PatientAssessment, ScreeningDispositionCreate } from '@/lib/api/types';

const DISPOSITIONS: { value: ScreeningDispositionCreate['disposition']; label: string }[] = [
  { value: 'INVITE_FOR_FORMAL_SCREENING', label: 'Invite for formal screening (external)' },
  { value: 'NOT_SUITABLE', label: 'Not suitable' },
  { value: 'SEEK_MORE_INFORMATION', label: 'Seek more information' },
];

export function PatientActions({ trialId, patient, assessment, protocolVersionId, onChanged }: {
  trialId: string; patient: Patient360; assessment: PatientAssessment | null; protocolVersionId: string | null; onChanged: () => void;
}) {
  const { actor } = useActor();
  const isInvestigator = actor.role === 'INVESTIGATOR';
  const [dialog, setDialog] = useState<'participation' | 'disposition' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState('');
  const [reference, setReference] = useState('');
  const [rationale, setRationale] = useState('');
  const [disposition, setDisposition] = useState<ScreeningDispositionCreate['disposition']>('INVITE_FOR_FORMAL_SCREENING');
  const [cited, setCited] = useState<string[]>([]);
  const participationKey = useIdempotencyKey('participation');
  const dispositionKey = useIdempotencyKey('disposition');
  const investigationKey = useIdempotencyKey('investigation');

  const nextParticipation = patient.participation_status === 'NOT_ENROLLED' ? 'PARTICIPATING' : patient.participation_status === 'PARTICIPATING' ? 'ENDED' : null;
  const evidenceIds = [...new Set((assessment?.criteria ?? []).flatMap((c) => c.evidence_refs.map((e) => e.evidence_id)))];

  function open(kind: 'participation' | 'disposition') {
    setError(null);
    setRationale('');
    setReference('');
    setSourceId('');
    setCited([]);
    setDialog(kind);
  }

  async function submitParticipation() {
    if (!nextParticipation) return;
    setBusy(true);
    setError(null);
    try {
      const res = await getApi().recordParticipation(trialId, patient.patient_id, { next_status: nextParticipation, external_record_source_id: sourceId, external_record_reference: reference.trim(), rationale: rationale.trim() }, participationKey.current());
      participationKey.reset();
      setDialog(null);
      setNotice(`Recorded external participation ${res.data.from_status} → ${res.data.to_status} by ${res.data.actor_id}. This mirrors an external record; ProtocolPulse does not enroll patients.`);
      onChanged();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function submitDisposition() {
    if (!assessment) return;
    setBusy(true);
    setError(null);
    try {
      const res = await getApi().recordDisposition(trialId, patient.patient_id, { assessment_id: assessment.assessment_id, disposition, rationale: rationale.trim(), cited_evidence_ids: cited }, dispositionKey.current());
      dispositionKey.reset();
      setDialog(null);
      setNotice(`Screening disposition ${res.data.disposition} recorded by ${res.data.actor_id}. Enrollment remains an external, manual process.`);
      onChanged();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function requestInvestigation() {
    if (!protocolVersionId) return;
    setError(null);
    setNotice(null);
    try {
      const res = await getApi().createAgentInvestigation({
        role: 'EVIDENCE_INVESTIGATOR', trial_id: trialId, protocol_version_id: protocolVersionId, patient_id: patient.patient_id,
        criterion_ids: (assessment?.criteria ?? []).filter((c) => c.status === 'UNKNOWN').map((c) => c.criterion_id), event_id: null,
        objective: 'Retrieve evidence for unresolved criteria and propose verification questions.',
      }, investigationKey.current());
      investigationKey.reset();
      setNotice(`Investigation accepted as job ${res.data.job_id}. It is not complete until the job reports SUCCEEDED.`);
    } catch (e) { setError(e); }
  }

  return (
    <section className="card card-pad space-y-3" aria-labelledby="actions-heading">
      <h2 id="actions-heading">Human actions</h2>
      {notice && <p role="status" className="rounded border border-info-line bg-info-bg p-2 text-xs text-info-fg">{notice}</p>}
      {error ? <ErrorPanel error={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" disabled={!isInvestigator || !assessment} onClick={() => open('disposition')}>Record screening disposition…</button>
        <button type="button" className="btn-secondary" disabled={!isInvestigator || !nextParticipation} onClick={() => open('participation')}>
          {nextParticipation === 'ENDED' ? 'Record participation ended…' : 'Record external participation…'}
        </button>
        <button type="button" className="btn-secondary" disabled={!protocolVersionId || actor.role === 'AUDITOR'} onClick={requestInvestigation}>Request agent investigation</button>
      </div>
      {!isInvestigator && <p className="text-xs text-ink-muted">Dispositions and participation records are investigator-only.</p>}
      {!assessment && <p className="text-xs text-ink-muted">Open this patient from a screening run to record a disposition against that assessment.</p>}

      <ConfirmReviewDialog open={dialog === 'participation'} title={`Record external participation: ${patient.patient_id}`} confirmLabel={`Record ${nextParticipation ?? ''}`} busy={busy}
        confirmDisabled={!sourceId || !reference.trim() || !rationale.trim()} onCancel={() => setDialog(null)} onConfirm={submitParticipation}>
        <p className="text-xs">This records that an authorised external process changed participation to <strong>{nextParticipation}</strong>. It is a human-entered fact, not an enrollment action.</p>
        <label className="label" htmlFor="part-source">Registered external participation source</label>
        <select id="part-source" className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Select a source…</option>
          {patient.source_document_index.map((s) => <option key={`${s.source_id}-${s.source_version}`} value={s.source_id}>{s.source_id} · {s.filename}</option>)}
        </select>
        {sourceId && (
          <div className="text-xs">
            <p className="label">Source text (the reference must match this registered record)</p>
            <SourceViewer trialId={trialId} sourceId={sourceId} page={null} start={null} end={null} />
          </div>
        )}
        <label className="label" htmlFor="part-ref">External record reference</label>
        <input id="part-ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        <label className="label" htmlFor="part-rationale">Rationale</label>
        <textarea id="part-rationale" className="input" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </ConfirmReviewDialog>

      <ConfirmReviewDialog open={dialog === 'disposition'} title={`Screening disposition: ${patient.patient_id}`} confirmLabel="Record disposition" busy={busy}
        confirmDisabled={!rationale.trim()} onCancel={() => setDialog(null)} onConfirm={submitDisposition}>
        <p className="text-xs">Against assessment <span className="mono">{assessment?.assessment_id}</span>. The computed pre-screen status is unchanged; this is a separate investigator decision.</p>
        <label className="label" htmlFor="disp">Disposition</label>
        <select id="disp" className="input" value={disposition} onChange={(e) => setDisposition(e.target.value as ScreeningDispositionCreate['disposition'])}>
          {DISPOSITIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <fieldset>
          <legend className="label">Cited evidence</legend>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {evidenceIds.map((id) => (
              <label key={id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={cited.includes(id)} onChange={(e) => setCited((c) => e.target.checked ? [...c, id] : c.filter((x) => x !== id))} />
                <span className="mono">{id}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="label" htmlFor="disp-rationale">Rationale (required)</label>
        <textarea id="disp-rationale" className="input" rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </ConfirmReviewDialog>
    </section>
  );
}
