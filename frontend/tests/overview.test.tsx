import { render, screen, waitFor, within } from '@testing-library/react';
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

describe('study selection on Overview', () => {
  it.each(['ACT-COORD-01', 'ACT-INV-01'])('%s starts on an empty Overview without fetching trial details', async (actor) => {
    const requests: ApiRequest[] = [];
    const inner = createMockTransport();
    setup(actor, async (req) => { requests.push(req); return inner(req); });
    expect(screen.getByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Study', { exact: true })).toBeEnabled());
    expect(screen.getByLabelText('Study', { exact: true })).toHaveValue('');
    const nav = screen.getByRole('navigation', { name: 'Study workflow' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    for (const button of within(nav).getAllByRole('button')) expect(button).toBeDisabled();
    if (actor === 'ACT-INV-01') expect(within(nav).getByRole('button', { name: 'Screen patients' })).toBeDisabled();
    else expect(within(nav).queryByRole('button', { name: 'Screen patients' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Site time zone')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Study summary' })).not.toBeInTheDocument();
    expect(screen.queryByText(/What needs your attention/)).not.toBeInTheDocument();
    expect(requests.every((req) => req.path === '/trials' && req.headers['X-Demo-Actor-Id'] === actor)).toBe(true);
  });

  it('loads all cursor pages and routes the chosen study to its own overview', async () => {
    const user = userEvent.setup();
    const calls: ApiRequest[] = [];
    const second = { ...study, trial_id: 'TR/SECOND', title: 'Second study' };
    setup('ACT-COORD-01', async (req) => {
      calls.push(req);
      return req.query?.cursor ? page([second]) : page([study], 'next-page');
    });
    const selector = screen.getByLabelText('Study', { exact: true });
    await screen.findByRole('option', { name: 'Second study' });
    await user.selectOptions(selector, second.trial_id);
    expect(navigation.push).toHaveBeenCalledWith('/trials/TR%2FSECOND');
    expect(calls).toHaveLength(2);
    expect(calls[1].query?.cursor).toBe('next-page');
    expect(navigation.prefetch).toHaveBeenCalledWith('/trials/TR-FIRST');
    expect(navigation.prefetch).toHaveBeenCalledWith('/trials/TR%2FSECOND');
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

  it('reports a study-list failure and allows retry without showing trial details', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    setup('ACT-COORD-01', async () => {
      if (++attempts === 1) throw new Error('offline');
      return page([study]);
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load studies');
    expect(screen.getByLabelText('Study', { exact: true })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('option', { name: 'First study' });
    expect(screen.getByLabelText('Study', { exact: true })).toBeEnabled();
  });

  it('explains when no studies exist', async () => {
    setup('ACT-INV-01', async () => page([]));
    await screen.findByText('No studies yet');
    expect(screen.getByLabelText('Study', { exact: true })).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Study summary' })).not.toBeInTheDocument();
  });
});
