'use client';

import { Fragment, useState } from 'react';
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

// Fixture chooser for synthetic records. The first preset is the API_CONTRACTS §4 day-18 example verbatim.
export function eventPresets(trialId: string): Preset[] {
  return [
    { id: 'p042-admin', label: 'P-042 · day-18 SYN-MED-R1 administration', patientId: 'P-042', description: 'Restricted-class administration during recorded participation (API_CONTRACTS §4 example).', body: medicationEvent(trialId, 'SRC-EVT-D18-P042', 'SRC-MED-D18-P042', 'SYN-MED-R1', 'ADMINISTRATION') },
    { id: 'p042-order', label: 'P-042 · day-18 SYN-MED-R1 order only', patientId: 'P-042', description: 'Restricted-class order without confirmed use. An order is not proof of ingestion.', body: medicationEvent(trialId, 'SRC-EVT-D18-P042-ORDER', 'SRC-MED-D18-P042-ORDER', 'SYN-MED-R1', 'ORDER') },
    { id: 'p151-n1', label: 'P-151 · day-18 SYN-MED-N1 administration', patientId: 'P-151', description: 'Non-restricted class. Expected to be relevance-checked without opening a case.', body: medicationEvent(trialId, 'SRC-EVT-D18-P151-N1', 'SRC-MED-D18-P151-N1', 'SYN-MED-N1', 'ADMINISTRATION') },
  ];
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
  const [sourceVersion, setSourceVersion] = useState(1);
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
    setSourceVersion(1);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setReceipt(null);
    job.clear();
    const body: EventCreate = { ...preset.body, effective_at: effectiveAt, recorded_at: recordedAt, source_version: sourceVersion };
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
      <h2 id="sim-heading">Demo: add a clinical record</h2>
      <p className="text-xs text-ink-muted">For demonstrations: adds a medication or lab record for a participating patient, as if it arrived from the hospital system. The safety check runs on it automatically.</p>
      <button type="button" className="btn-primary" disabled={!allowed || busy || job.running} onClick={() => { setError(null); setOpen(true); }}>Simulate new record…</button>
      {!allowed && <p className="text-xs text-unknown-fg">Records are added by the Sponsor.</p>}
      {receipt && (
        <div className="space-y-1 rounded border border-line bg-canvas p-3 text-xs" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <span>Record added for patient {receipt.patient_id}</span>
            {receipt.deduplicated ? <Pill tone="info">Deduplicated replay</Pill> : <Pill tone="neutral">Accepted</Pill>}
          </div>
          {receipt.deduplicated && <p>The backend returned the original event and job. No second event, finding or case is created.</p>}
        </div>
      )}
      <JobProgress job={job.job} error={job.error} running={job.running} label={job.running ? 'Awaiting backend re-evaluation' : 'Ingest job'} />
      {job.job?.status === 'SUCCEEDED' && job.job.result && (
        <details className="text-xs">
          <summary className="font-semibold text-ink-muted">Technical details</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3">
            {Object.entries(job.job.result).map(([k, v]) => <Fragment key={k}><dt className="text-ink-muted">{k}</dt><dd className="mono break-all">{String(v)}</dd></Fragment>)}
          </dl>
        </details>
      )}
      {error ? <ErrorPanel error={error} context="Event submission" /> : null}

      <ConfirmReviewDialog open={open} title="Add a source record" confirmLabel="Post event" busy={busy}
        confirmDisabled={!effectiveAt || !recordedAt || sourceVersion < 1} onCancel={() => setOpen(false)} onConfirm={submit}>
        <fieldset className="space-y-2">
          <legend className="label">Fixture</legend>
          {presets.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-sm">
              <input type="radio" name="preset" className="mt-1" checked={presetId === p.id} onChange={() => choose(p.id)} />
              <span><span className="font-medium">{p.label}</span><br /><span className="text-xs text-ink-muted">{p.description}</span></span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="eff-at">Clinical effective time (offset-aware)</label>
            <input id="eff-at" className="input mono" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rec-at">Source recorded time</label>
            <input id="rec-at" className="input mono" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="src-ver">Source version</label>
          <input id="src-ver" type="number" min={1} className="input w-24" value={sourceVersion} onChange={(e) => setSourceVersion(Number(e.target.value))} />
          <p className="mt-1 text-2xs text-ink-faint">Same source event + version + payload replays idempotently; a changed payload under the same version is rejected (409).</p>
        </div>
        <p className="mono rounded bg-canvas p-2 text-2xs">source_event_id {preset.body.source_event_id} · {preset.body.medication?.code} {preset.body.medication?.evidence_type}</p>
      </ConfirmReviewDialog>
    </section>
  );
}
