const { chromium } = require('../../frontend/node_modules/playwright');
const AxeBuilder = require('../../frontend/node_modules/@axe-core/playwright').default;
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const out = path.resolve('artifacts/integration/judge');
  const apiProof = JSON.parse(fs.readFileSync(path.join(out, 'http-probe.json'), 'utf8'));
  const run = apiProof.screening.run_id;
  const caseId = apiProof.case_after_review.case_id;
  const browser = await chromium.launch({headless: true, channel: 'msedge'});
  const context = await browser.newContext({viewport: {width: 1440, height: 1050}});
  const page = await context.newPage();
  const proof = {mode: 'INDEPENDENT_REAL_CHROMIUM_NEXT_API', pages: [], errors: [], requests: []};
  page.on('pageerror', e => proof.errors.push(e.message));
  page.on('response', r => {
    if (r.url().includes(':8016/api/v1')) proof.requests.push({url: r.url(), status: r.status()});
  });
  try {
    for (const [name, route] of [
      ['protocol', '/protocol'], ['selector', `/selector?run=${run}&status=ALL`],
      ['patient', `/patients/P-083?run=${run}`], ['monitor', '/monitor'],
      ['case', `/cases?case=${caseId}`], ['audit', '/audit'],
    ]) {
      await page.goto('http://localhost:3015/trials/TR-PX104' + route);
      await page.waitForLoadState('networkidle');
      const text = await page.locator('body').innerText();
      const audit = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa']).analyze();
      proof.pages.push({name, route, text, violations: audit.violations});
      await page.screenshot({path: path.join(out, `browser-${name}.png`), fullPage: true});
      if (name === 'selector' || name === 'case') {
        await page.reload();
        await page.waitForLoadState('networkidle');
        proof.pages.at(-1).after_refresh = await page.locator('body').innerText();
      }
    }
  } finally {
    fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(proof, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({pages: proof.pages.map(p => ({name: p.name, violations: p.violations.length})), errors: proof.errors}));
})().catch(e => { console.error(e); process.exitCode = 1; });
