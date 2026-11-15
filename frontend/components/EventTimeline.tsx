import Link from 'next/link';
import { CategoryPill, PriorityPill } from './StatusPill';
import { formatInstant } from '@/lib/api/time';
import type { MonitoringFinding } from '@/lib/api/types';

// Monitoring findings as the backend reports them; each one links to its review case.
export function EventTimeline({ trialId, findings, timeZone }: { trialId: string; findings: MonitoringFinding[]; timeZone?: string }) {
  const base = `/trials/${encodeURIComponent(trialId)}`;
  return (
    <ol className="space-y-3">
      {findings.map((f) => {
        const ev = f.evidence_refs[0];
        return (
          <li key={f.finding_id} className="card card-pad flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryPill category={f.category} />
                <PriorityPill priority={f.priority} />
              </div>
              <h3 className="text-base">
                Patient <Link className="text-brand underline underline-offset-2" href={`${base}/patients/${encodeURIComponent(f.patient_id)}`}>{f.patient_id}</Link>
              </h3>
              <p className="text-ink-muted">
                Occurred {formatInstant(ev?.effective_at ?? null, timeZone)} · Recorded {formatInstant(ev?.recorded_at ?? null, timeZone)} · Found {formatInstant(f.created_at, timeZone)} · {f.evidence_refs.length} supporting record{f.evidence_refs.length === 1 ? '' : 's'}
              </p>
            </div>
            <Link className="btn-primary" aria-label={`Open case for patient ${f.patient_id}`} href={`${base}/cases?case=${encodeURIComponent(f.case_id)}`}>Open case</Link>
          </li>
        );
      })}
    </ol>
  );
}
