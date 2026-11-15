'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useActor } from './ActorContext';
import { AgentExecutionPanel } from './AgentExecutionPanel';
import { ConfirmReviewDialog } from './ConfirmReviewDialog';
import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { SourceViewer } from './ProtocolCitation';
import { CaseStatusPill, CategoryPill, PriorityPill } from './StatusPill';
import { ApiError } from '@/lib/api/client';
import { useApiQuery } from '@/lib/api/hooks';
import { ROLE_LABEL, plainText, sentenceCase } from '@/lib/api/labels';
import { DEMO_ACTORS, actorById, getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { CasePatch, CaseStatus, EvidenceRef, ReviewCase } from '@/lib/api/types';
import { notifyTrialChanged } from '@/lib/api/events';

function ownerLabel(actorId: string | null): string {
  if (!actorId) return 'Unassigned';
  const owner = actorById(actorId);
  return owner ? ROLE_LABEL[owner.role] : 'Assigned';
}

const STATUSES: CaseStatus[] = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'REOPENED'];
export const INVESTIGATOR_ONLY: CaseStatus[] = ['RESOLVED', 'CLOSED'];

function EvidenceLink({ trialId, evidence, timeZone }: { trialId: string; evidence: EvidenceRef; timeZone?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="text-xs">
      <button type="button" className="font-semibold text-brand underline-offset-2 hover:underline" aria-expanded={open} aria-label={open ? 'Hide source record' : `Open ${sentenceCase(evidence.evidence_type).toLowerCase()} source record`} onClick={() => setOpen((o) => !o)}>{open ? 'Hide source record' : 'Open source record'}</button>
      <span className="ml-2 text-ink-muted">{sentenceCase(evidence.evidence_type)} · occurred {formatInstant(evidence.effective_at, timeZone)} · recorded {formatInstant(evidence.recorded_at, timeZone)}</span>
      {open && <div className="mt-2"><SourceViewer trialId={trialId} sourceId={evidence.source_id} version={evidence.source_version} page={evidence.page} start={evidence.span_start} end={evidence.span_end} /></div>}
    </li>
  );
}

export function buildCasePatch(c: ReviewCase, form: { nextStatus: CaseStatus; assignee: string; disposition: string; rationale: string; cited: string[] }): CasePatch {
  return {
    expected_revision: c.revision, next_status: form.nextStatus, assigned_actor_id: form.assignee || null,
    disposition: form.disposition.trim(), rationale: form.rationale.trim(), cited_evidence_ids: form.cited,
  };
}

export function CaseReviewPanel({ trialId, caseId, timeZone, onUpdated }: { trialId: string; caseId: string; timeZone?: string; onUpdated: () => void }) {
  const { actor } = useActor();
  const reviewCase = useApiQuery(() => getApi().getCase(caseId).then((r) => r.data), [caseId, actor.actor_id]);
  const patientId = reviewCase.data?.patient_id;
  const findings = useApiQuery(patientId ? () => getApi().listFindings(trialId, { patient_id: patientId, limit: 100 }).then((r) => r.data.items.filter((f) => f.case_id === caseId)) : null, [trialId, patientId, caseId, actor.actor_id]);
  const [nextStatus, setNextStatus] = useState<CaseStatus | ''>('');
  const [assignee, setAssignee] = useState<string | null>(null);
  const [disposition, setDisposition] = useState('');
  const [rationale, setRationale] = useState('');
  const [cited, setCited] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  if (reviewCase.loading && !reviewCase.data) return <LoadingSkeleton rows={5} label="Loading case" />;
  if (reviewCase.error) return <ErrorPanel error={reviewCase.error} context="Case" onRetry={reviewCase.reload} />;
  const c = reviewCase.data;
  if (!c) return null;

  const canPatch = actor.role === 'INVESTIGATOR';
  const evidence = (findings.data ?? []).flatMap((f) => f.evidence_refs);
  const effectiveAssignee = assignee ?? (DEMO_ACTORS.some((a) => a.actor_id === c.assigned_actor_id && a.role === 'INVESTIGATOR') ? c.assigned_actor_id : '') ?? '';
  const ready = !!nextStatus && !!disposition.trim() && !!rationale.trim();
  const missing = (filled: boolean) => attempted && !filled;
  const isConflict = error instanceof ApiError && error.code === 'REVISION_CONFLICT';

  async function submit() {
    if (!c || !nextStatus) return;
    setBusy(true);
    setError(null);
    try {
      const patch = buildCasePatch(c, { nextStatus, assignee: effectiveAssignee, disposition, rationale, cited });
      const res = await getApi().patchCase(c.case_id, patch);
      setConfirmOpen(false);
      setNotice(`Case moved to ${sentenceCase(res.data.status)} by the ${ROLE_LABEL[actor.role].toLowerCase()}.`);
      notifyTrialChanged();
      setNextStatus('');
      setAttempted(false);
      setDisposition('');
      setRationale('');
      setCited([]);
      setAssignee(null);
      reviewCase.reload();
      onUpdated();
    } catch (e) {
      setConfirmOpen(false);
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2>Patient {c.patient_id}</h2>
        <CaseStatusPill status={c.status} />
        <PriorityPill priority={c.priority} />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-ink-muted">Patient</dt><dd><Link className="font-semibold text-brand underline-offset-2 hover:underline" href={`/trials/${encodeURIComponent(trialId)}/patients/${encodeURIComponent(c.patient_id)}`}>{c.patient_id}</Link></dd>
        <dt className="text-ink-muted">Assigned to</dt><dd>{ownerLabel(c.assigned_actor_id)}</dd>
        <dt className="text-ink-muted">Opened</dt><dd>{formatInstant(c.opened_at, timeZone)}</dd>
        <dt className="text-ink-muted">Updated</dt><dd>{formatInstant(c.updated_at, timeZone)}</dd>
      </dl>
      <details className="text-xs">
        <summary className="font-semibold text-ink-muted">Technical details</summary>
        <p className="mono mt-1 break-all text-ink-muted">{c.case_id} · revision {c.revision} · {c.criterion_id} · {c.protocol_version_id} · {c.issue_key}</p>
      </details>

      {notice && <p role="status" className="rounded border border-info-line bg-info-bg p-2 text-xs text-info-fg">{notice}</p>}
      {error ? (
        <div className="space-y-2">
          <ErrorPanel error={error} context="Case update rejected" />
          {isConflict && <button type="button" className="btn-secondary" onClick={() => { setError(null); reviewCase.reload(); }}>Reload latest case revision</button>}
        </div>
      ) : null}

      <section className="space-y-2">
        <h3>Findings and evidence</h3>
        {findings.loading && <LoadingSkeleton rows={2} />}
        {findings.error ? <ErrorPanel error={findings.error} onRetry={findings.reload} /> : null}
        {(findings.data ?? []).map((f) => (
          <div key={f.finding_id} className="rounded border border-line p-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <CategoryPill category={f.category} />
              <span className="text-ink-muted">Found {formatInstant(f.created_at, timeZone)}</span>
            </div>
            <ul className="mt-2 space-y-1">{f.evidence_refs.map((e) => <EvidenceLink key={e.evidence_id} trialId={trialId} evidence={e} timeZone={timeZone} />)}</ul>
          </div>
        ))}
        {findings.data && findings.data.length === 0 && <p className="text-xs text-ink-muted">No findings returned for this case ({c.finding_ids.length} linked ID(s): <span className="mono">{c.finding_ids.join(', ')}</span>).</p>}
      </section>

      <section className="space-y-2">
        <h3>Case summary</h3>
        {c.current_summary ? (
          <div className={`rounded border p-2 text-xs ${c.summary_origin === 'AI_DRAFT' ? 'border-info-line bg-info-bg' : 'border-line bg-canvas'}`}>
            <p className="mb-1 font-semibold">{c.summary_origin === 'AI_DRAFT' ? 'AI-drafted summary (not a clinical decision)' : 'System-generated deterministic summary'}</p>
            <p>{plainText(c.current_summary)}</p>
          </div>
        ) : <p className="text-xs text-ink-muted">No summary recorded.</p>}
      </section>

      {c.agent_execution_id && (
        <section className="space-y-2">
          <h3>Automated summary</h3>
          <AgentExecutionPanel executionId={c.agent_execution_id} timeZone={timeZone} />
        </section>
      )}

      <section className="space-y-2">
        <h3>Human review decisions ({c.decisions.length})</h3>
        {c.decisions.length === 0 ? <p className="text-xs text-ink-muted">No reviewer decisions yet.</p> : (
          <ol className="space-y-2">
            {c.decisions.map((d) => (
              <li key={d.decision_id} className="rounded border border-line p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{ROLE_LABEL[d.actor_role] ?? d.actor_role}</span>
                  <span>{d.from_status ? sentenceCase(d.from_status) : '—'} → {d.to_status ? sentenceCase(d.to_status) : '—'}</span>
                  <span className="text-ink-muted">{formatInstant(d.decided_at, timeZone)}</span>
                </div>
                <p className="mt-1"><span className="text-ink-muted">Disposition:</span> {sentenceCase(d.disposition)}</p>
                <p><span className="text-ink-muted">Rationale:</span> {d.rationale}</p>
                {d.cited_evidence_ids.length > 0 && <p className="text-ink-muted">{d.cited_evidence_ids.length} evidence record{d.cited_evidence_ids.length === 1 ? '' : 's'} cited</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <form className="card card-pad space-y-3" aria-labelledby="transition-heading" noValidate
        onSubmit={(e) => { e.preventDefault(); setAttempted(true); if (canPatch && ready) setConfirmOpen(true); }}>
        <h3 id="transition-heading">Record a review decision</h3>
        {!canPatch && <p className="text-xs text-unknown-fg">Cases are updated by the Clinical Lead.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label required" htmlFor="next-status">Next status</label>
            <select id="next-status" className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as CaseStatus)} disabled={!canPatch}>
              <option value="">Select…</option>
              {STATUSES.map((s) => {
                const blocked = INVESTIGATOR_ONLY.includes(s) && actor.role !== 'INVESTIGATOR';
                return <option key={s} value={s} disabled={blocked}>{sentenceCase(s)}{s === c.status ? ' (current)' : ''}{blocked ? ' — Clinical Lead only' : ''}</option>;
              })}
            </select>
            {missing(!!nextStatus) && <p className="mt-1 text-xs text-fail-fg">Choose the next status.</p>}
          </div>
          <div>
            <label className="label" htmlFor="assignee">Owner</label>
            <select id="assignee" className="input" value={effectiveAssignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canPatch}>
              <option value="">Unassigned</option>
              {DEMO_ACTORS.filter((a) => a.role === 'INVESTIGATOR').map((a) => <option key={a.actor_id} value={a.actor_id}>{ROLE_LABEL[a.role]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label required" htmlFor="disposition">Disposition</label>
          <input id="disposition" className="input" required value={disposition} onChange={(e) => setDisposition(e.target.value)} placeholder="e.g. Review required" disabled={!canPatch} aria-invalid={missing(!!disposition.trim())} />
          {missing(!!disposition.trim()) && <p className="mt-1 text-xs text-fail-fg">Enter a short disposition, for example &quot;Review required&quot;.</p>}
        </div>
        <div>
          <label className="label required" htmlFor="rationale">Rationale</label>
          <textarea id="rationale" className="input" rows={3} required value={rationale} onChange={(e) => setRationale(e.target.value)} disabled={!canPatch} aria-invalid={missing(!!rationale.trim())} />
          {missing(!!rationale.trim()) && <p className="mt-1 text-xs text-fail-fg">Explain the reason for this decision.</p>}
        </div>
        <fieldset>
          <legend className="label">Evidence to cite (optional)</legend>
          {evidence.length === 0 ? <p className="text-xs text-ink-muted">No source records are linked to this case.</p> : (
            <div className="space-y-1">
              {evidence.map((e) => (
                <label key={e.evidence_id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" disabled={!canPatch} checked={cited.includes(e.evidence_id)} onChange={(ev) => setCited((prev) => ev.target.checked ? [...prev, e.evidence_id] : prev.filter((x) => x !== e.evidence_id))} />
                  <span>{sentenceCase(e.evidence_type)} record, {formatInstant(e.effective_at, timeZone)} <span className="mono text-2xs text-ink-faint">{e.evidence_id}</span></span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <p className="text-xs text-ink-muted"><span aria-hidden="true" className="text-fail-fg">*</span> Required field</p>
        <button type="submit" className="btn-primary" disabled={!canPatch || busy}>Review and submit…</button>
      </form>

      <ConfirmReviewDialog open={confirmOpen} title={`Confirm decision for patient ${c.patient_id}`} confirmLabel="Submit decision" busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={submit}>
        <p>As {ROLE_LABEL[actor.role].toLowerCase()}, you are recording:</p>
        <ul className="list-disc pl-5 text-xs">
          <li>Status {sentenceCase(c.status)} → <strong>{nextStatus ? sentenceCase(nextStatus) : ''}</strong></li>
          <li>Assigned to: {ownerLabel(effectiveAssignee || null)}</li>
          <li>Disposition: {disposition}</li>
          <li>Cited evidence: {cited.length || 'none'}</li>
        </ul>
        <p className="text-xs text-ink-muted">This records a human review decision. It does not change treatment, participation or enrollment.</p>
      </ConfirmReviewDialog>
    </div>
  );
}
