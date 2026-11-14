'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useActor } from './ActorContext';
import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pill } from './StatusPill';
import { useApiQuery } from '@/lib/api/hooks';
import { getApi } from '@/lib/api/runtime';
import type { TrialDetail } from '@/lib/api/types';

const STAGES = [
  { href: '', label: 'Overview' },
  { href: '/protocol', label: 'Trial setup' },
  { href: '/selector', label: 'Patient selector' },
  { href: '/monitor', label: 'Safety monitor' },
  { href: '/cases', label: 'Review queue' },
  { href: '/audit', label: 'Agent activity & audit' },
];

export function useTrial(trialId: string) {
  const { actor } = useActor();
  return useApiQuery<TrialDetail>(() => getApi().getTrial(trialId).then((r) => r.data), [trialId, actor.actor_id]);
}

export function TrialHeader({ trialId }: { trialId: string }) {
  const trial = useTrial(trialId);
  const pathname = usePathname() ?? '';
  const base = `/trials/${encodeURIComponent(trialId)}`;
  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {trial.loading && <LoadingSkeleton rows={1} label="Loading trial" />}
          {trial.error ? <ErrorPanel error={trial.error} context="Trial" onRetry={trial.reload} /> : null}
          {trial.data && (
            <>
              <p className="text-xs text-ink-muted"><span className="mono">{trial.data.trial_id}</span> · site <span className="mono">{trial.data.site_id}</span> · {trial.data.site_timezone}</p>
              <h1 className="truncate">{trial.data.title}</h1>
            </>
          )}
        </div>
        {trial.data && (
          <div className="flex flex-wrap items-center gap-2">
            {trial.data.active_protocol_version_id
              ? <Pill tone="pass">Active protocol <span className="ml-1 normal-case">{trial.data.active_protocol_version_id}</span></Pill>
              : <Pill tone="unknown">No approved protocol</Pill>}
          </div>
        )}
      </div>
      <nav aria-label="Trial workflow" className="overflow-x-auto border-b border-line">
        <ul className="flex min-w-max gap-1">
          {STAGES.map((s) => {
            const href = base + s.href;
            const active = s.href === '' ? pathname === base : pathname.startsWith(href);
            return (
              <li key={s.label}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px inline-block border-b-2 px-3 py-2 text-sm ${active ? 'border-brand font-semibold text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
