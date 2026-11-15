'use client';

import Link from 'next/link';
import { useActor } from '@/components/ActorContext';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Pill } from '@/components/StatusPill';
import { useApiQuery } from '@/lib/api/hooks';
import { displayTitle, formatDay } from '@/lib/api/labels';
import { getApi } from '@/lib/api/runtime';

export default function TrialListPage() {
  const { actor } = useActor();
  const trials = useApiQuery(() => getApi().listTrials({ sort: '-created_at' }).then((r) => r.data), [actor.actor_id]);

  return (
    <div className="space-y-4">
      <div>
        <h1>Studies</h1>
        <p className="text-ink-muted">Choose a study to open it.</p>
      </div>
      {trials.loading && <LoadingSkeleton rows={3} label="Loading studies" />}
      {trials.error ? <ErrorPanel error={trials.error} context="Could not load studies" onRetry={trials.reload} /> : null}
      {trials.data && trials.data.items.length === 0 && (
        <EmptyState title="No studies yet">A coordinator or research IT registers a study before it appears here.</EmptyState>
      )}
      {trials.data && trials.data.items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Study</th><th>Site time zone</th><th>Planned dates</th><th>Protocol</th></tr></thead>
            <tbody>
              {trials.data.items.map((t) => (
                <tr key={t.trial_id}>
                  <td>
                    <Link className="font-medium text-brand underline-offset-2 hover:underline" href={`/trials/${encodeURIComponent(t.trial_id)}`}>{displayTitle(t.title)}</Link>
                  </td>
                  <td>{t.site_timezone}</td>
                  <td className="whitespace-nowrap">{formatDay(t.planned_start_date)} – {formatDay(t.planned_end_date)}</td>
                  <td>{t.active_protocol_version_id ? <Pill tone="pass">Approved</Pill> : <Pill tone="unknown">Not approved</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
