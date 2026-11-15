'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEMO_ACTORS, actorById, getCurrentActorId, setCurrentActorId, type DemoActor } from '@/lib/api/runtime';
import { invalidateReads } from '@/lib/api/cache';

const STORAGE_KEY = 'protocolpulse.demoActor';

interface ActorContextValue { actor: DemoActor; setActorId: (id: string) => void }
const ActorContext = createContext<ActorContextValue | null>(null);

export function ActorProvider({ children, initialActorId }: { children: ReactNode; initialActorId?: string }) {
  const [actorId, setActorIdState] = useState(actorById(initialActorId ?? getCurrentActorId())?.actor_id ?? DEMO_ACTORS[0].actor_id);
  // The saved role is only readable in the browser. Until it has been read, nothing role-dependent
  // renders or fetches, so a page load never shows (or requests data as) the default role first.
  const [ready, setReady] = useState(Boolean(initialActorId));

  useEffect(() => {
    if (initialActorId) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const restored = actorById(stored)?.actor_id ?? DEMO_ACTORS[0].actor_id;
        setCurrentActorId(restored);
        setActorIdState(restored);
        if (restored !== stored) window.localStorage.setItem(STORAGE_KEY, restored);
      }
    } catch { /* storage unavailable: keep default */ }
    setReady(true);
  }, [initialActorId]);

  useEffect(() => { setCurrentActorId(actorId); }, [actorId]);

  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') invalidateReads(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const setActorId = useCallback((id: string) => {
    const next = actorById(id)?.actor_id ?? DEMO_ACTORS[0].actor_id;
    setCurrentActorId(next);
    setActorIdState(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ actor: actorById(actorId) ?? DEMO_ACTORS[0], setActorId }), [actorId, setActorId]);
  return <ActorContext.Provider value={value}>{ready ? children : null}</ActorContext.Provider>;
}

export function useActor(): ActorContextValue {
  const ctx = useContext(ActorContext);
  if (!ctx) throw new Error('useActor must be used inside ActorProvider');
  return ctx;
}
