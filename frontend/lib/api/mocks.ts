// MOCK MODE ONLY: an in-memory stand-in for the FastAPI backend that answers the exact
// API_CONTRACTS envelopes, status enums, error codes and header guards. It is selected only by
// NEXT_PUBLIC_API_BASE_URL=mock and the UI labels it on every screen. Release evidence must
// come from the real backend.
import type { ApiRequest, ApiResponse, Transport } from './client';
import protocolFixture from './fixtures/expected_protocol_detail.json';
import manifest from './fixtures/manifest.json';
import sourcePages from './fixtures/source_pages.json';
import {
  MOCK_CANDIDATE_STATUS, PATIENT_IDS, mockCriterionResults, mockEvidenceSource, mockPatient360,
} from './mock-data';
import type {
  ActorRole, AgentExecution, ApprovalReceipt, ApprovalRequest, AuditEntry, CasePatch, CaseStatus,
  CriteriaReplaceRequest, EventCreate, EventReceipt, JobDetail, JobReceipt, MonitoringFinding,
  ParticipationCreate, ParticipationStatus, PatientAssessment, ProtocolDetail, ReviewCase,
  ScreeningCreate, ScreeningDispositionCreate, ScreeningRun, TrialDetail,
} from './types';

const MOCK_ACTORS: Record<string, ActorRole> = {
  'ACT-INV-01': 'INVESTIGATOR', 'ACT-COORD-01': 'COORDINATOR', 'ACT-MON-01': 'MONITOR', 'ACT-AUD-01': 'AUDITOR',
  'ACT-SPONSOR-01': 'SPONSOR_OPS', 'ACT-IT-01': 'RESEARCH_IT',
};
const FIXTURE_PDF_SHA256 = manifest.sha256['PX-104-v1.0-fictional.pdf'];
const MAX_PDF_BYTES = 12 * 1024 * 1024;

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details: { field: string; reason: string }[] = [], public retryable = false) {
    super(message);
  }
}

interface MockJob { detail: JobDetail; pollsUntilDone: number; complete: () => { ok: true; result: Record<string, unknown> } | { ok: false; code: string; message: string } }

// Scripted monitoring outcomes keyed by source_event_id (no rule logic runs in the browser).
const SCRIPTED_EVENTS: Record<string, { criterion_id: string; category: MonitoringFinding['category']; priority: MonitoringFinding['priority'] } | null> = {
  'SRC-EVT-D18-P042': { criterion_id: 'PX-MON-01', category: 'CONFIRMED_PROTOCOL_CONFLICT', priority: 'HIGH' },
  'SRC-EVT-D18-P042-ORDER': { criterion_id: 'PX-MON-02', category: 'POTENTIAL_SAFETY_REVIEW', priority: 'MEDIUM' },
  'SRC-EVT-D18-P151-N1': null,
};

function nowIso(clock: { t: number }): string {
  clock.t += 1000;
  return new Date(clock.t).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function canonical(value: unknown): string {
  if (value instanceof FormData) {
    const file = value.get('file');
    return JSON.stringify({ label: value.get('version_label'), name: file instanceof File ? file.name : null, size: file instanceof File ? file.size : null });
  }
  return JSON.stringify(value);
}

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createMockTransport(options: { pollsUntilDone?: number } = {}): Transport {
  const pollsUntilDone = options.pollsUntilDone ?? 2;
  const clock = { t: Date.parse('2026-11-14T09:00:00Z') };
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-MOCK-${String(++seq).padStart(3, '0')}`;

  const trial: TrialDetail = {
    trial_id: 'TR-PX104', title: 'PX-104 fictional 12-week study (synthetic)', fictional_product_code: 'PX-104',
    site_id: 'SITE-SYN-01', site_timezone: 'Europe/Athens', planned_start_date: '2026-11-01', planned_end_date: '2027-01-24',
    synthetic_only: true, active_protocol_version_id: null, created_at: '2026-10-30T10:00:00Z', revision: 1,
    protocol_version_ids: ['PV-PX104-1.0'], patient_count: PATIENT_IDS.length, finding_count: 0,
    trial_notice: 'Fictional protocol and synthetic patients only. Not for clinical use.',
  };
  const protocols = new Map<string, ProtocolDetail>([['PV-PX104-1.0', structuredClone(protocolFixture) as ProtocolDetail]]);
  const jobs = new Map<string, MockJob>();
  const runs = new Map<string, ScreeningRun>();
  const assessments = new Map<string, PatientAssessment[]>();
  const participation = new Map<string, ParticipationStatus>(PATIENT_IDS.map((p) => [p, 'NOT_ENROLLED']));
  const events = new Map<string, { hash: string; receipt: EventReceipt }>();
  const findings: MonitoringFinding[] = [];
  const cases = new Map<string, ReviewCase>();
  const executions = new Map<string, AgentExecution>();
  const audit: AuditEntry[] = [];
  const idempotency = new Map<string, { hash: string; response: { status: number; data: unknown } }>();
  let latestRunId: string | null = null;

  function appendAudit(actorId: string, action: string, targetType: string, targetId: string, requestId: string, outputs: string[] = [], targetVersion: string | null = null) {
    audit.push({
      audit_id: nextId('AUD'), trial_id: trial.trial_id, actor_id: actorId, actor_role: MOCK_ACTORS[actorId] ?? 'RESEARCH_IT',
      action, target_type: targetType, target_id: targetId, target_version: targetVersion,
      correlation_id: requestId, request_id: requestId, input_hash: null, output_ref_ids: outputs,
      result_code: 'OK', occurred_at: nowIso(clock),
    });
  }

  function createJob(kind: JobReceipt['kind'], resourceId: string | null, requestId: string, complete: MockJob['complete']): JobReceipt {
    const jobId = nextId('JOB');
    const created = nowIso(clock);
    const detail: JobDetail = {
      job_id: jobId, kind, status: 'QUEUED', resource_id: resourceId, correlation_id: requestId,
      poll_url: `/api/v1/jobs/${jobId}`, created_at: created, attempts: 0, max_attempts: 3,
      started_at: null, finished_at: null, progress_percent: null, result: null, error: null,
    };
    jobs.set(jobId, { detail, pollsUntilDone, complete });
    const { attempts: _a, max_attempts: _m, started_at: _s, finished_at: _f, progress_percent: _p, result: _r, error: _e, ...receipt } = detail;
    return receipt;
  }

  function advanceJob(job: MockJob): JobDetail {
    const d = job.detail;
    if (d.status === 'SUCCEEDED' || d.status === 'FAILED') return d;
    job.pollsUntilDone -= 1;
    if (job.pollsUntilDone > 0) {
      d.status = 'RUNNING';
      d.attempts = 1;
      d.started_at ??= nowIso(clock);
      d.progress_percent = 50;
      return d;
    }
    const outcome = job.complete();
    d.finished_at = nowIso(clock);
    d.progress_percent = 100;
    if (outcome.ok) {
      d.status = 'SUCCEEDED';
      d.result = outcome.result;
    } else {
      d.status = 'FAILED';
      d.error = { code: outcome.code, message: outcome.message, retryable: false };
    }
    return d;
  }

  function requireRole(actorId: string, allowed: ActorRole[]) {
    if (!allowed.includes(MOCK_ACTORS[actorId])) {
      throw new HttpError(403, 'ROLE_FORBIDDEN', `Actor ${actorId} (${MOCK_ACTORS[actorId]}) may not perform this operation.`);
    }
  }

  function requireIfMatch(req: ApiRequest, revision: number) {
    const header = req.headers['If-Match'];
    if (header !== `"${revision}"`) {
      throw new HttpError(409, 'REVISION_CONFLICT', `If-Match ${header ?? '(missing)'} does not match current revision "${revision}".`);
    }
  }

  function getProtocol(trialId: string, versionId: string): ProtocolDetail {
    if (trialId !== trial.trial_id) throw new HttpError(404, 'TRIAL_NOT_FOUND', `Trial ${trialId} not found.`);
    const p = protocols.get(versionId);
    if (!p) throw new HttpError(404, 'VERSION_NOT_FOUND', `Protocol version ${versionId} not found.`);
    return p;
  }

  function paginate<T>(items: T[], query: ApiRequest['query']) {
    const limit = Math.min(Math.max(Number(query?.limit ?? 25), 1), 100);
    const offset = query?.cursor ? Number(query.cursor) : 0;
    const slice = items.slice(offset, offset + limit);
    const next = offset + limit < items.length ? String(offset + limit) : null;
    return { items: slice, page: { next_cursor: next, limit, total_count: items.length } };
  }

  const routes: { method: ApiRequest['method']; pattern: RegExp; roles?: ActorRole[]; handler: (req: ApiRequest, m: RegExpMatchArray, actorId: string, requestId: string) => Promise<{ status: number; data: unknown }> | { status: number; data: unknown } }[] = [
    { method: 'GET', pattern: /^\/health$/, handler: () => ({ status: 200, data: { status: 'ok', database: 'ok', migrations: 'current', worker: 'running', llm: 'disabled', synthetic_only: true, api_version: 'v1', contract_version: '1.0.0-rc2' } }) },
    { method: 'GET', pattern: /^\/trials$/, handler: (req) => ({ status: 200, data: paginate([trial].map(({ protocol_version_ids: _p, patient_count: _c, finding_count: _f, trial_notice: _n, ...t }) => t), req.query) }) },
    { method: 'POST', pattern: /^\/trials$/, roles: ['COORDINATOR', 'RESEARCH_IT'], handler: () => { throw new HttpError(400, 'UNSUPPORTED_OPERATION', 'The mock backend holds a single fixture trial (TR-PX104).'); } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)$/, handler: (_r, m) => {
      if (m[1] !== trial.trial_id) throw new HttpError(404, 'TRIAL_NOT_FOUND', `Trial ${m[1]} not found.`);
      return { status: 200, data: { ...trial, protocol_version_ids: [...protocols.keys()], finding_count: findings.length } };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/participation-summary$/, handler: (_r, m) => {
      if (m[1] !== trial.trial_id) throw new HttpError(404, 'TRIAL_NOT_FOUND', `Trial ${m[1]} not found.`);
      const statuses = [...participation.values()];
      return { status: 200, data: { trial_id: m[1], cohort_count: statuses.length, participating_count: statuses.filter((s) => s === 'PARTICIPATING').length, ended_count: statuses.filter((s) => s === 'ENDED').length } };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/protocols$/, handler: (req, m) => {
      if (m[1] !== trial.trial_id) throw new HttpError(404, 'TRIAL_NOT_FOUND', `Trial ${m[1]} not found.`);
      return { status: 200, data: paginate([...protocols.values()], req.query) };
    } },
    { method: 'POST', pattern: /^\/trials\/([^/]+)\/protocols$/, roles: ['COORDINATOR', 'RESEARCH_IT'], handler: async (req, m, actorId, requestId) => {
      if (m[1] !== trial.trial_id) throw new HttpError(404, 'TRIAL_NOT_FOUND', `Trial ${m[1]} not found.`);
      const form = req.body as FormData;
      const file = form.get('file');
      const label = String(form.get('version_label') ?? '').trim();
      if (!(file instanceof File)) throw new HttpError(422, 'VALIDATION_ERROR', 'A PDF file is required.', [{ field: 'file', reason: 'missing' }]);
      if (!label) throw new HttpError(422, 'VALIDATION_ERROR', 'version_label is required.', [{ field: 'version_label', reason: 'missing' }]);
      if (file.size > MAX_PDF_BYTES) throw new HttpError(413, 'PDF_TOO_LARGE', 'PDF exceeds MAX_PDF_MB (12).');
      const head = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
      if (head !== '%PDF-') throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'File does not have a PDF signature.');
      if ([...protocols.values()].some((p) => p.label === label)) throw new HttpError(422, 'VALIDATION_ERROR', `Version label ${label} already exists.`, [{ field: 'version_label', reason: 'duplicate' }]);
      req.onUploadProgress?.(0.5);
      const sha = await sha256Hex(file);
      req.onUploadProgress?.(1);
      const versionId = `PV-PX104-${label}`;
      const sourceId = nextId('SRC-PROTOCOL');
      const created = nowIso(clock);
      const detail: ProtocolDetail = {
        protocol_version_id: versionId, trial_id: trial.trial_id, label, state: 'DRAFT', revision: 1,
        source: { source_id: sourceId, source_version: 1, sha256: sha, filename: file.name, mime_type: 'application/pdf', created_at: created, synthetic_only: true },
        file_sha256: sha, criteria: [], coverage: [], coverage_signed_by: null, coverage_signed_at: null,
        approved_set_hash: null, approved_at: null, extraction_job_id: null, blocking_count: 0,
      };
      protocols.set(versionId, detail);
      appendAudit(actorId, 'PROTOCOL_UPLOADED', 'PROTOCOL_VERSION', versionId, requestId, [sourceId]);
      return { status: 201, data: detail };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/protocols\/([^/]+)$/, handler: (_r, m) => ({ status: 200, data: getProtocol(m[1], m[2]) }) },
    { method: 'POST', pattern: /^\/trials\/([^/]+)\/protocols\/([^/]+)\/extract$/, roles: ['COORDINATOR', 'INVESTIGATOR'], handler: (_req, m, actorId, requestId) => {
      const p = getProtocol(m[1], m[2]);
      if (p.state === 'EXTRACTING') throw new HttpError(409, 'JOB_ALREADY_RUNNING', 'Extraction is already running.');
      if (!['DRAFT', 'EXTRACTION_FAILED'].includes(p.state)) throw new HttpError(400, 'INVALID_TRANSITION', `Cannot extract from state ${p.state}.`);
      p.state = 'EXTRACTING';
      const receipt = createJob('PROTOCOL_EXTRACT', p.protocol_version_id, requestId, () => {
        // The mock only "knows" the fixture PDF. Any other upload fails visibly; no substitution.
        if (p.file_sha256 !== FIXTURE_PDF_SHA256) {
          p.state = 'EXTRACTION_FAILED';
          return { ok: false, code: 'MOCK_SOURCE_NOT_RECOGNISED', message: 'Mock backend can only return the curated proposal for the PX-104 fixture PDF (hash mismatch).' };
        }
        const fixture = structuredClone(protocolFixture) as ProtocolDetail;
        p.criteria = fixture.criteria.map((c) => ({ ...c, protocol_version_id: p.protocol_version_id, source_id: p.source.source_id }));
        p.coverage = fixture.coverage.map((c) => ({ ...c, source_id: p.source.source_id }));
        p.blocking_count = 0;
        p.state = 'EXTRACTION_REVIEW';
        p.revision += 1;
        return { ok: true, result: { protocol_version_id: p.protocol_version_id, curated_proposal: true } };
      });
      p.extraction_job_id = receipt.job_id;
      appendAudit(actorId, 'PROTOCOL_EXTRACT_REQUESTED', 'PROTOCOL_VERSION', p.protocol_version_id, requestId, [receipt.job_id]);
      return { status: 202, data: receipt };
    } },
    { method: 'PUT', pattern: /^\/trials\/([^/]+)\/protocols\/([^/]+)\/criteria$/, roles: ['INVESTIGATOR'], handler: (req, m, actorId, requestId) => {
      const p = getProtocol(m[1], m[2]);
      requireIfMatch(req, p.revision);
      if (p.state !== 'EXTRACTION_REVIEW') throw new HttpError(400, 'INVALID_TRANSITION', `Criteria can only be revised in EXTRACTION_REVIEW (now ${p.state}).`);
      const body = req.body as CriteriaReplaceRequest;
      if (!body.change_reason?.trim()) throw new HttpError(422, 'VALIDATION_ERROR', 'change_reason is required.', [{ field: 'change_reason', reason: 'empty' }]);
      const bad = body.criteria.find((c) => c.protocol_version_id !== p.protocol_version_id);
      if (bad) throw new HttpError(422, 'VALIDATION_ERROR', 'criteria[].protocol_version_id must match the path.', [{ field: 'criteria', reason: bad.criterion_id }]);
      p.revision += 1;
      p.criteria = body.criteria.map((c) => ({ ...c, revision: p.revision, approved_by: null, approved_at: null }));
      p.coverage = body.coverage;
      p.blocking_count = body.coverage.filter((c) => c.status === 'BLOCKING').length;
      appendAudit(actorId, 'CRITERIA_REPLACED', 'PROTOCOL_VERSION', p.protocol_version_id, requestId, [], String(p.revision));
      return { status: 200, data: p };
    } },
    { method: 'POST', pattern: /^\/trials\/([^/]+)\/protocols\/([^/]+)\/approve$/, roles: ['INVESTIGATOR'], handler: (req, m, actorId, requestId) => {
      const p = getProtocol(m[1], m[2]);
      requireIfMatch(req, p.revision);
      const body = req.body as ApprovalRequest;
      if (trial.active_protocol_version_id && trial.active_protocol_version_id !== p.protocol_version_id) {
        throw new HttpError(409, 'VERSION_ALREADY_ACTIVE', `Version ${trial.active_protocol_version_id} is already active.`);
      }
      const details: { field: string; reason: string }[] = [];
      if (p.state !== 'EXTRACTION_REVIEW') details.push({ field: 'state', reason: `protocol is ${p.state}` });
      const ids = new Set(p.criteria.map((c) => c.criterion_id));
      if (body.criterion_ids.length !== ids.size || body.criterion_ids.some((id) => !ids.has(id))) details.push({ field: 'criterion_ids', reason: 'must equal the full proposed criterion set' });
      for (const c of p.coverage.filter((x) => x.status === 'BLOCKING')) details.push({ field: 'coverage', reason: `BLOCKING section ${c.section_id} has no approved resolution` });
      for (const c of p.criteria.filter((x) => x.workflow_status === 'NEEDS_CLARIFICATION')) details.push({ field: 'criteria', reason: `${c.criterion_id} needs clarification` });
      if (body.coverage_attestation !== true || body.activate !== true || !body.decision_reason?.trim()) details.push({ field: 'body', reason: 'attestation, activation and decision_reason are required' });
      if (details.length) throw new HttpError(409, 'APPROVAL_BLOCKED', 'One or more protocol criteria or coverage items remain unresolved.', details);
      const at = nowIso(clock);
      p.criteria = p.criteria.map((c) => ({ ...c, workflow_status: 'APPROVED', approved_by: actorId, approved_at: at }));
      p.coverage_signed_by = actorId;
      p.coverage_signed_at = at;
      p.approved_set_hash = `sha256:mock-${p.protocol_version_id}-r${p.revision}`;
      p.approved_at = at;
      p.state = 'ACTIVE';
      p.revision += 1;
      trial.active_protocol_version_id = p.protocol_version_id;
      appendAudit(actorId, 'PROTOCOL_APPROVED', 'PROTOCOL_VERSION', p.protocol_version_id, requestId, body.criterion_ids, String(p.revision));
      const receipt: ApprovalReceipt = { protocol_version_id: p.protocol_version_id, approved_set_hash: p.approved_set_hash, signed_criterion_ids: body.criterion_ids, approved_by: actorId, approved_at: at, state: 'ACTIVE', superseded_version_id: null };
      return { status: 200, data: receipt };
    } },
    { method: 'POST', pattern: /^\/trials\/([^/]+)\/screenings$/, roles: ['COORDINATOR', 'INVESTIGATOR'], handler: (req, m, actorId, requestId) => {
      if (m[1] !== trial.trial_id) throw new HttpError(404, 'TRIAL_NOT_FOUND', `Trial ${m[1]} not found.`);
      const body = req.body as ScreeningCreate;
      const p = protocols.get(body.protocol_version_id);
      if (!p || p.state !== 'ACTIVE' || trial.active_protocol_version_id !== p.protocol_version_id) {
        throw new HttpError(409, 'PROTOCOL_NOT_ACTIVE', 'Screening requires the investigator-approved active protocol version.');
      }
      const runId = nextId('RUN');
      const created = nowIso(clock);
      const run: ScreeningRun = {
        run_id: runId, trial_id: trial.trial_id, protocol_version_id: p.protocol_version_id, approved_set_hash: p.approved_set_hash!,
        screening_date: body.screening_date, evidence_cutoff_at: body.evidence_cutoff_at, evidence_snapshot_id: nextId('SNAP'),
        engine_version: 'px104-eval-v1', terminology_map_version: 'px104-terminology-v1', status: 'QUEUED', job_id: '',
        patient_count: 0, counts: { POTENTIAL_MATCH: 0, NEEDS_REVIEW: 0, PROTOCOL_CONFLICT: 0, EVALUATION_ERROR: 0 },
        created_at: created, completed_at: null, stale: false, error_code: null,
      };
      runs.set(runId, run);
      const receipt = createJob('SCREEN_COHORT', runId, requestId, () => {
        const ids = body.patient_ids ?? [...PATIENT_IDS];
        const at = nowIso(clock);
        const list: PatientAssessment[] = ids.map((pid) => ({
          assessment_id: `ASM-${runId}-${pid}`, run_id: runId, trial_id: trial.trial_id, patient_id: pid,
          protocol_version_id: p.protocol_version_id, approved_set_hash: p.approved_set_hash!, evidence_snapshot_id: run.evidence_snapshot_id,
          assessment_type: 'SCREENING', screening_date: body.screening_date, evaluation_at: at, evaluation_state: 'COMPLETE',
          candidate_status: MOCK_CANDIDATE_STATUS[pid], criteria: mockCriterionResults(pid, at), before_assessment_id: null,
          caused_by_event_id: null, related_finding_ids: [], evidence_completeness_percent: null,
          participation_status: participation.get(pid)!, stale: false,
        }));
        assessments.set(runId, list);
        for (const a of list) {
          if (a.candidate_status) run.counts[a.candidate_status] += 1;
          else run.counts.EVALUATION_ERROR += 1;
        }
        run.patient_count = list.length;
        run.status = 'COMPLETE';
        run.completed_at = at;
        latestRunId = runId;
        return { ok: true, result: { run_id: runId } };
      });
      run.job_id = receipt.job_id;
      appendAudit(actorId, 'SCREENING_REQUESTED', 'SCREENING_RUN', runId, requestId, [receipt.job_id]);
      return { status: 202, data: receipt };
    } },
    { method: 'GET', pattern: /^\/screenings\/([^/]+)$/, handler: (_r, m) => {
      const run = runs.get(m[1]);
      if (!run) throw new HttpError(404, 'VERSION_NOT_FOUND', `Screening run ${m[1]} not found.`);
      return { status: 200, data: run };
    } },
    { method: 'GET', pattern: /^\/screenings\/([^/]+)\/assessments$/, handler: (req, m) => {
      if (!runs.has(m[1])) throw new HttpError(404, 'VERSION_NOT_FOUND', `Screening run ${m[1]} not found.`);
      let list = [...(assessments.get(m[1]) ?? [])];
      const q = req.query ?? {};
      if (q.status) list = list.filter((a) => a.candidate_status === q.status);
      if (q.reason) list = list.filter((a) => a.criteria.some((c) => c.reason_codes.includes(q.reason as never)));
      if (q.sort === '-evidence_completeness_percent') list.sort((a, b) => (b.evidence_completeness_percent ?? -1) - (a.evidence_completeness_percent ?? -1) || a.patient_id.localeCompare(b.patient_id));
      else list.sort((a, b) => a.patient_id.localeCompare(b.patient_id));
      return { status: 200, data: paginate(list, q) };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/patients\/([^/]+)$/, roles: ['COORDINATOR', 'INVESTIGATOR', 'MONITOR', 'AUDITOR'], handler: (_r, m) => {
      if (!participation.has(m[2])) throw new HttpError(404, 'PATIENT_NOT_FOUND', `Patient ${m[2]} not found.`);
      const current = latestRunId ? `ASM-${latestRunId}-${m[2]}` : null;
      return { status: 200, data: mockPatient360(m[2], participation.get(m[2])!, current) };
    } },
    { method: 'POST', pattern: /^\/patients\/([^/]+)\/events$/, roles: ['INVESTIGATOR', 'COORDINATOR', 'RESEARCH_IT'], handler: (req, m, actorId, requestId) => {
      const pid = m[1];
      if (!participation.has(pid)) throw new HttpError(404, 'PATIENT_NOT_FOUND', `Patient ${pid} not found.`);
      const body = req.body as EventCreate;
      const payloads = [body.medication, body.lab, body.condition, body.note, body.observation].filter((x) => x !== null);
      if (payloads.length !== 1) throw new HttpError(422, 'VALIDATION_ERROR', 'Exactly one event payload is required.');
      if ((body.effective_at === null) === (body.time_uncertainty === null)) throw new HttpError(422, 'INVALID_TIME_INTERVAL', 'Provide exact effective_at OR time_uncertainty.');
      const key = `${pid}|${body.source_event_id}|${body.source_version}`;
      const hash = canonical(body);
      const existing = events.get(key);
      if (existing) {
        if (existing.hash !== hash) throw new HttpError(409, 'EVENT_VERSION_CONFLICT', 'Same source event/version with a different payload. Use a new source_version and supersedes_event_id.');
        return { status: 200, data: { ...existing.receipt, deduplicated: true } };
      }
      const eventId = nextId('EVT');
      const ingested = nowIso(clock);
      const job = createJob('INGEST_EVENT', eventId, requestId, () => {
        const scripted = SCRIPTED_EVENTS[body.source_event_id];
        if (!scripted || participation.get(pid) !== 'PARTICIPATING') return { ok: true, result: { event_id: eventId, relevance: 'NO_ACTION' } };
        const caseId = `CASE-${pid}-${scripted.criterion_id}`;
        const findingId = nextId('FND');
        const afterId = nextId('ASM-MON');
        const before = latestRunId ? `ASM-${latestRunId}-${pid}` : null;
        const evidenceRef = { evidence_id: `EV-${eventId}`, source_id: body.source_id, source_version: body.source_document_version, evidence_type: body.medication?.evidence_type ?? body.event_kind, effective_at: body.effective_at, recorded_at: body.recorded_at, page: null, span_start: null, span_end: null };
        const created = nowIso(clock);
        findings.unshift({
          finding_id: findingId, trial_id: trial.trial_id, patient_id: pid, protocol_version_id: trial.active_protocol_version_id ?? 'PV-PX104-1.0',
          criterion_id: scripted.criterion_id, triggering_event_id: eventId, before_assessment_id: before, after_assessment_id: afterId,
          category: scripted.category, priority: scripted.priority, case_id: caseId, evidence_refs: [evidenceRef],
          issue_key: `${scripted.criterion_id}:${body.medication?.code ?? body.event_kind}`, created_at: created,
        });
        const executionId = nextId('EXEC');
        executions.set(executionId, {
          execution_id: executionId, role: 'MONITORING_WORKFLOW', status: 'UNAVAILABLE', trial_id: trial.trial_id, patient_id: pid,
          protocol_version_id: trial.active_protocol_version_id ?? 'PV-PX104-1.0', criterion_ids: [scripted.criterion_id], event_id: eventId,
          correlation_id: requestId, evidence_refs: [], summary: null, unknown_reasons: [], verification_questions: [], trace: [],
          error_code: 'LLM_DISABLED', model_id: null, created_at: created, finished_at: created,
        });
        const existingCase = cases.get(caseId);
        if (existingCase) {
          existingCase.finding_ids.push(findingId);
          existingCase.updated_at = created;
        } else {
          cases.set(caseId, {
            case_id: caseId, trial_id: trial.trial_id, patient_id: pid, protocol_version_id: trial.active_protocol_version_id ?? 'PV-PX104-1.0',
            criterion_id: scripted.criterion_id, issue_key: `${scripted.criterion_id}:${body.medication?.code ?? body.event_kind}`,
            status: 'OPEN', priority: scripted.priority, assigned_actor_id: null, finding_ids: [findingId],
            current_summary: `${scripted.category} under ${scripted.criterion_id}: ${body.medication?.code ?? body.event_kind} ${body.medication?.evidence_type ?? ''} effective ${body.effective_at ?? 'uncertain'}. Investigator review required; no treatment change implied.`,
            summary_origin: 'SYSTEM_DETERMINISTIC', agent_execution_id: executionId, revision: 1, opened_at: created, updated_at: created, decisions: [],
          });
        }
        appendAudit(actorId, 'FINDING_CREATED', 'MONITORING_FINDING', findingId, requestId, [caseId, eventId]);
        return { ok: true, result: { event_id: eventId, relevance: 'RELEVANT', finding_id: findingId, case_id: caseId } };
      });
      const receipt: EventReceipt = { event_id: eventId, patient_id: pid, trial_id: trial.trial_id, ingested_at: ingested, deduplicated: false, job };
      events.set(key, { hash, receipt });
      appendAudit(actorId, 'EVENT_INGESTED', 'PATIENT_EVENT', eventId, requestId, [job.job_id]);
      return { status: 202, data: receipt };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/findings$/, roles: ['MONITOR', 'INVESTIGATOR', 'COORDINATOR', 'AUDITOR'], handler: (req) => {
      const q = req.query ?? {};
      let list = [...findings];
      if (q.category) list = list.filter((f) => f.category === q.category);
      if (q.priority) list = list.filter((f) => f.priority === q.priority);
      if (q.patient_id) list = list.filter((f) => f.patient_id === q.patient_id);
      if (q.sort === 'created_at') list.reverse();
      return { status: 200, data: paginate(list, q) };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/cases$/, roles: ['MONITOR', 'INVESTIGATOR', 'COORDINATOR', 'AUDITOR'], handler: (req) => {
      const q = req.query ?? {};
      let list = [...cases.values()].map((c) => ({ ...c, decisions: [] }));
      if (q.status) list = list.filter((c) => c.status === q.status);
      if (q.patient_id) list = list.filter((c) => c.patient_id === q.patient_id);
      if (q.assigned_actor_id) list = list.filter((c) => c.assigned_actor_id === q.assigned_actor_id);
      if (q.category) list = list.filter((c) => findings.some((f) => f.case_id === c.case_id && f.category === q.category));
      list.sort((a, b) => (q.sort === 'updated_at' ? 1 : -1) * a.updated_at.localeCompare(b.updated_at));
      return { status: 200, data: paginate(list, q) };
    } },
    { method: 'GET', pattern: /^\/cases\/([^/]+)$/, handler: (_r, m) => {
      const c = cases.get(m[1]);
      if (!c) throw new HttpError(404, 'CASE_NOT_FOUND', `Case ${m[1]} not found.`);
      return { status: 200, data: c };
    } },
    { method: 'PATCH', pattern: /^\/cases\/([^/]+)$/, roles: ['MONITOR', 'INVESTIGATOR'], handler: (req, m, actorId, requestId) => {
      const c = cases.get(m[1]);
      if (!c) throw new HttpError(404, 'CASE_NOT_FOUND', `Case ${m[1]} not found.`);
      requireIfMatch(req, c.revision);
      const body = req.body as CasePatch;
      if (body.expected_revision !== c.revision) throw new HttpError(409, 'REVISION_CONFLICT', 'expected_revision does not match.');
      if (body.assigned_actor_id && body.assigned_actor_id !== 'ACT-INV-01') throw new HttpError(403, 'ROLE_FORBIDDEN', 'Only the Clinical Lead can own a review case.');
      const investigatorOnly: CaseStatus[] = ['RESOLVED', 'CLOSED'];
      if (investigatorOnly.includes(body.next_status) && MOCK_ACTORS[actorId] !== 'INVESTIGATOR') {
        throw new HttpError(403, 'ROLE_FORBIDDEN', 'RESOLVED and CLOSED are investigator-only.');
      }
      if (!body.rationale.trim()) throw new HttpError(422, 'VALIDATION_ERROR', 'A rationale is required.', [{ field: 'rationale', reason: 'empty' }]);
      const at = nowIso(clock);
      c.decisions.push({ decision_id: nextId('DEC'), actor_id: actorId, actor_role: MOCK_ACTORS[actorId], from_status: c.status, to_status: body.next_status, disposition: body.disposition, rationale: body.rationale, cited_evidence_ids: body.cited_evidence_ids, decided_at: at });
      c.status = body.next_status;
      c.assigned_actor_id = body.assigned_actor_id;
      c.revision += 1;
      c.updated_at = at;
      appendAudit(actorId, 'CASE_TRANSITIONED', 'REVIEW_CASE', c.case_id, requestId, body.cited_evidence_ids, String(c.revision));
      return { status: 200, data: c };
    } },
    { method: 'GET', pattern: /^\/agent-executions\/([^/]+)$/, handler: (_r, m) => {
      const e = executions.get(m[1]);
      if (!e) throw new HttpError(404, 'JOB_NOT_FOUND', `Agent execution ${m[1]} not found.`);
      return { status: 200, data: e };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/audit$/, roles: ['AUDITOR', 'INVESTIGATOR', 'MONITOR', 'SPONSOR_OPS'], handler: (req) => {
      const q = req.query ?? {};
      let list = [...audit];
      if (q.action) list = list.filter((a) => a.action === q.action);
      if (q.actor_id) list = list.filter((a) => a.actor_id === q.actor_id);
      if (q.sort !== 'occurred_at') list.reverse();
      return { status: 200, data: paginate(list, q) };
    } },
    { method: 'GET', pattern: /^\/jobs\/([^/]+)$/, handler: (_r, m) => {
      const job = jobs.get(m[1]);
      if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', `Job ${m[1]} not found.`);
      return { status: 200, data: structuredClone(advanceJob(job)) };
    } },
    { method: 'GET', pattern: /^\/trials\/([^/]+)\/evidence\/([^/]+)$/, handler: (req, m) => {
      const sourceId = m[2];
      for (const p of protocols.values()) {
        if (p.source.source_id === sourceId) {
          const page = req.query?.page !== undefined ? Number(req.query.page) : null;
          const pages = sourcePages.pages.filter((pg) => page === null || pg.page === page);
          if (page !== null && !pages.length) throw new HttpError(404, 'SOURCE_NOT_FOUND', `Page ${page} not in ${sourceId}.`);
          return { status: 200, data: { ...p.source, kind: 'PDF', page_count: sourcePages.pages.length, spans: pages.map((pg) => ({ page: pg.page, start: 0, end: [...pg.text].length, text: pg.text })) } };
        }
      }
      const pid = PATIENT_IDS.find((id) => sourceId.startsWith(`SRC-${id}-`));
      const detail = pid ? mockEvidenceSource(pid, sourceId) : null;
      if (!detail) throw new HttpError(404, 'SOURCE_NOT_FOUND', `Source ${sourceId} not found in the mock.`);
      return { status: 200, data: detail };
    } },
    { method: 'POST', pattern: /^\/trials\/([^/]+)\/patients\/([^/]+)\/dispositions$/, roles: ['INVESTIGATOR'], handler: (req, m, actorId, requestId) => {
      const body = req.body as ScreeningDispositionCreate;
      if (!body.rationale.trim()) throw new HttpError(422, 'VALIDATION_ERROR', 'A rationale is required.', [{ field: 'rationale', reason: 'empty' }]);
      const id = nextId('DISP');
      appendAudit(actorId, 'SCREENING_DISPOSITION_RECORDED', 'PATIENT', m[2], requestId, [id]);
      return { status: 201, data: { disposition_id: id, patient_id: m[2], trial_id: m[1], assessment_id: body.assessment_id, disposition: body.disposition, rationale: body.rationale, cited_evidence_ids: body.cited_evidence_ids, actor_id: actorId, decided_at: nowIso(clock), workflow_status: 'INVESTIGATOR_DISPOSITIONED' } };
    } },
    { method: 'POST', pattern: /^\/trials\/([^/]+)\/patients\/([^/]+)\/participation$/, roles: ['INVESTIGATOR'], handler: (req, m, actorId, requestId) => {
      const pid = m[2];
      const body = req.body as ParticipationCreate;
      const from = participation.get(pid);
      if (!from) throw new HttpError(404, 'PATIENT_NOT_FOUND', `Patient ${pid} not found.`);
      const allowed = (from === 'NOT_ENROLLED' && body.next_status === 'PARTICIPATING') || (from === 'PARTICIPATING' && body.next_status === 'ENDED');
      if (!allowed) throw new HttpError(400, 'INVALID_TRANSITION', `Participation cannot move ${from} → ${body.next_status}.`);
      if (body.external_record_source_id !== `SRC-${pid}-PARTICIPATION`) throw new HttpError(404, 'SOURCE_NOT_FOUND', 'external_record_source_id must reference registered participation evidence.');
      participation.set(pid, body.next_status);
      const id = nextId('PART');
      appendAudit(actorId, 'PARTICIPATION_RECORDED', 'PATIENT', pid, requestId, [id]);
      return { status: 201, data: { participation_id: id, trial_id: m[1], patient_id: pid, from_status: from, to_status: body.next_status, source_id: body.external_record_source_id, external_record_reference: body.external_record_reference, actor_id: actorId, decided_at: nowIso(clock) } };
    } },
    { method: 'POST', pattern: /^\/agent-investigations$/, roles: ['COORDINATOR', 'MONITOR', 'INVESTIGATOR'], handler: () => {
      throw new HttpError(503, 'AGENT_UNAVAILABLE', 'LLM is disabled (LLM_ENABLED=false). No investigation job was created.');
    } },
  ];

  return async (req: ApiRequest): Promise<ApiResponse> => {
    const requestId = req.headers['X-Request-ID'] ?? crypto.randomUUID();
    const respond = (status: number, body: unknown): ApiResponse => ({ status, requestIdHeader: requestId, body });
    try {
      const route = routes.find((r) => r.method === req.method && r.pattern.test(req.path));
      if (!route) throw new HttpError(404, 'BAD_REQUEST', `No contract route for ${req.method} ${req.path}.`);
      const match = req.path.match(route.pattern)!;
      const actorId = req.headers['X-Demo-Actor-Id'];
      if (req.path !== '/health') {
        if (!actorId) throw new HttpError(401, 'ACTOR_REQUIRED', 'X-Demo-Actor-Id header is required.');
        if (!MOCK_ACTORS[actorId]) throw new HttpError(401, 'ACTOR_UNKNOWN', `Unknown demo actor ${actorId}.`);
        if (!['INVESTIGATOR', 'COORDINATOR'].includes(MOCK_ACTORS[actorId])) throw new HttpError(403, 'ROLE_FORBIDDEN', 'This demo actor has been retired.');
      }
      if (route.roles) requireRole(actorId, route.roles);
      if (req.method === 'POST') {
        const key = req.headers['Idempotency-Key'];
        if (!key) throw new HttpError(400, 'BAD_REQUEST', 'Idempotency-Key header is required.');
        const idemKey = `${actorId}|${req.path}|${key}`;
        const hash = canonical(req.body);
        const prior = idempotency.get(idemKey);
        if (prior) {
          if (prior.hash !== hash) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'Idempotency-Key reused with a different request body.');
          const replay = prior.response;
          return respond(replay.status === 202 && req.path.endsWith('/events') ? 200 : replay.status, {
            data: req.path.endsWith('/events') ? { ...(replay.data as EventReceipt), deduplicated: true } : replay.data,
            request_id: requestId,
          });
        }
        const result = await route.handler(req, match, actorId, requestId);
        idempotency.set(idemKey, { hash, response: result });
        return respond(result.status, { data: structuredClone(result.data), request_id: requestId });
      }
      const result = await route.handler(req, match, actorId, requestId);
      return respond(result.status, { data: structuredClone(result.data), request_id: requestId });
    } catch (err) {
      if (err instanceof HttpError) {
        return respond(err.status, { error: { code: err.code, message: err.message, details: err.details, retryable: err.retryable }, request_id: requestId });
      }
      return respond(500, { error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : String(err), details: [], retryable: true }, request_id: requestId });
    }
  };
}
