import { ApiClient, ApiError, type Transport } from './client';
import { createEndpoints, type Endpoints } from './endpoints';
import { createLiveTransport } from './live';
import { createMockTransport } from './mocks';
import type { ActorRole } from './types';

// The only browser configuration is NEXT_PUBLIC_API_BASE_URL (see .env.example).
// The literal value "mock" selects the explicitly labelled in-memory mock backend.
// There is no automatic fallback: a failing live API surfaces its error.
export type ApiMode = 'live' | 'mock' | 'unconfigured';

export function resolveMode(baseUrl: string | undefined): ApiMode {
  if (!baseUrl) return 'unconfigured';
  return baseUrl.trim() === 'mock' ? 'mock' : 'live';
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
export const API_MODE: ApiMode = resolveMode(BASE_URL);
export const API_BASE_URL_LABEL = API_MODE === 'live' ? BASE_URL! : API_MODE === 'mock' ? 'in-memory mock' : 'not configured';

// Named fictional actors registered by the backend seed (backend/app/seed.py).
export interface DemoActor { actor_id: string; role: ActorRole; label: string; confirmed: boolean }
export const DEMO_ACTORS: DemoActor[] = [
  { actor_id: 'ACT-INV-01', role: 'INVESTIGATOR', label: 'Investigator (synthetic)', confirmed: true },
  { actor_id: 'ACT-COORD-01', role: 'COORDINATOR', label: 'Coordinator (synthetic)', confirmed: true },
  { actor_id: 'ACT-MON-01', role: 'MONITOR', label: 'Monitor (synthetic)', confirmed: true },
  { actor_id: 'ACT-AUD-01', role: 'AUDITOR', label: 'Auditor (synthetic)', confirmed: true },
  { actor_id: 'ACT-SPONSOR-01', role: 'SPONSOR_OPS', label: 'Sponsor ops (synthetic)', confirmed: true },
  { actor_id: 'ACT-IT-01', role: 'RESEARCH_IT', label: 'Research IT (synthetic)', confirmed: true },
];

let currentActorId: string = DEMO_ACTORS[0].actor_id;
export function setCurrentActorId(id: string) { currentActorId = id; }
export function getCurrentActorId() { return currentActorId; }
export function actorById(id: string): DemoActor | undefined {
  return DEMO_ACTORS.find((a) => a.actor_id === id);
}

function unconfiguredTransport(): Transport {
  return async () => {
    throw new ApiError({
      status: 0, code: 'CONFIG_ERROR',
      message: 'NEXT_PUBLIC_API_BASE_URL is not set. Put it in frontend/.env.local (a backend URL, or "mock" for the labelled mock).',
    });
  };
}

export function createApi(transport: Transport, getActorId: () => string | null = getCurrentActorId): Endpoints {
  return createEndpoints(new ApiClient({ transport, getActorId }));
}

let api: Endpoints | null = null;
export function getApi(): Endpoints {
  if (!api) {
    const transport = API_MODE === 'live' ? createLiveTransport(BASE_URL!)
      : API_MODE === 'mock' ? createMockTransport()
      : unconfiguredTransport();
    api = createApi(transport);
  }
  return api;
}

// Tests inject a transport without touching module-level environment.
export function setApiForTesting(next: Endpoints | null) { api = next; }
