import { EvidenceStatePill, MEDICATION_TYPE_LABEL, MedicationTypePill, Pill } from './StatusPill';
import { sortMedications } from '@/lib/api/patient';
import { formatInstant } from '@/lib/api/time';
import { medicationName, plainText } from '@/lib/api/labels';
import type { MedicationEvidence, OpenItem } from '@/lib/api/types';

function timeLabel(m: MedicationEvidence, tz?: string): string {
  if (m.asserted_start_at) return formatInstant(m.asserted_start_at, tz);
  if (m.evidence.effective_at) return formatInstant(m.evidence.effective_at, tz);
  const u = m.evidence.time_uncertainty;
  if (u) return `${u.raw_date} (${u.precision.toLowerCase()} precision)`;
  return 'Date not recorded';
}

// Order, dispense, administration and reported use are separate evidence types and are never merged.
export function MedicationTimeline({ medications, openItems = [], timeZone, title = 'Medication evidence' }: {
  medications: MedicationEvidence[]; openItems?: OpenItem[]; timeZone?: string; title?: string;
}) {
  const sorted = sortMedications(medications);
  const conflicts = openItems.filter((o) => o.status === 'OPEN' && sorted.some((m) => o.conflicting_evidence_ids.includes(m.source.evidence_id) || o.conflicting_evidence_ids.includes(m.evidence.source.evidence_id)));
  const conflictingIds = new Set(conflicts.flatMap((o) => o.conflicting_evidence_ids));
  return (
    <section aria-label={title} className="space-y-2">
      <h3>{title}</h3>
      {conflicts.map((o) => (
        <div key={o.open_item_id} role="note" className="rounded border border-unknown-line bg-unknown-bg p-2 text-xs text-unknown-fg">
          <strong>Records disagree</strong>: {plainText(o.description)} Both entries are kept; neither is chosen automatically.
        </div>
      ))}
      {sorted.length === 0 ? (
        <p className="text-xs text-ink-muted">No medication entries returned. This is not evidence that no medication was used.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-line pl-4">
          {sorted.map((m) => {
            const conflicting = conflictingIds.has(m.source.evidence_id) || conflictingIds.has(m.evidence.source.evidence_id);
            return (
              <li key={m.exposure_id} className="relative">
                <span aria-hidden="true" className={`absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full border-2 border-surface ${m.evidence_type === 'ADMINISTRATION' ? 'bg-brand' : 'bg-line-strong'}`} />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{timeLabel(m, timeZone)}</span>
                  <MedicationTypePill type={m.evidence_type} />
                  <span className="font-semibold">{medicationName(m.medication_code)}</span>
                  {!m.mapped_class && <Pill tone="unknown">Not identified</Pill>}
                  <EvidenceStatePill state={m.evidence.evidence_state} />
                  {conflicting && <Pill tone="unknown">Conflict</Pill>}
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">{MEDICATION_TYPE_LABEL[m.evidence_type].note}.</p>
                <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-2xs text-ink-muted">
                  {m.dose && <><dt>Dose</dt><dd>{m.dose.value ?? '—'} {m.dose.unit ?? ''}</dd></>}
                  {m.route && <><dt>Route</dt><dd>{m.route.value ?? '—'}</dd></>}
                  {m.asserted_end_exclusive_at && <><dt>Ends before</dt><dd>{formatInstant(m.asserted_end_exclusive_at, timeZone)}</dd></>}
                  {!m.asserted_end_exclusive_at && m.asserted_start_at && <><dt>End</dt><dd>Not recorded (not assumed ongoing or stopped)</dd></>}
                  {m.stop_reason && <><dt>Stop reason</dt><dd>{m.stop_reason}</dd></>}
                  {m.evidence.time_uncertainty?.possible_interval && (
                    <><dt>Possible interval</dt><dd>{formatInstant(m.evidence.time_uncertainty.possible_interval.earliest, timeZone)} to before {formatInstant(m.evidence.time_uncertainty.possible_interval.latest_exclusive, timeZone)}</dd></>
                  )}
                  <dt>Recorded</dt><dd>{formatInstant(m.evidence.recorded_at, timeZone)}</dd>
                  {m.adverse_reactions.length > 0 && <><dt>Reactions</dt><dd>{m.adverse_reactions.join('; ')}</dd></>}
                </dl>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
