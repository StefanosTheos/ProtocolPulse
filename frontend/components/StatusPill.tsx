import type {
  AgentStatus, CandidateStatus, CaseStatus, CriterionStatus, EvidenceState, FindingCategory,
  FindingPriority, JobStatus, MedicationEvidenceType, ProtocolState,
} from '@/lib/api/types';

export type Tone = 'pass' | 'fail' | 'unknown' | 'info' | 'neutral';

const TONE_CLASS: Record<Tone, string> = {
  pass: 'bg-pass-bg text-pass-fg border-pass-line',
  fail: 'bg-fail-bg text-fail-fg border-fail-line',
  unknown: 'bg-unknown-bg text-unknown-fg border-unknown-line',
  info: 'bg-info-bg text-info-fg border-info-line',
  neutral: 'bg-neutral-bg text-neutral-fg border-neutral-line',
};

export function Pill({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

// UNKNOWN is always amber with its own glyph; it is never rendered as a pass.
const CRITERION: Record<CriterionStatus, { tone: Tone; label: string; glyph: string }> = {
  PASS: { tone: 'pass', label: 'Pass', glyph: '✓' },
  FAIL: { tone: 'fail', label: 'Fail', glyph: '✕' },
  UNKNOWN: { tone: 'unknown', label: 'Unknown', glyph: '?' },
};
export function CriterionStatusPill({ status }: { status: CriterionStatus }) {
  const s = CRITERION[status];
  return <Pill tone={s.tone}><span aria-hidden="true" className="mr-1">{s.glyph}</span>{s.label}</Pill>;
}

export const CANDIDATE_LABEL: Record<CandidateStatus, string> = {
  POTENTIAL_MATCH: 'Pre-screened potential match',
  NEEDS_REVIEW: 'Needs review',
  PROTOCOL_CONFLICT: 'Protocol conflict',
};
const CANDIDATE_TONE: Record<CandidateStatus, Tone> = { POTENTIAL_MATCH: 'info', NEEDS_REVIEW: 'unknown', PROTOCOL_CONFLICT: 'fail' };
export function CandidateStatusPill({ status }: { status: CandidateStatus | null }) {
  if (status === null) return <Pill tone="neutral" title="Operational evaluation error: no authoritative candidate status">Evaluation error</Pill>;
  return <Pill tone={CANDIDATE_TONE[status]}>{CANDIDATE_LABEL[status]}</Pill>;
}

const PROTOCOL_TONE: Record<ProtocolState, Tone> = {
  DRAFT: 'neutral', EXTRACTING: 'info', EXTRACTION_REVIEW: 'unknown', EXTRACTION_FAILED: 'fail',
  APPROVED: 'info', ACTIVE: 'pass', SUPERSEDED: 'neutral',
};
export function ProtocolStatePill({ state }: { state: ProtocolState }) {
  return <Pill tone={PROTOCOL_TONE[state]}>{state.replace(/_/g, ' ')}</Pill>;
}

const JOB_TONE: Record<JobStatus, Tone> = { QUEUED: 'neutral', RUNNING: 'info', SUCCEEDED: 'pass', FAILED: 'fail' };
export function JobStatusPill({ status }: { status: JobStatus }) {
  return <Pill tone={JOB_TONE[status]}>Job {status.toLowerCase()}</Pill>;
}

const CASE_TONE: Record<CaseStatus, Tone> = { OPEN: 'unknown', ACKNOWLEDGED: 'info', INVESTIGATING: 'info', RESOLVED: 'neutral', CLOSED: 'neutral', REOPENED: 'unknown' };
export function CaseStatusPill({ status }: { status: CaseStatus }) {
  return <Pill tone={CASE_TONE[status]}>{status}</Pill>;
}

// Priority is a backend workflow label, shown as text without alarm colours.
export function PriorityPill({ priority }: { priority: FindingPriority }) {
  return <Pill tone={priority === 'HIGH' ? 'fail' : 'neutral'} title="Workflow triage priority (backend-defined), not clinical severity">{priority} priority</Pill>;
}

export const CATEGORY_LABEL: Record<FindingCategory, string> = {
  CONFIRMED_PROTOCOL_CONFLICT: 'Confirmed protocol conflict',
  POTENTIAL_SAFETY_REVIEW: 'Potential safety review',
  DATA_QUALITY_DISCREPANCY: 'Data quality discrepancy',
  POSSIBLE_PROTOCOL_DEVIATION: 'Possible protocol deviation',
};
export function CategoryPill({ category }: { category: FindingCategory }) {
  return <Pill tone={category === 'CONFIRMED_PROTOCOL_CONFLICT' ? 'fail' : 'unknown'}>{CATEGORY_LABEL[category]}</Pill>;
}

const AGENT_TONE: Record<AgentStatus, Tone> = { QUEUED: 'neutral', RUNNING: 'info', SUCCEEDED: 'pass', FAILED: 'fail', UNAVAILABLE: 'neutral', PARTIAL: 'unknown' };
export function AgentStatusPill({ status }: { status: AgentStatus }) {
  return <Pill tone={AGENT_TONE[status]}>Agent {status.toLowerCase()}</Pill>;
}

export const EVIDENCE_STATE_LABEL: Record<EvidenceState, string> = {
  NOT_RECORDED: 'Not recorded', EXPLICITLY_NEGATIVE: 'Explicitly negative', NOT_ASSESSED: 'Not assessed',
  NOT_APPLICABLE: 'Not applicable', UNCERTAIN: 'Uncertain', POSITIVE: 'Positive (documented)',
};
export function EvidenceStatePill({ state }: { state: EvidenceState }) {
  const tone: Tone = state === 'UNCERTAIN' ? 'unknown' : state === 'POSITIVE' || state === 'EXPLICITLY_NEGATIVE' ? 'info' : 'neutral';
  return <Pill tone={tone}>{EVIDENCE_STATE_LABEL[state]}</Pill>;
}

export const MEDICATION_TYPE_LABEL: Record<MedicationEvidenceType, { label: string; note: string }> = {
  ORDER: { label: 'Order', note: 'Prescribed — not evidence of use' },
  DISPENSE: { label: 'Dispense', note: 'Supplied — not evidence of use' },
  ADMINISTRATION: { label: 'Administration', note: 'Documented dose given' },
  REPORTED_USE: { label: 'Reported use', note: 'Attributed statement; needs reconciliation' },
  DISCONTINUATION: { label: 'Discontinuation', note: 'Modifies an order/report; history kept' },
  CANCELLATION: { label: 'Cancellation', note: 'Cancels an order; history kept' },
};
export function MedicationTypePill({ type }: { type: MedicationEvidenceType }) {
  const tone: Tone = type === 'ADMINISTRATION' ? 'info' : type === 'REPORTED_USE' ? 'unknown' : 'neutral';
  return <Pill tone={tone} title={MEDICATION_TYPE_LABEL[type].note}>{MEDICATION_TYPE_LABEL[type].label}</Pill>;
}
