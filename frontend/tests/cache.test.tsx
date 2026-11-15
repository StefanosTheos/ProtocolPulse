import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActorProvider } from '@/components/ActorContext';
import { ApiClient, type ApiResponse, type Transport } from '@/lib/api/client';
import { useApiQuery, useJobRunner } from '@/lib/api/hooks';
import { createApi, getApi, getCurrentActorId, setApiForTesting, setCurrentActorId } from '@/lib/api/runtime';

const response = (data: unknown): ApiResponse => ({ status: 200, requestIdHeader: null, body: { data, request_id: 'observed-request' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('scoped read cache', () => {
  it('deduplicates in-flight reads and canonicalizes query order without merging filters', async () => {
    const pending = deferred<ApiResponse>();
    const transport = vi.fn<Transport>().mockReturnValue(pending.promise);
    const client = new ApiClient({ transport, getActorId: () => 'ACT-INV-01' });
    const first = client.request('GET', '/trials', { query: { cursor: undefined, limit: 25, sort: 'title' } });
    const second = client.request('GET', '/trials', { query: { sort: 'title', limit: 25 } });
    expect(transport).toHaveBeenCalledTimes(1);
    pending.resolve(response({ items: [] }));
    await Promise.all([first, second]);
    await client.request('GET', '/trials', { query: { limit: 25, sort: 'title' } });
    expect(transport).toHaveBeenCalledTimes(1);
    await client.request('GET', '/trials', { query: { limit: 25, sort: '-created_at' } });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('isolates actors and expires cached data within five seconds', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    let actor = 'ACT-INV-01';
    const transport = vi.fn<Transport>().mockImplementation(async (req) => response(req.headers['X-Demo-Actor-Id']));
    const client = new ApiClient({ transport, getActorId: () => actor });
    try {
      expect((await client.request('GET', '/trials/TR-PX104')).data).toBe(actor);
      actor = 'ACT-MON-01';
      expect((await client.request('GET', '/trials/TR-PX104')).data).toBe(actor);
      expect(transport).toHaveBeenCalledTimes(2);
      now.mockReturnValue(6_001);
      await client.request('GET', '/trials/TR-PX104');
      expect(transport).toHaveBeenCalledTimes(3);
    } finally { now.mockRestore(); }
  });

  it.each(['/health', '/jobs/JOB-1', '/agent-executions/EXEC-1', '/screenings/RUN-1'])(
    'always refreshes operational state at %s', async (path) => {
      const transport = vi.fn<Transport>().mockResolvedValue(response({ status: 'RUNNING' }));
      const client = new ApiClient({ transport, getActorId: () => 'ACT-INV-01' });
      await client.request('GET', path);
      await client.request('GET', path);
      expect(transport).toHaveBeenCalledTimes(2);
    },
  );

  it('does not cache failures', async () => {
    const transport = vi.fn<Transport>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('recovered'));
    const client = new ApiClient({ transport, getActorId: () => 'ACT-INV-01' });
    await expect(client.request('GET', '/trials')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect((await client.request('GET', '/trials')).data).toBe('recovered');
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('invalidates after a write and never lets an older read repopulate the cache', async () => {
    const old = deferred<ApiResponse>();
    const transport = vi.fn<Transport>().mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(response('write accepted')).mockResolvedValue(response('new data'));
    const client = new ApiClient({ transport, getActorId: () => 'ACT-INV-01' });
    const before = client.request('GET', '/trials/TR-PX104');
    await client.request('POST', '/trials', { body: {}, idempotencyKey: 'one-intent' });
    expect((await client.request('GET', '/trials/TR-PX104')).data).toBe('new data');
    old.resolve(response('old data')); await before;
    expect((await client.request('GET', '/trials/TR-PX104')).data).toBe('new data');
    expect(transport).toHaveBeenCalledTimes(3);
  });
});

describe('query freshness and roles', () => {
  it('shares requests through StrictMode and independent consumers', async () => {
    const transport = vi.fn<Transport>().mockResolvedValue(response({ title: 'Shared trial' }));
    setApiForTesting(createApi(transport));
    const { result } = renderHook(() => [
      useApiQuery(() => getApi().getTrial('TR-PX104').then((r) => r.data), ['TR-PX104']),
      useApiQuery(() => getApi().getTrial('TR-PX104').then((r) => r.data), ['TR-PX104']),
    ], { wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> });
    await waitFor(() => expect(result.current[0].data).toEqual({ title: 'Shared trial' }));
    expect(result.current[1].data).toEqual({ title: 'Shared trial' });
    expect(transport).toHaveBeenCalledTimes(1);
    act(() => result.current[0].reload());
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
  });

  it('hides previous-role data immediately and refetches even when the caller omitted actor dependencies', async () => {
    const monitor = deferred<ApiResponse>();
    const transport = vi.fn<Transport>().mockResolvedValueOnce(response({ title: 'Investigator data' })).mockReturnValue(monitor.promise);
    setApiForTesting(createApi(transport));
    const { result } = renderHook(() => useApiQuery(() => getApi().getTrial('TR-PX104').then((r) => r.data), []));
    await waitFor(() => expect(result.current.data?.title).toBe('Investigator data'));
    act(() => setCurrentActorId('ACT-MON-01'));
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await act(async () => { monitor.resolve(response({ title: 'Monitor data' })); });
    await waitFor(() => expect(result.current.data?.title).toBe('Monitor data'));
    expect(transport.mock.calls[1][0].headers['X-Demo-Actor-Id']).toBe('ACT-MON-01');
  });

  it('ignores an old response after the actor switches', async () => {
    const old = deferred<ApiResponse>();
    const transport = vi.fn<Transport>().mockReturnValueOnce(old.promise).mockResolvedValue(response({ title: 'Current role' }));
    setApiForTesting(createApi(transport));
    const { result } = renderHook(() => useApiQuery(() => getApi().getTrial('TR-PX104').then((r) => r.data), []));
    act(() => setCurrentActorId('ACT-MON-01'));
    await waitFor(() => expect(result.current.data?.title).toBe('Current role'));
    await act(async () => { old.resolve(response({ title: 'Previous role' })); });
    expect(result.current.data?.title).toBe('Current role');
  });

  it('refreshes mounted queries after a mutation and on returning to the window', async () => {
    let version = 1;
    const transport = vi.fn<Transport>().mockImplementation(async () => response({ title: `Revision ${version}` }));
    setApiForTesting(createApi(transport));
    const { result } = renderHook(() => useApiQuery(() => getApi().getTrial('TR-PX104').then((r) => r.data), []), {
      wrapper: ({ children }: { children: ReactNode }) => <ActorProvider initialActorId={getCurrentActorId()}>{children}</ActorProvider>,
    });
    await waitFor(() => expect(result.current.data?.title).toBe('Revision 1'));
    await act(async () => { version = 2; await getApi().createTrial({} as never, 'write-once'); });
    await waitFor(() => expect(result.current.data?.title).toBe('Revision 2'));
    act(() => { version = 3; window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(result.current.data?.title).toBe('Revision 3'));
  });

  it('invalidates reads when a background job reaches a terminal state', async () => {
    let version = 1;
    const transport = vi.fn<Transport>().mockImplementation(async (req) => response(req.path.startsWith('/jobs/')
      ? { job_id: 'JOB-1', status: 'SUCCEEDED' } : { title: `Revision ${version}` }));
    setApiForTesting(createApi(transport));
    const { result } = renderHook(() => ({
      query: useApiQuery(() => getApi().getTrial('TR-PX104').then((r) => r.data), []),
      job: useJobRunner(),
    }));
    await waitFor(() => expect(result.current.query.data?.title).toBe('Revision 1'));
    await act(async () => { version = 2; await result.current.job.run('JOB-1'); });
    await waitFor(() => expect(result.current.query.data?.title).toBe('Revision 2'));
  });
});
