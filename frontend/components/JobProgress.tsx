import { ErrorPanel } from './ErrorBoundary';
import { JobStatusPill } from './StatusPill';
import type { JobDetail } from '@/lib/api/types';

// Shows durable job state exactly as GET /jobs/{id} reports it.
export function JobProgress({ job, error, running, label }: { job: JobDetail | null; error: unknown; running: boolean; label: string }) {
  if (!job && !error && !running) return null;
  return (
    <div className="space-y-2 rounded-md border border-line bg-canvas p-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{label}</span>
        {job ? <JobStatusPill status={job.status} /> : running && <span className="text-ink-muted">Waiting for job status…</span>}
        {job && <span className="mono text-ink-faint">{job.job_id}</span>}
        {job?.progress_percent !== null && job?.progress_percent !== undefined && <span className="text-xs text-ink-muted">{job.progress_percent}%</span>}
        {job && <span className="text-xs text-ink-muted">attempt {job.attempts}/{job.max_attempts}</span>}
      </div>
      {running && job?.progress_percent != null && (
        <div className="h-1.5 w-full overflow-hidden rounded bg-line" role="progressbar" aria-valuenow={job.progress_percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-brand transition-all" style={{ width: `${job.progress_percent}%` }} />
        </div>
      )}
      {job?.status === 'FAILED' && job.error && (
        <p className="text-fail-fg"><span className="mono">{job.error.code}</span>: {job.error.message}{job.error.retryable ? ' (retryable)' : ''}</p>
      )}
      {error ? <ErrorPanel error={error} context="Job polling" /> : null}
    </div>
  );
}
