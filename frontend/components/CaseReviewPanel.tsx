'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useActor } from './ActorContext';
import { AgentExecutionPanel } from './AgentExecutionPanel';
import { ConfirmReviewDialog } from './ConfirmReviewDialog';
import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { SourceViewer } from './ProtocolCitation';
import { CaseStatusPill, CategoryPill, Pill, PriorityPill } from './StatusPill';
import { ApiError } from '@/lib/api/client';
import { useApiQuery } from '@/lib/api/hooks';
import { DEMO_ACTORS, getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { CasePatch, CaseStatus, EvidenceRef, ReviewCase } from '@/lib/api/types';

const STATUSES: CaseStatus[] = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'REOPENED'];
export const INVESTIGATOR_ONLY: CaseStatus[] = ['RESOLVED', 'CLOSED'];

function EvidenceLink({ trialId, evidence, timeZone }: { trialId: string; evidence: EvidenceRef; timeZone?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="text-xs">
      <button type="button" className="mono text-brand underline-offset-2 hover:underline" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{evidence.evidence_id}</button>
      <span className="ml-2 text-ink-muted">{evidence.evidence_type} · effective {formatInstant(evidence.effective_at, timeZone)} · recorded {formatInstant(evidence.recorded_at, timeZone)} · <span className="mono">{evidence.source_id} v{evidence.source_version}</span></span>
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

  if (reviewCase.loading && !reviewCase.data) return <LoadingSkeleton rows={5} label="Loading case" />;
  if (reviewCase.error) return <ErrorPanel error={reviewCase.error} context={`Case ${caseId}`} onRetry={reviewCase.reload} />;
  const c = reviewCase.data;
  if (!c) return null;

  const canPatch = actor.role === 'MONITOR' || actor.role === 'INVESTIGATOR';
  const evidence = (findings.data ?? []).flatMap((f) => f.evidence_refs);
  const effectiveAssignee = assignee ?? c.assigned_actor_id ?? '';
  const ready = !!nextStatus && !!disposition.trim() && !!rationale.trim();
  const isConflict = error instanceof ApiError && error.code === 'REVISION_CONFLICT';

  async function submit() {
    if (!c || !nextStatus) return;
    setBusy(true);
    setError(null);
    try {
      const patch = buildCasePatch(c, { nextStatus, assignee: effectiveAssignee, disposition, rationale, cited });
      const res = await getApi().patchCase(c.case_id, patch);
      setConfirmOpen(false);
      setNotice(`Case moved to ${res.data.status} (revision ${res.data.revision}) by ${actor.actor_id}.`);
      setNextStatus('');
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
        <h2 className="mono">{c.case_id}</h2>
        <CaseStatusPill status={c.status} />
        <PriorityPill priority={c.priority} />
        <span className="text-xs text-ink-muted">revision {c.revision}</span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-ink-muted">Patient</dt><dd><Link className="mono text-brand underline-offset-2 hover:underline" href={`/trials/${encodeURIComponent(trialId)}/patients/${encodeURIComponent(c.patient_id)}`}>{c.patient_id}</Link></dd>
        <dt className="text-ink-muted">Rule</dt><dd className="mono">{c.criterion_id} · {c.protocol_version_id}</dd>
        <dt className="text-ink-muted">Owner</dt><dd className="mono">{c.assigned_actor_id ?? 'Unassigned'}</dd>
        <dt className="text-ink-muted">Opened</dt><dd>{formatInstant(c.opened_at, timeZone)}</dd>
        <dt className="text-ink-muted">Updated</dt><dd>{formatInstant(c.updated_at, timeZone)}</dd>
        <dt className="text-ink-muted">Issue key</dt><dd className="mono">{c.issue_key}</dd>
      </dl>

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
              <span className="mono">{f.finding_id}</span>
              <span className="text-ink-muted">event <span className="mono">{f.triggering_event_id}</span> · before <span className="mono">{f.before_assessment_id ?? 'none'}</span> → after <span className="mono">{f.after_assessment_id}</span></span>
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
            <p>{c.current_summary}</p>
          </div>
        ) : <p className="text-xs text-ink-muted">No summary recorded.</p>}
      </section>

      {c.agent_execution_id && (
        <section className="space-y-2">
          <h3>Agent investigation</h3>
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
                  <span className="mono font-semibold">{d.actor_id}</span><Pill tone="neutral">{d.actor_role}</Pill>
                  <span>{d.from_status ?? '—'} → {d.to_status ?? '—'}</span>
                  <span className="text-ink-muted">{formatInstant(d.decided_at, timeZone)}</span>
                </div>
                <p className="mt-1"><span className="text-ink-muted">Disposition:</span> <span className="mono">{d.disposition}</span></p>
                <p><span className="text-ink-muted">Rationale:</span> {d.rationale}</p>
                {d.cited_evidence_ids.length > 0 && <p className="text-ink-muted">Cited <span className="mono">{d.cited_evidence_ids.join(', ')}</span></p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card card-pad space-y-3" aria-labelledby="transition-heading">
        <h3 id="transition-heading">Record a review decision</h3>
        {!canPatch && <p className="text-xs text-unknown-fg">Only monitor or investigator actors can update cases.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="next-status">Next status</label>
            <select id="next-status" className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value as CaseStatus)} disabled={!canPatch}>
              <option value="">Select…</option>
              {STATUSES.map((s) => {
                const blocked = INVESTIGATOR_ONLY.includes(s) && actor.role !== 'INVESTIGATOR';
                return <option key={s} value={s} disabled={blocked}>{s}{s === c.status ? ' (current)' : ''}{blocked ? ' — investigator only' : ''}</option>;
              })}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="assignee">Owner</label>
            <select id="assignee" className="input" value={effectiveAssignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canPatch}>
              <option value="">Unassigned</option>
              {DEMO_ACTORS.filter((a) => a.role === 'MONITOR' || a.role === 'INVESTIGATOR').map((a) => <option key={a.actor_id} value={a.actor_id}>{a.actor_id} · {a.role}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="disposition">Disposition</label>
          <input id="disposition" className="input" value={disposition} onChange={(e) => setDisposition(e.target.value)} placeholder="e.g. REVIEW_REQUIRED" disabled={!canPatch} />
        </div>
        <div>
          <label className="label" htmlFor="rationale">Rationale</label>
          <textarea id="rationale" className="input" rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} disabled={!canPatch} />
        </div>
        <fieldset>
          <legend className="label">Cited evidence</legend>
          {evidence.length === 0 ? <p className="text-xs text-ink-muted">No evidence references loaded.</p> : (
            <div className="space-y-1">
              {evidence.map((e) => (
                <label key={e.evidence_id} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" disabled={!canPatch} checked={cited.includes(e.evidence_id)} onChange={(ev) => setCited((prev) => ev.target.checked ? [...prev, e.evidence_id] : prev.filter((x) => x !== e.evidence_id))} />
                  <span className="mono">{e.evidence_id}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <button type="button" className="btn-primary" disabled={!canPatch || !ready} onClick={() => setConfirmOpen(true)}>Review and submit…</button>
      </section>

      <ConfirmReviewDialog open={confirmOpen} title={`Confirm decision on ${c.case_id}`} confirmLabel="Submit decision" busy={busy} onCancel={() => setConfirmOpen(false)} onConfirm={submit}>
        <p>As <span className="mono">{actor.actor_id}</span> ({actor.role}), at case revision {c.revision}:</p>
        <ul className="list-disc pl-5 text-xs">
          <li>Status {c.status} → <strong>{nextStatus}</strong></li>
          <li>Owner: <span className="mono">{effectiveAssignee || 'Unassigned'}</span></li>
          <li>Disposition: <span className="mono">{disposition}</span></li>
          <li>Cited evidence: <span className="mono">{cited.join(', ') || 'none'}</span></li>
        </ul>
        <p className="text-xs text-ink-muted">This records a human review decision. It does not change treatment, participation or enrollment.</p>
      </ConfirmReviewDialog>
    </div>
  );
}
