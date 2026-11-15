'use client';

import { Fragment, useMemo, useState } from 'react';
import { useActor } from './ActorContext';
import { ConfirmReviewDialog } from './ConfirmReviewDialog';
import { ErrorPanel } from './ErrorBoundary';
import { ProtocolCitation } from './ProtocolCitation';
import { Pill, type Tone } from './StatusPill';
import { REVIEWABLE_STATES, approvalGate, formatThreshold, formatWindow, parseThresholdInput } from '@/lib/api/gates';
import { actorById, getApi } from '@/lib/api/runtime';
import { formatInstant } from '@/lib/api/time';
import type { CoverageItem, Criterion, CriterionDraftInput, ProtocolDetail } from '@/lib/api/types';
import { notifyTrialChanged } from '@/lib/api/events';
import { COVERAGE_LABEL, MISSING_DATA_TEXT, actorRoleLabel, criterionName, operatorText, plainText, ruleLabel, sentenceCase } from '@/lib/api/labels';

const roleOf = (id: string) => actorById(id)?.role;

const WORKFLOW_TONE: Record<Criterion['workflow_status'], Tone> = { PROPOSED: 'unknown', NEEDS_CLARIFICATION: 'fail', APPROVED: 'pass', REJECTED: 'fail' };
const COVERAGE_TONE: Record<CoverageItem['status'], Tone> = { MAPPED: 'info', INFORMATIONAL: 'neutral', BLOCKING: 'fail' };

interface CriterionEdit { threshold: string; unit: string; evidence_requirement: string; workflow_status: 'PROPOSED' | 'NEEDS_CLARIFICATION'; ambiguity: string }
type CoverageEdit = Pick<CoverageItem, 'status' | 'review_note'>;

function thresholdText(c: Criterion): string {
  return c.threshold === null ? '' : Array.isArray(c.threshold) ? `${c.threshold[0]}–${c.threshold[1]}` : String(c.threshold);
}

function toDraft(c: Criterion, edit: CriterionEdit | undefined): CriterionDraftInput | Error {
  let threshold = c.threshold;
  if (edit) {
    const parsed = parseThresholdInput(edit.threshold, c.threshold);
    if (parsed instanceof Error) return new Error(`${c.criterion_id}: ${parsed.message}`);
    threshold = parsed;
  }
  const workflow = edit?.workflow_status ?? (c.workflow_status === 'NEEDS_CLARIFICATION' ? 'NEEDS_CLARIFICATION' : 'PROPOSED');
  return {
    criterion_id: c.criterion_id, protocol_version_id: c.protocol_version_id, type: c.type,
    clinical_subject: c.clinical_subject, operator: c.operator, threshold,
    unit: edit ? (edit.unit.trim() || null) : c.unit, window: c.window,
    evidence_requirement: edit ? edit.evidence_requirement : c.evidence_requirement,
    missing_data_policy: c.missing_data_policy, source_quote: c.source_quote, source_id: c.source_id,
    source_page: c.source_page, source_anchor: c.source_anchor, applicable_site_ids: c.applicable_site_ids,
    terminology_map_version: c.terminology_map_version, logical_group_id: c.logical_group_id,
    workflow_status: workflow, ambiguity: edit ? (edit.ambiguity.trim() || null) : c.ambiguity,
  };
}

export function ProtocolCoverageReview({ trialId, protocol, onChanged, initialNotice = null, onNotice }: {
  trialId: string; protocol: ProtocolDetail; onChanged: (next: ProtocolDetail) => void;
  // The page remounts this panel when the protocol revision changes, so it keeps the last message.
  initialNotice?: string | null; onNotice?: (message: string) => void;
}) {
  const { actor } = useActor();
  const [criterionEdits, setCriterionEdits] = useState<Record<string, CriterionEdit>>({});
  const [coverageEdits, setCoverageEdits] = useState<Record<string, CoverageEdit>>({});
  const [editing, setEditing] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [attested, setAttested] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [approveKey, setApproveKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [notice, setNoticeState] = useState<string | null>(initialNotice);
  const setNotice = (message: string | null) => { setNoticeState(message); if (message) onNotice?.(message); };

  const hasEdits = Object.keys(criterionEdits).length + Object.keys(coverageEdits).length > 0;
  const reviewable = REVIEWABLE_STATES.includes(protocol.state);
  const canEdit = actor.role === 'INVESTIGATOR' && reviewable;
  const gate = approvalGate(protocol, actor.role, hasEdits);
  const mapped = useMemo(() => protocol.coverage.filter((c) => c.status === 'MAPPED').length, [protocol.coverage]);
  const informational = protocol.coverage.filter((c) => c.status === 'INFORMATIONAL').length;
  const blocking = protocol.coverage.filter((c) => c.status === 'BLOCKING').length;

  function editCriterion(c: Criterion, patch: Partial<CriterionEdit>) {
    setCriterionEdits((prev) => {
      const base: CriterionEdit = prev[c.criterion_id] ?? {
        threshold: thresholdText(c), unit: c.unit ?? '', evidence_requirement: c.evidence_requirement,
        workflow_status: c.workflow_status === 'NEEDS_CLARIFICATION' ? 'NEEDS_CLARIFICATION' : 'PROPOSED', ambiguity: c.ambiguity ?? '',
      };
      return { ...prev, [c.criterion_id]: { ...base, ...patch } };
    });
  }

  function editCoverage(item: CoverageItem, patch: Partial<CoverageEdit>) {
    setCoverageEdits((prev) => ({ ...prev, [item.section_id]: { ...(prev[item.section_id] ?? { status: item.status, review_note: item.review_note }), ...patch } }));
  }

  function discard() {
    setCriterionEdits({});
    setCoverageEdits({});
    setEditing(false);
  }

  async function saveCorrections() {
    setActionError(null);
    const drafts: CriterionDraftInput[] = [];
    for (const c of protocol.criteria) {
      const d = toDraft(c, criterionEdits[c.criterion_id]);
      if (d instanceof Error) { setActionError(d); return; }
      drafts.push(d);
    }
    const coverage = protocol.coverage.map((item) => ({ ...item, ...(coverageEdits[item.section_id] ?? {}) }));
    setBusy(true);
    try {
      const res = await getApi().replaceCriteria(trialId, protocol.protocol_version_id, { criteria: drafts, coverage, change_reason: changeReason.trim() }, protocol.revision);
      discard();
      setSaveOpen(false);
      setChangeReason('');
      setNotice(`Corrections saved as protocol revision ${res.data.revision}. They remain proposals until approved.`);
      onChanged(res.data);
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setActionError(null);
    setBusy(true);
    try {
      const ids = protocol.criteria.map((c) => c.criterion_id);
      const res = await getApi().approveProtocol(trialId, protocol.protocol_version_id, { criterion_ids: ids, coverage_attestation: true, activate: true, decision_reason: decisionReason.trim() }, protocol.revision, approveKey);
      setApproveOpen(false);
      setNotice(`✓ Protocol approved by the investigator on ${formatInstant(res.data.approved_at)}. ${res.data.signed_criterion_ids.length} rules are now in use, and patient screening is available.`);
      notifyTrialChanged();
      const refreshed = await getApi().getProtocol(trialId, protocol.protocol_version_id);
      onChanged(refreshed.data);
    } catch (e) {
      setApproveOpen(false);
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {notice && <p role="status" className="rounded-md border border-info-line bg-info-bg p-3 text-info-fg">{notice}</p>}
      {actionError ? <ErrorPanel error={actionError} context="Protocol action failed" /> : null}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h2>Extracted rules <span className="font-normal text-ink-muted">({protocol.criteria.length})</span></h2>
            <p className="text-xs text-ink-muted">Every rule cites its source page and code-point anchor. Proposals are not operational until an investigator approves them.</p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              {!editing && <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>Edit proposals</button>}
              {editing && <button type="button" className="btn-secondary" onClick={discard}>Discard edits</button>}
              {editing && <button type="button" className="btn-primary" disabled={!hasEdits} onClick={() => setSaveOpen(true)}>Save corrections…</button>}
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Rule</th><th>What is checked</th><th>Threshold</th><th>Time window</th><th>Evidence needed</th><th>Status</th><th>Source</th></tr>
            </thead>
            <tbody>
              {protocol.criteria.map((c) => {
                const edit = criterionEdits[c.criterion_id];
                return (
                  <Fragment key={c.criterion_id}>
                    <tr>
                      <td className="whitespace-nowrap">
                        <div className="font-semibold">{criterionName(c, c.criterion_id)}</div>
                        <div className="text-2xs text-ink-faint">{sentenceCase(ruleLabel(c.criterion_id))} · <span className="mono">{c.criterion_id}</span></div>
                      </td>
                      <td><div>{operatorText(c.operator)}</div><div className="text-xs text-ink-faint">{plainText(c.clinical_subject)}</div></td>
                      <td className="whitespace-nowrap">
                        {editing ? (
                          <div className="flex w-40 flex-col gap-1">
                            <label className="sr-only" htmlFor={`thr-${c.criterion_id}`}>Threshold for {c.criterion_id}</label>
                            <input id={`thr-${c.criterion_id}`} className="input" value={edit?.threshold ?? thresholdText(c)} onChange={(e) => editCriterion(c, { threshold: e.target.value })} />
                            <label className="sr-only" htmlFor={`unit-${c.criterion_id}`}>Unit for {c.criterion_id}</label>
                            <input id={`unit-${c.criterion_id}`} className="input" placeholder="unit" value={edit?.unit ?? c.unit ?? ''} onChange={(e) => editCriterion(c, { unit: e.target.value })} />
                          </div>
                        ) : plainText(formatThreshold(c))}
                      </td>
                      <td className="text-xs">{formatWindow(c.window)}</td>
                      <td className="min-w-[14rem] text-xs">
                        {editing ? (
                          <>
                            <label className="sr-only" htmlFor={`req-${c.criterion_id}`}>Evidence requirement for {c.criterion_id}</label>
                            <textarea id={`req-${c.criterion_id}`} className="input" rows={3} value={edit?.evidence_requirement ?? c.evidence_requirement} onChange={(e) => editCriterion(c, { evidence_requirement: e.target.value })} />
                          </>
                        ) : (
                          <>
                            {plainText(c.evidence_requirement)}
                            <div className="mt-1 text-ink-faint">{MISSING_DATA_TEXT[c.missing_data_policy] ?? `Missing data: ${sentenceCase(c.missing_data_policy)}`}</div>
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        {editing ? (
                          <div className="flex w-44 flex-col gap-1">
                            <label className="sr-only" htmlFor={`wf-${c.criterion_id}`}>Review status for {c.criterion_id}</label>
                            <select id={`wf-${c.criterion_id}`} className="input" value={edit?.workflow_status ?? (c.workflow_status === 'NEEDS_CLARIFICATION' ? 'NEEDS_CLARIFICATION' : 'PROPOSED')} onChange={(e) => editCriterion(c, { workflow_status: e.target.value as CriterionEdit['workflow_status'] })}>
                              <option value="PROPOSED">Proposed</option>
                              <option value="NEEDS_CLARIFICATION">Needs clarification</option>
                            </select>
                            <label className="sr-only" htmlFor={`amb-${c.criterion_id}`}>Ambiguity note for {c.criterion_id}</label>
                            <input id={`amb-${c.criterion_id}`} className="input" placeholder="ambiguity note" value={edit?.ambiguity ?? c.ambiguity ?? ''} onChange={(e) => editCriterion(c, { ambiguity: e.target.value })} />
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Pill tone={WORKFLOW_TONE[c.workflow_status]}>{sentenceCase(c.workflow_status)}</Pill>
                            {c.approved_by && <div className="text-2xs text-ink-muted">by {actorRoleLabel(c.approved_by, roleOf)}<br />{formatInstant(c.approved_at)}</div>}
                            {c.ambiguity && <div className="text-2xs text-unknown-fg">{c.ambiguity}</div>}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs">Page {c.source_page}</td>
                    </tr>
                    <tr className="hover:bg-transparent">
                      <td colSpan={7} className="bg-canvas/50">
                        <details>
                          <summary className="cursor-pointer text-xs text-brand">Source text for {criterionName(c, c.criterion_id).toLowerCase()} ({ruleLabel(c.criterion_id)})</summary>
                          <div className="mt-2">
                            <ProtocolCitation trialId={trialId} sourceId={c.source_id} page={c.source_page} start={c.source_anchor.start} end={c.source_anchor.end} quote={c.source_quote} />
                          </div>
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="border-b border-line px-4 py-3">
          <h2>Extraction coverage <span className="font-normal text-ink-muted">({protocol.coverage.length} sections)</span></h2>
          <p className="text-xs text-ink-muted">
            {mapped} mapped · {informational} informational · {blocking} blocking. Every numbered protocol section must be accounted for before approval.
            Informational sections explain the rules but create no executable criteria.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Section</th><th>Coverage</th><th>Rules from this section</th><th>Page</th><th>Review note</th></tr></thead>
            <tbody>
              {protocol.coverage.map((item) => {
                const edit = coverageEdits[item.section_id];
                return (
                  <tr key={item.section_id}>
                    <td className="mono">{item.section_id}</td>
                    <td>
                      {editing ? (
                        <>
                          <label className="sr-only" htmlFor={`cov-${item.section_id}`}>Coverage status for {item.section_id}</label>
                          <select id={`cov-${item.section_id}`} className="input w-40" value={edit?.status ?? item.status} onChange={(e) => editCoverage(item, { status: e.target.value as CoverageItem['status'] })}>
                            <option value="MAPPED">Covered by a rule</option>
                            <option value="INFORMATIONAL">Background only</option>
                            <option value="BLOCKING">Blocking</option>
                          </select>
                        </>
                      ) : <Pill tone={COVERAGE_TONE[item.status]}>{COVERAGE_LABEL[item.status]}</Pill>}
                    </td>
                    <td>{item.criterion_ids.length ? item.criterion_ids.map((id) => sentenceCase(ruleLabel(id))).join(', ') : <span className="text-ink-faint">none</span>}</td>
                    <td className="whitespace-nowrap text-xs">Page {item.page}</td>
                    <td className="text-xs">
                      {editing ? (
                        <>
                          <label className="sr-only" htmlFor={`note-${item.section_id}`}>Review note for {item.section_id}</label>
                          <input id={`note-${item.section_id}`} className="input" value={edit?.review_note ?? item.review_note ?? ''} onChange={(e) => editCoverage(item, { review_note: e.target.value || null })} />
                        </>
                      ) : item.review_note ?? <span className="text-ink-faint">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3 text-xs text-ink-muted">
          Coverage signed: {protocol.coverage_signed_by
            ? <>by {actorRoleLabel(protocol.coverage_signed_by, roleOf)} on {formatInstant(protocol.coverage_signed_at)}</>
            : <strong className="text-unknown-fg">not signed</strong>}
        </div>
      </section>

      {reviewable && (
        <section className="card card-pad" aria-labelledby="approve-heading">
          <h2 id="approve-heading">Investigator approval</h2>
          <p className="mt-1 text-ink-muted">
            Approval signs all {protocol.criteria.length} rules individually and attests to complete coverage, then activates this version.
            Zero blockers does not approve anything by itself.
          </p>
          {!gate.allowed && (
            <ul className="mt-2 list-disc pl-5 text-unknown-fg">{gate.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          )}
          <button type="button" className="btn-primary mt-3" disabled={!gate.allowed} onClick={() => { setAttested(false); setDecisionReason(''); setApproveKey(`approve-${protocol.protocol_version_id}-r${protocol.revision}-${crypto.randomUUID()}`); setApproveOpen(true); }}>
            Approve criteria…
          </button>
        </section>
      )}

      <ConfirmReviewDialog
        open={saveOpen} title="Save inline corrections" confirmLabel="Save corrections" busy={busy}
        confirmDisabled={!changeReason.trim()} onCancel={() => setSaveOpen(false)} onConfirm={saveCorrections}
      >
        <p>Corrections replace the proposed rule set (revision {protocol.revision} → {protocol.revision + 1}). They stay proposals and still need approval.</p>
        <label className="label" htmlFor="change-reason">Change reason (required)</label>
        <textarea id="change-reason" className="input" rows={3} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
      </ConfirmReviewDialog>

      <ConfirmReviewDialog
        open={approveOpen} title={`Approve ${protocol.criteria.length} protocol rules`} confirmLabel="Approve and activate" busy={busy}
        confirmDisabled={!attested || !decisionReason.trim()} onCancel={() => setApproveOpen(false)} onConfirm={approve}
      >
        <p>As the investigator, you are approving protocol version {protocol.label} with these rules:</p>
        <ul className="list-disc rounded bg-canvas py-2 pl-8 pr-2">{protocol.criteria.map((c) => <li key={c.criterion_id}>{criterionName(c, c.criterion_id)} ({ruleLabel(c.criterion_id)})</li>)}</ul>
        <label className="flex items-start gap-2">
          <input type="checkbox" className="mt-0.5" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
          <span>I reviewed every rule against its cited source clause and attest that all {protocol.coverage.length} coverage sections are accounted for.</span>
        </label>
        <label className="label" htmlFor="decision-reason">Decision reason (required)</label>
        <textarea id="decision-reason" className="input" rows={3} value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} />
      </ConfirmReviewDialog>
    </div>
  );
}
