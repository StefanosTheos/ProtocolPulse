'use client';

import Link from 'next/link';
import { useActor } from '@/components/ActorContext';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Pill } from '@/components/StatusPill';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';

export default function TrialListPage() {
  const { actor } = useActor();
  const trials = useApiQuery(() => getApi().listTrials({ sort: '-created_at' }).then((r) => r.data), [actor.actor_id]);

  return (
    <div className="space-y-4">
      <div>
        <h1>Trials</h1>
        <p className="text-ink-muted">Fictional trials registered with the ProtocolPulse API.</p>
      </div>
      {trials.loading && <LoadingSkeleton rows={3} label="Loading trials" />}
      {trials.error ? <ErrorPanel error={trials.error} context="Could not load trials" onRetry={trials.reload} /> : null}
      {trials.data && trials.data.items.length === 0 && (
        <EmptyState title="No trials yet">A coordinator or research IT actor registers a fictional trial through the API seed or POST /trials.</EmptyState>
      )}
      {trials.data && trials.data.items.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Trial</th><th>Product</th><th>Site</th><th>Planned window</th><th>Protocol</th></tr></thead>
            <tbody>
              {trials.data.items.map((t) => (
                <tr key={t.trial_id}>
                  <td>
                    <Link className="font-medium text-brand underline-offset-2 hover:underline" href={`/trials/${encodeURIComponent(t.trial_id)}`}>{t.title}</Link>
                    <div className="mono text-ink-faint">{t.trial_id}</div>
                  </td>
                  <td className="mono">{t.fictional_product_code}</td>
                  <td><span className="mono">{t.site_id}</span><div className="text-xs text-ink-faint">{t.site_timezone}</div></td>
                  <td className="whitespace-nowrap">{t.planned_start_date} → {t.planned_end_date}</td>
                  <td>{t.active_protocol_version_id ? <Pill tone="pass">{t.active_protocol_version_id}</Pill> : <Pill tone="unknown">Not approved</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
