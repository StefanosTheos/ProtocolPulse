'use client';

import Link from 'next/link';
import { useActor } from './ActorContext';
import { Pill } from './StatusPill';
import { useApiQuery } from '@/lib/api/hooks';
import { ROLE_LABEL } from '@/lib/api/labels';
import { DEMO_ACTORS, getApi } from '@/lib/api/runtime';
import { CONTRACT_VERSION } from '@/lib/api/types';

// Shown only when something is wrong; a healthy service needs no badge.
function ServiceStatus() {
  const health = useApiQuery(() => getApi().getHealth().then((r) => r.data), []);
  if (health.loading) return null;
  if (health.error || !health.data) return <Pill tone="fail">Service unavailable</Pill>;
  if (process.env.NODE_ENV !== 'production' && health.data.contract_version !== CONTRACT_VERSION) {
    return <Pill tone="fail" title={`UI expects ${CONTRACT_VERSION}`}>API version mismatch</Pill>;
  }
  return null;
}

export function AppHeader() {
  const { actor, setActorId } = useActor();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-brand">ProtocolPulse</Link>
        <div className="flex flex-wrap items-center gap-3">
          <ServiceStatus />
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Viewing as</span>
            <select className="input w-auto font-semibold" value={actor.actor_id} onChange={(e) => setActorId(e.target.value)}>
              {DEMO_ACTORS.map((a) => <option key={a.actor_id} value={a.actor_id}>{ROLE_LABEL[a.role]}</option>)}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
