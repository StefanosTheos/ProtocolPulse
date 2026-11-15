'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useOptimistic, useRef, useTransition, type ReactNode } from 'react';
import { useActor } from './ActorContext';
import { ErrorPanel } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';
import { Pill } from './StatusPill';
import { StudySelector } from './StudySelector';
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

export function useTrial(trialId?: string) {
  const shared = useContext(TrialContext);
  const { actor } = useActor();
  const hasShared = shared !== null && shared.trialId === trialId;
  // Standalone screens remain usable in component tests without a route layout.
  const fallback = useApiQuery<TrialDetail>(!trialId || hasShared ? null : () => getApi().getTrial(trialId).then((r) => r.data), [trialId, actor.actor_id]);
  return hasShared ? shared.state : fallback;
}

export function TrialHeader({ trialId, children }: { trialId?: string; children?: ReactNode }) {
  const { actor } = useActor();
  const trial = useTrial(trialId);
  const pathname = usePathname() ?? '';
  const [targetPath, setTargetPath] = useOptimistic(pathname);
  const [pending, startTransition] = useTransition();
  const targetId = targetPath.match(/^\/trials\/([^/]+)/)?.[1];
  const selectedTrialId = targetId ? decodeURIComponent(targetId) : undefined;
  const changingStudy = pending && selectedTrialId !== trialId;
  const base = selectedTrialId ? `/trials/${encodeURIComponent(selectedTrialId)}` : '/';

  const router = useRouter();
  function navigate(href: string) {
    if (!pending && href === pathname) return;
    startTransition(() => {
      setTargetPath(href);
      router.push(href);
    });
  }
  function prefetchTab(key: string) {
    if (!trialId || changingStudy) return;
    const step = STEPS.find((s) => s.key === key && s.roles.includes(actor.role));
    if (!step) return;
    router.prefetch(base + step.href);
    const api = getApi();
    const reads: Promise<unknown>[] = [];
    if (key === 'protocol') reads.push(api.listProtocols(trialId, { sort: '-created_at', limit: 50 }));
    if (key === 'screen' && trial.data?.active_protocol_version_id) reads.push(api.getProtocol(trialId, trial.data.active_protocol_version_id));
    if (key === 'safety') reads.push(api.listFindings(trialId, { sort: '-created_at', limit: 50 }), api.listCases(trialId, { sort: '-updated_at', limit: 20 }));
    if (key === 'audit') reads.push(api.listAudit(trialId, { sort: '-occurred_at', limit: 50 }), api.listCases(trialId, { limit: 100 }));
    // A failed speculative read is retried by the destination, where errors are visible.
    void Promise.allSettled(reads);
  }
  const steps = STEPS.filter((s) => s.roles.includes(actor.role));
  // A patient page is reached from screening or from a safety case, so it belongs to whichever
  // of those steps the current role has; it is never off-role.
  const onPatient = targetPath.startsWith(`${base}/patients`);
  const current = onPatient
    ? steps.find((s) => s.key === 'screen') ?? steps.find((s) => s.key === 'safety') ?? STEPS[0]
    : STEPS.find((s) => s.paths.some((p) => targetPath.startsWith(base + p))) ?? STEPS[0];
  const offRole = !onPatient && !current.roles.includes(actor.role);

  // Switching role while on a screen the new role does not use goes to the overview.
  const previousRole = useRef(actor.role);
  useEffect(() => {
    if (previousRole.current !== actor.role && offRole) router.replace(base);
    previousRole.current = actor.role;
  }, [actor.role, offRole, base, router]);
  // A single workflow step is not a sequence, so it gets no number.
  const numbered = !!trialId && steps.length > 2;
  const protocolApproved = Boolean(trial.data?.active_protocol_version_id);
  const safetyFlag = (trial.data?.finding_count ?? 0) > 0 && (actor.role === 'INVESTIGATOR' || actor.role === 'MONITOR');

  return (
    <>
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {!selectedTrialId && <h1>Overview</h1>}
          {changingStudy && selectedTrialId && <h1>Opening study…</h1>}
          {!changingStudy && trial.loading && <LoadingSkeleton rows={1} label="Loading trial" />}
          {!changingStudy && trial.error ? <ErrorPanel error={trial.error} context="Trial" onRetry={trial.reload} /> : null}
          {!changingStudy && trial.data && <h1 className="truncate">{displayTitle(trial.data.title)}</h1>}
        </div>
        {!changingStudy && trial.data && (protocolApproved ? <Pill tone="pass">Protocol approved</Pill> : <Pill tone="unknown">No approved protocol</Pill>)}
      </div>
      <nav aria-label="Study workflow" className="border-b border-line">
        <ul className="flex flex-wrap gap-1">
          {steps.map((s, i) => {
            const active = s.key === current.key;
            const done = s.key === 'protocol' && protocolApproved;
            const circle = active ? 'bg-brand text-white' : done ? 'bg-pass-bg text-pass-fg' : 'bg-neutral-bg text-neutral-fg';
            return (
              <li key={s.key}>
                {(!selectedTrialId || changingStudy) && s.key !== 'overview' ? (
                  <button type="button" disabled title="Select a study first" className="-mb-px border-b-[3px] border-transparent px-3.5 py-3 text-sm font-medium text-ink-faint">{s.label}</button>
                ) : (
                  <Link
                    href={base + s.href}
                    prefetch={false}
                    onNavigate={(event) => { event.preventDefault(); navigate(base + s.href); }}
                    onMouseEnter={() => prefetchTab(s.key)}
                    onFocus={() => prefetchTab(s.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`-mb-px flex items-center gap-2 border-b-[3px] px-3.5 py-3 text-sm ${active ? 'border-brand font-bold text-brand' : 'border-transparent font-medium text-ink-muted hover:text-ink'}`}
                  >
                    {s.key !== 'overview' && s.key !== 'audit' && numbered && (
                      <span aria-hidden="true" className={`inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-xs font-bold ${circle}`}>{done ? '✓' : i}</span>
                    )}
                    {s.label}
                    {s.key === 'safety' && safetyFlag && (
                      <span className="-ml-1 -mt-3 inline-block h-2 w-2 rounded-full bg-fail-fg"><span className="sr-only">Findings to review</span></span>
                    )}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      {current.key === 'overview' && <StudySelector trialId={selectedTrialId} onNavigate={navigate} />}
      {offRole && (
        <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-unknown-line bg-unknown-bg px-4 py-3">
          <p className="font-semibold text-unknown-fg">This screen is not part of the {ROLE_LABEL[actor.role].toLowerCase().replace('research it', 'research IT')} role.</p>
          <Link href={base} className="btn-secondary">Go to overview</Link>
        </div>
      )}
    </div>
    {pending && <LoadingSkeleton rows={5} label="Opening view" />}
    <div hidden={pending}>{children}</div>
    </>
  );
}
