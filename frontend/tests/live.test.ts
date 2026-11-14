// Live H6/H10 journey against a running backend, through the same typed client the UI uses.
// Opt-in and destructive to the demo state: run only against a freshly seeded local database:
//   python -m backend.app.seed --dataset px104-15 --reset-demo   (then start uvicorn)
//   PP_LIVE_API_BASE_URL=http://127.0.0.1:8000/api/v1 npx vitest run tests/live.test.ts
import { describe, expect, it } from 'vitest';
import { ApiClient, ApiError, pollJob } from '@/lib/api/client';
import { createEndpoints } from '@/lib/api/endpoints';
import { createLiveTransport } from '@/lib/api/live';
import { sliceByCodePoints } from '@/lib/api/text';
import { endOfScreeningDayWatermark } from '@/lib/api/time';
import type { CandidateStatus, EventCreate, ProtocolDetail, ReviewCase, ScreeningRun } from '@/lib/api/types';

const BASE = process.env.PP_LIVE_API_BASE_URL;
const run = Math.random().toString(36).slice(2, 8);
let actor = 'ACT-INV-01';
const api = BASE ? createEndpoints(new ApiClient({ transport: createLiveTransport(BASE), getActorId: () => actor })) : null!;
const as = <T>(id: string, fn: () => Promise<T>) => { actor = id; return fn(); };
const drain = (jobId: string) => pollJob((id) => api.getJob(id), jobId, { intervalMs: 300, timeoutMs: 60_000 });
const rejects = (p: Promise<unknown>) => p.then(() => { throw new Error('expected rejection'); }, (e: ApiError) => e);

const state: { protocol?: ProtocolDetail; run?: ScreeningRun; caseId?: string } = {};

function day18(patientId: string, sourceEventId: string, code: string, evidenceType: 'ADMINISTRATION' | 'ORDER'): EventCreate {
  return {
    trial_id: 'TR-PX104', event_kind: 'MEDICATION', source_event_id: sourceEventId, source_version: 1, source_id: `SRC-MED-${sourceEventId}`, source_document_version: 1,
    effective_at: '2026-11-19T09:30:00+02:00', recorded_at: '2026-11-20T11:00:00+02:00', time_uncertainty: null, evidence_state: 'POSITIVE', evidence_quality: 'HIGH',
    medication: { code, evidence_type: evidenceType, dose_value: evidenceType === 'ADMINISTRATION' ? 1 : null, dose_unit: evidenceType === 'ADMINISTRATION' ? 'synthetic-unit' : null, route: evidenceType === 'ADMINISTRATION' ? 'ORAL' : null, interval_end_exclusive_at: null },
    lab: null, condition: null, note: null, observation: null, supersedes_event_id: null,
  };
}

(BASE ? describe.sequential : describe.skip)('live backend journey (H6/H10)', { timeout: 90_000 }, () => {
  it('health reports the frozen contract', async () => {
    const h = (await api.getHealth()).data;
    expect(h).toMatchObject({ status: 'ok', database: 'ok', worker: 'running', contract_version: '1.0.0-rc2', synthetic_only: true });
  });

  it('serves the unapproved PX-104 proposal with source quotes matching real page text', async () => {
    const trial = (await api.getTrial('TR-PX104')).data;
    expect(trial.active_protocol_version_id).toBeNull();
    expect(trial.patient_count).toBe(15);
    const p = (await api.getProtocol('TR-PX104', 'PV-PX104-1.0')).data;
    expect(['DRAFT', 'EXTRACTION_REVIEW']).toContain(p.state);
    expect(p.criteria.map((c) => c.criterion_id).sort()).toEqual(['PX-EXC-01', 'PX-EXC-02', 'PX-INC-01', 'PX-INC-02', 'PX-INC-03', 'PX-MON-01', 'PX-MON-02', 'PX-MON-03']);
    expect(p.criteria.every((c) => c.workflow_status === 'PROPOSED' && c.approved_by === null)).toBe(true);
    expect(p.coverage).toHaveLength(12);
    expect(p.coverage.filter((c) => c.status === 'INFORMATIONAL')).toHaveLength(4);
    expect([p.coverage_signed_by, p.approved_set_hash]).toEqual([null, null]);
    for (const c of p.criteria) {
      const src = (await api.getEvidenceSource('TR-PX104', c.source_id, { page: c.source_page })).data;
      const span = src.spans.find((s) => s.page === c.source_page)!;
      expect(sliceByCodePoints(span.text, c.source_anchor.start - span.start, c.source_anchor.end - span.start)).toBe(c.source_quote);
    }
    state.protocol = p;
  });

  it('blocks screening and non-investigator approval before signoff', async () => {
    const body = { protocol_version_id: 'PV-PX104-1.0', screening_date: '2026-10-31', evidence_cutoff_at: endOfScreeningDayWatermark('2026-10-31', 'Europe/Athens'), patient_ids: null, purpose: 'BASELINE' as const };
    expect(await as('ACT-COORD-01', () => rejects(api.createScreening('TR-PX104', body, `pre-${run}`)))).toMatchObject({ status: 409, code: 'PROTOCOL_NOT_ACTIVE' });
    const ids = state.protocol!.criteria.map((c) => c.criterion_id);
    const approval = { criterion_ids: ids, coverage_attestation: true as const, activate: true as const, decision_reason: 'Live smoke review' };
    expect(await as('ACT-COORD-01', () => rejects(api.approveProtocol('TR-PX104', 'PV-PX104-1.0', approval, state.protocol!.revision, `ap0-${run}`)))).toMatchObject({ status: 403, code: 'ROLE_FORBIDDEN' });
    expect(await as('ACT-INV-01', () => rejects(api.approveProtocol('TR-PX104', 'PV-PX104-1.0', approval, state.protocol!.revision + 5, `ap1-${run}`)))).toMatchObject({ status: 409, code: 'REVISION_CONFLICT' });
  });

  it('investigator approval signs all 8 rules and activates the version', async () => {
    const ids = state.protocol!.criteria.map((c) => c.criterion_id);
    const receipt = await as('ACT-INV-01', () => api.approveProtocol('TR-PX104', 'PV-PX104-1.0', { criterion_ids: ids, coverage_attestation: true, activate: true, decision_reason: 'Reviewed every clause against the PDF' }, state.protocol!.revision, `ap2-${run}`));
    expect(receipt.data).toMatchObject({ state: 'ACTIVE', approved_by: 'ACT-INV-01' });
    expect(receipt.data.signed_criterion_ids.sort()).toEqual([...ids].sort());
    const p = (await api.getProtocol('TR-PX104', 'PV-PX104-1.0')).data;
    expect(p.criteria.every((c) => c.workflow_status === 'APPROVED' && c.approved_by === 'ACT-INV-01')).toBe(true);
    expect(p.coverage_signed_by).toBe('ACT-INV-01');
    expect((await api.getTrial('TR-PX104')).data.active_protocol_version_id).toBe('PV-PX104-1.0');
  });

  it('screening: 202 accepted, job SUCCEEDED, run COMPLETE, 15 assessments with archetype outcomes', async () => {
    const accepted = await as('ACT-COORD-01', () => api.createScreening('TR-PX104', { protocol_version_id: 'PV-PX104-1.0', screening_date: '2026-10-31', evidence_cutoff_at: '2026-10-31T22:00:00Z', patient_ids: null, purpose: 'BASELINE' }, `scr-${run}`));
    expect(accepted.status).toBe(202);
    const job = await drain(accepted.data.job_id);
    expect(job.status).toBe('SUCCEEDED');
    const r = (await api.getScreeningRun(accepted.data.resource_id!)).data;
    expect(r.status).toBe('COMPLETE');
    expect(r.patient_count).toBe(15);
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(15);
    const items = (await api.listAssessments(r.run_id, { limit: 100 })).data.items;
    expect(items).toHaveLength(15);
    const status = Object.fromEntries(items.map((a) => [a.patient_id, a.candidate_status])) as Record<string, CandidateStatus | null>;
    expect(status).toMatchObject({
      'P-042': 'POTENTIAL_MATCH', 'P-118': 'POTENTIAL_MATCH',
      'P-175': 'PROTOCOL_CONFLICT', 'P-161': 'PROTOCOL_CONFLICT', 'P-117': 'PROTOCOL_CONFLICT',
      'P-124': 'NEEDS_REVIEW', 'P-083': 'NEEDS_REVIEW', 'P-140': 'NEEDS_REVIEW',
    });
    const exc02 = (pid: string) => items.find((a) => a.patient_id === pid)!.criteria.find((c) => c.criterion_id === 'PX-EXC-02')!;
    expect(exc02('P-083')).toMatchObject({ status: 'UNKNOWN', reason_codes: expect.arrayContaining(['ORDER_ONLY']) });
    expect(exc02('P-140')).toMatchObject({ status: 'UNKNOWN', reason_codes: expect.arrayContaining(['CONFLICTING_SOURCES']) });
    expect(items.every((a) => a.criteria.length === 5 && a.participation_status === 'NOT_ENROLLED')).toBe(true);
    const counted = items.reduce<Record<string, number>>((acc, a) => { const k = a.candidate_status ?? 'EVALUATION_ERROR'; acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
    for (const [k, v] of Object.entries(r.counts)) expect(counted[k] ?? 0).toBe(v);
    state.run = r;
  });

  it('Patient 360 for P-042 returns all sections with provenance', async () => {
    const p = (await api.getPatient360('TR-PX104', 'P-042')).data;
    for (const key of ['demographics', 'index_disease', 'medical_conditions', 'family_history', 'symptom_history', 'observations', 'medications', 'prior_clinical_research', 'procedures_and_imaging', 'allergies', 'encounters', 'open_items'] as const) {
      expect(p).toHaveProperty(key);
    }
    expect(p.synthetic_only).toBe(true);
    expect(p.demographics.birth_date.source.source_id).toBeTruthy();
  });

  it('day-18 administration during recorded participation opens one case; replay is deduplicated', async () => {
    const part = await as('ACT-INV-01', () => api.recordParticipation('TR-PX104', 'P-042', { next_status: 'PARTICIPATING', external_record_source_id: 'SRC-P-042-external', external_record_reference: 'EXT-P-042', rationale: 'External authorised participation record (synthetic)' }, `part-${run}`));
    expect(part.data).toMatchObject({ from_status: 'NOT_ENROLLED', to_status: 'PARTICIPATING', actor_id: 'ACT-INV-01' });

    const body = day18('P-042', `SRC-EVT-D18-P042-${run}`, 'SYN-MED-R1', 'ADMINISTRATION');
    const key = `evt-${run}`;
    const first = await as('ACT-COORD-01', () => api.createPatientEvent('P-042', body, key));
    expect(first.status).toBe(202);
    expect(first.data.deduplicated).toBe(false);
    expect((await drain(first.data.job.job_id)).status).toBe('SUCCEEDED');

    const findings = (await api.listFindings('TR-PX104', { patient_id: 'P-042' })).data.items.filter((f) => f.triggering_event_id === first.data.event_id);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ criterion_id: 'PX-MON-01', category: 'CONFIRMED_PROTOCOL_CONFLICT' });
    state.caseId = findings[0].case_id;

    const replay = await api.createPatientEvent('P-042', body, key);
    expect(replay.status).toBe(200);
    expect(replay.data).toMatchObject({ event_id: first.data.event_id, deduplicated: true, job: { job_id: first.data.job.job_id } });
    const after = (await api.listFindings('TR-PX104', { patient_id: 'P-042' })).data.items.filter((f) => f.triggering_event_id === first.data.event_id);
    expect(after).toHaveLength(1);

    const conflict = await rejects(api.createPatientEvent('P-042', { ...body, recorded_at: '2026-11-21T11:00:00+02:00' }, `evt2-${run}`));
    expect(conflict).toMatchObject({ status: 409 });

    const baseline = (await api.listAssessments(state.run!.run_id, { limit: 100 })).data.items.find((a) => a.patient_id === 'P-042')!;
    expect(baseline.candidate_status).toBe('POTENTIAL_MATCH');
  });

  it('a non-restricted event for P-151 opens no case', async () => {
    const before = (await api.listCases('TR-PX104', { patient_id: 'P-151' })).data.items.length;
    const res = await as('ACT-COORD-01', () => api.createPatientEvent('P-151', day18('P-151', `SRC-EVT-D18-P151-${run}`, 'SYN-MED-N1', 'ADMINISTRATION'), `evt151-${run}`));
    expect((await drain(res.data.job.job_id)).status).toBe('SUCCEEDED');
    expect((await api.listCases('TR-PX104', { patient_id: 'P-151' })).data.items).toHaveLength(before);
  });

  it('case lifecycle: monitor acknowledges; RESOLVED/CLOSED are investigator-only; decisions are attributed', async () => {
    let c: ReviewCase = (await as('ACT-MON-01', () => api.getCase(state.caseId!))).data;
    expect(c.status).toBe('OPEN');
    const evidence = (await api.listFindings('TR-PX104', { patient_id: 'P-042' })).data.items.filter((f) => f.case_id === c.case_id).flatMap((f) => f.evidence_refs.map((e) => e.evidence_id));
    const patch = (next: ReviewCase['status'], rev: number) => ({ expected_revision: rev, next_status: next, assigned_actor_id: 'ACT-INV-01', disposition: 'REVIEW_REQUIRED', rationale: `Live smoke ${next}`, cited_evidence_ids: evidence.slice(0, 1) });
    c = (await api.patchCase(c.case_id, patch('ACKNOWLEDGED', c.revision))).data;
    c = (await api.patchCase(c.case_id, patch('INVESTIGATING', c.revision))).data;
    expect(await rejects(api.patchCase(c.case_id, patch('RESOLVED', c.revision)))).toMatchObject({ status: 403 });
    expect(await rejects(api.patchCase(c.case_id, patch('RESOLVED', c.revision + 9)))).toMatchObject({ status: 409, code: 'REVISION_CONFLICT' });
    c = (await as('ACT-INV-01', () => api.patchCase(c.case_id, patch('RESOLVED', c.revision)))).data;
    c = (await api.patchCase(c.case_id, patch('CLOSED', c.revision))).data;
    expect(c.status).toBe('CLOSED');
    const full = (await api.getCase(c.case_id)).data;
    expect(full.decisions.map((d) => [d.actor_id, d.to_status])).toEqual([
      ['ACT-MON-01', 'ACKNOWLEDGED'], ['ACT-MON-01', 'INVESTIGATING'], ['ACT-INV-01', 'RESOLVED'], ['ACT-INV-01', 'CLOSED'],
    ]);
  });

  it('audit is retrievable and the agent path is honestly unavailable with the LLM off', async () => {
    const audit = (await as('ACT-AUD-01', () => api.listAudit('TR-PX104', { limit: 100 }))).data.items;
    expect(audit.some((a) => a.action === 'PROTOCOL_APPROVED' && a.actor_id === 'ACT-INV-01')).toBe(true);
    const c = (await as('ACT-INV-01', () => api.getCase(state.caseId!))).data;
    if (c.agent_execution_id) {
      const exec = (await api.getAgentExecution(c.agent_execution_id)).data;
      expect(['UNAVAILABLE', 'FAILED', 'PARTIAL', 'SUCCEEDED']).toContain(exec.status);
      if (exec.status === 'UNAVAILABLE') expect(exec.trace).toEqual([]);
    }
    const health = (await api.getHealth()).data;
    if (health.llm !== 'enabled') {
      const err = await rejects(api.createAgentInvestigation({ role: 'EVIDENCE_INVESTIGATOR', trial_id: 'TR-PX104', protocol_version_id: 'PV-PX104-1.0', patient_id: 'P-140', criterion_ids: ['PX-EXC-02'], event_id: null, objective: 'Live smoke' }, `inv-${run}`));
      expect(err).toMatchObject({ status: 503, code: 'AGENT_UNAVAILABLE' });
    }
  });
});
