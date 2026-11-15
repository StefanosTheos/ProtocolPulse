'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId } from 'react';
import { useActor } from './ActorContext';
import { EmptyState, ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useApiQuery } from '@/lib/api/hooks';
import { displayTitle, formatDay } from '@/lib/api/labels';
import { getApi } from '@/lib/api/runtime';
import type { Trial } from '@/lib/api/types';

export function StudySelector({ trialId, onNavigate }: { trialId?: string; onNavigate?: (href: string) => void }) {
  const { actor } = useActor();
  const router = useRouter();
  const id = useId();
  const studies = useApiQuery(async () => {
    const items: Trial[] = [];
    let cursor: string | undefined;
    do {
      const result = await getApi().listTrials({ sort: '-created_at', limit: 100, cursor });
      items.push(...result.data.items);
      cursor = result.data.page.next_cursor ?? undefined;
    } while (cursor);
    return items;
  }, [actor.actor_id]);
  const selectedStudy = studies.data?.find((study) => study.trial_id === trialId);

  useEffect(() => {
    // Warm route code only; unselected studies must not trigger clinical-data reads.
    for (const study of studies.data?.slice(0, 5) ?? []) router.prefetch(`/trials/${encodeURIComponent(study.trial_id)}`);
  }, [studies.data, router]);

  return (
    <section className="mt-5 space-y-3" aria-label="Study selection">
      <div className="max-w-xl">
        <label className="label" htmlFor={id}>Study</label>
        <select id={id} className="input w-full" value={trialId ?? ''} disabled={!studies.data} onChange={(event) => {
          const selected = event.target.value;
          (onNavigate ?? router.push)(selected ? `/trials/${encodeURIComponent(selected)}` : '/');
        }}>
          <option value="">Select a study…</option>
          {trialId && !studies.data?.some((s) => s.trial_id === trialId) && <option value={trialId} disabled>Current study</option>}
          {studies.data?.map((study) => <option key={study.trial_id} value={study.trial_id}>{displayTitle(study.title)}</option>)}
        </select>
      </div>
      {studies.loading && !studies.data && <LoadingSkeleton rows={1} label="Loading studies" />}
      {studies.error ? <ErrorPanel error={studies.error} context="Could not load studies" onRetry={studies.reload} /> : null}
      {selectedStudy && (
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><dt className="text-ink-muted">Site time zone</dt><dd>{selectedStudy.site_timezone}</dd></div>
          <div><dt className="text-ink-muted">Planned dates</dt><dd>{formatDay(selectedStudy.planned_start_date)} – {formatDay(selectedStudy.planned_end_date)}</dd></div>
        </dl>
      )}
      {studies.data?.length === 0 && <EmptyState title="No studies yet">The Sponsor registers a study before it appears here.</EmptyState>}
      {!trialId && <p className="text-ink-muted">Choose a study to view its overview.</p>}
    </section>
  );
}
