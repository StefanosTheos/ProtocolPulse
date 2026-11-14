import Link from 'next/link';
import { CategoryPill, PriorityPill } from './StatusPill';
import { formatInstant } from '@/lib/api/time';
import type { MonitoringFinding } from '@/lib/api/types';

// Monitoring findings as the backend reports them. Before/after are assessment IDs; the
// contract has no assessment-by-ID route, so statuses are not inferred here.
export function EventTimeline({ trialId, findings, timeZone }: { trialId: string; findings: MonitoringFinding[]; timeZone?: string }) {
  const base = `/trials/${encodeURIComponent(trialId)}`;
  return (
    <ol className="space-y-3">
      {findings.map((f) => {
        const ev = f.evidence_refs[0];
        return (
          <li key={f.finding_id} className="card card-pad">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryPill category={f.category} />
              <PriorityPill priority={f.priority} />
              <Link className="mono font-semibold text-brand underline-offset-2 hover:underline" href={`${base}/patients/${encodeURIComponent(f.patient_id)}`}>{f.patient_id}</Link>
              <span className="mono">{f.criterion_id}</span>
              <span className="mono text-ink-faint">{f.protocol_version_id}</span>
            </div>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr_auto_1fr]">
              <dt className="text-ink-muted">Event clinical time</dt><dd>{formatInstant(ev?.effective_at ?? null, timeZone)}</dd>
              <dt className="text-ink-muted">Event recorded</dt><dd>{formatInstant(ev?.recorded_at ?? null, timeZone)}</dd>
              <dt className="text-ink-muted">Finding created</dt><dd>{formatInstant(f.created_at, timeZone)}</dd>
              <dt className="text-ink-muted">Triggering event</dt><dd className="mono">{f.triggering_event_id}</dd>
              <dt className="text-ink-muted">Before assessment</dt><dd className="mono">{f.before_assessment_id ?? 'none'}</dd>
              <dt className="text-ink-muted">After assessment</dt><dd className="mono">{f.after_assessment_id}</dd>
            </dl>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              <Link className="btn-secondary px-2 py-1" href={`${base}/cases?case=${encodeURIComponent(f.case_id)}`}>Open case {f.case_id}</Link>
              <span className="text-ink-faint">{f.evidence_refs.length} evidence reference(s) · issue <span className="mono">{f.issue_key}</span></span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
