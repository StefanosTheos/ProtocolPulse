'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { TrialDataProvider, TrialHeader, useTrial } from '@/components/TrialHeader';
import { isNotFound } from '@/lib/api/errors';
import { onTrialChanged } from '@/lib/api/events';

// The trial title and step bar live in the layout so they stay mounted while switching tabs.
// They refresh whenever a page reports a change.
function TrialShell({ trialId, children }: { trialId: string; children: ReactNode }) {
  const trial = useTrial(trialId);
  const { reload } = trial;
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
  return <TrialHeader trialId={trialId}>{children}</TrialHeader>;
}

export default function TrialLayout({ children }: { children: ReactNode }) {
  const { trialId } = useParams<{ trialId: string }>();
  return (
    <TrialDataProvider trialId={trialId}>
      <TrialShell trialId={trialId}>{children}</TrialShell>
    </TrialDataProvider>
  );
}
