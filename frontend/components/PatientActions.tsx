'use client';

import { useState } from 'react';
import { useActor } from './ActorContext';
import { ConfirmReviewDialog } from './ConfirmReviewDialog';
import { ErrorPanel } from './ErrorBoundary';
import { useIdempotencyKey } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { Patient360, PatientAssessment, ScreeningDispositionCreate } from '@/lib/api/types';
import { notifyTrialChanged } from '@/lib/api/events';
import { plainText, sentenceCase } from '@/lib/api/labels';

// Screening results the Clinical Lead can approve into the study.
const APPROVABLE = ['NEEDS_REVIEW', 'POTENTIAL_MATCH'];

const DISPOSITIONS: { value: ScreeningDispositionCreate['disposition']; label: string }[] = [
  { value: 'INVITE_FOR_FORMAL_SCREENING', label: 'Invite for formal screening (external)' },
  { value: 'NOT_SUITABLE', label: 'Not suitable' },
  { value: 'SEEK_MORE_INFORMATION', label: 'Seek more information' },
];

export function PatientActions({ trialId, patient, assessment, onChanged }: {
  trialId: string; patient: Patient360; assessment: PatientAssessment | null; onChanged: () => void;
}) {
  const { actor } = useActor();
  const isInvestigator = actor.role === 'INVESTIGATOR';
  const [dialog, setDialog] = useState<'approve' | 'disposition' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [disposition, setDisposition] = useState<ScreeningDispositionCreate['disposition']>('INVITE_FOR_FORMAL_SCREENING');
  const [cited, setCited] = useState<string[]>([]);
  const participationKey = useIdempotencyKey('participation');
  const dispositionKey = useIdempotencyKey('disposition');

  // Participation must cite the patient's registered external participation record (seeded as
  // SRC-<patient>-external containing reference EXT-<patient>); the backend verifies both.
  const participationSource = patient.source_document_index.find((s) => /-(external|participation)$/i.test(s.source_id));
  const result = assessment?.candidate_status ?? null;
  const approvable = result !== null && APPROVABLE.includes(result);
  const canApprove = isInvestigator && approvable && patient.participation_status === 'NOT_ENROLLED' && Boolean(participationSource);
  const evidenceLabels = new Map((assessment?.criteria ?? []).flatMap((c) => c.evidence_refs.map((e) => [e.evidence_id, `${sentenceCase(e.evidence_type)} record${e.effective_at ? `, ${plainText(e.effective_at)}` : ''}`] as const)));
  const evidenceIds = [...evidenceLabels.keys()];

  function open(kind: 'approve' | 'disposition') {
    setError(null);
    setRationale('');
    setCited([]);
    setDialog(kind);
  }

  async function approve() {
    if (!canApprove || !result || !participationSource) return;
    setBusy(true);
    setError(null);
    try {
      await getApi().recordParticipation(trialId, patient.patient_id, {
        next_status: 'PARTICIPATING', external_record_source_id: participationSource.source_id,
        external_record_reference: `EXT-${patient.patient_id}`,
        rationale: `Approved by the Clinical Lead from screening result: ${sentenceCase(result)}.`,
      }, participationKey.current());
      participationKey.reset();
      setDialog(null);
      setNotice(`${patient.patient_id} approved: now participating.`);
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

  return (
    <section className="card card-pad space-y-3" aria-labelledby="actions-heading">
      <h2 id="actions-heading">Next step</h2>
      {notice && <p role="status" className="rounded border border-info-line bg-info-bg p-2 text-xs text-info-fg">{notice}</p>}
      {error ? <ErrorPanel error={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={!isInvestigator || !assessment || busy} onClick={() => open('disposition')}>Record screening decision</button>
        <button type="button" className="btn-secondary" disabled={!canApprove || busy} onClick={() => open('approve')}>Approve</button>
      </div>
      {!isInvestigator && <p className="text-xs text-ink-muted">Screening decisions and participation are recorded by the Clinical Lead.</p>}
      {isInvestigator && !assessment && <p className="text-xs text-ink-muted">Open this patient from the candidate list to record a screening decision.</p>}
      {isInvestigator && assessment && !approvable && patient.participation_status === 'NOT_ENROLLED' && (
        <p className="text-xs text-ink-muted">Only patients whose result is Needs review or Potential match can be approved.</p>
      )}
      {patient.participation_status !== 'NOT_ENROLLED' && <p className="text-xs text-ink-muted">This patient is already {patient.participation_status === 'PARTICIPATING' ? 'participating' : 'past participation'}.</p>}
      
      <ConfirmReviewDialog open={dialog === 'approve'} title={`Approve ${patient.patient_id}`} confirmLabel="Confirm approval" busy={busy}
        onCancel={() => setDialog(null)} onConfirm={approve}>
        <p className="text-xs">This changes {patient.patient_id} from <strong>Not participating</strong> to <strong>Participating</strong> and records the approval in the audit trail. Safety monitoring then follows new events for this patient.</p>
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
