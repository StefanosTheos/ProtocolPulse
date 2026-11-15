'use client';

import { useState } from 'react';
import { useActor } from './ActorContext';
import { ConfirmReviewDialog } from './ConfirmReviewDialog';
import { ErrorPanel } from './ErrorBoundary';
import { JobProgress } from './JobProgress';
import { Pill } from './StatusPill';
import { useJobRunner } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { EventCreate, EventReceipt, JobDetail } from '@/lib/api/types';
import { notifyTrialChanged } from '@/lib/api/events';

interface Preset { id: string; label: string; patientId: string; description: string; body: EventCreate }

function medicationEvent(trialId: string, sourceEventId: string, sourceId: string, code: string, evidenceType: 'ADMINISTRATION' | 'ORDER'): EventCreate {
  return {
    trial_id: trialId, event_kind: 'MEDICATION', source_event_id: sourceEventId, source_version: 1,
    source_id: sourceId, source_document_version: 1,
    effective_at: '2026-11-19T09:30:00+02:00', recorded_at: '2026-11-20T11:00:00+02:00', time_uncertainty: null,
    evidence_state: 'POSITIVE', evidence_quality: 'HIGH',
    medication: { code, evidence_type: evidenceType, dose_value: evidenceType === 'ADMINISTRATION' ? 1 : null, dose_unit: evidenceType === 'ADMINISTRATION' ? 'synthetic-unit' : null, route: evidenceType === 'ADMINISTRATION' ? 'ORAL' : null, interval_end_exclusive_at: null },
    lab: null, condition: null, note: null, observation: null, supersedes_event_id: null,
  };
}

// Sample records for demonstrations. The first is the API_CONTRACTS §4 day-18 example verbatim.
export function eventPresets(trialId: string): Preset[] {
  return [
    { id: 'p042-admin', label: 'Patient P-042 · restricted medication given', patientId: 'P-042', description: 'A dose of a restricted medication is recorded during participation.', body: medicationEvent(trialId, 'SRC-EVT-D18-P042', 'SRC-MED-D18-P042', 'SYN-MED-R1', 'ADMINISTRATION') },
    { id: 'p042-order', label: 'Patient P-042 · restricted medication ordered only', patientId: 'P-042', description: 'Ordered, but use is not confirmed. An order does not prove the patient took it.', body: medicationEvent(trialId, 'SRC-EVT-D18-P042-ORDER', 'SRC-MED-D18-P042-ORDER', 'SYN-MED-R1', 'ORDER') },
    { id: 'p151-n1', label: 'Patient P-151 · other medication given', patientId: 'P-151', description: 'Not a restricted medication. It is checked, and no case is expected.', body: medicationEvent(trialId, 'SRC-EVT-D18-P151-N1', 'SRC-MED-D18-P151-N1', 'SYN-MED-N1', 'ADMINISTRATION') },
  ];
}

// The date-time picker has no time-zone offset; reuse the offset of the sample record's own times.
function withOffset(local: string, sample: string): string {
  if (!local) return '';
  const offset = /(Z|[+-]\d{2}:\d{2})$/.exec(sample)?.[1] ?? 'Z';
  return `${local.length === 16 ? `${local}:00` : local}${offset}`;
}

// Stable per logical source event, so an identical resubmission is an idempotent replay.
export function eventIdempotencyKey(patientId: string, body: EventCreate): string {
  return `event-${patientId}-${body.source_event_id}-v${body.source_version}`;
}

export function EventSimulator({ trialId, onProcessed }: { trialId: string; onProcessed: (job: JobDetail, receipt: EventReceipt) => void }) {
  const { actor } = useActor();
  const presets = eventPresets(trialId);
  const [open, setOpen] = useState(false);
  const [presetId, setPresetId] = useState(presets[0].id);
  const [effectiveAt, setEffectiveAt] = useState(presets[0].body.effective_at ?? '');
  const [recordedAt, setRecordedAt] = useState(presets[0].body.recorded_at);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [receipt, setReceipt] = useState<EventReceipt | null>(null);
  const job = useJobRunner({ intervalMs: 750, timeoutMs: 60_000 });
  const allowed = actor.role === 'COORDINATOR' || actor.role === 'RESEARCH_IT';
  const preset = presets.find((p) => p.id === presetId)!;

  function choose(id: string) {
    const p = presets.find((x) => x.id === id)!;
    setPresetId(id);
    setEffectiveAt(p.body.effective_at ?? '');
    setRecordedAt(p.body.recorded_at);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setReceipt(null);
    job.clear();
    const body: EventCreate = { ...preset.body, effective_at: effectiveAt, recorded_at: recordedAt };
    try {
      const res = await getApi().createPatientEvent(preset.patientId, body, eventIdempotencyKey(preset.patientId, body));
      setReceipt(res.data);
      setOpen(false);
      const finished = await job.run(res.data.job.job_id);
      if (finished) { onProcessed(finished, res.data); notifyTrialChanged(); }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card card-pad space-y-3" aria-labelledby="sim-heading">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-96">
          <h2 id="sim-heading">Add a clinical record</h2>
          <p className="text-ink-muted">For demonstrations: adds a medication or lab record for a participating patient, as if it arrived from the hospital system. The safety check runs on it automatically.</p>
          <p className="mt-1 text-xs text-ink-muted">Safety checks apply only to patients the Clinical Lead has recorded as participating.</p>
        </div>
        <button type="button" className="btn-primary px-5 py-2.5 text-[15px]" disabled={!allowed || busy || job.running} onClick={() => { setError(null); setOpen(true); }}>Simulate new record</button>
      </div>
      {!allowed && <p className="text-xs text-unknown-fg">Records are added by the Sponsor.</p>}
      {receipt && (
        <div className="space-y-1 rounded-lg border border-line bg-canvas p-3 text-xs" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span>Record added for patient {receipt.patient_id}</span>
            {receipt.deduplicated ? <Pill tone="info">Already added</Pill> : <Pill tone="neutral">Accepted</Pill>}
          </div>
          {receipt.deduplicated && <p>This record was added before, so nothing new was created: no second finding or case.</p>}
        </div>
      )}
      <JobProgress job={job.job} error={job.error} running={job.running} label="Safety check" />
      {error ? <ErrorPanel error={error} context="The record was not added" /> : null}

      <ConfirmReviewDialog open={open} title="Add a clinical record" confirmLabel="Add record" busy={busy}
        confirmDisabled={!effectiveAt || !recordedAt} onCancel={() => setOpen(false)} onConfirm={submit}>
        <p className="text-ink-muted">Choose a sample record. The safety check runs as soon as it is added.</p>
        <fieldset className="space-y-2">
          <legend className="label">Record</legend>
          {presets.map((p) => (
            <label key={p.id} className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${presetId === p.id ? 'border-brand bg-brand-soft' : 'border-line'}`}>
              <input type="radio" name="preset" className="mt-1" checked={presetId === p.id} onChange={() => choose(p.id)} />
              <span><span className="block font-semibold">{p.label}</span><span className="block text-[13px] text-ink-muted">{p.description}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="eff-at">When it happened</label>
            <input id="eff-at" type="datetime-local" className="input" value={effectiveAt.slice(0, 16)} onChange={(e) => setEffectiveAt(withOffset(e.target.value, preset.body.recorded_at))} />
          </div>
          <div>
            <label className="label" htmlFor="rec-at">When it was recorded</label>
            <input id="rec-at" type="datetime-local" className="input" value={recordedAt.slice(0, 16)} onChange={(e) => setRecordedAt(withOffset(e.target.value, preset.body.recorded_at))} />
          </div>
        </div>
        <p className="text-xs text-ink-muted">Times are in the study site&apos;s time zone. Adding the same record twice does not create a second finding.</p>
      </ConfirmReviewDialog>
    </section>
  );
}
