// UI gating derived only from backend-reported workflow state. These decide whether to offer a
// control; the backend re-validates every request and remains authoritative.
import type { ActorRole, Criterion, ProtocolDetail, TrialDetail, WindowSpec } from './types';

export interface Gate { allowed: boolean; reasons: string[] }

// Zero coverage blockers never substitutes for investigator approval of every rule + coverage.
export function screeningGate(trial: Pick<TrialDetail, 'active_protocol_version_id' | 'patient_count'> | null, protocol: ProtocolDetail | null): Gate {
  const reasons: string[] = [];
  if (!trial?.active_protocol_version_id) reasons.push('The trial has no Clinical Lead-approved active protocol version.');
  if (trial?.patient_count === 0) reasons.push('This study has no patients to screen. Choose a study with patients from Overview.');
  if (!protocol) {
    reasons.push('No protocol version loaded.');
    return { allowed: false, reasons };
  }
  if (trial?.active_protocol_version_id && trial.active_protocol_version_id !== protocol.protocol_version_id) {
    reasons.push(`Protocol ${protocol.protocol_version_id} is not the trial's active version.`);
  }
  if (protocol.state !== 'ACTIVE') reasons.push(`Protocol state is ${protocol.state}, not ACTIVE.`);
  const unapproved = protocol.criteria.filter((c) => c.workflow_status !== 'APPROVED' || !c.approved_by || !c.approved_at);
  if (unapproved.length) reasons.push(`${unapproved.length} of ${protocol.criteria.length} rules lack a recorded Clinical Lead approval.`);
  if (!protocol.coverage_signed_by || !protocol.coverage_signed_at) reasons.push('Coverage has not been signed by the Clinical Lead.');
  if (!protocol.approved_set_hash) reasons.push('No approved rule-set hash is recorded.');
  return { allowed: reasons.length === 0, reasons };
}

// The backend accepts approval of a reviewable proposal in DRAFT (reset seeds a curated proposal
// as DRAFT) or EXTRACTION_REVIEW; anything else is failed, in flight or immutable.
export const REVIEWABLE_STATES: ProtocolDetail['state'][] = ['DRAFT', 'EXTRACTION_REVIEW'];

export function approvalGate(protocol: ProtocolDetail, role: ActorRole, hasUnsavedEdits: boolean): Gate {
  const reasons: string[] = [];
  if (role !== 'INVESTIGATOR') reasons.push('Only the Clinical Lead can approve rules and sign coverage.');
  if (!REVIEWABLE_STATES.includes(protocol.state)) reasons.push(`Protocol is ${protocol.state}; it is not a reviewable proposal.`);
  if (protocol.criteria.length === 0) reasons.push('No proposed rules to approve.');
  const blocking = protocol.coverage.filter((c) => c.status === 'BLOCKING');
  if (protocol.blocking_count > 0 || blocking.length > 0) {
    reasons.push(`${Math.max(protocol.blocking_count, blocking.length)} coverage section(s) are BLOCKING.`);
  }
  const unclear = protocol.criteria.filter((c) => c.workflow_status === 'NEEDS_CLARIFICATION' || c.workflow_status === 'REJECTED');
  if (unclear.length) reasons.push(`${unclear.map((c) => c.criterion_id).join(', ')} need clarification.`);
  const ambiguous = protocol.criteria.filter((c) => c.ambiguity && !unclear.includes(c));
  if (ambiguous.length) reasons.push(`${ambiguous.map((c) => c.criterion_id).join(', ')} carry an unresolved ambiguity note.`);
  if (hasUnsavedEdits) reasons.push('Save or discard inline corrections first.');
  return { allowed: reasons.length === 0, reasons };
}

export function formatThreshold(c: Pick<Criterion, 'threshold' | 'unit'>): string {
  const t = c.threshold;
  const value = t === null ? '—' : Array.isArray(t) ? `${t[0]}–${t[1]}` : String(t);
  return c.unit ? `${value} ${c.unit}` : value;
}

export function formatWindow(w: WindowSpec | null): string {
  if (!w) return 'No window';
  if (w.anchor === 'PARTICIPATION' && w.start_offset_days === null && w.end_offset_days === null) {
    return `During recorded participation ${w.start_inclusive ? '[' : '('}start, end${w.end_inclusive ? ']' : ')'} · ${w.time_zone}`;
  }
  const anchor = w.anchor === 'SCREENING_DATE' ? 'screening date' : w.anchor === 'EVENT_EFFECTIVE_AT' ? 'event time' : 'participation';
  if (w.start_offset_days === 0 && w.end_offset_days === 0) return `As of ${anchor} · ${w.time_zone}`;
  const fmt = (d: number | null) => (d === null ? 'open' : d === 0 ? 'D' : `D${d > 0 ? '+' : ''}${d}`);
  return `${w.start_inclusive ? '[' : '('}${fmt(w.start_offset_days)}, ${fmt(w.end_offset_days)}${w.end_inclusive ? ']' : ')'} from ${anchor} · ${w.time_zone}`;
}

export function parseThresholdInput(raw: string, original: Criterion['threshold']): Criterion['threshold'] | Error {
  const s = raw.trim();
  if (s === '') return null;
  if (Array.isArray(original)) {
    const nums = s.replace(/[[\]\s]/g, '').split(/[,–-]/).filter(Boolean).map(Number);
    if (nums.length !== 2 || nums.some((n) => !Number.isFinite(n))) return new Error('Enter a range as "low–high", e.g. 40–70.');
    return [nums[0], nums[1]];
  }
  if (typeof original === 'number') {
    const n = Number(s);
    return Number.isFinite(n) ? n : new Error('Enter a finite number.');
  }
  return s;
}
