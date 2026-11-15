import type { Detail, Envelope, ErrorEnvelope, JobDetail } from './types';
import { getReadRevision, invalidateReads } from './cache';

// A transport turns one HTTP request into a status + parsed JSON body. The live transport
// uses fetch/XHR against NEXT_PUBLIC_API_BASE_URL; the mock transport (mocks.ts) answers
// the same requests in memory. UI code never knows which one is active.
export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  path: string; // relative to the /api/v1 base, e.g. "/trials"
  query?: Record<string, string | number | undefined>;
  headers: Record<string, string>;
  body?: unknown; // JSON-serialisable, or FormData for multipart upload
  onUploadProgress?: (fraction: number) => void;
  signal?: AbortSignal; // lets the user cancel a long request such as an upload
}

export interface ApiResponse {
  status: number;
  requestIdHeader: string | null;
  body: unknown; // parsed JSON, or undefined when the body was not JSON
}

export type Transport = (req: ApiRequest) => Promise<ApiResponse>;

export type ClientErrorCode =
  | 'NETWORK_ERROR' // fetch rejected: backend down, wrong URL or CORS rejection
  | 'BAD_RESPONSE' // body is not a contract Envelope/ErrorEnvelope
  | 'POLL_TIMEOUT' // job still not terminal after the polling budget
  | 'CONFIG_ERROR' // API base URL missing
  | 'CANCELLED'; // the user cancelled the request

export class ApiError extends Error {
  readonly status: number; // 0 for client-side errors
  readonly code: string;
  readonly details: Detail[];
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(opts: {
    status: number; code: string; message: string; details?: Detail[];
    retryable?: boolean; requestId?: string | null;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details ?? [];
    this.retryable = opts.retryable ?? false;
    this.requestId = opts.requestId ?? null;
  }
}

export function newRequestId(): string {
  return crypto.randomUUID();
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  if (!body || typeof body !== 'object') return false;
  const err = (body as { error?: unknown }).error;
  return !!err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string';
}

function isEnvelope(body: unknown): body is Envelope<unknown> {
  return !!body && typeof body === 'object' && 'data' in body &&
    typeof (body as { request_id?: unknown }).request_id === 'string';
}

export interface RequestOptions {
  query?: ApiRequest['query'];
  body?: unknown;
  idempotencyKey?: string;
  ifMatchRevision?: number;
  onUploadProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface ClientConfig {
  transport: Transport;
  getActorId: () => string | null;
}

export interface ApiResult<T> {
  data: T;
  status: number;
  requestId: string;
}

export class ApiClient {
  private readonly reads = new Map<string, {
    revision: number; expiresAt: number; promise: Promise<ApiResult<unknown>>;
  }>();

  constructor(private readonly config: ClientConfig) {}

  async request<T>(method: ApiRequest['method'], path: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
    const actor = this.config.getActorId();
    if (method !== 'GET') {
      const result = await this.send<T>(method, path, opts, actor);
      invalidateReads();
      return result;
    }
    const query = Object.entries(opts.query ?? {}).filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    const key = JSON.stringify([actor, path, query]);
    const revision = getReadRevision();
    const existing = this.reads.get(key);
    if (existing?.revision === revision && existing.expiresAt > Date.now()) {
      return existing.promise as Promise<ApiResult<T>>;
    }
    // Polling/readiness and mutable execution state always hit the server after
    // the current in-flight request completes. Other reads live for at most 5s.
    const polling = path === '/health' || /^\/(jobs|agent-executions)\//.test(path) || /^\/screenings\/[^/]+$/.test(path);
    const entry = { revision, expiresAt: Infinity, promise: this.send<T>(method, path, opts, actor) };
    this.reads.set(key, entry);
    if (this.reads.size > 100) this.reads.delete(this.reads.keys().next().value!);
    void entry.promise.then(() => {
      if (getReadRevision() !== revision) {
        if (this.reads.get(key) === entry) this.reads.delete(key);
      } else entry.expiresAt = Date.now() + (polling ? 0 : 5_000);
    }, () => { if (this.reads.get(key) === entry) this.reads.delete(key); });
    return entry.promise;
  }

  private async send<T>(method: ApiRequest['method'], path: string, opts: RequestOptions, actor: string | null): Promise<ApiResult<T>> {
    const requestId = newRequestId();
    const headers: Record<string, string> = { 'X-Request-ID': requestId };
    if (actor && path !== '/health') headers['X-Demo-Actor-Id'] = actor;
    if (method === 'POST') {
      if (!opts.idempotencyKey) throw new Error(`POST ${path} requires an Idempotency-Key`);
      headers['Idempotency-Key'] = opts.idempotencyKey;
    }
    if (opts.ifMatchRevision !== undefined) headers['If-Match'] = `"${opts.ifMatchRevision}"`;
    if (method === 'PUT' || method === 'PATCH') {
      if (opts.ifMatchRevision === undefined) throw new Error(`${method} ${path} requires If-Match`);
    }

    let res: ApiResponse;
    try {
      res = await this.config.transport({
        method, path, query: opts.query, headers, body: opts.body, onUploadProgress: opts.onUploadProgress, signal: opts.signal,
      });
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;
      if (opts.signal?.aborted) throw new ApiError({ status: 0, code: 'CANCELLED', message: 'The request was cancelled.', requestId });
      throw new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Could not reach the ProtocolPulse API. The backend may be stopped, the base URL wrong, or the request blocked by CORS.',
        retryable: true,
        requestId,
      });
    }

    if (opts.signal?.aborted) throw new ApiError({ status: 0, code: 'CANCELLED', message: 'The request was cancelled.', requestId });
    const echoedId = res.requestIdHeader ?? requestId;
    if (res.status >= 400) {
      if (isErrorEnvelope(res.body)) {
        const e = res.body.error;
        throw new ApiError({
          status: res.status, code: e.code, message: e.message, details: e.details,
          retryable: e.retryable, requestId: res.body.request_id ?? echoedId,
        });
      }
      throw new ApiError({
        status: res.status, code: 'BAD_RESPONSE',
        message: `HTTP ${res.status} without a contract error envelope.`, requestId: echoedId,
      });
    }
    if (!isEnvelope(res.body)) {
      throw new ApiError({
        status: res.status, code: 'BAD_RESPONSE',
        message: 'Response is not a contract Envelope {data, request_id}.', requestId: echoedId,
      });
    }
    return { data: res.body.data as T, status: res.status, requestId: res.body.request_id };
  }
}

export const TERMINAL_JOB_STATUSES = new Set(['SUCCEEDED', 'FAILED']);

export interface PollOptions {
  intervalMs?: number;
  timeoutMs?: number;
  onUpdate?: (job: JobDetail) => void;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
}

// A 202 only means "accepted". The caller learns completion exclusively from GET /jobs/{id}.
export async function pollJob(
  getJob: (jobId: string) => Promise<ApiResult<JobDetail>>,
  jobId: string,
  opts: PollOptions = {},
): Promise<JobDetail> {
  const intervalMs = opts.intervalMs ?? 1000;
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const started = Date.now();
  for (;;) {
    if (opts.signal?.aborted) throw new DOMException('Polling aborted', 'AbortError');
    const { data } = await getJob(jobId);
    opts.onUpdate?.(data);
    if (TERMINAL_JOB_STATUSES.has(data.status)) return data;
    if (Date.now() - started >= timeoutMs) {
      throw new ApiError({
        status: 0, code: 'POLL_TIMEOUT', retryable: true,
        message: `Job ${jobId} is still ${data.status} after ${Math.round(timeoutMs / 1000)}s. It may still finish; refresh to check again.`,
      });
    }
    await sleep(intervalMs);
  }
}

export function describeError(err: unknown): { title: string; message: string; requestId: string | null; details: Detail[] } {
  if (err instanceof ApiError) {
    const title = err.status ? `${err.code} (HTTP ${err.status})` : err.code;
    return { title, message: err.message, requestId: err.requestId, details: err.details };
  }
  if (err instanceof Error) return { title: 'Unexpected error', message: err.message, requestId: null, details: [] };
  return { title: 'Unexpected error', message: String(err), requestId: null, details: [] };
}
