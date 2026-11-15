import { test, expect } from '@playwright/test';
import { displayTitle } from '../../lib/api/labels';
import type { Trial } from '../../lib/api/types';

test('study choice responds before a blocked route and hides the previous study', async ({ page, request }) => {
  const response = await request.get('http://127.0.0.1:8000/api/v1/trials?limit=100', { headers: { 'X-Demo-Actor-Id': 'ACT-INV-01' } });
  expect(response.status()).toBe(200);
  const studies: Trial[] = (await response.json()).data.items;
  const previous = studies.find((s) => s.trial_id !== 'TR-PX104')!;
  expect(previous).toBeDefined();
  let release!: () => void;
  let blocked = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('_rsc') && url.pathname === '/trials/TR-PX104') { blocked = true; await gate; }
    await route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-INV-01'));
  await page.goto(`/trials/${encodeURIComponent(previous.trial_id)}`);
  const summary = page.getByRole('region', { name: 'Study summary' });
  await expect(summary).toBeVisible();
  const selector = page.getByLabel('Study', { exact: true });
  await expect(selector).toBeEnabled();
  try {
    await expect.poll(() => blocked).toBe(true);
    await selector.selectOption('TR-PX104');
    await expect(selector).toHaveValue('TR-PX104', { timeout: 500 });
    await expect(page.getByRole('heading', { name: 'Opening study…', exact: true })).toBeVisible({ timeout: 500 });
    await expect(summary).toHaveCount(0);
    await expect(page.getByRole('heading', { name: displayTitle(previous.title), exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Study workflow' }).getByRole('button', { name: 'Protocol' })).toBeDisabled();
  } finally { release(); }
  await expect(page).toHaveURL(/\/trials\/TR-PX104$/);
  await expect(summary).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'PX-104 study', exact: true })).toBeVisible();
});

test('the latest study choice wins when an earlier route is blocked', async ({ page, request }) => {
  const response = await request.get('http://127.0.0.1:8000/api/v1/trials?limit=100', { headers: { 'X-Demo-Actor-Id': 'ACT-INV-01' } });
  const studies: Trial[] = (await response.json()).data.items;
  const previous = studies.find((s) => s.trial_id !== 'TR-PX104')!;
  expect(previous).toBeDefined();
  let release!: () => void;
  let blocked = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('_rsc') && url.pathname === '/trials/TR-PX104') { blocked = true; await gate; }
    await route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-INV-01'));
  await page.goto(`/trials/${encodeURIComponent(previous.trial_id)}`);
  await expect(page.getByRole('region', { name: 'Study summary' })).toBeVisible();
  const selector = page.getByLabel('Study', { exact: true });
  try {
    await expect(selector).toBeEnabled();
    await expect.poll(() => blocked).toBe(true);
    await selector.selectOption('TR-PX104');
    await expect(selector).toHaveValue('TR-PX104', { timeout: 500 });
    await selector.selectOption(previous.trial_id);
    await expect(selector).toHaveValue(previous.trial_id, { timeout: 500 });
  } finally { release(); }
  await expect(page).toHaveURL(new RegExp(`/trials/${encodeURIComponent(previous.trial_id)}$`));
  await expect(page.getByRole('heading', { level: 1, name: displayTitle(previous.title), exact: true })).toBeVisible();
});

test('tab selection responds before a blocked route and intent warms only permitted GETs', async ({ page }) => {
  let release!: () => void;
  let blocked = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reads: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.port === '8000') {
      expect(['GET', 'OPTIONS']).toContain(request.method());
      if (request.method() === 'GET') reads.push(url.pathname + url.search);
    }
    if (url.searchParams.has('_rsc') && url.pathname === '/trials/TR-PX104/protocol') { blocked = true; await gate; }
    await route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-INV-01'));
  await page.goto('/trials/TR-PX104');
  const summary = page.getByRole('region', { name: 'Study summary' });
  await expect(summary).toBeVisible();
  const tab = page.getByRole('navigation', { name: 'Study workflow' }).getByRole('link', { name: 'Protocol', exact: true });
  await tab.hover();
  await expect.poll(() => reads.some((path) => path.includes('/protocols?') && path.includes('limit=50'))).toBe(true);
  try {
    await expect.poll(() => blocked).toBe(true);
    await tab.click();
    await expect(tab).toHaveAttribute('aria-current', 'page', { timeout: 500 });
    await expect(summary).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: 'Opening view' })).toBeVisible();
  } finally { release(); }
  await expect(page).toHaveURL(/\/trials\/TR-PX104\/protocol$/);
  await expect(page.locator('#version-heading')).toBeVisible();
});

test('cancelling a pending tab change preserves the unsaved screening date', async ({ page }) => {
  let release!: () => void;
  let blocked = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.port === '8000') expect(['GET', 'OPTIONS']).toContain(request.method());
    if (url.searchParams.has('_rsc') && url.pathname === '/trials/TR-PX104/monitor') { blocked = true; await gate; }
    await route.continue();
  });
  await page.addInitScript(() => localStorage.setItem('protocolpulse.demoActor', 'ACT-INV-01'));
  await page.goto('/trials/TR-PX104/selector');
  const date = page.getByLabel('Screening date', { exact: true });
  await expect(date).toBeEnabled();
  await date.fill('2026-11-02');
  const nav = page.getByRole('navigation', { name: 'Study workflow' });
  try {
    await nav.getByRole('link', { name: /Safety/ }).hover();
    await expect.poll(() => blocked).toBe(true);
    await nav.getByRole('link', { name: /Safety/ }).click();
    await expect(date).toBeHidden();
    await nav.getByRole('link', { name: 'Screen patients' }).click();
  } finally { release(); }
  await expect(page).toHaveURL(/\/trials\/TR-PX104\/selector$/);
  await expect(date).toBeVisible();
  await expect(date).toHaveValue('2026-11-02');
});
