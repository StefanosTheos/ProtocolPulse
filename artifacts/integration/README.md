# Recorded integration evidence

Authoritative runtime report: [INTEGRATION_REPORT.md](../../INTEGRATION_REPORT.md). Inputs are entirely synthetic. Model-backed results are not asserted.

- `test-manifest.json`: exact code commit, source fingerprints, package/runtime versions and freeze identity.
- `final-python.log`: combined backend/AI results. `final-auto-enrichment.log` verifies the final test-only assertion cleanup.
- `final-frontend-tests.log`, `final-lint.log`, `final-typecheck.log`, `final-build.log`: actual frontend quality checks.
- `baseline-live-client.log`: ten real HTTP client tests on a separately reset database.
- `final-browser.log`, `browser-evidence.json`, numbered screenshots: real Chromium/Next/FastAPI journey. `browser-refresh.log` and `browser-refresh.json`: read-only browser refresh following API restart. Browser JSON reporter output may represent the most recent selected test invocation; the two command logs distinguish their outcomes.
- `accessibility-audit.json`: axe results for six live views, after the recorded contrast/focus fixes. This is not complete manual WCAG certification.
- `live-api-evidence.json`, `final-live-api.log`: additional live degraded branches, malformed proposals, source allowlist/size checks, pagination, CORS, OFF behavior and database integrity.
- `actual-gateway-P-042.json`, `actual-gateway-P-083.json`, `actual-gateway-P-124.json`: real E2 gateway/adapter and E3 entrypoint on migrated SQLite under TestClient, with an explicitly **mocked model**. Automatic monitoring enrichment starts after the worker creates the P-042 case. These are not live Gemini traces.
- `openapi.json`, `contract-audit.json`, `typescript-contract.json`, `final-contract.log`: running schema snapshot and static consistency checks. The contract audit is not a substitute for runtime scenarios.
- `durable-snapshot-before.json`, `durable-snapshot-after.json`, `persistence-result.json`: equality of selected durable API data and SQLite counts across an actual API process restart. An earlier invalid probe used a conflicting recorder filename; only the `durable-snapshot-*` files and final persistence logs are authoritative.
- `final-ai-evals.log`: twelve mocked/disabled evaluations; live inference explicitly skipped.
- `npm-audit-online.log`: initial dependency advisories. `npm-audit-final.log`: remaining development advisories. `production-audit.log`: online production-only advisory result. `backend-lint-final.log`: deferred import-order lint failures.
- `secrets-check.json`: credential-pattern and ignore checks, not an exhaustive secret-detection guarantee.

Commands recorded after the recorder filename correction have `*.command.json` metadata (command, actual exit code and duration). Older `*.json` command metadata is retained beside its log. Baseline/diagnostic failures are historical evidence, not final passing outcomes. Runtime browser cache/traces and SQLite files are ignored; no real API key or health record belongs here.

Live follow-up: `live-provider.log` and `live-provider-smoke.json` record an actual Gemini run against a synthetic test gateway: model AVAILABLE, eight calls, FAILED/BAD_INPUT in 18.804s. This does not supersede the mocked status of the earlier gateway fixtures or prove live E2 persistence.
