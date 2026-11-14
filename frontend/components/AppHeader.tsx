'use client';

import Link from 'next/link';
import { useActor } from './ActorContext';
import { Pill } from './StatusPill';
import { useApiQuery } from '@/lib/api/hooks';
import { API_BASE_URL_LABEL, API_MODE, DEMO_ACTORS, getApi } from '@/lib/api/runtime';
import { CONTRACT_VERSION } from '@/lib/api/types';

function HealthIndicator() {
  const health = useApiQuery(() => getApi().getHealth().then((r) => r.data), []);
  if (health.loading) return <Pill tone="neutral">API checking…</Pill>;
  if (health.error || !health.data) return <Pill tone="fail" title={String((health.error as Error)?.message ?? '')}>API unreachable</Pill>;
  const h = health.data;
  const mismatch = h.contract_version !== CONTRACT_VERSION;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Pill tone={h.status === 'ok' ? 'pass' : 'unknown'} title={`database ${h.database} · migrations ${h.migrations} · worker ${h.worker}`}>API {h.status}</Pill>
      <Pill tone={h.llm === 'enabled' ? 'info' : 'neutral'} title="Agent investigations need the LLM; deterministic screening does not">LLM {h.llm}</Pill>
      {mismatch && <Pill tone="fail" title={`UI expects ${CONTRACT_VERSION}`}>Contract {h.contract_version} ≠ UI</Pill>}
    </span>
  );
}

export function AppHeader() {
  const { actor, setActorId } = useActor();
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
        <Link href="/" className="text-base font-semibold text-brand">ProtocolPulse</Link>
        <div className="flex flex-1 flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Pill tone={API_MODE === 'live' ? 'info' : API_MODE === 'mock' ? 'unknown' : 'fail'}>{API_MODE === 'live' ? 'Live API' : API_MODE === 'mock' ? 'Mock API' : 'No API'}</Pill>
          <span className="mono hidden sm:inline" title="API base URL">{API_BASE_URL_LABEL}</span>
          <HealthIndicator />
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-ink-muted">Simulated actor <span className="sr-only">(demo role switcher, not authentication)</span></span>
          <select
            className="input w-auto py-1"
            value={actor.actor_id}
            onChange={(e) => setActorId(e.target.value)}
            aria-describedby="actor-hint"
          >
            {DEMO_ACTORS.map((a) => (
              <option key={a.actor_id} value={a.actor_id}>{a.actor_id} · {a.role}{a.confirmed ? '' : ' (unconfirmed ID)'}</option>
            ))}
          </select>
        </label>
        <span id="actor-hint" className="w-full text-2xs text-ink-faint sm:w-auto">Demo role simulation, not authentication.</span>
      </div>
    </header>
  );
}
