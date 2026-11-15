import { test, expect } from '@playwright/test';
import proposal from '../../lib/api/fixtures/expected_protocol_detail.json';

const base = '/trials/TR-PX104';

test('only Clinical Lead and Sponsor can be selected and use their authorized tabs', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (r) => { if (r.url().includes(':8000/api/v1/')) expect(['GET', 'OPTIONS']).toContain(r.method()); });
  await page.addInitScript(() => {
    if (!localStorage.getItem('protocolpulse.demoActor')) localStorage.setItem('protocolpulse.demoActor', 'ACT-INV-01');
  });
  await page.goto(base);
  const dropdown = page.getByLabel('Viewing as');
  await expect(dropdown.locator('option')).toHaveText(['Sponsor', 'Clinical Lead']);
  await expect(page.getByLabel('Show supporting demo roles')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Study workflow' });
  await expect(nav.getByRole('link', { name: 'Screen patients' })).toBeVisible();
  const auditResponse = page.waitForResponse((r) => r.url().includes('/api/v1/trials/TR-PX104/audit?'));
  await nav.getByRole('link', { name: 'Audit trail' }).click();
  expect((await auditResponse).status()).toBe(200);
  await expect(page.getByText(/This screen is not part of/)).toHaveCount(0);
  await dropdown.selectOption('ACT-COORD-01');
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await expect(nav.getByRole('link', { name: 'Screen patients' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Audit trail' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /Protocol/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Safety/ })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-MON-01'));
  await page.reload();
  await expect(dropdown).toHaveValue('ACT-INV-01');
  await expect(dropdown.locator('option')).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem('protocolpulse.demoActor'))).toBe('ACT-INV-01');
  for (const id of ['ACT-MON-01', 'ACT-AUD-01', 'ACT-SPONSOR-01', 'ACT-IT-01']) {
    const response = await request.get('http://127.0.0.1:8000/api/v1/trials/TR-PX104', { headers: { 'X-Demo-Actor-Id': id } });
    expect(response.status()).toBe(403);
  }
  expect(errors).toEqual([]);
});

test('mocked protocol reads demonstrate serial review handoff and cross-window approval refresh', async ({ page, request }) => {
  // Browser UI is real; only protocol/trial GET responses below simulate approval. No real write or model call.
  const response = await request.get('http://127.0.0.1:8000/api/v1/trials/TR-PX104', { headers: { 'X-Demo-Actor-Id': 'ACT-COORD-01' } });
  expect(response.status()).toBe(200);
  const trial = (await response.json()).data;
  const approved = structuredClone(proposal);
  Object.assign(approved, { state: 'ACTIVE', revision: 2, approved_set_hash: 'synthetic-browser-test', approved_at: '2026-11-15T00:00:00Z', coverage_signed_by: 'ACT-INV-01', coverage_signed_at: '2026-11-15T00:00:00Z' });
  for (const criterion of approved.criteria) Object.assign(criterion, { workflow_status: 'APPROVED', approved_by: 'ACT-INV-01', approved_at: '2026-11-15T00:00:00Z' });
  let signed = false;
  await page.route('**/api/v1/trials/TR-PX104', (route) => route.fulfill({ json: { request_id: 'mock-handoff', data: { ...trial, active_protocol_version_id: signed ? proposal.protocol_version_id : null } } }));
  await page.route('**/api/v1/trials/TR-PX104/protocols?*', (route) => route.fulfill({ json: { request_id: 'mock-handoff', data: { items: [signed ? approved : proposal], page: { next_cursor: null, limit: 50, total_count: 1 } } } }));
  await page.addInitScript(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-COORD-01'));
  await page.goto(base + '/protocol');
  await expect(page.getByText('Waiting for a Clinical Lead to approve these rules')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start screening' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Approve rules' })).toBeDisabled();
  await page.getByLabel('Viewing as').selectOption('ACT-INV-01');
  await expect(page.getByText('Next: Review and approve these rules')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve rules' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Upload PDF' })).toHaveCount(0);
  await page.getByLabel('Viewing as').selectOption('ACT-COORD-01');
  await expect(page.getByText('Waiting for a Clinical Lead to approve these rules')).toBeVisible();
  signed = true;
  await expect(page.getByText(/All rules are approved by the Clinical Lead/)).toBeVisible({ timeout: 12_000 });
  await expect(page.getByText('Waiting for a Clinical Lead to approve these rules')).toHaveCount(0);
  await page.getByLabel('Viewing as').selectOption('ACT-INV-01');
  await expect(page.getByRole('link', { name: 'Next: Screen patients' })).toBeVisible();
});
