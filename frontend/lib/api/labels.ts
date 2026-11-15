// Plain-language display text for backend enums and codes. Display only: nothing here changes
// what the backend decided, and the raw values stay available in the audit trail.
import type { ActorRole, Criterion, CriterionResult, PatientAssessment, ProtocolState, UnknownReason, WindowSpec } from './types';

export const ROLE_LABEL: Record<ActorRole, string> = {
  INVESTIGATOR: 'Clinical Lead',
  COORDINATOR: 'Sponsor',
  MONITOR: 'Historical actor',
  AUDITOR: 'Historical actor',
  SPONSOR_OPS: 'Historical actor',
  RESEARCH_IT: 'Historical actor',
};

// "SOME_VALUE" -> "Some value"
export function sentenceCase(value: string): string {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Seed data marks titles as fictional/synthetic; the UI shows the study name only.
export function displayTitle(title: string): string {
  const text = title.replace(/\b(fictional|synthetic)\b\s*/gi, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Turns backend free text into plain wording for display: placeholder codes (SYN-…), rule IDs,
// source IDs, ENUM_WORDS and ISO dates. Display only; the stored text is unchanged.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatDay(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

const RULE_KIND: Record<string, string> = { INC: 'inclusion rule', EXC: 'exclusion rule', MON: 'safety rule' };
export function ruleLabel(criterionId: string): string {
  const m = /^[A-Z0-9]+-(INC|EXC|MON)-0*(\d+)$/.exec(criterionId);
  return m ? `${RULE_KIND[m[1]]} ${m[2]}` : criterionId;
}

const PLACEHOLDERS: [RegExp, string][] = [
  [/SYN-EXCLUDED-CONDITION/g, 'the excluded condition'],
  [/SYN-CONDITION-A condition/g, 'study condition'],
  [/SYN-CONDITION-A/g, 'the study condition'],
  [/SYN-CLASS-R/g, 'the restricted medication class'],
  [/SYN-MED-R\d*/g, 'a restricted medication'],
  [/SYN-EGFR/g, 'eGFR'],
  [/\bSYN-([A-Z0-9-]+)/g, '$1'],
  [/\bSRC-PROTOCOL-[A-Z0-9-]+/g, 'the protocol document'],
  [/\bsynthetic\s+/gi, ''],
  [/\bfictional\s+/gi, ''],
];
export function plainText(text: string): string {
  let out = PLACEHOLDERS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
  // Dates and times: 2026-11-19T09:30:00+02:00 → 19 Nov 2026, 09:30; 2026-10-31 → 31 Oct 2026
  out = out.replace(/\b(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?/g, (_m, d, h, mi) => `${formatDay(d)}, ${h}:${mi}`);
  out = out.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (d) => formatDay(d));
  // Rule IDs and ENUM_WORDS
  out = out.replace(/\b[A-Z0-9]+-(?:INC|EXC|MON)-\d+\b/g, (id) => ruleLabel(id));
  out = out.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g, (w) => w.replace(/_/g, ' ').toLowerCase());
  // Single shouted words such as ADMINISTRATION (acronyms of four letters or fewer are kept)
  out = out.replace(/\b[A-Z]{5,}\b/g, (w) => w.toLowerCase());
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export const REASON_LABEL: Record<UnknownReason, string> = {
  MISSING_LAB: 'No lab result on record',
  OUTDATED_LAB: 'Lab result is out of date',
  DATE_AMBIGUOUS: 'A date in the record is unclear',
  ORDER_ONLY: 'Medication was ordered; use is not confirmed',
  CONFLICTING_SOURCES: 'Records disagree with each other',
  UNMAPPED_CODE: 'An entry could not be identified',
  UNAPPROVED_RULE: 'The rule is not approved yet',
  INCOMPLETE_EXTRACTION: 'The protocol rule is incomplete',
  INSUFFICIENT_ABSENCE_EVIDENCE: 'Not enough evidence to rule this out',
  UNIT_UNSUPPORTED: 'Result uses an unsupported unit',
  SOURCE_UNAVAILABLE: 'The source record is unavailable',
};

export const REASON_RESOLVE: Record<UnknownReason, string> = {
  MISSING_LAB: 'Add a lab result dated within the required period.',
  OUTDATED_LAB: 'Add a new lab result dated within the required period.',
  DATE_AMBIGUOUS: 'Confirm the exact date with the source record.',
  ORDER_ONLY: 'Confirm with the patient or pharmacy whether the medication was taken.',
  CONFLICTING_SOURCES: 'Compare the records with the source and mark which one is correct.',
  UNMAPPED_CODE: 'Identify the entry and confirm whether it is relevant to this criterion.',
  UNAPPROVED_RULE: 'The Clinical Lead must approve the protocol rule.',
  INCOMPLETE_EXTRACTION: 'Complete the protocol rule review.',
  INSUFFICIENT_ABSENCE_EVIDENCE: 'Complete a record review stating whether this applies to the patient.',
  UNIT_UNSUPPORTED: 'Record the result in the unit the protocol requires.',
  SOURCE_UNAVAILABLE: 'Make the source record available, then screen again.',
};

const SUBJECT_LABEL: Record<string, string> = {
  age: 'Age',
  diagnosis: 'Study diagnosis',
  egfr: 'Kidney function (eGFR)',
  condition: 'Excluded condition',
  medication: 'Restricted medication',
};

export function criterionName(criterion: Criterion | undefined, fallbackId: string): string {
  if (!criterion) return fallbackId;
  return SUBJECT_LABEL[criterion.clinical_subject.toLowerCase()] ?? sentenceCase(criterion.clinical_subject);
}

export function criteriaSummary(criteria: CriterionResult[]): string {
  const count = (status: CriterionResult['status']) => criteria.filter((c) => c.status === status).length;
  const met = count('PASS');
  const failed = count('FAIL');
  const unclear = count('UNKNOWN');
  if (!failed && !unclear) return `${met} of ${criteria.length} met`;
  return [`${met} met`, failed ? `${failed} not met` : '', unclear ? `${unclear} unclear` : ''].filter(Boolean).join(' · ');
}

// One-line reason for a candidate's status, built only from backend criterion outcomes.
export function plainReason(a: PatientAssessment, criteriaById: Record<string, Criterion> = {}): string {
  if (a.evaluation_state === 'EVALUATION_ERROR') return 'Could not be evaluated';
  const name = (c: CriterionResult) => criterionName(criteriaById[c.criterion_id], c.criterion_id);
  const failed = a.criteria.filter((c) => c.status === 'FAIL');
  if (failed.length) return failed.map((c) => `${name(c)} not met`).join('; ');
  const unclear = a.criteria.filter((c) => c.status === 'UNKNOWN');
  if (unclear.length) {
    return unclear.map((c) => `${name(c)}: ${c.reason_codes.map((r) => REASON_LABEL[r] ?? sentenceCase(r)).join(', ') || 'unclear'}`).join('; ');
  }
  return 'Meets all eligibility criteria';
}

const ACTION_LABEL: Record<string, string> = {
  PROTOCOL_UPLOADED: 'Uploaded a protocol document',
  EXTRACTION_QUEUED: 'Started reading rules from the protocol',
  CURATED_PROPOSAL: 'Registered proposed protocol rules',
  CURATED_PROPOSAL_LOADED: 'Loaded proposed protocol rules',
  PROPOSAL_REPLACED: 'Edited proposed protocol rules',
  PROTOCOL_APPROVED: 'Approved the protocol',
  SCREENING_QUEUED: 'Started patient screening',
  SCREENING_COMPLETE: 'Patient screening completed',
  EXTERNAL_PARTICIPATION_RECORDED: 'Recorded patient participation',
  EVENT_ACCEPTED: 'Added a clinical record',
  MONITORING_EVALUATED: 'Safety check run on a new record',
  AGENT_UNAVAILABLE: 'Automated case summary was not available',
  CASE_REVIEWED: 'Reviewed a safety case',
};
export const KNOWN_ACTIONS = Object.keys(ACTION_LABEL);
export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? sentenceCase(action);
}

// Which roles the API lets read each kind of record. Screens only request what the role may read.
export const CAN_READ: Record<'patients' | 'findings' | 'cases' | 'audit', ActorRole[]> = {
  patients: ['COORDINATOR', 'INVESTIGATOR', 'MONITOR', 'AUDITOR'],
  findings: ['MONITOR', 'INVESTIGATOR', 'COORDINATOR', 'AUDITOR'],
  cases: ['MONITOR', 'INVESTIGATOR', 'COORDINATOR', 'AUDITOR'],
  audit: ['AUDITOR', 'INVESTIGATOR', 'MONITOR', 'SPONSOR_OPS'],
};

// Workflow steps and the roles that work on each. Overview is every role's starting point.
export interface Step { key: string; label: string; href: string; paths: string[]; roles: ActorRole[] }
const ALL_ROLES: ActorRole[] = ['INVESTIGATOR', 'COORDINATOR'];
export const STEPS: Step[] = [
  { key: 'overview', label: 'Overview', href: '', paths: [], roles: ALL_ROLES },
  { key: 'protocol', label: 'Protocol', href: '/protocol', paths: ['/protocol'], roles: ALL_ROLES },
  { key: 'screen', label: 'Screen patients', href: '/selector', paths: ['/selector', '/patients'], roles: ['INVESTIGATOR'] },
  { key: 'safety', label: 'Safety', href: '/monitor', paths: ['/monitor', '/cases'], roles: ALL_ROLES },
  { key: 'audit', label: 'Audit trail', href: '/audit', paths: ['/audit'], roles: ['INVESTIGATOR'] },
];

// One-line description of a case for lists, from the backend summary.
export function caseIssue(summary: string | null): string {
  if (!summary) return 'Protocol finding during participation';
  const first = plainText(summary).split(/(?<=\.)\s/)[0];
  return first.replace(/\.$/, '');
}

// Wording for protocol rule fields.
const OPERATOR_TEXT: Record<string, string> = {
  AGE_RANGE_INCLUSIVE: 'Age within range',
  CODE_CONFIRMED: 'Confirmed diagnosis',
  LAB_GTE: 'Lab result at or above',
  ABSENCE_CONFIRMED_ACTIVE: 'Confirmed not present',
  NO_RESTRICTED_USE: 'No restricted medication use',
  EVENT_RESTRICTED_USE: 'Restricted medication given',
  EVENT_ORDER_ONLY: 'Restricted medication ordered, use not confirmed',
  EVENT_LAB_LT: 'Lab result falls below',
};
export function operatorText(operator: string): string {
  return OPERATOR_TEXT[operator] ?? sentenceCase(operator);
}
export const COVERAGE_LABEL: Record<'MAPPED' | 'INFORMATIONAL' | 'BLOCKING', string> = {
  MAPPED: 'Covered by a rule',
  INFORMATIONAL: 'Background only',
  BLOCKING: 'Blocking',
};
export const MISSING_DATA_TEXT: Record<string, string> = {
  UNKNOWN_UNLESS_RECONCILED: 'If data is missing, the result is "unclear" until a person reconciles it',
};
export function actorRoleLabel(actorId: string | null | undefined, roleOf: (id: string) => ActorRole | undefined): string {
  if (!actorId) return '—';
  const role = roleOf(actorId);
  return role ? `the ${ROLE_LABEL[role].toLowerCase()}` : 'a reviewer';
}

// Plain names for protocol versions, sections and time windows. Raw identifiers stay in the audit trail.
export const PROTOCOL_STATE_LABEL: Record<ProtocolState, string> = {
  DRAFT: 'Uploaded',
  EXTRACTING: 'Reading rules',
  EXTRACTION_REVIEW: 'Waiting for approval',
  EXTRACTION_FAILED: 'Rules could not be read',
  APPROVED: 'Approved',
  ACTIVE: 'In use',
  SUPERSEDED: 'Replaced',
};

const SECTION_KIND: Record<string, string> = { INC: 'Inclusion criteria', EXC: 'Exclusion criteria', MON: 'Safety monitoring' };
// "PX-SECTION-INC-01" -> "Inclusion criteria · 1"; "PX-INFO-CALENDAR" -> "Calendar"
export function sectionLabel(sectionId: string): string {
  const rule = /-(INC|EXC|MON)-0*(\d+)$/.exec(sectionId);
  if (rule) return `${SECTION_KIND[rule[1]]} · ${rule[2]}`;
  const rest = sectionId.replace(/^.*?-(?:INFO|SECTION)-/, '');
  return sentenceCase(rest.replace(/-/g, '_'));
}

const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;
export function windowText(w: WindowSpec | null): string {
  if (!w) return 'Any time';
  if (w.anchor === 'PARTICIPATION') return 'During participation';
  const anchor = w.anchor === 'SCREENING_DATE' ? 'screening' : 'the record';
  const from = w.start_offset_days;
  const to = w.end_offset_days;
  if (from === 0 && to === 0) return w.anchor === 'SCREENING_DATE' ? 'On the screening date' : 'At the time of the record';
  if (from !== null && from < 0 && (to === 0 || to === null)) return `Within ${days(-from)} before ${anchor}`;
  if ((from === 0 || from === null) && to !== null && to > 0) return `Within ${days(to)} after ${anchor}`;
  if (from !== null && to !== null) return `From ${days(Math.abs(from))} ${from < 0 ? 'before' : 'after'} to ${days(Math.abs(to))} ${to < 0 ? 'before' : 'after'} ${anchor}`;
  return `Relative to ${anchor}`;
}

// Medication and class codes from the seed data, in plain words.
export function medicationName(code: string): string {
  if (/^SYN-MED-R\d*$/.test(code)) return 'Restricted medication';
  if (/^SYN-MED-N\d*$/.test(code)) return 'Other medication (not restricted)';
  if (/^SYN-CLASS-R$/.test(code)) return 'Restricted medication class';
  return plainText(code);
}
