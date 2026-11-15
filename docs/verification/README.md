# Verification and supported behavior

This index separates checks executed during repository presentation cleanup from retained historical system executions. The source baseline is `3cec7371a146fdd59011c58bccd5f12aadfecda3`; application source, contracts, dependencies and fixtures are unchanged by the cleanup.

## Current checks

Executed on 15 November 2026 against the baseline application code and the documentation-cleanup working tree:

| Check | Observed result |
|---|---|
| Backend and AI pytest | **183 passed**, one existing Starlette/AnyIO deprecation warning. Isolated migrated/seeded SQLite databases. |
| Frontend unit tests | **82 passed, 10 skipped**. Mocked transport; destructive opt-in live-client tests were skipped. |
| Agent scenario evaluations | **12 passed** using mocked models/gateways and the real disabled entrypoint; no live inference. |
| Protocol fixture checker | Passed five PDF pages, eight rules, twelve sections, hashes/Unicode spans and eleven negative mutations. |
| TypeScript contract comparison | **74 declarations, zero mismatches**. |
| API/AI contract audit | **27 routes, zero issues**, using the actual current FastAPI process on isolated port 8017. |
| Frontend lint and type checking | Both exited **0**. |

Pre-publication sync merged remote `651948b` through `d130afb`. Incoming changes only replace UI punctuation and update matching test expectations. Frontend tests (**82 passed, 10 skipped**), lint and type checking were rerun successfully on the merged source. Backend/AI runtime and fixtures are unchanged from the earlier tested baseline; those suites were not rerun. Screenshots retain their recorded capture revision.

[Machine-readable check record](checks.json) · [Current route audit](evidence/current-contract-audit.json)

The checks do not establish clinical validity, production deployment, exhaustive accessibility or current live-provider reliability. No new live model call or full fresh upload-to-review journey was run for this documentation cleanup.

## Current screenshots

The [screenshot manifest](../media/manifest.json) records the source commit, actual screening result and capture environment. Screens use the current Next.js development server and real FastAPI/SQLite, without mocked transport. They use an isolated copy of synthetic data with the thirty-patient extension; AI is disabled. Existing approved rules, cases and traces come from the copied historical data, not new inference.

[Screening](../media/screening.png) · [Protocol rules](../media/protocol.png) · [Patient evidence](../media/patient-evidence.png) · [Saved investigation](../media/investigation.png) · [Case review](../media/case-review.png) · [Safety](../media/safety.png) · [Sponsor participation](../media/participation.png)

The initial capture pass ran one deterministic screening in the copy. The subsequent seven-image README showcase was read-only and displayed an existing Gemini investigation; it made no new model calls. The user's running services and database are not reset or modified.

## Recorded system evidence

These files preserve earlier observed runs. They are **historical evidence**, not assertions that the complete live journey was rerun on the cleanup revision. Original source paths, SHA-256 hashes and archive revision are recorded in the [evidence manifest](evidence/manifest.json); the [historical source manifest](evidence/historical-source-manifest.json) identifies the earlier reviewed implementation. Evidence JSON uses LF line endings; the manifest preserves both original-byte and curated-file checksums.

| Evidence | What it supports | Boundary |
|---|---|---|
| [Core HTTP workflow](evidence/core-workflow.json) | Actual extraction/approval/screening/event/review requests, duplicate and irrelevant branches, restart checks. | LLM deliberately OFF; extraction was curated. |
| [Live uploaded-source and monitoring](evidence/live-workflow.json) | Actual Gemini proposals and automatic monitoring enrichment through backend jobs and persistence. | Controlled PX-104 source and synthetic evidence; historical run. |
| [Live investigations](evidence/live-investigations.json) | Different lab, medication, contradiction, monitoring and irrelevant-event tool paths, including unresolved tasks. | PARTIAL is unresolved evidence, not complete investigation or a clinical verdict. |
| [Restart comparison](evidence/restart-comparison.json) | Selected durable resources matched across an actual API restart. | A separate earlier run; not a load/recovery guarantee. |
| [Historical review](HISTORICAL_REVIEW.md) | Full earlier critique, category scores, defects and reproducibility caveats. | The earlier score and backlog are not a current release rating. |

For example, the live P-124 execution used `retrieve_patient_evidence -> get_lab_history -> search_notes -> get_evidence_link -> request_verification_task`; P-151 stopped at `classify_event_relevance`. Inspect the recorded results rather than assuming a fixed path for all patients.

The [saved investigation shown in the README](evidence/showcase-investigation.json) preserves the exact API result behind that screenshot. Its tool order is recorded in the screenshot manifest; it is separate from the earlier independent investigation runs above.

The review retains an observed temporal wording defect and gaps in verification-task/async-result UX. Verified citation identifiers do not alone establish clinical correctness of generated prose. These findings remain visible in the [roadmap](../DEVELOPMENT_PLAN.md).

## Reproduce automated checks

With the Python virtual environment activated, from repository root:

```sh
python tools/protocol_fixture.py --check
python -m pytest backend/tests ai/tests -q
python -m ai.evals.run_evals
npm --prefix frontend test
npm --prefix frontend run lint
npm --prefix frontend run typecheck
node tools/integration/contracts.cjs
python tools/integration/contracts.py
```

The last Python command expects the API on port 8000 and the JSON produced by the preceding Node command. The cleanup audit used the same checker with its HTTP read redirected to the isolated current API on port 8017. Python tests use disposable databases, and default frontend tests do not mutate the running API.

On Windows, use `.venv/Scripts/python.exe` instead of an activated `python`. If pytest's default temporary directory is unavailable, set a unique `--basetemp=backend/var/qa-<unique-name>`.

## Live model smoke

A separately authorized provider smoke can load server configuration explicitly:

```powershell
.venv/Scripts/python.exe -c "from dotenv import load_dotenv; load_dotenv(); from ai.evals.run_evals import main; main()" --live
```

It requires the configured enabled provider/key and still uses a **synthetic test gateway**. A successful smoke does not prove backend integration. Missing credentials cause a labeled skip; do not count that as live success.

## Mutating browser and HTTP scenarios

Use a separate disposable database and frontend configuration. The full legacy integration suite expects the original **fifteen-patient** fresh seed and unapproved protocol; do not add the extension to that specific fixture unless adapting its assertions. It is distinct from normal thirty-patient startup.

After migrations, the initial seed and API/frontend launch on that disposable installation:

```powershell
$env:PP_LIVE_API_BASE_URL='http://127.0.0.1:8000/api/v1'
npm --prefix frontend test -- tests/live.test.ts
Remove-Item Env:PP_LIVE_API_BASE_URL
```

Reset **only that disposable installation** before the separate full browser journey, then:

```powershell
frontend/node_modules/.bin/playwright.cmd install chromium
npm --prefix frontend run test:e2e
.venv/Scripts/python.exe tools/integration/live_checks.py
```

POSIX uses `frontend/node_modules/.bin/playwright install chromium`. Inspect each targeted browser test's prerequisites; newer role/navigation tests may expect an already approved study or a second empty study.

Generated outputs continue to go to ignored `artifacts/integration/`. Keep repeatable scripts and tests in Git; promote selected evidence to this directory only with its execution mode and source revision recorded.

## Historical records

The full earlier [integration report](https://github.com/StefanosTheos/ProtocolPulse/blob/3cec7371a146fdd59011c58bccd5f12aadfecda3/INTEGRATION_REPORT.md), [AI implementation checkpoints](https://github.com/StefanosTheos/ProtocolPulse/blob/3cec7371a146fdd59011c58bccd5f12aadfecda3/docs/AI_REMEDIATION.md), engineer prompts and generated run logs remain in Git history. Cleanup preserves historical failures and does not rewrite repository history.

API_CONTRACTS governs API/wire behavior, DATA_MODEL persistence and TEAM_OWNERSHIP engineering ownership. All disagreements require coordinator review rather than local reinterpretation.
