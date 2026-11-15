import { EvidenceStatePill, Pill } from './StatusPill';
import { formatFactValue } from '@/lib/api/patient';
import { formatInstant } from '@/lib/api/time';
import { REASON_LABEL, ROLE_LABEL, formatDay, plainText, sentenceCase } from '@/lib/api/labels';
import type { ActorRole, Patient360, ProvenancedFact, UnknownReason } from '@/lib/api/types';

const EMPTY_NOTE = 'No entries returned. An empty section is not evidence of absence.';

function FactList({ facts, timeZone }: { facts: ProvenancedFact<unknown>[]; timeZone?: string }) {
  if (!facts.length) return <p className="text-xs text-ink-muted">{EMPTY_NOTE}</p>;
  return (
    <ul className="space-y-1">
      {facts.map((f) => (
        <li key={f.fact_id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="font-medium text-ink">{formatFactValue(f)}</span>
          <EvidenceStatePill state={f.evidence_state} />
          {f.verification_status !== 'VERIFIED' && <Pill tone="unknown">{sentenceCase(f.verification_status)}</Pill>}
          <span className="text-ink-faint">{f.effective_at ? `effective ${formatInstant(f.effective_at, timeZone)}` : f.onset_date ? `onset ${formatDay(f.onset_date)}` : f.time_uncertainty ? `date "${f.time_uncertainty.raw_date}"` : 'no clinical date'}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad space-y-2" aria-labelledby={`sec-${n}`}>
      <h3 id={`sec-${n}`}><span className="mr-1 text-ink-faint">{n}.</span>{title}</h3>
      {children}
    </section>
  );
}

// The twelve reusable history sections from DATA_MODEL §6, rendered from the DTO as-is.
export function PatientSections({ patient: p, timeZone }: { patient: Patient360; timeZone?: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section n={1} title="Identity, demographics and snapshot">
        <FactList facts={[p.demographics.birth_date, p.demographics.sex_at_birth, p.demographics.location_jurisdiction]} timeZone={timeZone} />
        <p className="text-xs text-ink-muted">Record as of {formatDay(p.screening_snapshot_date)} · last updated {formatInstant(p.data_watermark, timeZone)}</p>
      </Section>
      <Section n={2} title={`Index disease (${plainText(p.index_disease.code)})`}>
        <FactList facts={[...p.index_disease.diagnosis_criteria, p.index_disease.severity, p.index_disease.first_onset]} timeZone={timeZone} />
        <p className="text-xs text-ink-muted">{p.index_disease.diagnostic_evidence.length} diagnostic evidence reference(s)</p>
      </Section>
      <Section n={3} title="Comorbidities, surgery and hospitalisation">
        <FactList facts={[...p.medical_conditions, ...p.surgeries_hospitalizations]} timeZone={timeZone} />
      </Section>
      <Section n={4} title="Family history and genetics">
        <FactList facts={[...p.family_history, ...p.genetics]} timeZone={timeZone} />
      </Section>
      <Section n={5} title="Symptom history">
        <FactList facts={p.symptom_history} timeZone={timeZone} />
      </Section>
      <Section n={6} title="Serial labs and observations">
        <FactList facts={p.observations.map((o) => o.observation)} timeZone={timeZone} />
      </Section>
      <Section n={7} title="Medications (concomitant) and blinded study product">
        <p className="text-xs">{p.medications.length} concomitant medication evidence entr{p.medications.length === 1 ? 'y' : 'ies'} (see timeline).</p>
        <p className="text-xs text-ink-muted">Study product is blinded: {p.study_product_exposure.exposures.length} exposure record(s); assignment {p.study_product_exposure.assignment_masked ? 'masked' : 'not recorded'}. It is never inferred.</p>
      </Section>
      <Section n={8} title="Prior clinical research">
        {p.prior_clinical_research.length === 0 ? <p className="text-xs text-ink-muted">{EMPTY_NOTE}</p> : (
          <ul className="space-y-1 text-xs">
            {p.prior_clinical_research.map((r) => (
              <li key={r.research_id}>{sentenceCase(r.kind)} · completion <EvidenceStatePill state={r.completion_status} /> · last dose {formatInstant(r.last_dose_at, timeZone)}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section n={9} title="Procedures and imaging">
        <FactList facts={p.procedures_and_imaging} timeZone={timeZone} />
      </Section>
      <Section n={10} title="Allergy, pregnancy, capacity, study partner, administration">
        <FactList facts={[...p.allergies, ...p.pregnancy_contraception, p.decision_capacity, p.study_partner, p.administration_ability]} timeZone={timeZone} />
      </Section>
      <Section n={11} title="Encounters, sources and narratives">
        <p className="text-xs">{p.encounters.length} encounter(s) · {p.source_document_index.length} source document(s)</p>
        {p.clinical_narratives.map((n) => (
          <div key={n.note_id} className="rounded bg-canvas p-2 text-xs">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Pill tone={n.extraction_status === 'CONFLICTED' ? 'unknown' : 'neutral'}>{sentenceCase(n.extraction_status)}</Pill>
              <span className="text-ink-faint">recorded {formatInstant(n.recorded_at, timeZone)}</span>
            </div>
            <p className="whitespace-pre-line">{n.text}</p>
            <p className="mt-1 text-2xs text-ink-faint">Narrative is a sourced claim; it does not override structured data.</p>
          </div>
        ))}
      </Section>
      <Section n={12} title="Open gaps and blocking questions">
        {p.open_items.length === 0 ? <p className="text-xs text-ink-muted">No open items returned.</p> : (
          <ul className="space-y-1 text-xs">
            {p.open_items.map((o) => (
              <li key={o.open_item_id} className="flex flex-wrap items-center gap-2">
                <Pill tone={o.status === 'OPEN' ? 'unknown' : 'neutral'}>{sentenceCase(o.status)}</Pill>
                {o.blocking && <Pill tone="fail">Blocking</Pill>}
                <span className="font-semibold">{REASON_LABEL[o.reason_code as UnknownReason] ?? sentenceCase(o.reason_code)}</span>
                <span>{plainText(o.description)}</span>
                {o.requested_for_role && <span className="text-ink-faint">for {ROLE_LABEL[o.requested_for_role as ActorRole] ?? sentenceCase(o.requested_for_role)}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
