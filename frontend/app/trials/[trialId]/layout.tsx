'use client';

import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { TrialDataProvider, TrialHeader, useTrial } from '@/components/TrialHeader';
import { isNotFound } from '@/lib/api/errors';
import { onTrialChanged } from '@/lib/api/events';

// The trial title and step bar live in the layout so they stay mounted while switching tabs.
// They refresh on every navigation and whenever a page reports a change.
function TrialShell({ children }: { children: ReactNode }) {
  const { trialId } = useParams<{ trialId: string }>();
  const pathname = usePathname();
  const search = useSearchParams()?.toString();
  const trial = useTrial(trialId);
  const { reload } = trial;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    reload();
  }, [pathname, search, reload]);
  useEffect(() => onTrialChanged(reload), [reload]);

  if (isNotFound(trial.error)) {
    return (
      <div className="card card-pad mx-auto max-w-xl space-y-3 text-center">
        <h1>Study not found</h1>
        <p className="text-ink-muted">This study doesn&apos;t exist or was removed. Check the address, or choose a study from the list.</p>
        <Link href="/" className="btn-primary">Go to studies</Link>
      </div>
    );
  }
  return (
    <div>
      <TrialHeader trialId={trialId} trial={trial} />
      {children}
    </div>
  );
}

export default function TrialLayout({ children }: { children: ReactNode }) {
  const { trialId } = useParams<{ trialId: string }>();
  return (
    <Suspense fallback={null}>
      <TrialDataProvider trialId={trialId}>
        <TrialShell>{children}</TrialShell>
      </TrialDataProvider>
    </Suspense>
  );
}
