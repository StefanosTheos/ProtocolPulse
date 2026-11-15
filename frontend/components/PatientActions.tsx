'use client';

import { useState } from 'react';
import { useActor } from './ActorContext';
import { ConfirmReviewDialog } from './ConfirmReviewDialog';
import { ErrorPanel } from './ErrorBoundary';
import { SourceViewer } from './ProtocolCitation';
import { useIdempotencyKey } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { Patient360, PatientAssessment, ScreeningDispositionCreate } from '@/lib/api/types';
import { notifyTrialChanged } from '@/lib/api/events';
import { plainText, sentenceCase } from '@/lib/api/labels';

const PARTICIPATION_LABEL: Record<string, string> = { NOT_ENROLLED: 'not participating', PARTICIPATING: 'participating', ENDED: 'participation ended' };

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
  const evidenceLabels = new Map((assessment?.criteria ?? []).flatMap((c) => c.evidence_refs.map((e) => [e.evidence_id, `${sentenceCase(e.evidence_type)} record${e.effective_at ? `, ${plainText(e.effective_at)}` : ''}`] as const)));
  const evidenceIds = [...evidenceLabels.keys()];

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
      setNotice(`Participation recorded: now ${PARTICIPATION_LABEL[res.data.to_status] ?? sentenceCase(res.data.to_status)}. This mirrors an external record; ProtocolPulse does not enroll patients.`);
      onChanged();
      notifyTrialChanged();
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
      setNotice(`Screening decision recorded: ${DISPOSITIONS.find((d) => d.value === res.data.disposition)?.label ?? sentenceCase(res.data.disposition)}. Enrollment remains an external, manual process.`);
      onChanged();
      notifyTrialChanged();
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  async function requestInvestigation() {
    if (!protocolVersionId || busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await getApi().createAgentInvestigation({
        role: 'EVIDENCE_INVESTIGATOR', trial_id: trialId, protocol_version_id: protocolVersionId, patient_id: patient.patient_id,
        criterion_ids: (assessment?.criteria ?? []).filter((c) => c.status === 'UNKNOWN').map((c) => c.criterion_id), event_id: null,
        objective: 'Retrieve evidence for unresolved criteria and propose verification questions.',
      }, investigationKey.current());
      investigationKey.reset();
      setNotice('Automated summary requested. It appears on this patient\'s safety case when it is ready.');
    } catch (e) { setError(e); } finally { setBusy(false); }
  }

  return (
    <section className="card card-pad space-y-3" aria-labelledby="actions-heading">
      <h2 id="actions-heading">Next step</h2>
      {notice && <p role="status" className="rounded border border-info-line bg-info-bg p-2 text-xs text-info-fg">{notice}</p>}
      {error ? <ErrorPanel error={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={!isInvestigator || !assessment || busy} onClick={() => open('disposition')}>Record screening decision</button>
        <button type="button" className="btn-secondary" disabled={!isInvestigator || !nextParticipation} onClick={() => open('participation')}>
          {nextParticipation === 'ENDED' ? 'Record participation ended' : 'Record external participation'}
        </button>
        <button type="button" className="btn-secondary" disabled={!protocolVersionId || actor.role === 'AUDITOR' || busy} onClick={requestInvestigation}>Request automated summary</button>
      </div>
      {!isInvestigator && <p className="text-xs text-ink-muted">Screening decisions and participation are recorded by the Clinical Lead.</p>}
      {isInvestigator && !assessment && <p className="text-xs text-ink-muted">Open this patient from the candidate list to record a screening decision.</p>}
      {!protocolVersionId && <p className="text-xs text-ink-muted">An automated summary needs an approved protocol.</p>}
      
      <ConfirmReviewDialog open={dialog === 'participation'} title={`Record external participation: ${patient.patient_id}`} confirmLabel={nextParticipation === 'ENDED' ? 'Record participation ended' : 'Record participation'} busy={busy}
        confirmDisabled={!sourceId || !reference.trim() || !rationale.trim()} onCancel={() => setDialog(null)} onConfirm={submitParticipation}>
        <p className="text-xs">This records that an authorised external process changed participation to <strong>{nextParticipation ? PARTICIPATION_LABEL[nextParticipation] : ''}</strong>. It is a human-entered fact, not an enrollment action.</p>
        <label className="label" htmlFor="part-source">Registered external participation source</label>
        <select id="part-source" className="input" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Select a source</option>
          {patient.source_document_index.map((s) => <option key={`${s.source_id}-${s.source_version}`} value={s.source_id}>{s.filename}</option>)}
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

      <ConfirmReviewDialog open={dialog === 'disposition'} title={`Screening decision: ${patient.patient_id}`} confirmLabel="Record decision" busy={busy}
        confirmDisabled={!rationale.trim()} onCancel={() => setDialog(null)} onConfirm={submitDisposition}>
        <p className="text-xs">This is recorded against the current screening result. The screening status itself is unchanged; this is a separate Clinical Lead decision.</p>
        <label className="label" htmlFor="disp">Decision</label>
        <select id="disp" className="input" value={disposition} onChange={(e) => setDisposition(e.target.value as ScreeningDispositionCreate['disposition'])}>
          {DISPOSITIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <fieldset>
          <legend className="label">Cited evidence</legend>
          <div className="max-h-32 space-y-1 overflow-y-auto">
            {evidenceIds.map((id) => (
              <label key={id} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={cited.includes(id)} onChange={(e) => setCited((c) => e.target.checked ? [...c, id] : c.filter((x) => x !== id))} />
                <span>{evidenceLabels.get(id) ?? 'Source record'}</span>
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
