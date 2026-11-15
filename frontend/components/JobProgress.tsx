'use client';

import { useEffect, useState } from 'react';
import { ErrorPanel } from './ErrorBoundary';
import { JobStatusPill } from './StatusPill';
import type { JobDetail } from '@/lib/api/types';

// The backend reports progress in a few coarse jumps. While a job runs, the bar eases towards
// the next jump so it keeps moving; it only reaches 100% when the job has actually succeeded.
export function useSmoothProgress(job: JobDetail | null, running: boolean): number {
  const [shown, setShown] = useState(0);
  const reported = job?.progress_percent ?? 0;
  const done = job?.status === 'SUCCEEDED';
  useEffect(() => {
    if (done) { setShown(100); return; }
    if (!running) return;
    const timer = window.setInterval(() => {
      setShown((current) => {
        const floor = Math.max(current, Math.min(reported, 95));
        return floor + (95 - floor) * 0.03;
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [running, reported, done]);
  return shown;
}

export function ProgressBar({ percent, label, active }: { percent: number; label: string; active: boolean }) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-brand-soft" role="progressbar" aria-label={label} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
      <div className="relative h-full overflow-hidden rounded-full bg-brand transition-[width] duration-500 ease-out" style={{ width: `${percent}%` }}>
        {active && <div aria-hidden="true" className="progress-sheen absolute inset-y-0 left-0 w-1/3 bg-white/30" />}
      </div>
    </div>
  );
}

// Progress of a background task, in plain words.
export function JobProgress({ job, error, running, label }: { job: JobDetail | null; error: unknown; running: boolean; label: string }) {
  const percent = useSmoothProgress(job, running);
  if (!job && !error && !running) return null;
  return (
    <div className="space-y-2 rounded-lg border border-line bg-canvas p-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{label}</span>
          {job ? <JobStatusPill status={job.status} /> : running && <span className="text-ink-muted">Working</span>}
        </span>
        {running && <span className="font-semibold tabular-nums text-brand">{Math.round(percent)}%</span>}
      </div>
      {running && <ProgressBar percent={percent} label={label} active />}
      {job?.status === 'FAILED' && job.error && (
        <p className="text-fail-fg">{job.error.message}{job.error.retryable ? ' You can try again.' : ''}</p>
      )}
      {error ? <ErrorPanel error={error} context="Could not check progress" /> : null}
    </div>
  );
}

const STAGES = [
  { until: 25, title: 'Reading the document', detail: 'Opening every page of the PDF.' },
  { until: 60, title: 'Finding the rules', detail: 'Eligibility and safety rules.' },
  { until: 90, title: 'Linking to source pages', detail: 'Each rule points to its text.' },
  { until: 100, title: 'Preparing for review', detail: 'Checking every section is covered.' },
];

// Staged progress for reading rules from a protocol PDF.
export function ExtractionProgress({ job, error, running }: { job: JobDetail | null; error: unknown; running: boolean }) {
  const percent = useSmoothProgress(job, running);
  if (!job && !error && !running) return null;
  const failed = job?.status === 'FAILED';
  const current = STAGES.find((s) => percent < s.until);
  return (
    <div className="space-y-4" aria-live="polite">
      {!failed && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-base font-semibold">{current ? current.title : 'Rules are ready for review'}</p>
            <p className="text-[22px] font-bold tabular-nums text-brand">{Math.round(percent)}%</p>
          </div>
          <ProgressBar percent={percent} label="Reading rules from the protocol" active={running} />
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STAGES.map((stage, i) => {
              const done = percent >= stage.until;
              const active = !done && percent >= (STAGES[i - 1]?.until ?? 0);
              return (
                <li key={stage.title} className={`rounded-xl border px-3.5 py-3 transition-colors duration-500 ${active ? 'border-pass-line bg-pass-bg' : done ? 'border-line bg-surface' : 'border-line bg-canvas'}`}>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <span aria-hidden="true" className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-pass-fg">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.5 2.5 2.5 4.5-5.5" /></svg>
                      </span>
                    ) : active ? (
                      <span aria-hidden="true" className="h-[18px] w-[18px] flex-none animate-spin rounded-full border-2 border-pass-line border-t-brand motion-reduce:animate-none" />
                    ) : (
                      <span aria-hidden="true" className="h-[18px] w-[18px] flex-none rounded-full border-2 border-neutral-line" />
                    )}
                    <span className={`font-semibold ${done || active ? 'text-ink' : 'text-ink-muted'}`}>{stage.title}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-muted">{stage.detail}</p>
                </li>
              );
            })}
          </ol>
          {running && <p className="text-xs text-ink-muted">You can leave this page. Reading continues, and the rules appear below when it finishes.</p>}
        </>
      )}
      {failed && job?.error && <p className="text-fail-fg">{job.error.message}{job.error.retryable ? ' You can try again.' : ''}</p>}
      {error ? <ErrorPanel error={error} context="Could not check progress" /> : null}
    </div>
  );
}
