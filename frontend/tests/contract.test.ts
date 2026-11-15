import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError, pollJob, type ApiRequest, type ApiResponse, type Transport } from '@/lib/api/client';
import { createEndpoints } from '@/lib/api/endpoints';
import { approvalGate, screeningGate } from '@/lib/api/gates';
import { createLiveTransport } from '@/lib/api/live';
import { createMockTransport } from '@/lib/api/mocks';
import { resolveMode } from '@/lib/api/runtime';
import { codePointToUtf16Index, sliceByCodePoints, utf16ToCodePointIndex } from '@/lib/api/text';
import { endOfScreeningDayWatermark } from '@/lib/api/time';
import type { EventCreate, JobDetail, ProtocolDetail } from '@/lib/api/types';
import protocolFixture from '@/lib/api/fixtures/expected_protocol_detail.json';
import sourcePages from '@/lib/api/fixtures/source_pages.json';

const IC_FIXTURES = resolve(__dirname, '../../fixtures/protocols/px104-v1');
const LOCAL_FIXTURES = resolve(__dirname, '../lib/api/fixtures');
const fixture = protocolFixture as ProtocolDetail;

function recordingTransport(reply: (req: ApiRequest) => ApiResponse): { transport: Transport; calls: ApiRequest[] } {
  const calls: ApiRequest[] = [];
  return { calls, transport: async (req) => { calls.push(req); return reply(req); } };
}
const ok = (data: unknown, status = 200): ApiResponse => ({ status, requestIdHeader: 'rid-1', body: { data, request_id: 'rid-1' } });
const api = (transport: Transport, actor: string | null = 'ACT-INV-01') => createEndpoints(new ApiClient({ transport, getActorId: () => actor }));

describe('shared protocol fixture (px104-protocol-v1)', () => {
  // Parsed comparison: the local copies may be checked out with CRLF (only the IC originals are eol=lf).
  it.each(['expected_protocol_detail.json', 'source_pages.json', 'manifest.json'])('%s copy matches the IC original', (name) => {
    const read = (dir: string) => JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
    expect(read(LOCAL_FIXTURES)).toEqual(read(IC_FIXTURES));
  });

  it('is an unsigned EXTRACTION_REVIEW proposal with 8 rules and 12 coverage sections', () => {
    expect(fixture.state).toBe('EXTRACTION_REVIEW');
    expect(fixture.criteria).toHaveLength(8);
    expect(fixture.criteria.every((c) => c.workflow_status === 'PROPOSED' && c.approved_by === null && c.approved_at === null)).toBe(true);
    expect(fixture.coverage).toHaveLength(12);
    expect(fixture.coverage.filter((c) => c.status === 'INFORMATIONAL')).toHaveLength(4);
    expect(fixture.coverage.filter((c) => c.status === 'MAPPED')).toHaveLength(8);
    expect([fixture.coverage_signed_by, fixture.coverage_signed_at, fixture.approved_set_hash, fixture.approved_at, fixture.extraction_job_id]).toEqual([null, null, null, null, null]);
    expect(fixture.blocking_count).toBe(0);
  });

  it('every source quote equals its code-point span in the extracted page text', () => {
    const pages = new Map(sourcePages.pages.map((p) => [p.page, p.text]));
    for (const c of fixture.criteria) {
      expect(sliceByCodePoints(pages.get(c.source_page)!, c.source_anchor.start, c.source_anchor.end)).toBe(c.source_quote);
    }
  });

  it('zero blockers never enables screening on the unsigned proposal', () => {
    const gate = screeningGate({ active_protocol_version_id: null }, fixture);
    expect(gate.allowed).toBe(false);
    expect(gate.reasons.join(' ')).toMatch(/no Clinical Lead-approved active protocol/);
    expect(gate.reasons.join(' ')).toMatch(/8 of 8 rules lack/);
    expect(gate.reasons.join(' ')).toMatch(/Coverage has not been signed/);
  });

  it('only an investigator may approve; blocking coverage and clarification block approval', () => {
    expect(approvalGate(fixture, 'INVESTIGATOR', false).allowed).toBe(true);
    expect(approvalGate(fixture, 'COORDINATOR', false).allowed).toBe(false);
    const blocked: ProtocolDetail = { ...fixture, blocking_count: 1, coverage: fixture.coverage.map((c, i) => (i === 0 ? { ...c, status: 'BLOCKING' } : c)) };
    expect(approvalGate(blocked, 'INVESTIGATOR', false).reasons.join(' ')).toMatch(/BLOCKING/);
    const unclear: ProtocolDetail = { ...fixture, criteria: fixture.criteria.map((c, i) => (i === 0 ? { ...c, workflow_status: 'NEEDS_CLARIFICATION' } : c)) };
    expect(approvalGate(unclear, 'INVESTIGATOR', false).reasons.join(' ')).toMatch(/PX-INC-01 need clarification/);
    const ambiguous: ProtocolDetail = { ...fixture, criteria: fixture.criteria.map((c, i) => (i === 1 ? { ...c, ambiguity: 'unclear unit' } : c)) };
    expect(approvalGate(ambiguous, 'INVESTIGATOR', false).reasons.join(' ')).toMatch(/PX-INC-02 carry an unresolved ambiguity/);
  });

  it('a reset-seeded DRAFT proposal is reviewable (backend approves DRAFT or EXTRACTION_REVIEW)', () => {
    expect(approvalGate({ ...fixture, state: 'DRAFT' }, 'INVESTIGATOR', false).allowed).toBe(true);
    for (const state of ['EXTRACTING', 'EXTRACTION_FAILED', 'ACTIVE'] as const) {
      expect(approvalGate({ ...fixture, state }, 'INVESTIGATOR', false).allowed).toBe(false);
    }
  });
});

describe('Unicode code-point offsets', () => {
  const text = 'a😀b²c'; // 😀 is two UTF-16 units; ² is one
  it('converts code points to UTF-16 indices and back', () => {
    expect(codePointToUtf16Index(text, 2)).toBe(3);
    expect(utf16ToCodePointIndex(text, 3)).toBe(2);
    expect(sliceByCodePoints(text, 1, 3)).toBe('😀b');
    expect(sliceByCodePoints(text, 3, 4)).toBe('²');
  });
  it('rejects offsets beyond the text', () => {
    expect(() => codePointToUtf16Index(text, 99)).toThrow(RangeError);
  });
});

describe('site calendar', () => {
  it('end-of-screening-day watermark for 2026-10-31 Europe/Athens is 2026-10-31T22:00:00Z', () => {
    expect(endOfScreeningDayWatermark('2026-10-31', 'Europe/Athens')).toBe('2026-10-31T22:00:00Z');
  });
});

describe('typed HTTP client', () => {
  it('sends request ID and actor on every call except health', async () => {
    const { transport, calls } = recordingTransport(() => ok({ items: [], page: { next_cursor: null, limit: 25, total_count: 0 } }));
    const client = api(transport);
    await client.listTrials();
    await client.getHealth();
    expect(calls[0].headers['X-Demo-Actor-Id']).toBe('ACT-INV-01');
    expect(calls[0].headers['X-Request-ID']).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls[1].headers['X-Demo-Actor-Id']).toBeUndefined();
  });

  it('requires Idempotency-Key on POST and quoted If-Match on PUT/PATCH/approve', async () => {
    const { transport, calls } = recordingTransport(() => ok({}));
    const client = new ApiClient({ transport, getActorId: () => 'ACT-INV-01' });
    await expect(client.request('POST', '/trials', { body: {} })).rejects.toThrow(/Idempotency-Key/);
    await expect(client.request('PUT', '/x', { body: {} })).rejects.toThrow(/If-Match/);
    const e = createEndpoints(client);
    await e.approveProtocol('TR-PX104', 'PV-PX104-1.0', { criterion_ids: [], coverage_attestation: true, activate: true, decision_reason: 'r' }, 3, 'k1');
    expect(calls.at(-1)!.headers['If-Match']).toBe('"3"');
    expect(calls.at(-1)!.headers['Idempotency-Key']).toBe('k1');
    await e.patchCase('CASE-1', { expected_revision: 4, next_status: 'ACKNOWLEDGED', assigned_actor_id: null, disposition: 'd', rationale: 'r', cited_evidence_ids: [] });
    expect(calls.at(-1)!.headers['If-Match']).toBe('"4"');
    expect((calls.at(-1)!.body as { expected_revision: number }).expected_revision).toBe(4);
  });

  it('maps contract error envelopes to ApiError with code, details and request ID', async () => {
    const { transport } = recordingTransport(() => ({
      status: 409, requestIdHeader: 'hdr',
      body: { error: { code: 'REVISION_CONFLICT', message: 'stale', details: [{ field: 'If-Match', reason: 'mismatch' }], retryable: false }, request_id: 'body-rid' },
    }));
    const err = await api(transport).getTrial('TR-PX104').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, code: 'REVISION_CONFLICT', requestId: 'body-rid', retryable: false });
    expect(err.details).toEqual([{ field: 'If-Match', reason: 'mismatch' }]);
  });

  it('reports network/CORS failures and malformed bodies explicitly, with no fallback data', async () => {
    const failing: Transport = async () => { throw new TypeError('Failed to fetch'); };
    await expect(api(failing).listTrials()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
    const { transport } = recordingTransport(() => ({ status: 200, requestIdHeader: null, body: { success: true } }));
    await expect(api(transport).listTrials()).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    const { transport: html } = recordingTransport(() => ({ status: 502, requestIdHeader: null, body: undefined }));
    await expect(api(html).listTrials()).rejects.toMatchObject({ code: 'BAD_RESPONSE', status: 502 });
  });

  it('live transport builds URLs from the base and omits empty query params', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { items: [] }, request_id: 'r' }), { status: 200, headers: { 'X-Request-ID': 'r' } }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await createLiveTransport('http://127.0.0.1:8000/api/v1/')({ method: 'GET', path: '/screenings/RUN-1/assessments', query: { status: 'NEEDS_REVIEW', cursor: undefined, limit: 25 }, headers: { 'X-Demo-Actor-Id': 'ACT-INV-01' } });
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe('http://127.0.0.1:8000/api/v1/screenings/RUN-1/assessments?status=NEEDS_REVIEW&limit=25');
      expect((init.headers as Record<string, string>)['X-Demo-Actor-Id']).toBe('ACT-INV-01');
      expect(res.requestIdHeader).toBe('r');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('selects mock mode only for the literal value "mock"', () => {
    expect(resolveMode(undefined)).toBe('unconfigured');
    expect(resolveMode('mock')).toBe('mock');
    expect(resolveMode('http://127.0.0.1:8000/api/v1')).toBe('live');
  });
});

describe('job polling', () => {
  const job = (status: JobDetail['status']): JobDetail => ({
    job_id: 'J', kind: 'SCREEN_COHORT', status, resource_id: 'RUN', correlation_id: 'c', poll_url: '/api/v1/jobs/J', created_at: 'x',
    attempts: 1, max_attempts: 3, started_at: null, finished_at: null, progress_percent: null, result: null, error: null,
  });

  it('a 202 is not completion: resolves only when GET /jobs reports a terminal status', async () => {
    const sequence: JobDetail['status'][] = ['QUEUED', 'RUNNING', 'RUNNING', 'SUCCEEDED'];
    const getJob = vi.fn(async () => ({ data: job(sequence.shift()!), status: 200, requestId: 'r' }));
    const updates: string[] = [];
    const final = await pollJob(getJob, 'J', { sleep: async () => {}, onUpdate: (j) => updates.push(j.status) });
    expect(final.status).toBe('SUCCEEDED');
    expect(updates).toEqual(['QUEUED', 'RUNNING', 'RUNNING', 'SUCCEEDED']);
  });

  it('times out with POLL_TIMEOUT instead of assuming success', async () => {
    const getJob = async () => ({ data: job('RUNNING'), status: 200, requestId: 'r' });
    await expect(pollJob(getJob, 'J', { timeoutMs: 0, sleep: async () => {} })).rejects.toMatchObject({ code: 'POLL_TIMEOUT' });
  });
});

describe('mock backend honours the contract guards', () => {
  const day18: EventCreate = {
    trial_id: 'TR-PX104', event_kind: 'MEDICATION', source_event_id: 'SRC-EVT-D18-P042', source_version: 1, source_id: 'SRC-MED-D18-P042', source_document_version: 1,
    effective_at: '2026-11-19T09:30:00+02:00', recorded_at: '2026-11-20T11:00:00+02:00', time_uncertainty: null, evidence_state: 'POSITIVE', evidence_quality: 'HIGH',
    medication: { code: 'SYN-MED-R1', evidence_type: 'ADMINISTRATION', dose_value: 1, dose_unit: 'synthetic-unit', route: 'ORAL', interval_end_exclusive_at: null },
    lab: null, condition: null, note: null, observation: null, supersedes_event_id: null,
  };
  const drain = async (client: ReturnType<typeof api>, jobId: string) => pollJob((id) => client.getJob(id), jobId, { sleep: async () => {} });

  it('blocks screening before approval, then supports approve → screen → poll → complete run of 15', async () => {
    let actor = 'ACT-COORD-01';
    const client = createEndpoints(new ApiClient({ transport: createMockTransport(), getActorId: () => actor }));
    const body = { protocol_version_id: 'PV-PX104-1.0', screening_date: '2026-10-31', evidence_cutoff_at: '2026-10-31T22:00:00Z', patient_ids: null, purpose: 'BASELINE' as const };
    await expect(client.createScreening('TR-PX104', body, 's1')).rejects.toMatchObject({ status: 409, code: 'PROTOCOL_NOT_ACTIVE' });

    const approval = { criterion_ids: fixture.criteria.map((c) => c.criterion_id), coverage_attestation: true as const, activate: true as const, decision_reason: 'Reviewed anchors' };
    await expect(client.approveProtocol('TR-PX104', 'PV-PX104-1.0', approval, 1, 'a0')).rejects.toMatchObject({ status: 403, code: 'ROLE_FORBIDDEN' });
    actor = 'ACT-INV-01';
    await expect(client.approveProtocol('TR-PX104', 'PV-PX104-1.0', approval, 7, 'a1')).rejects.toMatchObject({ status: 409, code: 'REVISION_CONFLICT' });
    const receipt = await client.approveProtocol('TR-PX104', 'PV-PX104-1.0', approval, 1, 'a2');
    expect(receipt.data).toMatchObject({ state: 'ACTIVE', approved_by: 'ACT-INV-01', signed_criterion_ids: approval.criterion_ids });

    const accepted = await client.createScreening('TR-PX104', body, 's2');
    expect(accepted.status).toBe(202);
    expect(accepted.data.status).toBe('QUEUED');
    const before = await client.getScreeningRun(accepted.data.resource_id!);
    expect(before.data.status).not.toBe('COMPLETE');
    const done = await drain(client, accepted.data.job_id);
    expect(done.status).toBe('SUCCEEDED');
    const run = (await client.getScreeningRun(accepted.data.resource_id!)).data;
    expect(run.status).toBe('COMPLETE');
    expect(run.patient_count).toBe(15);
    expect(Object.values(run.counts).reduce((a, b) => a + b, 0)).toBe(15);
    const page = (await client.listAssessments(run.run_id, { limit: 100 })).data;
    expect(page.items.map((a) => a.patient_id)).toHaveLength(15);
    expect(page.items.every((a) => a.criteria.length === 5)).toBe(true);
  });

  it('event replay returns 200 with original IDs and deduplicated:true; changed payload is 409', async () => {
    let actor = 'ACT-COORD-01';
    const client = createEndpoints(new ApiClient({ transport: createMockTransport(), getActorId: () => actor }));
    const first = await client.createPatientEvent('P-042', day18, 'evt-1');
    expect(first.status).toBe(202);
    expect(first.data.deduplicated).toBe(false);
    const replay = await client.createPatientEvent('P-042', day18, 'evt-1');
    expect(replay.status).toBe(200);
    expect(replay.data).toMatchObject({ event_id: first.data.event_id, deduplicated: true, job: { job_id: first.data.job.job_id } });
    await expect(client.createPatientEvent('P-042', { ...day18, recorded_at: '2026-11-21T11:00:00+02:00' }, 'evt-2')).rejects.toMatchObject({ status: 409, code: 'EVENT_VERSION_CONFLICT' });
    actor = 'ACT-INV-01';
    await expect(client.createAgentInvestigation({ role: 'MONITORING_WORKFLOW', trial_id: 'TR-PX104', protocol_version_id: 'PV-PX104-1.0', patient_id: 'P-042', criterion_ids: [], event_id: null, objective: 'x' }, 'inv-1'))
      .rejects.toMatchObject({ status: 503, code: 'AGENT_UNAVAILABLE' });
  });

  it('requires an actor and rejects unknown actors', async () => {
    await expect(api(createMockTransport(), null).listTrials()).rejects.toMatchObject({ status: 401, code: 'ACTOR_REQUIRED' });
    await expect(api(createMockTransport(), 'ACT-NOPE').listTrials()).rejects.toMatchObject({ status: 401, code: 'ACTOR_UNKNOWN' });
  });
});
