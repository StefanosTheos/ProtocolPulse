import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import MonitorPage from '@/app/trials/[trialId]/monitor/page';
import SelectorPage from '@/app/trials/[trialId]/selector/page';
import { ActorProvider } from '@/components/ActorContext';
import { AgentExecutionView } from '@/components/AgentExecutionPanel';
import { CaseReviewPanel } from '@/components/CaseReviewPanel';
import { CriterionMatrix } from '@/components/CriterionMatrix';
import { EmptyState, ErrorPanel } from '@/components/ErrorBoundary';
import { EventSimulator } from '@/components/EventSimulator';
import { MedicationTimeline } from '@/components/MedicationTimeline';
import { ProtocolCoverageReview } from '@/components/ProtocolCoverageReview';
import { ProtocolUpload, validateUpload } from '@/components/ProtocolUpload';
import { ApiClient, ApiError, pollJob, type ApiRequest, type Transport } from '@/lib/api/client';
import { createEndpoints } from '@/lib/api/endpoints';
import protocolFixture from '@/lib/api/fixtures/expected_protocol_detail.json';
import { mockPatient360 } from '@/lib/api/mock-data';
import { createMockTransport } from '@/lib/api/mocks';
import { createApi, setApiForTesting, setCurrentActorId } from '@/lib/api/runtime';
import type { AgentExecution, CriterionResult, ProtocolDetail } from '@/lib/api/types';
import { navigation } from './setup';

const fixture = protocolFixture as ProtocolDetail;

function useMock(options: { pollsUntilDone?: number } = {}) {
  const calls: ApiRequest[] = [];
  const inner = createMockTransport({ pollsUntilDone: options.pollsUntilDone ?? 1 });
  const transport: Transport = async (req) => { calls.push(req); return inner(req); };
  setApiForTesting(createApi(transport));
  return { calls, transport };
}

function renderAs(actorId: string, ui: ReactNode) {
  setCurrentActorId(actorId);
  return render(<ActorProvider initialActorId={actorId}>{ui}</ActorProvider>);
}

// Drives the mock backend directly (as another actor would) to set up workflow state.
function directClient(transport: Transport, actorId: string) {
  return createEndpoints(new ApiClient({ transport, getActorId: () => actorId }));
}

describe('J-01 protocol review and approval', () => {
  it('renders all 8 proposed rules and 12 coverage sections, including 4 informational, as unsigned', () => {
    useMock();
    renderAs('ACT-INV-01', <ProtocolCoverageReview trialId="TR-PX104" protocol={fixture} onChanged={() => {}} />);
    for (const c of fixture.criteria) expect(screen.getAllByText(c.criterion_id).length).toBeGreaterThan(0);
    const coverageTable = screen.getByRole('heading', { name: /Extraction coverage/ }).closest('section')!;
    const rows = within(coverageTable).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(12);
    expect(within(coverageTable).getAllByText('Background only')).toHaveLength(4);
    expect(within(coverageTable).getByText('not signed')).toBeInTheDocument();
    expect(screen.getByText(/Zero blockers does not approve anything by itself/)).toBeInTheDocument();
  });

  it('a coordinator cannot approve; the button is disabled with the reason', () => {
    useMock();
    renderAs('ACT-COORD-01', <ProtocolCoverageReview trialId="TR-PX104" protocol={fixture} onChanged={() => {}} />);
    expect(screen.getByRole('button', { name: /Approve criteria/ })).toBeDisabled();
    expect(screen.getByText(/Only an investigator can approve/)).toBeInTheDocument();
  });

  it('coverage blockers disable approval', () => {
    useMock();
    const blocked: ProtocolDetail = { ...fixture, blocking_count: 1, coverage: fixture.coverage.map((c, i) => (i === 2 ? { ...c, status: 'BLOCKING' } : c)) };
    renderAs('ACT-INV-01', <ProtocolCoverageReview trialId="TR-PX104" protocol={blocked} onChanged={() => {}} />);
    expect(screen.getByRole('button', { name: /Approve criteria/ })).toBeDisabled();
    expect(screen.getByText(/coverage section\(s\) are BLOCKING/)).toBeInTheDocument();
  });

  it('approval needs explicit attestation and a reason, then calls the API with If-Match and all 8 IDs', async () => {
    const { calls } = useMock();
    const onChanged = vi.fn();
    const user = userEvent.setup();
    renderAs('ACT-INV-01', <ProtocolCoverageReview trialId="TR-PX104" protocol={fixture} onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: /Approve criteria/ }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Approve and activate' });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox'));
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Decision reason/), 'Checked every clause against the PDF');
    await user.click(confirm);
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const approveCall = calls.find((c) => c.path.endsWith('/approve'))!;
    expect(approveCall.headers['If-Match']).toBe('"1"');
    expect(approveCall.headers['Idempotency-Key']).toMatch(/^approve-PV-PX104-1\.0-r1-/);
    expect((approveCall.body as { criterion_ids: string[] }).criterion_ids).toEqual(fixture.criteria.map((c) => c.criterion_id));
    expect(onChanged.mock.calls[0][0].state).toBe('ACTIVE');
    expect(screen.getByRole('status')).toHaveTextContent(/Protocol approved by the investigator/);
  });

  it('shows a revision conflict from the API instead of a success', async () => {
    useMock();
    const stale: ProtocolDetail = { ...fixture, revision: 9 };
    const user = userEvent.setup();
    renderAs('ACT-INV-01', <ProtocolCoverageReview trialId="TR-PX104" protocol={stale} onChanged={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Approve criteria/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('checkbox'));
    await user.type(within(dialog).getByLabelText(/Decision reason/), 'reason');
    await user.click(within(dialog).getByRole('button', { name: 'Approve and activate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('REVISION_CONFLICT');
    expect(screen.queryByText(/Protocol approved by/)).not.toBeInTheDocument();
  });
});

describe('upload constraints', () => {
  const pdf = (size: number, name = 'p.pdf', type = 'application/pdf') => new File([new Uint8Array(size)], name, { type });

  it('accepts a labelled PDF within the size limit', () => {
    expect(validateUpload(pdf(10), '1.1')).toEqual([]);
  });
  it('rejects non-PDF, empty, oversize files and missing labels', () => {
    expect(validateUpload(pdf(10, 'p.docx', 'application/msword'), '1.1')).toContain('Only PDF files can be uploaded. "p.docx" is a DOCX file.');
    expect(validateUpload(pdf(0), '1.1').join(' ')).toMatch(/is empty\. Choose a file with content\./);
    expect(validateUpload(pdf(12 * 1024 * 1024 + 1), '1.1').join(' ')).toMatch(/larger than 12 MB\. Choose a smaller file\./);
    expect(validateUpload(pdf(10), '  ')).toContain('Enter a version label, for example 1.1.');
    expect(validateUpload(null, '1.1')).toContain('Choose a PDF file.');
  });
  it('blocks submission and lists problems', async () => {
    const { calls } = useMock();
    const user = userEvent.setup();
    renderAs('ACT-COORD-01', <ProtocolUpload trialId="TR-PX104" onUploaded={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Upload PDF' }));
    // Each problem is shown next to its field.
    expect(screen.getByText('Choose a PDF file.')).toBeInTheDocument();
    expect(screen.getByText('Enter a version label, for example 1.1.')).toBeInTheDocument();
    expect(screen.getByText('Confirm the document contains no real patient data.')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });
  it('an investigator cannot upload', () => {
    useMock();
    renderAs('ACT-INV-01', <ProtocolUpload trialId="TR-PX104" onUploaded={() => {}} />);
    expect(screen.getByRole('button', { name: 'Upload PDF' })).toBeDisabled();
  });
});

describe('J-02 screening gate', () => {
  it('the unsigned review-state mock cannot start screening', async () => {
    useMock();
    navigation.params = { trialId: 'TR-PX104' };
    navigation.pathname = '/trials/TR-PX104/selector';
    renderAs('ACT-COORD-01', <SelectorPage />);
    expect(await screen.findByText('Screening disabled')).toBeInTheDocument();
    expect(screen.getByText(/no investigator-approved active protocol/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run screening' })).toBeDisabled();
  });
});

describe('J-03 evidence display', () => {
  const unknown: CriterionResult = {
    criterion_result_id: 'CR-1', criterion_id: 'PX-INC-03', protocol_version_id: 'PV-PX104-1.0', status: 'UNKNOWN', reason_codes: ['MISSING_LAB'],
    evidence_refs: [], considered_interval: null, explanation: 'No eGFR specimen in window.', evaluated_at: '2026-10-31T22:01:00Z',
  };

  it('shows UNKNOWN as an amber Unclear with its reason and how to resolve it, never as met', () => {
    render(<CriterionMatrix results={[unknown]} criteriaById={{}} selectedId={null} onSelect={() => {}} />);
    const pill = screen.getByText('Unclear').closest('span')!;
    expect(pill.className).toMatch(/unknown/);
    expect(pill.className).not.toMatch(/pass/);
    expect(screen.queryByText('Met')).not.toBeInTheDocument();
    expect(screen.getByText('No lab result on record.')).toBeInTheDocument();
    expect(screen.getByText(/To resolve: Add a lab result/)).toBeInTheDocument();
  });

  it('keeps conflicting medication entries separate and flags the conflict', () => {
    const p140 = mockPatient360('P-140', 'NOT_ENROLLED', null);
    render(<MedicationTimeline medications={p140.medications} openItems={p140.open_items} timeZone="Europe/Athens" />);
    expect(screen.getByRole('note')).toHaveTextContent(/Conflicting sources \(CONFLICTING_SOURCES\)/);
    expect(screen.getByRole('note')).toHaveTextContent(/neither is chosen automatically/);
    expect(screen.getByText('Reported use')).toBeInTheDocument();
    expect(screen.getByText('Discontinuation')).toBeInTheDocument();
    expect(screen.getAllByText('Conflict')).toHaveLength(2);
    expect(screen.getAllByText(/month precision/)).toHaveLength(2);
  });

  it('labels an order as not evidence of use', () => {
    const p083 = mockPatient360('P-083', 'NOT_ENROLLED', null);
    render(<MedicationTimeline medications={p083.medications} />);
    expect(screen.getByText('Order')).toBeInTheDocument();
    expect(screen.getByText(/Prescribed — not evidence of use/)).toBeInTheDocument();
  });
});

describe('J-04 event simulation and refresh', () => {
  it('waits for backend re-evaluation, then reports; a replay is deduplicated', async () => {
    useMock({ pollsUntilDone: 2 });
    const onProcessed = vi.fn();
    const user = userEvent.setup();
    renderAs('ACT-COORD-01', <EventSimulator trialId="TR-PX104" onProcessed={onProcessed} />);
    await user.click(screen.getByRole('button', { name: /Simulate new record/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post event' }));
    expect(await screen.findByText('Awaiting backend re-evaluation')).toBeInTheDocument();
    expect(onProcessed).not.toHaveBeenCalled();
    await waitFor(() => expect(onProcessed).toHaveBeenCalledTimes(1), { timeout: 4000 });
    expect(onProcessed.mock.calls[0][0].status).toBe('SUCCEEDED');

    await user.click(screen.getByRole('button', { name: /Simulate new record/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post event' }));
    expect(await screen.findByText('Deduplicated replay')).toBeInTheDocument();
    expect(screen.getByText(/No second event, finding or case is created/)).toBeInTheDocument();
  });

  it('the monitor shows no finding until the backend job succeeds, then refreshes from the API', async () => {
    const { transport } = useMock({ pollsUntilDone: 2 });
    const inv = directClient(transport, 'ACT-INV-01');
    await inv.approveProtocol('TR-PX104', 'PV-PX104-1.0', { criterion_ids: fixture.criteria.map((c) => c.criterion_id), coverage_attestation: true, activate: true, decision_reason: 'r' }, 1, 'k-a');
    await inv.recordParticipation('TR-PX104', 'P-042', { next_status: 'PARTICIPATING', external_record_source_id: 'SRC-P-042-PARTICIPATION', external_record_reference: 'EXT-1', rationale: 'external record' }, 'k-p');

    navigation.params = { trialId: 'TR-PX104' };
    navigation.pathname = '/trials/TR-PX104/monitor';
    const user = userEvent.setup();
    renderAs('ACT-COORD-01', <MonitorPage />);
    expect(await screen.findByText('No findings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Simulate new record/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Post event' }));
    expect(await screen.findByText('Awaiting backend re-evaluation')).toBeInTheDocument();
    expect(screen.getByText('No findings')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Open case for patient P-042/ }, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('No findings')).not.toBeInTheDocument();
    expect(screen.getAllByText('Confirmed protocol conflict').some((el) => el.tagName === 'SPAN')).toBe(true);
  });
});

describe('J-05 review update', () => {
  async function seedCase(transport: Transport) {
    const inv = directClient(transport, 'ACT-INV-01');
    const coord = directClient(transport, 'ACT-COORD-01');
    await inv.approveProtocol('TR-PX104', 'PV-PX104-1.0', { criterion_ids: fixture.criteria.map((c) => c.criterion_id), coverage_attestation: true, activate: true, decision_reason: 'r' }, 1, 'k-a');
    await inv.recordParticipation('TR-PX104', 'P-042', { next_status: 'PARTICIPATING', external_record_source_id: 'SRC-P-042-PARTICIPATION', external_record_reference: 'EXT-1', rationale: 'r' }, 'k-p');
    const receipt = await coord.createPatientEvent('P-042', {
      trial_id: 'TR-PX104', event_kind: 'MEDICATION', source_event_id: 'SRC-EVT-D18-P042', source_version: 1, source_id: 'SRC-MED-D18-P042', source_document_version: 1,
      effective_at: '2026-11-19T09:30:00+02:00', recorded_at: '2026-11-20T11:00:00+02:00', time_uncertainty: null, evidence_state: 'POSITIVE', evidence_quality: 'HIGH',
      medication: { code: 'SYN-MED-R1', evidence_type: 'ADMINISTRATION', dose_value: 1, dose_unit: 'synthetic-unit', route: 'ORAL', interval_end_exclusive_at: null },
      lab: null, condition: null, note: null, observation: null, supersedes_event_id: null,
    }, 'k-e');
    await pollJob((id) => coord.getJob(id), receipt.data.job.job_id, { sleep: async () => {} });
    return 'CASE-P-042-PX-MON-01';
  }

  it('a monitor acknowledges with exactly the CasePatch fields; RESOLVED/CLOSED are investigator-only', async () => {
    const { transport, calls } = useMock();
    const caseId = await seedCase(transport);
    const onUpdated = vi.fn();
    const user = userEvent.setup();
    renderAs('ACT-MON-01', <CaseReviewPanel trialId="TR-PX104" caseId={caseId} onUpdated={onUpdated} />);
    const statusSelect = await screen.findByLabelText('Next status');
    expect(within(statusSelect).getByRole('option', { name: /Resolved — investigator only/ })).toBeDisabled();
    expect(within(statusSelect).getByRole('option', { name: /Closed — investigator only/ })).toBeDisabled();
    expect(screen.getByText('System-generated deterministic summary')).toBeInTheDocument();

    await user.selectOptions(statusSelect, 'ACKNOWLEDGED');
    await user.selectOptions(screen.getByLabelText('Owner'), 'ACT-INV-01');
    await user.type(screen.getByLabelText('Disposition'), 'REVIEW_REQUIRED');
    await user.type(screen.getByLabelText('Rationale'), 'Source administration requires investigator review');
    const evidenceBox = await screen.findByRole('checkbox', { name: /EV-EVT-/ });
    await user.click(evidenceBox);
    await user.click(screen.getByRole('button', { name: /Review and submit/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Submit decision' }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled());

    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(Object.keys(patch.body as object).sort()).toEqual(['assigned_actor_id', 'cited_evidence_ids', 'disposition', 'expected_revision', 'next_status', 'rationale']);
    expect(patch.body).toMatchObject({ expected_revision: 1, next_status: 'ACKNOWLEDGED', assigned_actor_id: 'ACT-INV-01', disposition: 'REVIEW_REQUIRED' });
    expect(patch.headers['If-Match']).toBe('"1"');
    expect(await screen.findByText(/Case moved to Acknowledged/)).toBeInTheDocument();
    expect(await screen.findByText('Human review decisions (1)')).toBeInTheDocument();
  });
});

describe('J-06 agent activity', () => {
  const base: AgentExecution = {
    execution_id: 'EXEC-1', role: 'MONITORING_WORKFLOW', status: 'FAILED', trial_id: 'TR-PX104', patient_id: 'P-042', protocol_version_id: 'PV-PX104-1.0',
    criterion_ids: ['PX-MON-01'], event_id: 'EVT-1', correlation_id: 'c', evidence_refs: [], summary: null, unknown_reasons: [], verification_questions: [],
    trace: [{ tool_name: 'get_medication_timeline', input_reference_ids: ['P-042'], output_reference_ids: [], result_code: 'ERROR', elapsed_ms: 5000, error_code: 'TOOL_TIMEOUT' }],
    error_code: 'TOOL_TIMEOUT', model_id: 'gemini-3.8-flash', created_at: '2026-11-20T09:00:02Z', finished_at: '2026-11-20T09:00:32Z',
  };

  it('shows a failed execution honestly with its recorded tool trace only', () => {
    render(<AgentExecutionView execution={base} />);
    expect(screen.getByText(/automated summary didn.t finish/)).toHaveTextContent('TOOL_TIMEOUT');
    expect(screen.getByText('get_medication_timeline')).toBeInTheDocument();
    expect(screen.getByText(/nothing below was concluded by the automated summary/)).toBeInTheDocument();
  });

  it('shows UNAVAILABLE without any trace or summary', () => {
    render(<AgentExecutionView execution={{ ...base, status: 'UNAVAILABLE', trace: [], error_code: 'LLM_DISABLED', model_id: null }} />);
    expect(screen.getByText(/Automated summary unavailable/)).toHaveTextContent('No model ran');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('empty and error states', () => {
  it('error panel explains in plain words and keeps code, details and request ID for support', () => {
    const err = new ApiError({ status: 409, code: 'APPROVAL_BLOCKED', message: 'Unresolved items.', details: [{ field: 'coverage', reason: 'BLOCKING section X' }], requestId: 'req-123' });
    render(<ErrorPanel error={err} context="Approval" />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Approval: Approval is blocked');
    expect(alert).toHaveTextContent('APPROVAL_BLOCKED (HTTP 409)');
    expect(alert).toHaveTextContent('BLOCKING section X');
    expect(alert).toHaveTextContent('req-123');
  });
  it('empty state explains what to do next', () => {
    render(<EmptyState title="No cases">Cases open when the backend records a finding.</EmptyState>);
    expect(screen.getByText('No cases')).toBeInTheDocument();
  });
});
