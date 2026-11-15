import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import LandingPage from '@/app/page';
import { ActorProvider } from '@/components/ActorContext';
import { StudySelector } from '@/components/StudySelector';
import type { ApiRequest, Transport } from '@/lib/api/client';
import { createMockTransport } from '@/lib/api/mocks';
import { createApi, setApiForTesting, setCurrentActorId } from '@/lib/api/runtime';
import type { Trial } from '@/lib/api/types';
import { navigation } from './setup';

const study: Trial = {
  trial_id: 'TR-FIRST', title: 'First study', fictional_product_code: 'PX-104', site_id: 'SITE-SYN-01',
  site_timezone: 'Europe/Athens', planned_start_date: '2026-11-01', planned_end_date: '2027-01-24',
  synthetic_only: true, active_protocol_version_id: null, created_at: '2026-11-15T00:00:00Z', revision: 1,
};
const page = (items: Trial[], cursor: string | null = null) => ({
  status: 200, requestIdHeader: 'overview-test', body: { request_id: 'overview-test', data: {
    items, page: { next_cursor: cursor, limit: 100, total_count: null },
  } },
});

function setup(actor: string, transport: Transport, selected?: string) {
  setCurrentActorId(actor);
  setApiForTesting(createApi(transport));
  render(<ActorProvider initialActorId={actor}>{selected ? <StudySelector trialId={selected} /> : <LandingPage />}</ActorProvider>);
}

describe('landing page and study selection', () => {
  it.each([
    ['ACT-COORD-01', 'Start a study from its protocol'],
    ['ACT-INV-01', 'Review, screen and keep patients safe'],
  ])('%s lands on a role-specific page that only lists studies', async (actor, title) => {
    const requests: ApiRequest[] = [];
    const inner = createMockTransport();
    setup(actor, async (req) => { requests.push(req); return inner(req); });
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    await screen.findByRole('link', { name: /Open study/ });
    // No study is selected, so there is no workflow tab bar, table or study summary yet.
    expect(screen.queryByRole('navigation', { name: 'Study workflow' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Study summary' })).not.toBeInTheDocument();
    expect(screen.queryByText(/What needs your attention/)).not.toBeInTheDocument();
    // Only the Sponsor can start a new study from a protocol PDF.
    if (actor === 'ACT-COORD-01') expect(screen.getByRole('button', { name: 'Create study and upload protocol' })).toBeEnabled();
    else expect(screen.queryByRole('button', { name: 'Create study and upload protocol' })).not.toBeInTheDocument();
    expect(requests.every((req) => req.path === '/trials' && req.headers['X-Demo-Actor-Id'] === actor)).toBe(true);
  });

  it('loads all cursor pages and links each study to its own overview', async () => {
    const calls: ApiRequest[] = [];
    const second = { ...study, trial_id: 'TR/SECOND', title: 'Second study' };
    setup('ACT-COORD-01', async (req) => {
      calls.push(req);
      return req.query?.cursor ? page([second]) : page([study], 'next-page');
    });
    expect(await screen.findByRole('link', { name: /Second study/ })).toHaveAttribute('href', '/trials/TR%2FSECOND');
    expect(screen.getByRole('link', { name: /First study/ })).toHaveAttribute('href', '/trials/TR-FIRST');
    expect(calls).toHaveLength(2);
    expect(calls[1].query?.cursor).toBe('next-page');
  });

  it('creates a study and uploads its protocol in one step, then opens the protocol', async () => {
    const user = userEvent.setup();
    const calls: ApiRequest[] = [];
    setup('ACT-COORD-01', async (req) => {
      calls.push(req);
      if (req.method === 'POST' && req.path === '/trials') return { status: 201, requestIdHeader: 'r', body: { request_id: 'r', data: { ...study, trial_id: 'TR-NEW' } } };
      if (req.method === 'POST' && req.path === '/trials/TR-NEW/protocols') return { status: 201, requestIdHeader: 'r', body: { request_id: 'r', data: { protocol_version_id: 'PV-NEW-1.0', label: '1.0' } } };
      return page([]);
    });
    await user.click(screen.getByRole('button', { name: 'Create study and upload protocol' }));
    expect(screen.getByText('Choose a PDF file.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await user.upload(screen.getByLabelText('Protocol PDF file'), new File([new Uint8Array(10)], 'protocol.pdf', { type: 'application/pdf' }));
    await user.type(screen.getByLabelText('Study name'), 'New study');
    await user.type(screen.getByLabelText('Study product'), 'PX-200');
    await user.type(screen.getByLabelText('Planned start'), '2027-01-01');
    await user.type(screen.getByLabelText('Planned end'), '2027-06-30');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create study and upload protocol' }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/trials/TR-NEW/protocol?version=PV-NEW-1.0'));
    const create = calls.find((c) => c.method === 'POST' && c.path === '/trials')!;
    expect(create.body).toMatchObject({ title: 'New study', fictional_product_code: 'PX-200', planned_start_date: '2027-01-01', planned_end_date: '2027-06-30', synthetic_only: true });
  });

  it('can clear a selected study to return to the empty Overview', async () => {
    const user = userEvent.setup();
    setup('ACT-INV-01', async () => page([study]), study.trial_id);
    const selector = screen.getByLabelText('Study', { exact: true });
    await waitFor(() => expect(selector).toBeEnabled());
    expect(selector).toHaveValue(study.trial_id);
    expect(screen.getByText(study.site_timezone)).toBeInTheDocument();
    expect(screen.getByText(`${study.planned_start_date} → ${study.planned_end_date}`)).toBeInTheDocument();
    await user.selectOptions(selector, '');
    expect(navigation.push).toHaveBeenCalledWith('/');
  });

  it('reports a study-list failure and allows retry', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    setup('ACT-INV-01', async () => {
      if (++attempts === 1) throw new Error('offline');
      return page([study]);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load studies');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: /First study/ })).toBeInTheDocument();
  });

  it('explains when no studies exist', async () => {
    setup('ACT-INV-01', async () => page([]));
    await screen.findByText('No studies yet');
    expect(screen.queryByRole('link', { name: /Open study/ })).not.toBeInTheDocument();
  });
});
