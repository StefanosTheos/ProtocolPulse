// MOCK MODE ONLY. Canned, clearly-labelled synthetic replies for UI development when the
// backend is not running. Nothing here is computed from patient values: every assessment,
// criterion result and event outcome is a fixed table keyed by ID. Statuses for the nine
// acceptance archetypes follow PRODUCT_SPECIFICATION §15.2; P-151 and P-201–P-206 statuses are
// placeholders for UI states only. The live backend's evaluator is the only authority.
import type {
  CriterionResult, CriterionStatus, EvidenceRef, EvidenceSourceDetail, MedicationEvidence,
  MedicationEvidenceType, OpenItem, Patient360, PatientAssessment, ProvenancedFact, SourceRef, UnknownReason,
} from './types';

export const PATIENT_IDS = [
  'P-042', 'P-175', 'P-124', 'P-161', 'P-117', 'P-118', 'P-083', 'P-140', 'P-151',
  'P-201', 'P-202', 'P-203', 'P-204', 'P-205', 'P-206',
] as const;

export const ELIGIBILITY_IDS = ['PX-INC-01', 'PX-INC-02', 'PX-INC-03', 'PX-EXC-01', 'PX-EXC-02'] as const;

const RECORDED = '2026-10-20T08:00:00Z';
const INGESTED = '2026-10-30T12:00:00Z';

type Override = { status: CriterionStatus; reasons?: UnknownReason[]; explanation: string };
interface MockPatientSpec {
  birthDate: string; birthPrecision?: 'DAY' | 'MONTH';
  egfr: { value: number; specimenAt: string } | null;
  overrides: Partial<Record<(typeof ELIGIBILITY_IDS)[number], Override>>;
  meds: { code: string; mappedClass: string | null; type: MedicationEvidenceType; at: string | null; raw?: string; state?: 'POSITIVE' | 'UNCERTAIN' | 'EXPLICITLY_NEGATIVE' }[];
  openItems?: Omit<OpenItem, 'open_item_id'>[];
  narrative: string;
  completeness: number;
}

const DEFAULT_EXPLANATION: Record<string, string> = {
  'PX-INC-01': 'Sourced birth date gives an age within 40–70 on 2026-10-31.',
  'PX-INC-02': 'Verified SYN-CONDITION-A condition record active at screening.',
  'PX-INC-03': 'Latest eGFR specimen in [2026-10-01, 2026-10-31] is at least 60 mL/min/1.73m².',
  'PX-EXC-01': 'Reviewed record-completeness declaration supports absence of SYN-EXCLUDED-CONDITION.',
  'PX-EXC-02': 'Reviewed no-use reconciliation covers [2026-10-01, 2026-10-31) for SYN-CLASS-R.',
};

export const MOCK_PATIENTS: Record<string, MockPatientSpec> = {
  'P-042': { birthDate: '1968-04-12', egfr: { value: 82, specimenAt: '2026-10-22T07:30:00Z' }, overrides: {}, meds: [], narrative: 'Synthetic follow-up note: SYN-CONDITION-A confirmed by adjudicated review. Medication reconciliation completed by study clinician; no SYN-CLASS-R use reported for October 2026.', completeness: 100 },
  'P-175': { birthDate: '1972-01-30', egfr: { value: 74, specimenAt: '2026-10-18T08:10:00Z' }, overrides: { 'PX-EXC-01': { status: 'FAIL', explanation: 'Verified active SYN-EXCLUDED-CONDITION recorded at screening.' } }, meds: [], narrative: 'Synthetic note: SYN-EXCLUDED-CONDITION remains active and verified at the October review.', completeness: 100 },
  'P-124': { birthDate: '1975-07-04', egfr: { value: 71, specimenAt: '2026-08-02T09:00:00Z' }, overrides: { 'PX-INC-03': { status: 'UNKNOWN', reasons: ['OUTDATED_LAB'], explanation: 'Latest eGFR specimen (2026-08-02) is outside [2026-10-01, 2026-10-31].' } }, meds: [], narrative: 'Synthetic note: renal function panel due; last eGFR drawn in August 2026.', completeness: 80 },
  'P-161': { birthDate: '1963-11-21', egfr: { value: 54, specimenAt: '2026-10-25T08:00:00Z' }, overrides: { 'PX-INC-03': { status: 'FAIL', explanation: 'Timely eGFR 54 mL/min/1.73m² (specimen 2026-10-25) is below 60.' } }, meds: [], narrative: 'Synthetic note: eGFR 54 recorded at October visit; units reviewed.', completeness: 100 },
  'P-117': { birthDate: '1970-03-03', egfr: { value: 77, specimenAt: '2026-10-12T08:00:00Z' }, overrides: { 'PX-EXC-02': { status: 'FAIL', explanation: 'Verified SYN-MED-R1 administration at 2026-10-15 lies inside [2026-10-01, 2026-10-31).' } }, meds: [{ code: 'SYN-MED-R1', mappedClass: 'SYN-CLASS-R', type: 'ADMINISTRATION', at: '2026-10-15T09:00:00Z' }], narrative: 'Synthetic administration record: SYN-MED-R1 given on 2026-10-15.', completeness: 100 },
  'P-118': { birthDate: '1966-09-09', egfr: { value: 88, specimenAt: '2026-10-19T08:00:00Z' }, overrides: { 'PX-EXC-02': { status: 'PASS', explanation: 'Last confirmed use 2026-09-20 is before the window; reviewed no-use reconciliation covers [2026-10-01, 2026-10-31).' } }, meds: [{ code: 'SYN-MED-R1', mappedClass: 'SYN-CLASS-R', type: 'ADMINISTRATION', at: '2026-09-20T10:00:00Z' }], narrative: 'Synthetic note: last SYN-MED-R1 dose 2026-09-20; clinician reconciliation documents no use since.', completeness: 100 },
  'P-083': { birthDate: '1969-12-01', egfr: { value: 69, specimenAt: '2026-10-14T08:00:00Z' }, overrides: { 'PX-EXC-02': { status: 'UNKNOWN', reasons: ['ORDER_ONLY'], explanation: 'SYN-MED-R1 order on 2026-10-15 with no administration or reliable use/absence statement; an order is not proof of use.' } }, meds: [{ code: 'SYN-MED-R1', mappedClass: 'SYN-CLASS-R', type: 'ORDER', at: '2026-10-15T11:00:00Z' }], narrative: 'Synthetic order entry: SYN-MED-R1 prescribed 2026-10-15. No administration documented.', completeness: 70 },
  'P-140': { birthDate: '1961-06-15', egfr: { value: 66, specimenAt: '2026-10-21T08:00:00Z' }, overrides: { 'PX-EXC-02': { status: 'UNKNOWN', reasons: ['CONFLICTING_SOURCES'], explanation: 'One note reports continuing SYN-MED-R2 use; another says it stopped before the window. Dates are uncertain.' } }, meds: [{ code: 'SYN-MED-R2', mappedClass: 'SYN-CLASS-R', type: 'REPORTED_USE', at: null, raw: '2026-10', state: 'UNCERTAIN' }, { code: 'SYN-MED-R2', mappedClass: 'SYN-CLASS-R', type: 'DISCONTINUATION', at: null, raw: '2026-09', state: 'UNCERTAIN' }], openItems: [{ reason_code: 'CONFLICTING_SOURCES', description: 'Notes disagree on whether SYN-MED-R2 continued into October 2026.', blocking: true, status: 'OPEN', conflicting_evidence_ids: ['EV-P-140-MED-1', 'EV-P-140-MED-2'], requested_for_role: 'INVESTIGATOR' }], narrative: 'Synthetic note A: patient reports still taking SYN-MED-R2. Synthetic note B: SYN-MED-R2 stopped in September 2026.', completeness: 60 },
  'P-151': { birthDate: '1974-02-14', egfr: { value: 79, specimenAt: '2026-10-16T08:00:00Z' }, overrides: {}, meds: [], narrative: 'Synthetic note: routine visit, no restricted-class medication documented.', completeness: 100 },
  'P-201': { birthDate: '1990-05-05', egfr: { value: 95, specimenAt: '2026-10-11T08:00:00Z' }, overrides: { 'PX-INC-01': { status: 'FAIL', explanation: 'Sourced birth date gives age 36 on 2026-10-31, below 40.' } }, meds: [], narrative: 'Synthetic note: younger participant record for age-boundary testing.', completeness: 100 },
  'P-202': { birthDate: '1952-08-08', egfr: { value: 63, specimenAt: '2026-10-13T08:00:00Z' }, overrides: { 'PX-INC-01': { status: 'FAIL', explanation: 'Sourced birth date gives age 74 on 2026-10-31, above 70.' } }, meds: [], narrative: 'Synthetic note: older participant record for age-boundary testing.', completeness: 100 },
  'P-203': { birthDate: '1971-10-10', egfr: { value: 72, specimenAt: '2026-10-17T08:00:00Z' }, overrides: { 'PX-EXC-02': { status: 'UNKNOWN', reasons: ['UNMAPPED_CODE'], explanation: 'SYN-MED-X9 is not in terminology map px104-terminology-v1; class unknown.' } }, meds: [{ code: 'SYN-MED-X9', mappedClass: null, type: 'ADMINISTRATION', at: '2026-10-09T09:00:00Z' }], narrative: 'Synthetic note: SYN-MED-X9 administered; code not in approved map.', completeness: 80 },
  'P-204': { birthDate: '1967-01-25', egfr: { value: 70, specimenAt: '2026-10-20T08:00:00Z' }, overrides: { 'PX-EXC-02': { status: 'UNKNOWN', reasons: ['DATE_AMBIGUOUS'], explanation: 'SYN-MED-R1 administration dated only "2026-10"; possible interval crosses the window boundary.' } }, meds: [{ code: 'SYN-MED-R1', mappedClass: 'SYN-CLASS-R', type: 'ADMINISTRATION', at: null, raw: '2026-10', state: 'UNCERTAIN' }], narrative: 'Synthetic note: SYN-MED-R1 given sometime in October 2026; exact day not recorded.', completeness: 75 },
  'P-205': { birthDate: '1964-04-18', egfr: { value: 81, specimenAt: '2026-10-23T08:00:00Z' }, overrides: { 'PX-EXC-01': { status: 'UNKNOWN', reasons: ['INSUFFICIENT_ABSENCE_EVIDENCE'], explanation: 'No reviewed record-completeness declaration; an empty problem list is not evidence of absence.' } }, meds: [], narrative: 'Synthetic note: problem list empty; no completeness review documented.', completeness: 80 },
  'P-206': { birthDate: '1962-12-12', egfr: { value: 61, specimenAt: '2026-10-28T08:00:00Z' }, overrides: {}, meds: [], narrative: 'Synthetic note: serial eGFR values trending down (78 → 69 → 61) across 2026.', completeness: 100 },
};

function ref(pid: string, kind: string, n = 1, extra: Partial<EvidenceRef> = {}): EvidenceRef {
  return {
    evidence_id: `EV-${pid}-${kind}-${n}`, source_id: `SRC-${pid}-${kind}`, source_version: 1,
    evidence_type: kind, effective_at: null, recorded_at: RECORDED, page: null, span_start: null, span_end: null, ...extra,
  };
}

function fact<T>(pid: string, kind: string, n: number, value: T | null, extra: Partial<ProvenancedFact<T>> = {}): ProvenancedFact<T> {
  return {
    fact_id: `FACT-${pid}-${kind}-${n}`, value, unit: null, effective_at: null, onset_date: null,
    recorded_at: RECORDED, ingested_at: INGESTED, source: ref(pid, kind, n),
    evidence_quality: value === null ? 'UNVERIFIED' : 'HIGH',
    evidence_state: value === null ? 'NOT_RECORDED' : 'POSITIVE',
    time_uncertainty: null, verification_status: value === null ? 'UNVERIFIED' : 'VERIFIED', ...extra,
  };
}

function notAssessed(pid: string, kind: string): ProvenancedFact<string> {
  return fact<string>(pid, kind, 1, null, { evidence_state: 'NOT_ASSESSED' });
}

function evidenceRefsFor(pid: string, criterionId: string): EvidenceRef[] {
  switch (criterionId) {
    case 'PX-INC-01': return [ref(pid, 'DEMO')];
    case 'PX-INC-02': return [ref(pid, 'COND')];
    case 'PX-INC-03': {
      const lab = MOCK_PATIENTS[pid].egfr;
      return lab ? [ref(pid, 'LAB', 1, { effective_at: lab.specimenAt })] : [];
    }
    case 'PX-EXC-01': return [ref(pid, 'COND', 2)];
    case 'PX-EXC-02': {
      const meds = MOCK_PATIENTS[pid].meds;
      return meds.length ? meds.map((m, i) => ref(pid, 'MED', i + 1, { effective_at: m.at })) : [ref(pid, 'NOTE')];
    }
    default: return [];
  }
}

export function mockCriterionResults(pid: string, evaluatedAt: string): CriterionResult[] {
  const spec = MOCK_PATIENTS[pid];
  return ELIGIBILITY_IDS.map((cid) => {
    const o = spec.overrides[cid];
    return {
      criterion_result_id: `CR-${pid}-${cid}`, criterion_id: cid, protocol_version_id: 'PV-PX104-1.0',
      status: o?.status ?? 'PASS', reason_codes: o?.reasons ?? [],
      evidence_refs: evidenceRefsFor(pid, cid),
      considered_interval: cid === 'PX-EXC-02'
        ? { start: '2026-09-30T21:00:00Z', end: '2026-10-30T22:00:00Z' }
        : cid === 'PX-INC-03' ? { start: '2026-09-30T21:00:00Z', end: '2026-10-31T22:00:00Z' } : null,
      explanation: o?.explanation ?? DEFAULT_EXPLANATION[cid], evaluated_at: evaluatedAt,
    };
  });
}

// Canned aggregate per §15.2 table / placeholders. Not derived by any precedence logic here.
export const MOCK_CANDIDATE_STATUS: Record<string, PatientAssessment['candidate_status']> = {
  'P-042': 'POTENTIAL_MATCH', 'P-175': 'PROTOCOL_CONFLICT', 'P-124': 'NEEDS_REVIEW', 'P-161': 'PROTOCOL_CONFLICT',
  'P-117': 'PROTOCOL_CONFLICT', 'P-118': 'POTENTIAL_MATCH', 'P-083': 'NEEDS_REVIEW', 'P-140': 'NEEDS_REVIEW',
  'P-151': 'POTENTIAL_MATCH', 'P-201': 'PROTOCOL_CONFLICT', 'P-202': 'PROTOCOL_CONFLICT', 'P-203': 'NEEDS_REVIEW',
  'P-204': 'NEEDS_REVIEW', 'P-205': 'NEEDS_REVIEW', 'P-206': 'POTENTIAL_MATCH',
};

function medication(pid: string, m: MockPatientSpec['meds'][number], i: number): MedicationEvidence {
  const source = ref(pid, 'MED', i + 1, { effective_at: m.at });
  return {
    exposure_id: `EXP-${pid}-${i + 1}`, medication_code: m.code, mapped_class: m.mappedClass,
    evidence_type: m.type, asserted_start_at: m.at, asserted_end_exclusive_at: null,
    dose: m.type === 'ADMINISTRATION' ? fact<number>(pid, 'MED', i + 1, 1, { unit: 'synthetic-unit', effective_at: m.at }) : null,
    route: m.type === 'ADMINISTRATION' ? fact<string>(pid, 'MED', i + 1, 'ORAL', { effective_at: m.at }) : null,
    last_changed_at: null, stop_reason: m.type === 'DISCONTINUATION' ? 'Reported stopped (synthetic note)' : null,
    adverse_reactions: [],
    evidence: fact<string>(pid, 'MED', i + 1, `${m.code} ${m.type}`, {
      effective_at: m.at, evidence_state: m.state ?? 'POSITIVE',
      verification_status: m.state === 'UNCERTAIN' ? 'CONFLICTED' : 'VERIFIED',
      evidence_quality: m.state === 'UNCERTAIN' ? 'LOW' : 'HIGH',
      time_uncertainty: m.raw ? {
        raw_date: m.raw, precision: 'MONTH',
        possible_interval: m.raw === '2026-10'
          ? { earliest: '2026-09-30T21:00:00Z', latest_exclusive: '2026-10-31T22:00:00Z' }
          : { earliest: '2026-08-31T21:00:00Z', latest_exclusive: '2026-09-30T21:00:00Z' },
      } : null,
    }),
    source,
  };
}

export function mockSources(pid: string): SourceRef[] {
  const kinds = ['DEMO', 'COND', 'LAB', 'MED', 'NOTE', 'PARTICIPATION'];
  return kinds.map((k) => ({
    source_id: `SRC-${pid}-${k}`, source_version: 1, sha256: `mock-${pid}-${k}`.padEnd(64, '0').slice(0, 64),
    filename: `${pid.toLowerCase()}-${k.toLowerCase()}.json`, mime_type: 'application/json',
    created_at: RECORDED, synthetic_only: true,
  }));
}

export function mockPatient360(pid: string, participation: Patient360['participation_status'], currentAssessmentId: string | null): Patient360 {
  const spec = MOCK_PATIENTS[pid];
  const egfr = spec.egfr;
  return {
    patient_id: pid, trial_id: 'TR-PX104', synthetic_only: true, site_id: 'SITE-SYN-01',
    screening_snapshot_date: '2026-10-31',
    demographics: {
      birth_date: fact(pid, 'DEMO', 1, spec.birthDate),
      sex_at_birth: fact(pid, 'DEMO', 2, 'Synthetic: F'),
      location_jurisdiction: fact(pid, 'DEMO', 3, 'Synthetic site jurisdiction'),
    },
    index_disease: {
      code: 'SYN-CONDITION-A',
      diagnosis_criteria: [fact(pid, 'COND', 1, 'SYN-CONDITION-A adjudicated (synthetic)')],
      severity: notAssessed(pid, 'SEVERITY'),
      first_onset: fact<string>(pid, 'COND', 3, '2021-03-01', { onset_date: '2021-03-01' }),
      diagnostic_evidence: [ref(pid, 'COND')],
    },
    medical_conditions: pid === 'P-175'
      ? [fact(pid, 'COND', 2, 'SYN-EXCLUDED-CONDITION (ACTIVE)')]
      : [fact<string>(pid, 'COND', 2, spec.overrides['PX-EXC-01'] ? null : 'Reviewed completeness: no SYN-EXCLUDED-CONDITION', {
          evidence_state: spec.overrides['PX-EXC-01'] ? 'NOT_RECORDED' : 'EXPLICITLY_NEGATIVE',
        })],
    surgeries_hospitalizations: [],
    family_history: [notAssessed(pid, 'FAMILY')],
    genetics: [notAssessed(pid, 'GENETICS')],
    symptom_history: [],
    observations: egfr ? [{
      kind: 'LAB', analyte_code: 'SYN-EGFR',
      observation: fact<number | string>(pid, 'LAB', 1, egfr.value, { unit: 'mL/min/1.73m²', effective_at: egfr.specimenAt }),
      interpretation: null,
    }] : [],
    medications: spec.meds.map((m, i) => medication(pid, m, i)),
    study_product_exposure: { blinded: true, assignment_masked: null, exposures: [] },
    prior_clinical_research: [],
    procedures_and_imaging: [],
    allergies: [notAssessed(pid, 'ALLERGY')],
    pregnancy_contraception: [fact<string>(pid, 'REPRO', 1, null, { evidence_state: 'NOT_APPLICABLE' })],
    decision_capacity: notAssessed(pid, 'CAPACITY'),
    study_partner: notAssessed(pid, 'PARTNER'),
    administration_ability: notAssessed(pid, 'ADMIN'),
    encounters: [{ encounter_id: `ENC-${pid}-1`, occurred_at: '2026-10-20T08:00:00Z', source_ids: [`SRC-${pid}-NOTE`], summary: 'Synthetic screening-preparation visit.' }],
    source_document_index: mockSources(pid),
    clinical_narratives: [{ note_id: `NOTE-${pid}-1`, recorded_at: RECORDED, source: ref(pid, 'NOTE'), text: spec.narrative, extraction_status: spec.openItems ? 'CONFLICTED' : 'REVIEWED' }],
    open_items: (spec.openItems ?? []).map((o, i) => ({ ...o, open_item_id: `OI-${pid}-${i + 1}` })),
    participation_status: participation,
    current_assessment_id: currentAssessmentId,
    data_watermark: '2026-10-31T22:00:00Z',
  };
}

export function mockEvidenceSource(pid: string, sourceId: string): EvidenceSourceDetail | null {
  const src = mockSources(pid).find((s) => s.source_id === sourceId);
  if (!src) return null;
  const kind = sourceId.split('-').pop()!;
  const spec = MOCK_PATIENTS[pid];
  const text = kind === 'NOTE' ? spec.narrative
    : kind === 'LAB' ? (spec.egfr ? `SYN-EGFR ${spec.egfr.value} mL/min/1.73m² specimen ${spec.egfr.specimenAt}` : 'No eGFR result on file.')
    : kind === 'MED' ? (spec.meds.map((m) => `${m.code} ${m.type} ${m.at ?? m.raw ?? 'date unknown'}`).join('\n') || 'No medication entries returned.')
    : kind === 'DEMO' ? `Synthetic birth date ${spec.birthDate}`
    : kind === 'PARTICIPATION' ? `Synthetic external participation reference for ${pid} (registered for demo).`
    : 'SYN-CONDITION-A adjudicated; condition history (synthetic).';
  const mapKind: Record<string, EvidenceSourceDetail['kind']> = { NOTE: 'NOTE', LAB: 'LAB', MED: 'MEDICATION' };
  return { ...src, kind: mapKind[kind] ?? 'OTHER', page_count: null, spans: [{ page: null, start: 0, end: [...text].length, text }] };
}
