// Real Chromium + production Next build + live FastAPI/SQLite. No transport/model mocks.
// Requires a freshly reset synthetic database; deliberately mutates that demo database.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const API = 'http://127.0.0.1:8000/api/v1';
const trial = '/trials/TR-PX104';
const out = resolve(__dirname, '../../../artifacts/integration');

test('real protocol → screening → evidence → dated event → human case → audit', async ({ page, request }) => {
  mkdirSync(out, { recursive: true });
  const evidence: Record<string, unknown> = { mode: 'REAL_CHROMIUM_NEXT_FASTAPI_SQLITE_LLM_OFF', requests: [] };
  const calls = evidence.requests as unknown[];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().startsWith(API)) calls.push({ method: response.request().method(),
      url: response.url(), status: response.status(), request_id: response.headers()['x-request-id'] });
  });
  const get = async (path: string) => {
    const res = await request.get(API + path, { headers: { 'X-Demo-Actor-Id': 'ACT-INV-01' } });
    expect(res.status()).toBe(200);
    return (await res.json()).data;
  };
  const actor = (id: string) => page.getByLabel(/Viewing as/).selectOption(id);
  const shot = (name: string) => page.screenshot({ path: resolve(out, name + '.png'), fullPage: true });
  try {
    await page.goto(trial + '/selector');
    await expect(page.getByRole('button', { name: 'Run screening', exact: true })).toBeDisabled();
    await expect(page.getByText(/Decision support only/)).toBeVisible();

    await page.goto(trial + '/protocol');
    await actor('ACT-COORD-01');
    await page.getByLabel(/PDF file/).setInputFiles(resolve(__dirname, '../../../fixtures/protocols/px104-v1/PX-104-v1.0-fictional.pdf'));
    await page.getByLabel('Version label', { exact: true }).fill(`IC-browser-${Date.now()}`);
    await page.getByLabel('This document contains no real patient or sponsor data.').check();
    const upload = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/protocols'));
    await page.getByRole('button', { name: 'Upload PDF', exact: true }).click();
    expect((await upload).status()).toBe(201);
    const version = (await (await upload).json()).data.protocol_version_id;
    evidence.protocol_version_id = version;
    await expect(page).toHaveURL(/version=PV/);
    await page.getByRole('button', { name: 'Run extraction', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Extracted rules.*8/ })).toBeVisible();
    await expect.poll(async () => (await get(`/trials/TR-PX104/protocols/${version}`)).state).toBe('EXTRACTION_REVIEW');
    const proposal = await get(`/trials/TR-PX104/protocols/${version}`);
    expect(proposal.criteria).toHaveLength(8);
    expect(proposal.coverage).toHaveLength(12);
    expect(proposal.coverage.filter((c: { status: string }) => c.status === 'INFORMATIONAL')).toHaveLength(4);
    expect(proposal.approved_set_hash).toBeNull();
    evidence.extraction = { origin: 'CURATED_FIXTURE_NOT_MODEL_EXTRACTION', source: proposal.source, criteria: proposal.criteria, coverage: proposal.coverage };

    await actor('ACT-INV-01');
    await page.getByText(/^Source text for age \(inclusion rule 1\)$/).click();
    await page.getByRole('button', { name: 'Show in source page', exact: true }).click();
    await expect(page.locator('mark').first()).toContainText('40 to 70');
    await page.getByRole('button', { name: 'Edit proposals', exact: true }).click();
    await page.getByLabel('Evidence requirement for PX-INC-01', { exact: true }).fill(proposal.criteria.find((c: {criterion_id: string}) => c.criterion_id === 'PX-INC-01').evidence_requirement + ' Reviewed against the source in integration QA.');
    await page.getByRole('button', { name: 'Save corrections…', exact: true }).click();
    await page.getByLabel('Change reason (required)', { exact: true }).fill('Source review annotation; frozen rule semantics retained.');
    await page.getByRole('button', { name: 'Save corrections', exact: true }).click();
    await expect.poll(async () => (await get(`/trials/TR-PX104/protocols/${version}`)).revision).toBe(proposal.revision + 1);
    await page.getByRole('button', { name: 'Approve criteria…', exact: true }).click();
    await page.getByLabel(/I reviewed every rule against its cited source clause/).check();
    await page.getByLabel('Decision reason (required)').fill('Synthetic investigator verified all eight rules and twelve source sections.');
    await page.getByRole('button', { name: 'Approve and activate', exact: true }).click();
    await expect.poll(async () => (await get(`/trials/TR-PX104/protocols/${version}`)).state).toBe('ACTIVE');
    await shot('01-protocol-approved');

    await page.goto(trial + '/selector');
    await page.getByRole('button', { name: 'Run screening', exact: true }).click();
    await expect(page).toHaveURL(/run=RUN/, { timeout: 60_000 });
    const run = new URL(page.url()).searchParams.get('run')!;
    const assessments = (await get(`/screenings/${run}/assessments?limit=100`)).items;
    expect(assessments).toHaveLength(15);
    evidence.run = await get(`/screenings/${run}`);
    evidence.baseline_assessments = assessments;
    const statuses = Object.fromEntries(assessments.map((a: {patient_id:string;candidate_status:string}) => [a.patient_id, a.candidate_status]));
    expect(statuses).toMatchObject({ 'P-042': 'POTENTIAL_MATCH', 'P-175': 'PROTOCOL_CONFLICT', 'P-124': 'NEEDS_REVIEW', 'P-083': 'NEEDS_REVIEW', 'P-117': 'PROTOCOL_CONFLICT', 'P-118': 'POTENTIAL_MATCH', 'P-140': 'NEEDS_REVIEW' });
    // The list opens on "Needs review"; P-042 is a potential match, so show all patients.
    await page.getByRole('tab', { name: /All patients/ }).click();
    await expect(page.getByRole('link', { name: 'P-042', exact: true })).toBeVisible();
    await shot('02-selector-real-results');
    await page.reload();
    await expect(page.getByRole('link', { name: 'P-042', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'P-042', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Record sections', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Evidence timeline', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Record external participation…', exact: true }).click();
    await page.getByLabel('Registered external participation source').selectOption('SRC-P-042-external');
    await page.getByLabel('External record reference').fill('EXT-P-042');
    await page.getByLabel('Rationale', { exact: true }).fill('Record the independently registered synthetic external participation evidence.');
    await page.getByRole('button', { name: 'Record PARTICIPATING', exact: true }).click();
    await expect.poll(async () => (await get('/trials/TR-PX104/patients/P-042')).participation_status).toBe('PARTICIPATING');
    await shot('03-patient-evidence');

    await page.goto(trial + '/monitor');
    await actor('ACT-COORD-01');
    const postEvent = async () => {
      await page.getByRole('button', { name: 'Simulate new record…', exact: true }).click();
      const pending = page.waitForResponse(r => r.request().method() === 'POST' && /\/patients\/P-042\/events$/.test(r.url()));
      await page.getByRole('button', { name: 'Post event', exact: true }).click();
      const response = await pending;
      return { status: response.status(), body: (await response.json()).data };
    };
    const started = Date.now();
    const first = await postEvent();
    expect(first.status).toBe(202);
    await expect.poll(async () => (await get('/jobs/' + first.body.job.job_id)).status).toBe('SUCCEEDED');
    evidence.event_to_job_ms = Date.now() - started;
    const findings = (await get('/trials/TR-PX104/findings?patient_id=P-042')).items;
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ criterion_id: 'PX-MON-01', category: 'CONFIRMED_PROTOCOL_CONFLICT' });
    evidence.event_receipt = first;
    evidence.findings = findings;
    const caseId = findings[0].case_id;
    await expect(page.getByRole('button', { name: 'Simulate new record…', exact: true })).toBeEnabled();
    await shot('04-monitor-case');
    const duplicate = await postEvent();
    expect(duplicate.status).toBe(200);
    expect(duplicate.body).toMatchObject({ event_id: first.body.event_id, deduplicated: true });
    expect((await get('/trials/TR-PX104/cases?patient_id=P-042')).items).toHaveLength(1);
    evidence.duplicate = duplicate;

    await page.goto(trial + `/cases?case=${caseId}`);
    await actor('ACT-INV-01');
    await page.getByLabel('Next status', { exact: true }).selectOption('ACKNOWLEDGED');
    await page.getByLabel('Owner', { exact: true }).selectOption('ACT-INV-01');
    await page.getByLabel('Disposition', { exact: true }).fill('REVIEW_REQUIRED');
    await page.getByLabel('Rationale', { exact: true }).fill('Actual source administration requires investigator review under the approved fictional rule.');
    await page.getByLabel(new RegExp(findings[0].evidence_refs[0].evidence_id)).check();
    await page.getByRole('button', { name: 'Review and submit…', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Confirm|Submit|Record/ }).click();
    await expect.poll(async () => (await get('/cases/' + caseId)).status).toBe('ACKNOWLEDGED');
    evidence.review_case = await get('/cases/' + caseId);
    expect((evidence.review_case as {decisions: {actor_id:string}[]}).decisions[0].actor_id).toBe('ACT-INV-01');
    await shot('05-human-case-review');
    await page.reload();
    await expect(page.locator('span').filter({ hasText: /^Acknowledged$/ }).first()).toBeVisible();

    await page.goto(trial + '/audit');
    await actor('ACT-INV-01');
    await expect(page.getByText('Approved the protocol', { exact: true }).first()).toBeVisible();
    await shot('06-audit');
    evidence.audit = (await get('/trials/TR-PX104/audit?limit=100')).items;
    expect(errors).toEqual([]);
    evidence.browser_errors = errors;
    const accessibility: { path: string; violations: unknown[] }[] = [];
    for (const path of ['/protocol', `/selector?run=${run}&status=ALL`, `/patients/P-042?run=${run}`, '/monitor', `/cases?case=${caseId}`, '/audit']) {
      await page.goto(trial + path);
      await actor('ACT-INV-01');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      accessibility.push({ path, violations: result.violations });
    }
    evidence.accessibility = accessibility;
    writeFileSync(resolve(out, 'accessibility-audit.json'), JSON.stringify(accessibility, null, 2));
    expect(accessibility.flatMap(r => r.violations)).toEqual([]);
  } finally {
    evidence.browser_errors = errors;
    writeFileSync(resolve(out, 'browser-evidence.json'), JSON.stringify(evidence, null, 2));
    await shot('last-browser-state');
  }
});
