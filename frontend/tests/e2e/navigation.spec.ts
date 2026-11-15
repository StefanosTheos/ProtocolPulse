// Read-only navigation check against the existing approved synthetic demo.
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('navigation reuses shared reads and role switches fetch authorized data again', async ({ page }) => {
  const base = '/trials/TR-PX104';
  const apiRequests: { url: string; actor: string | undefined }[] = [];
  const timings: { route: string; content_ready_ms: number }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().startsWith('http://127.0.0.1:8000/api/v1')) {
      expect(['GET', 'OPTIONS']).toContain(request.method());
      if (request.method() === 'GET') apiRequests.push({ url: request.url(), actor: request.headers()['x-demo-actor-id'] });
    }
  });
  await page.addInitScript(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-INV-01'));
  await page.goto(base);
  await expect(page.getByRole('navigation', { name: 'Study workflow' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  await page.waitForLoadState('networkidle');
  const trialRequests = (actor: string) => apiRequests.filter((r) => new URL(r.url).pathname === '/api/v1/trials/TR-PX104' && r.actor === actor);
  expect(trialRequests('ACT-INV-01')).toHaveLength(1);

  for (const route of ['/protocol', '/selector', '/monitor', '/protocol']) {
    const started = Date.now();
    const findingResponse = route === '/monitor' ? page.waitForResponse((r) =>
      r.url().includes('/api/v1/trials/TR-PX104/findings') && r.status() === 200) : null;
    await page.locator(`nav[aria-label="Study workflow"] a[href="${base}${route}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${base}${route}`));
    if (route === '/protocol') await expect(page.locator('#version-heading')).toBeVisible();
    if (route === '/selector') await expect(page.locator('#screen-date')).not.toHaveValue('');
    if (findingResponse) {
      await findingResponse;
      await expect(page.getByRole('status').filter({ hasText: /Loading findings/ })).toHaveCount(0);
    }
    timings.push({ route, content_ready_ms: Date.now() - started });
  }
  expect(trialRequests('ACT-INV-01')).toHaveLength(1);
  const protocolLists = apiRequests.filter((r) => new URL(r.url).pathname === '/api/v1/trials/TR-PX104/protocols' && new URL(r.url).searchParams.get('limit') === '50');
  expect(protocolLists).toHaveLength(1);

  await page.getByLabel('Viewing as').selectOption('ACT-MON-01');
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await expect.poll(() => trialRequests('ACT-MON-01').length).toBe(1);
  await expect(page.locator('nav[aria-label="Study workflow"]')).not.toContainText('Screen patients');
  await page.getByLabel('Viewing as').selectOption('ACT-INV-01');
  await expect.poll(() => trialRequests('ACT-INV-01').length).toBe(2);
  await expect(page.locator('nav[aria-label="Study workflow"]')).toContainText('Screen patients');
  expect(errors).toEqual([]);
  writeFileSync(resolve(__dirname, '../../../artifacts/integration/navigation-performance.json'), JSON.stringify({
    mode: 'REAL_PRODUCTION_BROWSER_API_READ_ONLY', timings, api_requests: apiRequests,
    role_isolation: 'verified', browser_errors: errors,
  }, null, 2));
});
