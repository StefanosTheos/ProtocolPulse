import { test, expect } from '@playwright/test';
import { displayTitle } from '../../lib/api/labels';
import type { Trial, TrialDetail } from '../../lib/api/types';

for (const [role, actor] of [['Sponsor', 'ACT-COORD-01'], ['Clinical Lead', 'ACT-INV-01']] as const) {
  test(`${role} selects and switches studies from an initially empty Overview`, async ({ page, request }) => {
    const api = 'http://127.0.0.1:8000/api/v1';
    const headers = { 'X-Demo-Actor-Id': actor };
    const response = await request.get(api + '/trials?limit=100&sort=-created_at', { headers });
    expect(response.status()).toBe(200);
    const studies: Trial[] = (await response.json()).data.items;
    expect(studies.length).toBeGreaterThanOrEqual(2);
    const errors: string[] = [];
    const apiPaths: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (r) => {
      if (!r.url().startsWith(api)) return;
      expect(['GET', 'OPTIONS']).toContain(r.method());
      if (r.method() === 'GET') apiPaths.push(new URL(r.url()).pathname);
    });
    await page.addInitScript((id) => localStorage.setItem('protocolpulse.demoActor', id), actor);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Study workflow' });
    await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    const selector = page.getByLabel('Study', { exact: true });
    await expect(selector).toBeEnabled();
    await expect(selector).toHaveValue('');
    await expect(page.getByRole('region', { name: 'Study summary' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /What needs your attention/ })).toHaveCount(0);
    await expect(nav.getByRole('button', { name: 'Protocol' })).toBeDisabled();
    expect(apiPaths.every((path) => !path.startsWith('/api/v1/trials/'))).toBe(true);

    for (const study of studies.slice(0, 2)) {
      const detailResponse = await request.get(api + '/trials/' + encodeURIComponent(study.trial_id), { headers });
      expect(detailResponse.status()).toBe(200);
      const detail: TrialDetail = (await detailResponse.json()).data;
      const base = `/trials/${encodeURIComponent(study.trial_id)}`;
      await selector.selectOption(study.trial_id);
      await expect(page).toHaveURL(new RegExp(`${base}$`));
      await expect(page.getByRole('heading', { level: 1, name: displayTitle(study.title), exact: true })).toBeVisible();
      await expect(selector).toHaveValue(study.trial_id);
      await expect(page.getByText(study.site_timezone, { exact: true })).toBeVisible();
      await expect(page.getByText(`${study.planned_start_date} → ${study.planned_end_date}`, { exact: true })).toBeVisible();
      const summary = page.getByRole('region', { name: 'Study summary' });
      await expect(summary).toBeVisible();
      await expect(summary.getByRole('link', { name: /^Safety findings/ }).getByText(String(detail.finding_count), { exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', base);
      if (actor === 'ACT-INV-01') await expect(nav.getByRole('link', { name: 'Screen patients' })).toBeVisible();
      else await expect(nav.getByRole('link', { name: 'Screen patients' })).toHaveCount(0);
    }
    await page.reload();
    await expect(selector).toHaveValue(studies[1].trial_id);
    await expect(page.getByRole('heading', { level: 1, name: displayTitle(studies[1].title), exact: true })).toBeVisible();
    await selector.selectOption('');
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Study summary' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
