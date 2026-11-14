'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEMO_ACTORS, actorById, getCurrentActorId, setCurrentActorId, type DemoActor } from '@/lib/api/runtime';

const STORAGE_KEY = 'protocolpulse.demoActor';

interface ActorContextValue { actor: DemoActor; setActorId: (id: string) => void }
const ActorContext = createContext<ActorContextValue | null>(null);

export function ActorProvider({ children, initialActorId }: { children: ReactNode; initialActorId?: string }) {
  const [actorId, setActorIdState] = useState(initialActorId ?? getCurrentActorId());

  useEffect(() => {
    if (initialActorId) return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && actorById(stored)) {
        setCurrentActorId(stored);
        setActorIdState(stored);
      }
    } catch { /* storage unavailable: keep default */ }
  }, [initialActorId]);

  useEffect(() => { setCurrentActorId(actorId); }, [actorId]);

  const setActorId = useCallback((id: string) => {
    setCurrentActorId(id);
    setActorIdState(id);
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ actor: actorById(actorId) ?? DEMO_ACTORS[0], setActorId }), [actorId, setActorId]);
  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor(): ActorContextValue {
  const ctx = useContext(ActorContext);
  if (!ctx) throw new Error('useActor must be used inside ActorProvider');
  return ctx;
}
