'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pollJob, type PollOptions } from './client';
import { getApi } from './runtime';
import type { JobDetail } from './types';

export interface QueryState<T> {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

// Minimal fetch-on-deps hook. `load` returning null means "nothing to fetch yet".
export function useApiQuery<T>(load: (() => Promise<T>) | null, deps: unknown[]): QueryState<T> {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: !!load });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const fn = loadRef.current;
    if (!fn) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    fn().then(
      (data) => { if (!cancelled) setState({ data, error: null, loading: false }); },
      (error) => { if (!cancelled) setState({ data: null, error, loading: false }); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// One stable Idempotency-Key per intended logical operation; reset after the operation succeeds
// or its inputs change, so retries of a failed submit replay rather than duplicate.
export function useIdempotencyKey(operation: string) {
  const ref = useRef<string | null>(null);
  const current = useCallback(() => {
    ref.current ??= `${operation}-${crypto.randomUUID()}`;
    return ref.current;
  }, [operation]);
  const reset = useCallback(() => { ref.current = null; }, []);
  return { current, reset };
}

export interface JobRunnerState {
  job: JobDetail | null;
  error: unknown;
  running: boolean;
}

// Polls GET /jobs/{id} until SUCCEEDED/FAILED. Callers act only on the terminal result.
export function useJobRunner(pollOptions: Omit<PollOptions, 'onUpdate' | 'signal'> = {}) {
  const [state, setState] = useState<JobRunnerState>({ job: null, error: null, running: false });
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(pollOptions);
  optionsRef.current = pollOptions;

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (jobId: string): Promise<JobDetail | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ job: null, error: null, running: true });
    try {
      const job = await pollJob((id) => getApi().getJob(id), jobId, {
        ...optionsRef.current,
        signal: controller.signal,
        onUpdate: (j) => { if (!controller.signal.aborted) setState({ job: j, error: null, running: true }); },
      });
      if (!controller.signal.aborted) setState({ job, error: null, running: false });
      return job;
    } catch (error) {
      if (controller.signal.aborted) return null;
      setState((s) => ({ job: s.job, error, running: false }));
      return null;
    }
  }, []);

  const clear = useCallback(() => setState({ job: null, error: null, running: false }), []);
  return { ...state, run, clear };
}
