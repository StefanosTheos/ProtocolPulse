'use client';

import { useParams } from 'next/navigation';
import { useActor } from '@/components/ActorContext';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { listAllTrials } from '@/components/StudySelector';
import { useApiQuery } from '@/lib/api/hooks';
import { displayTitle } from '@/lib/api/labels';
import { getApi } from '@/lib/api/runtime';
import type { ParticipationSummary, Trial } from '@/lib/api/types';

// Sponsor view: aggregate participation per study. Counts only, so no patient can be identified.
export default function ParticipationPage() {
  const { trialId } = useParams<{ trialId: string }>();
  const { actor } = useActor();
  const rows = useApiQuery(async () => {
    const trials = await listAllTrials();
    const summaries = await Promise.all(trials.map((t) => getApi().getParticipationSummary(t.trial_id).then((r) => r.data)));
    return trials.map((t, i): [Trial, ParticipationSummary] => [t, summaries[i]]);
  }, [actor.actor_id]);
  const totals = rows.data?.reduce((sum, [, s]) => ({
    cohort: sum.cohort + s.cohort_count, participating: sum.participating + s.participating_count, ended: sum.ended + s.ended_count,
  }), { cohort: 0, participating: 0, ended: 0 });

  return (
    <section className="space-y-4" aria-labelledby="participation-heading">
      <div>
        <h2 id="participation-heading" className="text-xl">Participation</h2>
        <p className="text-ink-muted">How many patients take part in each study. Only counts are shown: patient identities and medical records stay with the Clinical Lead.</p>
      </div>
      {rows.loading && <LoadingSkeleton rows={3} label="Loading participation" />}
      {rows.error ? <ErrorPanel error={rows.error} context="Could not load participation" onRetry={rows.reload} /> : null}
      {rows.data && rows.data.length === 0 && <EmptyState title="No studies yet">Participation appears here once a study exists.</EmptyState>}
      {rows.data && rows.data.length > 0 && totals && (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Study</th><th className="text-right">Patients in cohort</th><th className="text-right">Participating</th><th className="text-right">Participation ended</th></tr>
            </thead>
            <tbody>
              {rows.data.map(([t, s]) => {
                const current = t.trial_id === trialId;
                return (
                  <tr key={t.trial_id} aria-current={current ? 'true' : undefined} className={current ? 'bg-brand-soft font-semibold' : undefined}>
                    <td>{displayTitle(t.title)}{current && <span className="ml-2 text-xs font-normal text-ink-muted">(this study)</span>}</td>
                    <td className="text-right tabular-nums">{s.cohort_count}</td>
                    <td className="text-right tabular-nums">{s.participating_count}</td>
                    <td className="text-right tabular-nums">{s.ended_count}</td>
                  </tr>
                );
              })}
            </tbody>
            {rows.data.length > 1 && (
              <tfoot>
                <tr className="font-semibold">
                  <td>All studies</td>
                  <td className="text-right tabular-nums">{totals.cohort}</td>
                  <td className="text-right tabular-nums">{totals.participating}</td>
                  <td className="text-right tabular-nums">{totals.ended}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  );
}
