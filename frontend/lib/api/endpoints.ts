import { ApiClient, type ApiResult } from './client';
import type {
  AgentExecution, AgentInvestigationCreate, ApprovalReceipt, ApprovalRequest, AssessmentQuery,
  AuditEntry, AuditQuery, CaseQuery, CasePatch, CriteriaReplaceRequest, EventCreate, EventReceipt,
  EvidenceQuery, EvidenceSourceDetail, FindingQuery, Health, JobDetail, JobReceipt, MonitoringFinding,
  Page, PageQuery, ParticipationCreate, ParticipationRecord, Patient360, PatientAssessment,
  ProtocolDetail, ReviewCase, ScreeningCreate, ScreeningDisposition, ScreeningDispositionCreate,
  ScreeningRun, Trial, TrialCreate, TrialDetail,
} from './types';

const enc = encodeURIComponent;
type Q = Record<string, string | number | undefined>;

// One typed function per API_CONTRACTS §3 route (26 method/path pairs). No other routes.
export function createEndpoints(client: ApiClient) {
  return {
    getHealth: (): Promise<ApiResult<Health>> => client.request('GET', '/health'),

    listTrials: (q: PageQuery & { sort?: 'created_at' | '-created_at' | 'title' } = {}): Promise<ApiResult<Page<Trial>>> =>
      client.request('GET', '/trials', { query: q as Q }),
    createTrial: (body: TrialCreate, idempotencyKey: string): Promise<ApiResult<Trial>> =>
      client.request('POST', '/trials', { body, idempotencyKey }),
    getTrial: (trialId: string): Promise<ApiResult<TrialDetail>> =>
      client.request('GET', `/trials/${enc(trialId)}`),

    listProtocols: (trialId: string, q: PageQuery & { sort?: 'label' | '-created_at' } = {}): Promise<ApiResult<Page<ProtocolDetail>>> =>
      client.request('GET', `/trials/${enc(trialId)}/protocols`, { query: q as Q }),
    uploadProtocol: (
      trialId: string,
      input: { file: File; versionLabel: string },
      idempotencyKey: string,
      onUploadProgress?: (fraction: number) => void,
    ): Promise<ApiResult<ProtocolDetail>> => {
      const form = new FormData();
      form.append('file', input.file);
      form.append('version_label', input.versionLabel);
      form.append('source_declared_synthetic', 'true');
      return client.request('POST', `/trials/${enc(trialId)}/protocols`, { body: form, idempotencyKey, onUploadProgress });
    },
    getProtocol: (trialId: string, versionId: string): Promise<ApiResult<ProtocolDetail>> =>
      client.request('GET', `/trials/${enc(trialId)}/protocols/${enc(versionId)}`),
    extractProtocol: (trialId: string, versionId: string, forceReinspect: boolean, idempotencyKey: string): Promise<ApiResult<JobReceipt>> =>
      client.request('POST', `/trials/${enc(trialId)}/protocols/${enc(versionId)}/extract`, {
        body: { force_reinspect: forceReinspect }, idempotencyKey,
      }),
    replaceCriteria: (trialId: string, versionId: string, body: CriteriaReplaceRequest, revision: number): Promise<ApiResult<ProtocolDetail>> =>
      client.request('PUT', `/trials/${enc(trialId)}/protocols/${enc(versionId)}/criteria`, { body, ifMatchRevision: revision }),
    approveProtocol: (trialId: string, versionId: string, body: ApprovalRequest, revision: number, idempotencyKey: string): Promise<ApiResult<ApprovalReceipt>> =>
      client.request('POST', `/trials/${enc(trialId)}/protocols/${enc(versionId)}/approve`, {
        body, ifMatchRevision: revision, idempotencyKey,
      }),

    createScreening: (trialId: string, body: ScreeningCreate, idempotencyKey: string): Promise<ApiResult<JobReceipt>> =>
      client.request('POST', `/trials/${enc(trialId)}/screenings`, { body, idempotencyKey }),
    getScreeningRun: (runId: string): Promise<ApiResult<ScreeningRun>> =>
      client.request('GET', `/screenings/${enc(runId)}`),
    listAssessments: (runId: string, q: AssessmentQuery = {}): Promise<ApiResult<Page<PatientAssessment>>> =>
      client.request('GET', `/screenings/${enc(runId)}/assessments`, { query: q as Q }),

    getPatient360: (trialId: string, patientId: string, asOf?: string): Promise<ApiResult<Patient360>> =>
      client.request('GET', `/trials/${enc(trialId)}/patients/${enc(patientId)}`, { query: { as_of: asOf } }),
    createPatientEvent: (patientId: string, body: EventCreate, idempotencyKey: string): Promise<ApiResult<EventReceipt>> =>
      client.request('POST', `/patients/${enc(patientId)}/events`, { body, idempotencyKey }),

    listFindings: (trialId: string, q: FindingQuery = {}): Promise<ApiResult<Page<MonitoringFinding>>> =>
      client.request('GET', `/trials/${enc(trialId)}/findings`, { query: q as Q }),
    listCases: (trialId: string, q: CaseQuery = {}): Promise<ApiResult<Page<ReviewCase>>> =>
      client.request('GET', `/trials/${enc(trialId)}/cases`, { query: q as Q }),
    getCase: (caseId: string): Promise<ApiResult<ReviewCase>> =>
      client.request('GET', `/cases/${enc(caseId)}`),
    patchCase: (caseId: string, body: CasePatch): Promise<ApiResult<ReviewCase>> =>
      client.request('PATCH', `/cases/${enc(caseId)}`, { body, ifMatchRevision: body.expected_revision }),

    getAgentExecution: (executionId: string): Promise<ApiResult<AgentExecution>> =>
      client.request('GET', `/agent-executions/${enc(executionId)}`),
    listAudit: (trialId: string, q: AuditQuery = {}): Promise<ApiResult<Page<AuditEntry>>> =>
      client.request('GET', `/trials/${enc(trialId)}/audit`, { query: q as Q }),
    getJob: (jobId: string): Promise<ApiResult<JobDetail>> =>
      client.request('GET', `/jobs/${enc(jobId)}`),
    getEvidenceSource: (trialId: string, sourceId: string, q: EvidenceQuery = {}): Promise<ApiResult<EvidenceSourceDetail>> =>
      client.request('GET', `/trials/${enc(trialId)}/evidence/${enc(sourceId)}`, { query: q as Q }),

    recordDisposition: (trialId: string, patientId: string, body: ScreeningDispositionCreate, idempotencyKey: string): Promise<ApiResult<ScreeningDisposition>> =>
      client.request('POST', `/trials/${enc(trialId)}/patients/${enc(patientId)}/dispositions`, { body, idempotencyKey }),
    recordParticipation: (trialId: string, patientId: string, body: ParticipationCreate, idempotencyKey: string): Promise<ApiResult<ParticipationRecord>> =>
      client.request('POST', `/trials/${enc(trialId)}/patients/${enc(patientId)}/participation`, { body, idempotencyKey }),
    createAgentInvestigation: (body: AgentInvestigationCreate, idempotencyKey: string): Promise<ApiResult<JobReceipt>> =>
      client.request('POST', '/agent-investigations', { body, idempotencyKey }),
  };
}

export type Endpoints = ReturnType<typeof createEndpoints>;
