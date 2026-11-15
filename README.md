# ProtocolPulse

Protocol-grounded recruitment and monitoring on **15 synthetic patients** and fictional PX-104. Investigator-approved rules drive deterministic screening and event-triggered review cases. No automatic enrollment, treatment action, pharmacological inference or real health data.

Contract `PP-S2-CF-20261114-01 / 1.0.0-rc2`; fixture `px104-protocol-v1`. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md), [API_CONTRACTS.md](docs/API_CONTRACTS.md) and [INTEGRATION_REPORT.md](INTEGRATION_REPORT.md). Design approval and software tests are not clinical validation.

## Prerequisites

Python **3.12**, Node.js **24**, npm. QA used Python 3.12.14, Node 24.16.0 and npm 11.13.0 on Windows. Run backend commands from repository root. Use one Uvicorn worker and persistent local SQLite.

## PowerShell setup

```powershell
Copy-Item .env.example .env  # first setup only; preserve an existing local configuration
python3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.lock
npm ci --prefix frontend
Set-Content frontend/.env.local 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1'
New-Item -ItemType Directory -Force backend/var/protocols | Out-Null
.venv/Scripts/python.exe -m alembic -c backend/alembic.ini upgrade head
.venv/Scripts/python.exe -m backend.app.seed --dataset px104-15
.venv/Scripts/python.exe -m tools.add_demo_patients
.venv/Scripts/python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
```

In another terminal at repository root:

```powershell
npm --prefix frontend run dev -- --hostname localhost --port 3000
```

Open **http://localhost:3000**. Health: **http://127.0.0.1:8000/api/v1/health**. API documentation: **http://127.0.0.1:8000/docs**. Browser origin must match `FRONTEND_ORIGIN=http://localhost:3000` for CORS.

For production frontend: stop the dev server, run `npm --prefix frontend run build`, then `npm --prefix frontend run start -- --hostname localhost --port 3000`.

Use this production frontend for the live demo: development mode compiles screens on first visit. The browser shares trial metadata across tabs and deduplicates identical in-flight reads. Completed read responses are cached in memory for at most five seconds, separately per actor and request parameters; operational job/run/execution and health reads are never served from a completed-response cache. Updates, job completion, Refresh and returning to the browser window invalidate reads. Role switches hide previous-role query data immediately and fetch under the new actor. No clinical data is stored in localStorage by this cache.

## POSIX setup

```sh
cp .env.example .env  # first setup only
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.lock
npm ci --prefix frontend
printf 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1\n' > frontend/.env.local
mkdir -p backend/var/protocols
python -m alembic -c backend/alembic.ini upgrade head
python -m backend.app.seed --dataset px104-15
python -m tools.add_demo_patients
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
# second terminal: npm --prefix frontend run dev -- --hostname localhost --port 3000
```

The Python lock captures tested package versions. POSIX commands were not executed during Windows QA. Ordinary startup never migrates, seeds or clears data; missing migrations/worker make health degraded.

## Synthetic walkthrough and reset

1. Load PX-104 and Trial setup. Seed rules are **unapproved**. To demonstrate upload/extraction, use `fixtures/protocols/px104-v1/PX-104-v1.0-fictional.pdf` and a new version label before activating another version.
2. As coordinator `ACT-COORD-01`, upload and extract. With the default `LLM_ENABLED=false`, extraction loads a **labeled curated fixture**. When enabled and configured, it runs Gemini through the scoped gateway and persists validated, unapproved model proposals. An enabled-model failure is explicit and never replaced by curated answers. The synthetic-source allowlist rejects other PDF bytes.
3. Switch to `ACT-INV-01`, review/edit proposals and all citations, attest twelve coverage sections and approve eight rules. A second active version is intentionally blocked in v1.
4. Screen for `2026-10-31`. Wait for job `SUCCEEDED` and run `COMPLETE`. Inspect P-042, P-175, P-124, P-117/P-118, P-083 and P-140. Counts come from fifteen actual assessments.
5. On P-042, record external participation using `SRC-P-042-external` and `EXT-P-042`. This mirrors a registered synthetic external record; screening does not enroll anyone.
6. As coordinator, post day-18 administration in Safety monitor. Wait for the backend case. Replay the preset to verify deduplication. A monitor/investigator records assignment and a review decision with **cited evidence**, rationale and disposition. Inspect audit.

**Reset:** stop the API first, then deliberately run `.venv/Scripts/python.exe -m backend.app.seed --dataset px104-15 --reset-demo` (POSIX: `python -m ...`). This replaces the entire local synthetic dataset, including approvals, screens, events, cases and reviews. Restart the API afterward. Ordinary restarts preserve data.

## Shared additional patients (30-patient cohort)

After pulling the repository and completing the normal migrations and initial
`px104-15` seed, run from the repository root with your Python environment:

```powershell
.venv/Scripts/python.exe -m tools.add_demo_patients
```

POSIX: `python -m tools.add_demo_patients` with the virtual environment activated.
This imports the same fifteen synthetic patients **P-301 through P-315** that were
added to the demo, including their source-linked records and narratives. It uses
the existing synthetic patient generator with fixed IDs and seed indices 15–29.
Existing patients, protocols, approvals, events and screening results are preserved;
rerunning skips existing patients. The database comes from your local `DATABASE_URL`;
SQLite runtime files and `.env` stay outside Git. A normal fresh setup has 30 patients
after this import. Run a **new screening** to include them; historical runs retain
their original cohort. After a demo reset, rerun the import to restore the extra fifteen.

A study created in the app starts with no patients, so it cannot be screened. To give it
the same fifteen synthetic profiles, pass its study ID (shown in the study's URL):

```powershell
.venv/Scripts/python.exe -m tools.add_demo_patients --trial TR-<study-id>
```

Because patient IDs are global, those patients get study-specific IDs such as
`P-272e70-301` to `P-272e70-315`. Rerunning skips existing patients.

## AI configuration

Default `LLM_ENABLED=false` needs no key. Deterministic screening/events/cases continue; agents show `UNAVAILABLE` without fabricated traces. Explicit investigations return `503 AGENT_UNAVAILABLE` when disabled/unconfigured.

Selected provider/model: `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.8-flash`. An authorized synthetic smoke may set `LLM_ENABLED=true` and server-side `LLM_API_KEY` in root `.env`, then restart the API. Backend loads root `.env` into the server process used by the AI entrypoint. Account access, quota, latency and live inference require an actual configured run; mocked SDK/model tests do not prove them.

Protocol preparation preserves actual PDF text/Unicode anchors. The model interprets clauses in two small bounded batches; code constructs the exact public drafts and the backend validates/persists them. Patient-role final outputs select verified citation registry entries. Monitoring switches to tool-free final drafting when its observed evidence is sufficient; the deterministic worker creates findings/cases independently. All roles retain the frozen eight-tool / 5s tool / 10s model / 30s execution limits. See [six-change verification](docs/AI_REMEDIATION.md) for real and mocked evidence, measured runs and limitations.

Never put secrets in browser configuration, `NEXT_PUBLIC_*`, DTOs, model input, traces or Git. The only frontend variable is `NEXT_PUBLIC_API_BASE_URL`. `.env`, virtual environments and `backend/var/` are ignored. Demo actors simulate roles and provide **no production authentication**.

## Demo roles and workflow

The **Viewing as** dropdown contains **Sponsor** (`COORDINATOR`, `ACT-COORD-01`) first and **Clinical Lead** (`INVESTIGATOR`, `ACT-INV-01`) second. Sponsor is the display name for the existing preparation/event-entry role, not the retired `SPONSOR_OPS` identity. There are no sign-in accounts. Supporting actors cannot be selected, restored, assigned cases or used through the API; old saved selections reset to Clinical Lead. Historical audit records remain intact.

Both roles land on an empty **Overview** at `/`. Select a study from the **Study** dropdown to load its current overview and enable the appropriate workflow tabs. Site time zone, planned dates, protocol state and existing attention/summary information appear only after selection. Use the dropdown on Overview to switch studies or select the blank option to clear the selection. The selected study is carried in `/trials/{trial_id}` and survives refresh; returning to `/` starts with no study selected. No trial-specific API requests are made from the unselected Overview.

Study selections and tab highlights respond before navigation completes. The previous view stays hidden while the destination loads, preserving unsaved inputs if a pending change is cancelled. Up to five study routes preload their route code; tab route code and authorized reads warm only on hover/focus. The existing actor-scoped five-second data cache, mutation/role invalidation and always-fresh job polling remain in force. Fresh data still requires its normal API response; preloading never performs extraction, screening, event writes or AI calls.

The Sponsor uploads the PDF and runs extraction. While proposals await approval, the overview and protocol screen show **Waiting for a Clinical Lead to approve these rules** and refresh status every five seconds. The Clinical Lead checks citations and coverage, resolves blockers, approves the rules, screens patients and records any externally confirmed participation. The Sponsor enters new events from Safety; the backend reassesses relevant rules automatically and the Clinical Lead investigates and dispositions resulting cases. A screening match never enrolls a patient.

Tabs: Sponsor **Overview → Protocol → Safety**; Clinical Lead **Overview → Protocol → Screen patients → Safety**, with **Audit trail** available throughout. This site workflow supports protocol surveillance and clinical review; independent sponsor monitoring remains a separate responsibility. Wire role identifiers and clinical gates are unchanged; the active demo policy rejects the four retired roles with `403 ROLE_FORBIDDEN` even in existing databases.

## Verification

```powershell
.venv/Scripts/python.exe tools/protocol_fixture.py --check
.venv/Scripts/python.exe -m pytest backend/tests ai/tests -q
.venv/Scripts/python.exe -m ai.evals.run_evals --live
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
```

Python tests use isolated migrated/seeded SQLite databases. Frontend unit tests use labeled mocks and skip the opt-in live suite. Agent `--live` skips inference without credentials; even its enabled smoke uses a synthetic test gateway.

For live frontend **client** tests, reset/start the API first:

```powershell
$env:PP_LIVE_API_BASE_URL='http://127.0.0.1:8000/api/v1'
npm --prefix frontend test -- tests/live.test.ts
Remove-Item Env:PP_LIVE_API_BASE_URL
```

For real Chromium E2E, reset/start the API **again**, build/start the live frontend, then:

```powershell
frontend/node_modules/.bin/playwright.cmd install chromium
npm --prefix frontend run test:e2e
.venv/Scripts/python.exe tools/integration/live_checks.py
node tools/integration/contracts.cjs
.venv/Scripts/python.exe tools/integration/contracts.py
```

POSIX uses `frontend/node_modules/.bin/playwright install chromium`. E2E intentionally mutates the synthetic database; run once per reset. Additional live checks follow the browser test. Evidence, route audit, traces and screenshots are saved to `artifacts/integration/`; runtime browser files and SQLite are ignored. `tools/integration/record.py LABEL EXECUTABLE ARGS...` records actual command output/exit codes.

See the integration report for observed results, remaining defects, severity assignments and the required Prompt E follow-up. No clinical, production-security or complete accessibility certification is claimed.
