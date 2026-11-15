'use client';

import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { TrialHeader } from '@/components/TrialHeader';

// The trial title and step bar live in the layout so they stay mounted while switching tabs.
export default function TrialLayout({ children }: { children: ReactNode }) {
  const { trialId } = useParams<{ trialId: string }>();
  return (
    <div>
      <TrialHeader trialId={trialId} />
      {children}
    </div>
  );
}
