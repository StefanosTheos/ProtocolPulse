// Plain-language display text for backend enums and codes. Display only: nothing here changes
// what the backend decided, and the raw values stay available in "Technical details".
import type { ActorRole, Criterion, CriterionResult, PatientAssessment, UnknownReason } from './types';

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

// Seed data uses placeholder codes (SYN-…) inside free text; show what they stand for.
const PLACEHOLDERS: [RegExp, string][] = [
  [/SYN-EXCLUDED-CONDITION/g, 'the excluded condition'],
  [/SYN-CONDITION-A/g, 'study condition'],
  [/SYN-CLASS-R/g, 'the restricted medication class'],
  [/SYN-EGFR/g, 'eGFR'],
  [/\bsynthetic\s+/gi, ''],
  [/\bfictional\s+/gi, ''],
];
export function plainText(text: string): string {
  const out = PLACEHOLDERS.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
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
  UNAPPROVED_RULE: 'An investigator must approve the protocol rule.',
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

// Case summaries written as system codes are replaced by a plain description.
export function caseIssue(summary: string | null): string {
  if (!summary || /[A-Z]{2,}_[A-Z]{2,}/.test(summary)) return 'Protocol finding during participation';
  return plainText(summary);
}
