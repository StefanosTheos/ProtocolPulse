import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: '../artifacts/integration/runtime/playwright',
  reporter: [['list'], ['json', { outputFile: '../artifacts/integration/browser-results.json' }]],
  use: { baseURL: 'http://localhost:3000', headless: true, viewport: { width: 1440, height: 1050 } },
});
