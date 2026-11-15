'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useActor } from './ActorContext';
import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pill } from './StatusPill';
import { useApiQuery, type QueryState } from '@/lib/api/hooks';
import { ROLE_LABEL, STEPS, displayTitle } from '@/lib/api/labels';
import { getApi } from '@/lib/api/runtime';
import type { TrialDetail } from '@/lib/api/types';

const TrialContext = createContext<{ trialId: string; state: QueryState<TrialDetail> } | null>(null);

export function TrialDataProvider({ trialId, children }: { trialId: string; children: ReactNode }) {
  const { actor } = useActor();
  const state = useApiQuery<TrialDetail>(() => getApi().getTrial(trialId).then((r) => r.data), [trialId, actor.actor_id]);
  return <TrialContext.Provider value={{ trialId, state }}>{children}</TrialContext.Provider>;
}

export function useTrial(trialId: string) {
  const shared = useContext(TrialContext);
  const { actor } = useActor();
  const hasShared = shared?.trialId === trialId;
  // Standalone screens remain usable in component tests without a route layout.
  const fallback = useApiQuery<TrialDetail>(hasShared ? null : () => getApi().getTrial(trialId).then((r) => r.data), [trialId, actor.actor_id]);
  return hasShared ? shared.state : fallback;
}

export function TrialHeader({ trialId }: { trialId: string }) {
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const pathname = usePathname() ?? '';
  const base = `/trials/${encodeURIComponent(trialId)}`;

  const router = useRouter();
  const steps = STEPS.filter((s) => s.roles.includes(actor.role));
  // A patient page is reached from screening or from a safety case, so it belongs to whichever
  // of those steps the current role has; it is never off-role.
  const onPatient = pathname.startsWith(`${base}/patients`);
  const current = onPatient
    ? steps.find((s) => s.key === 'screen') ?? steps.find((s) => s.key === 'safety') ?? STEPS[0]
    : STEPS.find((s) => s.paths.some((p) => pathname.startsWith(base + p))) ?? STEPS[0];
  const offRole = !onPatient && !current.roles.includes(actor.role);

  // Switching role while on a screen the new role does not use goes to the overview.
  const previousRole = useRef(actor.role);
  useEffect(() => {
    if (previousRole.current !== actor.role && offRole) router.replace(base);
    previousRole.current = actor.role;
  }, [actor.role, offRole, base, router]);
  // A single workflow step is not a sequence, so it gets no number.
  const numbered = steps.length > 2;
  const protocolApproved = Boolean(trial.data?.active_protocol_version_id);
  const safetyFlag = (trial.data?.finding_count ?? 0) > 0 && (actor.role === 'INVESTIGATOR' || actor.role === 'MONITOR');

  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {trial.loading && <LoadingSkeleton rows={1} label="Loading trial" />}
          {trial.error ? <ErrorPanel error={trial.error} context="Trial" onRetry={trial.reload} /> : null}
          {trial.data && <h1 className="truncate">{displayTitle(trial.data.title)}</h1>}
        </div>
        {trial.data && (protocolApproved ? <Pill tone="pass">Protocol approved</Pill> : <Pill tone="unknown">No approved protocol</Pill>)}
      </div>
      <nav aria-label="Study workflow" className="overflow-x-auto border-b border-line">
        <ul className="flex min-w-max gap-1">
          {steps.map((s, i) => {
            const active = s.key === current.key;
            const done = s.key === 'protocol' && protocolApproved;
            const circle = active ? 'bg-brand text-white' : done ? 'bg-pass-bg text-pass-fg' : 'bg-neutral-bg text-neutral-fg';
            return (
              <li key={s.key}>
                <Link
                  href={base + s.href}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px flex items-center gap-2 border-b-[3px] px-3.5 py-3 text-sm ${active ? 'border-brand font-bold text-brand' : 'border-transparent font-medium text-ink-muted hover:text-ink'}`}
                >
                  {s.key !== 'overview' && numbered && (
                    <span aria-hidden="true" className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-bold ${circle}`}>{done ? '✓' : i}</span>
                  )}
                  {s.label}
                  {s.key === 'safety' && safetyFlag && (
                    <span className="-ml-1 -mt-3 inline-block h-2 w-2 rounded-full bg-fail-fg"><span className="sr-only">Findings to review</span></span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {offRole && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-unknown-line bg-unknown-bg px-4 py-3">
          <p className="font-semibold text-unknown-fg">This screen is not part of the {ROLE_LABEL[actor.role].toLowerCase().replace('research it', 'research IT')} role.</p>
          <Link href={base} className="btn-secondary">Go to overview</Link>
        </div>
      )}
    </div>
  );
}
