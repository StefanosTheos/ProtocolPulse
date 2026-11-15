// Read-only follow-up; also runnable alone after the independently recorded API restart.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('durable browser refresh preserves run and attributed case', async ({ page }) => {
  const out = resolve(__dirname, '../../../artifacts/integration');
  const proof = JSON.parse(readFileSync(resolve(out, 'browser-evidence.json'), 'utf8'));
  await page.goto(`/trials/TR-PX104/selector?run=${proof.run.run_id}&status=ALL`);
  await expect(page.getByRole('link', { name: 'P-042', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'P-042', exact: true })).toBeVisible();
  await page.goto(`/trials/TR-PX104/cases?case=${proof.review_case.case_id}`);
  await page.getByLabel(/Viewing as/).selectOption('ACT-INV-01');
  await expect(page.locator('span').filter({ hasText: /^Acknowledged$/ }).first()).toBeVisible();
  await page.reload();
  await expect(page.locator('span').filter({ hasText: /^Acknowledged$/ }).first()).toBeVisible();
  await page.screenshot({ path: resolve(out, '07-after-api-restart.png'), fullPage: true });
  writeFileSync(resolve(out, 'browser-refresh.json'), JSON.stringify({ mode: 'REAL_BROWSER_NO_MOCKS',
    run_id: proof.run.run_id, case_id: proof.review_case.case_id, status_after_refresh: 'ACKNOWLEDGED' }, null, 2));
});
