import { EvidenceStatePill, MedicationTypePill, Pill } from './StatusPill';
import { formatFactValue } from '@/lib/api/patient';
import { formatDay, medicationName, plainText, sentenceCase } from '@/lib/api/labels';
import { formatInstant } from '@/lib/api/time';
import type { Patient360, ProvenancedFact } from '@/lib/api/types';

interface Entry { key: string; when: string | null; whenLabel: string; kind: 'Lab' | 'Observation' | 'Condition' | 'Medication' | 'Encounter'; title: string; detail: React.ReactNode; recorded: string | null }

function factWhen(f: ProvenancedFact<unknown>): { when: string | null; label: string | null } {
  if (f.effective_at) return { when: f.effective_at, label: null };
  if (f.onset_date) return { when: `${f.onset_date}T00:00:00Z`, label: formatDay(f.onset_date) };
  const u = f.time_uncertainty;
  if (u?.possible_interval) return { when: u.possible_interval.earliest, label: `${u.raw_date} (${u.precision.toLowerCase()} precision)` };
  return { when: null, label: null };
}

// Chronological view of age-relevant, condition, lab and medication evidence. Clinical-effective
// time drives ordering; recorded time is shown separately. Undated items are listed last.
export function EvidenceTimeline({ patient, timeZone }: { patient: Patient360; timeZone?: string }) {
  const entries: Entry[] = [];
  const fmt = (when: string | null, label: string | null) => label ?? (when ? formatInstant(when, timeZone) : 'Date not recorded');

  patient.observations.forEach((o, i) => {
    const w = factWhen(o.observation);
    entries.push({
      key: `obs-${i}-${o.observation.fact_id}`, when: w.when, whenLabel: fmt(w.when, w.label), kind: o.kind === 'LAB' ? 'Lab' : 'Observation',
      title: `${plainText(o.analyte_code ?? sentenceCase(o.kind))} ${formatFactValue(o.observation)}`,
      detail: <EvidenceStatePill state={o.observation.evidence_state} />, recorded: o.observation.recorded_at,
    });
  });
  [...patient.index_disease.diagnosis_criteria, patient.index_disease.first_onset, ...patient.medical_conditions].forEach((f, i) => {
    const w = factWhen(f);
    entries.push({
      key: `cond-${i}-${f.fact_id}`, when: w.when, whenLabel: fmt(w.when, w.label), kind: 'Condition', title: formatFactValue(f),
      detail: <><EvidenceStatePill state={f.evidence_state} /> <Pill tone="neutral">{sentenceCase(f.verification_status)}</Pill></>, recorded: f.recorded_at,
    });
  });
  patient.medications.forEach((m) => {
    const w = m.asserted_start_at ? { when: m.asserted_start_at, label: null } : factWhen(m.evidence);
    entries.push({
      key: `med-${m.exposure_id}`, when: w.when, whenLabel: fmt(w.when, w.label), kind: 'Medication', title: medicationName(m.medication_code),
      detail: <><MedicationTypePill type={m.evidence_type} /> <EvidenceStatePill state={m.evidence.evidence_state} /></>, recorded: m.evidence.recorded_at,
    });
  });
  patient.encounters.forEach((e) => entries.push({
    key: `enc-${e.encounter_id}`, when: e.occurred_at, whenLabel: formatInstant(e.occurred_at, timeZone), kind: 'Encounter', title: e.summary,
    detail: null, recorded: null,
  }));

  entries.sort((a, b) => (a.when === b.when ? a.key.localeCompare(b.key) : a.when === null ? 1 : b.when === null ? -1 : a.when.localeCompare(b.when)));

  if (!entries.length) return <p className="text-xs text-ink-muted">No dated evidence returned.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead><tr><th>Clinical time</th><th>Type</th><th>Entry</th><th>State</th><th>Recorded</th></tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.key}>
              <td className="whitespace-nowrap text-xs">{e.whenLabel}</td>
              <td className="text-xs">{e.kind}</td>
              <td>{e.title}</td>
              <td className="whitespace-nowrap">{e.detail}</td>
              <td className="whitespace-nowrap text-xs text-ink-muted">{e.recorded ? formatInstant(e.recorded, timeZone) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
