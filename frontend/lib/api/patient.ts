// Read-only views over a Patient360 DTO for display. No clinical interpretation happens here.
import { plainText, sentenceCase } from './labels';
import type { MedicationEvidence, Patient360, ProvenancedFact } from './types';

export interface LabelledFact { section: string; label: string; fact: ProvenancedFact<unknown> }

export function collectFacts(p: Patient360): LabelledFact[] {
  const out: LabelledFact[] = [];
  const add = (section: string, label: string, fact: ProvenancedFact<unknown> | null | undefined) => { if (fact) out.push({ section, label: plainText(label), fact }); };
  const addAll = (section: string, label: string, facts: ProvenancedFact<unknown>[]) => facts.forEach((f, i) => add(section, `${label} ${i + 1}`, f));
  add('Demographics', 'Birth date', p.demographics.birth_date);
  add('Demographics', 'Sex at birth', p.demographics.sex_at_birth);
  add('Demographics', 'Jurisdiction', p.demographics.location_jurisdiction);
  addAll('Index disease', 'Diagnosis criterion', p.index_disease.diagnosis_criteria);
  add('Index disease', 'Severity', p.index_disease.severity);
  add('Index disease', 'First onset', p.index_disease.first_onset);
  addAll('Conditions', 'Condition', p.medical_conditions);
  addAll('Conditions', 'Surgery/hospitalisation', p.surgeries_hospitalizations);
  addAll('Family history & genetics', 'Family history', p.family_history);
  addAll('Family history & genetics', 'Genetics', p.genetics);
  addAll('Symptoms', 'Symptom', p.symptom_history);
  p.observations.forEach((o, i) => {
    add('Observations', `${sentenceCase(o.kind)} ${o.analyte_code ?? ''} ${i + 1}`.trim(), o.observation);
    add('Observations', `${sentenceCase(o.kind)} interpretation ${i + 1}`, o.interpretation);
  });
  const meds = (list: MedicationEvidence[], section: string) => list.forEach((m) => {
    add(section, `${m.medication_code} ${m.evidence_type}`, m.evidence);
    add(section, `${m.medication_code} dose`, m.dose);
    add(section, `${m.medication_code} route`, m.route);
  });
  meds(p.medications, 'Medications');
  meds(p.study_product_exposure.exposures, 'Study product (blinded)');
  add('Study product (blinded)', 'Masked assignment', p.study_product_exposure.assignment_masked);
  p.prior_clinical_research.forEach((r) => {
    add('Prior research', `${r.research_id} exposure`, r.exposure);
    add('Prior research', `${r.research_id} half-life`, r.half_life_hours);
    addAll('Prior research', `${r.research_id} restriction`, r.ongoing_restrictions);
  });
  addAll('Procedures & imaging', 'Procedure', p.procedures_and_imaging);
  addAll('Allergy, pregnancy, capacity', 'Allergy', p.allergies);
  addAll('Allergy, pregnancy, capacity', 'Pregnancy/contraception', p.pregnancy_contraception);
  add('Allergy, pregnancy, capacity', 'Decision capacity', p.decision_capacity);
  add('Allergy, pregnancy, capacity', 'Study partner', p.study_partner);
  add('Allergy, pregnancy, capacity', 'Administration ability', p.administration_ability);
  return out;
}

export function factsByEvidenceId(p: Patient360): Map<string, LabelledFact[]> {
  const map = new Map<string, LabelledFact[]>();
  for (const lf of collectFacts(p)) {
    const id = lf.fact.source.evidence_id;
    map.set(id, [...(map.get(id) ?? []), lf]);
  }
  return map;
}

export function formatFactValue(fact: ProvenancedFact<unknown>): string {
  if (fact.value === null) return '—';
  const v = typeof fact.value === 'object' ? JSON.stringify(fact.value) : plainText(String(fact.value));
  return fact.unit ? `${v} ${fact.unit}` : v;
}

// Medications sort by their asserted clinical time; undated entries go last, never invented.
export function sortMedications(list: MedicationEvidence[]): MedicationEvidence[] {
  const key = (m: MedicationEvidence) => m.asserted_start_at ?? m.evidence.effective_at ?? m.evidence.time_uncertainty?.possible_interval?.earliest ?? null;
  return [...list].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === kb) return a.exposure_id.localeCompare(b.exposure_id);
    if (ka === null) return 1;
    if (kb === null) return -1;
    return ka.localeCompare(kb);
  });
}
