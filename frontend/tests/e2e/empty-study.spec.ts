import { test, expect } from '@playwright/test';
import type { Trial } from '../../lib/api/types';

test('an approved study without patients explains the missing cohort and cannot submit screening', async ({ page, request }) => {
  const api = 'http://127.0.0.1:8000/api/v1';
  const headers = { 'X-Demo-Actor-Id': 'ACT-INV-01' };
  const response = await request.get(api + '/trials?limit=100', { headers });
  expect(response.status()).toBe(200);
  const trials: Trial[] = (await response.json()).data.items;
  let empty: Trial | undefined;
  for (const trial of trials) {
    const detailResponse = await request.get(api + '/trials/' + trial.trial_id, { headers });
    const detail = (await detailResponse.json()).data;
    if (detail.active_protocol_version_id && detail.patient_count === 0) { empty = trial; break; }
  }
  expect(empty, 'The real demo includes an approved empty Integration QA study').toBeDefined();
  page.on('request', (r) => { if (r.url().startsWith(api)) expect(['GET', 'OPTIONS']).toContain(r.method()); });
  await page.addInitScript(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-INV-01'));
  const base = '/trials/' + encodeURIComponent(empty!.trial_id);
  await page.goto(base);
  await expect(page.getByText('No patients to screen', { exact: true })).toBeVisible();
  await expect(page.getByText('Patient screening is available', { exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Study workflow' }).getByRole('link', { name: 'Screen patients' }).click();
  await expect(page.getByText('No patients to screen', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run screening' })).toBeDisabled();
  await expect(page.getByText('This study has no patients to screen. Choose a study with patients from Overview.')).toBeVisible();
  await page.getByRole('link', { name: 'Choose another study' }).click();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await expect(page.getByLabel('Study', { exact: true })).toBeEnabled();
});
