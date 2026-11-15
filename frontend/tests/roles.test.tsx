import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import OverviewPage from '@/app/trials/[trialId]/page';
import ProtocolPage from '@/app/trials/[trialId]/protocol/page';
import { ActorProvider } from '@/components/ActorContext';
import { AppHeader } from '@/components/AppHeader';
import { TrialHeader } from '@/components/TrialHeader';
import type { Transport } from '@/lib/api/client';
import protocolFixture from '@/lib/api/fixtures/expected_protocol_detail.json';
import { createMockTransport } from '@/lib/api/mocks';
import { actorById, createApi, getCurrentActorId, setApiForTesting, setCurrentActorId } from '@/lib/api/runtime';
import type { ProtocolDetail } from '@/lib/api/types';
import { navigation } from './setup';

function setup(actor: string, ui: ReactNode, proposal?: ProtocolDetail, pathname = '/trials/TR-PX104/protocol') {
  const inner = createMockTransport({ pollsUntilDone: 1 });
  const transport: Transport = async (req) => {
    if (proposal && req.method === 'GET' && req.path === '/trials/TR-PX104/protocols') {
      return { status: 200, requestIdHeader: 'roles-test', body: { request_id: 'roles-test', data: {
        items: [proposal], page: { next_cursor: null, limit: 50, total_count: 1 },
      } } };
    }
    return inner(req);
  };
  setApiForTesting(createApi(transport));
  setCurrentActorId(actor);
  navigation.params = { trialId: 'TR-PX104' };
  navigation.pathname = pathname;
  render(<ActorProvider initialActorId={actor}>{ui}</ActorProvider>);
  return { server: inner };
}

describe('two demo roles', () => {
  it('offers only Clinical Lead and Sponsor, including after a role change', async () => {
    const user = userEvent.setup();
    setup('ACT-INV-01', <AppHeader />);
    const dropdown = screen.getByLabelText('Viewing as');
    expect(within(dropdown).getAllByRole('option').map((o) => o.textContent)).toEqual(['Sponsor', 'Clinical Lead']);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    await user.selectOptions(dropdown, 'ACT-COORD-01');
    expect(dropdown).toHaveValue('ACT-COORD-01');
    expect(within(dropdown).getAllByRole('option')).toHaveLength(2);
  });

  it.each(['ACT-MON-01', 'ACT-AUD-01', 'ACT-SPONSOR-01', 'ACT-IT-01'])('cannot select the retired identity %s', async (actorId) => {
    setup(actorId, <AppHeader />);
    expect(screen.getByLabelText('Viewing as')).toHaveValue('ACT-INV-01');
    expect(getCurrentActorId()).toBe('ACT-INV-01');
    expect(actorById(actorId)).toBeUndefined();
    const client = createApi(createMockTransport(), () => actorId);
    await expect(client.getTrial('TR-PX104')).rejects.toMatchObject({ status: 403, code: 'ROLE_FORBIDDEN' });
  });

  it.each([
    ['ACT-COORD-01', ['Overview', 'Protocol', 'Safety']],
    ['ACT-INV-01', ['Overview', 'Protocol', 'Screen patients', 'Safety', 'Audit trail']],
  ] as const)('%s sees its workflow tabs', async (actor, tabs) => {
    setup(actor, <TrialHeader trialId="TR-PX104" />, undefined, actor === 'ACT-COORD-01' ? '/trials/TR-PX104/protocol' : '/trials/TR-PX104/audit');
    await waitFor(() => expect(screen.queryByText('Loading trial')).not.toBeInTheDocument());
    const nav = screen.getByRole('navigation', { name: 'Study workflow' });
    for (const label of ['Overview', 'Protocol', 'Screen patients', 'Safety', 'Audit trail']) {
      if ((tabs as readonly string[]).includes(label)) expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
      else expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/This screen is not part of/)).not.toBeInTheDocument();
  });
});

describe('serial protocol handoff', () => {
  it('keeps the coordinator waiting and clears the message when a reviewer approves', async () => {
    const interval = vi.spyOn(window, 'setInterval');
    const clear = vi.spyOn(window, 'clearInterval');
    const { server } = setup('ACT-COORD-01', <ProtocolPage />);
    await screen.findByText('Waiting for a Clinical Lead to approve these rules');
    expect(screen.getByRole('button', { name: 'Approve rules' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start screening' })).toBeDisabled();
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 5000);
    const timer = interval.mock.results.at(-1)?.value;
    const refresh = interval.mock.calls.at(-1)?.[0] as () => void;
    // Simulate a different browser approving: no client-side invalidation reaches this window.
    const approval = await server({ method: 'POST', path: '/trials/TR-PX104/protocols/PV-PX104-1.0/approve',
      headers: { 'X-Demo-Actor-Id': 'ACT-INV-01', 'If-Match': '"1"', 'Idempotency-Key': 'roles-approval' },
      body: { criterion_ids: protocolFixture.criteria.map((c) => c.criterion_id), coverage_attestation: true,
        activate: true, decision_reason: 'Reviewed the synthetic source and coverage' },
    });
    expect(approval.status).toBe(200);
    expect(screen.getByText('Waiting for a Clinical Lead to approve these rules')).toBeInTheDocument();
    await act(async () => {
      refresh();
    });
    await screen.findByText(/All rules are approved by the Clinical Lead/);
    expect(screen.queryByText('Waiting for a Clinical Lead to approve these rules')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Next: Screen patients' })).not.toBeInTheDocument();
    expect(clear).toHaveBeenCalledWith(timer);
    interval.mockRestore();
    clear.mockRestore();
  });

  it('gives the reviewer an actionable approval step and no upload form', async () => {
    setup('ACT-INV-01', <ProtocolPage />);
    await screen.findByText('Next: Review and approve these rules');
    expect(screen.getByRole('button', { name: 'Approve rules' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Upload PDF' })).not.toBeInTheDocument();
    expect(screen.queryByText('Waiting for a Clinical Lead to approve these rules')).not.toBeInTheDocument();
  });

  it.each([
    ['EXTRACTION_REVIEW', 8, 'Waiting for a Clinical Lead to approve these rules'],
    ['DRAFT', 0, 'Next: Extract the protocol rules'],
    ['EXTRACTING', 0, 'Protocol rules are being extracted'],
    ['EXTRACTION_FAILED', 0, 'The protocol rules could not be read'],
  ] as const)('shows the correct coordinator handoff for %s', async (state, ruleCount, message) => {
    const proposal: ProtocolDetail = { ...structuredClone(protocolFixture) as ProtocolDetail, state, criteria: ruleCount ? structuredClone(protocolFixture.criteria) as ProtocolDetail['criteria'] : [] };
    setup('ACT-COORD-01', <OverviewPage />, proposal);
    await screen.findByText(message);
    if (state !== 'EXTRACTION_REVIEW') expect(screen.queryByText('Waiting for a Clinical Lead to approve these rules')).not.toBeInTheDocument();
  });
});
