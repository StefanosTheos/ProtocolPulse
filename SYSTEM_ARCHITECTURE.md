# ProtocolPulse — System Architecture

**Contract freeze candidate:** `PP-S2-CF-20261114-01` · **Version:** `1.0.0-rc1` · **Status:** awaiting team approval before parallel coding.  
**Authority:** uploaded `PRODUCT_SPECIFICATION.md` v1.0, especially §§4–10, 14–16. **Explicit superseding scope:** exactly **15** fictional demo patients (the newer patient-blueprint instruction replaces the source specification's historical 250-patient fixture and illustrative 34/89/127 counts). All other PX-104 rule semantics, calendar dates, named acceptance archetypes, authority boundaries, and criterion identifiers remain unchanged. Do not edit the source specification silently; record the approved cohort-size amendment in Stage 2.1.

## 1. Frozen choices and system constraints

- `frontend/`: Next.js App Router, React, TypeScript, Tailwind; browser calls one versioned REST API, polls jobs; no direct model/database access.
- `backend/`: Python **3.12**, FastAPI, Pydantic **v2**, SQLAlchemy **2**, Alembic, SQLite (WAL), pytest; **single Uvicorn process and one durable SQLite-backed job runner** in the demo. No Celery, Redis, broker, vector DB, or production authentication claim.
- `ai/`: Python 3.12, provider-configurable tool-capable LLM, Pydantic validation; one bounded coordinator with four logical roles, in-process through `backend/app/integrations/agent_adapter.py` ⇄ `ai/entrypoints.py`; never an independent write-authority service.
- **One source of truth:** backend relational storage + immutable uploaded protocol bytes on local `backend/var/protocols/` (absolute storage path configured). Database contains checksums, paths, version IDs and indexed text/page spans. Do not store blobs in browser.
- **Safety:** 15 wholly synthetic patients with provenance-bearing structured facts AND concise narratives; approve rules via attributed human action; deterministic `PASS|FAIL|UNKNOWN`, and `POTENTIAL_MATCH|NEEDS_REVIEW|PROTOCOL_CONFLICT`. These are pre-screen results, not enrollment, clinical safety, or pharmacology.
- **Demo dates/site:** `Europe/Athens`; screening local date `2026-10-31`, study day 0 `2026-11-01`, day 18 `2026-11-19`. Medication lookback `[2026-10-01 00:00, 2026-10-31 00:00)` in Athens; eGFR specimen **local calendar date** in `[2026-10-01, 2026-10-31]`. The screening record's evidence-cutoff watermark is separately set after the screening local day (seed `2026-11-01T00:00:00+02:00`) so the Oct 31 inclusive lab rule is implementable. Never compare clinical dates to job ingestion timestamps.
- **Explicit hard boundaries:** no real records, hospital API, automated enrollment, drug changes, SAE reporting, medical interaction inference, or assertion of regulatory/GCP validation. UI prominently labels fictional/demo mode.

## 2. Topology

```text
 [Next.js browser, fake actor switcher]       [Local dev: localhost:3000]
           | REST /api/v1 + JSON + multipart PDF; X-Demo-Actor-Id
           v
 +-------------------------------------------------------------+
 | FastAPI process :8000                                       |
 | API routes -> Pydantic validation -> actor/role guard       |
 |           -> services + deterministic rule evaluator        |
 |                  |                    |                      |
 |                  v                    v                      |
 |            SQLAlchemy 2           Job poller (lifespan)      |
 |                  |                    |                      |
 |           SQLite WAL              PROTOCOL_EXTRACT           |
 |        audit, jobs, cases         SCREEN_COHORT              |
 |        all evidence data          INGEST_EVENT                |
 |                  ^                AGENT_INVESTIGATION         |
 |                  |                    |                      |
 |     EvidenceGateway (whitelisted, scoped, Pydantic JSON)      |
 +------------------|--------------------|----------------------+
                    |                    v
             local PDF store    backend-owned agent_adapter.py
                                      |
                                      v
                        ai/entrypoints.py (single coordinator)
                        4 logical roles + read-only tools
                                      |
                                LLM provider (optional)
                        NO tools to approve/enroll/treat
```

**Local topology:** root working directory; Next dev server on 3000; `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1`; `npm --prefix frontend run dev`. Backend creates/opens the persistent SQLite file, verifies Alembic head, loads seeded actors/trial and **15** patients only through an explicit seed command, starts one job poller in lifespan. **No auto-seeding or schema creation during ordinary API startup.** Deployment proof can be a single host with front-end build + one API process and persistent volume (`backend/var`); do not horizontally scale this SQLite job design. Front-end server routes are UI only, not hidden data API routes.

## 3. Synchronous, asynchronous and transaction behavior

| Operation | Transport | Transaction boundary / authority | Completion |
|---|---|---|---|
| List/get trial, protocol, patient, evidence, assessments, cases, logs | `GET` | Read-only scoped session; stable cursor pagination | `200` |
| Create trial; PDF upload/version registration | `POST` | Validate actor + synthetic upload; hash/atomically move PDF, commit version+audit; orphan file cleanup on failure | `201` |
| Extract PDF | `POST .../extract` | Atomic creation of `Job(PROTOCOL_EXTRACT)`+audit; job parses and proposes typed unapproved rules, coverage in separate commit | `202` + `job_id` |
| Replace proposed criteria / approve | `PUT .../criteria`, `POST .../approve` | ETag/revision guards. Approval requires named eligible simulated investigator, per-criterion signoff + full coverage, writes immutable approved hash and audit | `200` |
| Screen cohort | `POST .../screenings` | Commit `SCREEN_COHORT` job and frozen version/evidence-watermark request; worker commits all 15 immutable assessments and run completion atomically | `202` |
| Post patient event | `POST .../events` | Transaction A: immutable event+source/ID dedup + job+audit; Transaction B in worker: affected rule calculations, before/after snapshots, finding/case upsert, audit and job result **together** | `202`, duplicate `200` |
| Investigator participation / disposition; case patch | Versioned POST/PATCH | Actor/role, transition, version checks; append immutable review decision + audit with status update in one transaction | `200`/`201` |
| Agent investigation / extraction | Background job | Never holds SQLite transaction open during LLM call. Read-only snapshot, bounded external call, validate evidence refs; persist agent outcome, optional verification request; deterministic status remains authoritative | `202` job and eventual status |

**Job states:** `QUEUED|RUNNING|SUCCEEDED|FAILED`; distinct from source specification's screening-run states (`QUEUED|RUNNING|COMPLETE|FAILED`), which represent domain progress. Job result may refer to `screening_run_id`, `agent_execution_id`, affected `assessment_ids`, finding/case IDs. Only `POST .../extract`, `POST .../screenings`, `POST .../events` and `POST /api/v1/agent-investigations` create durable jobs. `POST .../events` returns `200` on byte-identical idempotent replay and the original job ID.

**Worker:** one lifespan task polls `jobs` with `JOB_POLL_INTERVAL_MS`, atomically claims a queued row and sets an expiring `lease_until`; claim via SQLite atomic `UPDATE ... WHERE status='QUEUED' RETURNING ...` guarded by single-process ownership. On restart, expired RUNNING leases are requeued, attempts bounded by `JOB_MAX_ATTEMPTS`; retry work is replay-safe via business unique constraints and immutable versions. Worker must not claim success if audit or case persistence fails. Processing failure leaves domain's last valid assessment and a stale/error indicator; `500` is never mapped to clinical `UNKNOWN`. Unavailable LLM does not block deterministic evaluation.

## 4. Protocol pipeline and approval gate

1. `POST /api/v1/trials/{trial_id}/protocols` accepts `multipart/form-data` (`file` and `version_label`) up to `MAX_PDF_MB`, validates PDF signature, text-extraction eligibility, synthetic-demo allowlist (no unrestricted clinical upload), stores SHA-256 and original immutable file; creates version `DRAFT`.
2. `POST .../extract` queues a job. Backend PDF parser reads pages and offset spans; agent can choose reinspection and propose `Criterion` objects with `source_quote`, page and stable span anchor, but **cannot approve**. Scanned/encrypted/incomplete PDFs mark `EXTRACTION_FAILED` or coverage blockers, not fabricated anchors; prepared bundled mock text/PDF is a *clearly labeled alternative input*, not a claim that AI extracted a broken PDF.
3. Extraction coverage records all protocol eligibility/monitoring sections as `MAPPED|INFORMATIONAL|BLOCKING`. Review UI shows original span, rule operator, units, windows, terminology-map version and unsupported content.
4. `PUT .../criteria` permits revision of `PROPOSED|NEEDS_CLARIFICATION` only; any approved content change requires a *new* version. `POST .../approve` validates **each** executable rule, qualified actor and signed coverage; adds `CriterionApproval` and `APPROVED -> ACTIVE` activation transaction if no other active version (or marks former active `SUPERSEDED`). In v1 demo, limit automatic activation to first version; future amendment activation remains P2 and separately gated.
5. Screening job snapshots approved criterion set hash and evidence IDs/versions before evaluating. No draft rule influences operational outcomes. Existing run persists unchanged under subsequent event/correction.

## 5. Patient record/fixture invariant

The 15 records must each provide **A. deterministic, source-linked structured facts** and **B. concise clinical narrative**. The narrative is not an override. Inconsistent assertions become `OpenItem(CONFLICTING_SOURCES)` and may force `UNKNOWN`; they never silently replace structured values. Clinical facts carry `value`, optional `unit`, `effective_at` or onset, `recorded_at`, `source_id`, evidence-quality and explicit evidence status. Preserve `NOT_RECORDED|EXPLICITLY_NEGATIVE|NOT_ASSESSED|NOT_APPLICABLE|UNCERTAIN|POSITIVE`, and distinguish clinical status from evidence presence. Sections: demographics/screening/site; index disease/diagnosis; conditions/surgeries/hospitalization; family/genetics; dated symptoms; serial functional/pulmonary/labs/ECG/imaging; past/current medication evidence; **separate blinded study-product exposure**; prior trial participation/last dose/half-life/restrictions; procedures; allergies/pregnancy/capacity/study-partner/administration; encounters/source index; and `open_items`. See DATA_MODEL for normalized and typed-extension tables. No direct personal identifiers beyond fictional IDs.

Fixture ID set (exactly): `P-042,P-175,P-124,P-161,P-117,P-118,P-083,P-140,P-151,P-201,P-202,P-203,P-204,P-205,P-206`. First nine retain source specification acceptance archetypes; last six respectively test age-low, age-high, unmapped code, imprecise date, unverified absence, serial declining eGFR. **Computed** cohort status totals may differ from earlier illustrative 250-patient counts; never hardcode counts or percentages. Use test-time expected statuses, not display mocks.

## 6. Event-driven targeted reevaluation (P0 backbone)

1. Validate event `patient_id`, trial, participation state, `source_event_id`, `source_version`, `effective_at`, `recorded_at`, source citation, evidence subtype, payload SHA-256; reject imported real-person identifiers. Insert immutable event and `INGEST_EVENT` job atomically; enforce unique `(patient_id,source_event_id,source_version)` and idempotency key with same-body hash.
2. Worker loads approved active protocol, fixed terminology map and latest *relevant current monitoring assessment*, indexes criteria by `clinical_subject`, approved normalized class/code, and event type. Irrelevant event logs `NO_ACTION` with zero case writes or unrelated evaluation work.
3. For a relevant event, load all conflicting and corroborating structured evidence plus explicit completeness records; choose **clinical effective time** (including late/backdated) for protocol interval math. Evaluate **only affected patient and criteria**, preserve earlier snapshots, create new immutable `PatientTrialAssessment`/`CriterionResult` and `before_assessment_id` link.
4. Rule decision and monitoring finding are deterministic: confirmed in-window `ADMINISTRATION`/reliable `REPORTED_USE` for `SYN-CLASS-R` → `PX-MON-01`, `CONFIRMED_PROTOCOL_CONFLICT`; restricted-class `ORDER`/`DISPENSE` without proven use → `PX-MON-02`, `POTENTIAL_SAFETY_REVIEW`; newly low lab → `PX-MON-03` and review; contradictory evidence → `DATA_QUALITY_DISCREPANCY`. Unknown mapping never becomes safe; no model-authored restriction.
5. One case per active issue family `(trial_id,patient_id,criterion_id,issue_key)`; one immutable `MonitoringFinding` per causally distinct event/version/criterion, linked to an existing case if relevant. Unique event/criterion/category fingerprint prevents duplicates; material later evidence may reopen a closed case via review workflow/audited system transition while preserving prior decisions.
6. Commit monitoring assessment, finding, upserted case, audit, job result atomically. If enabled, enqueue optional **separate** `AGENT_INVESTIGATION` job to fetch relevant notes and prepare evidence-linked summary; LLM failure never suppresses deterministic case or claims completeness.

**Illustrative event JSON** and exact REST types are in API_CONTRACTS. P-042's October screen remains `POTENTIAL_MATCH` historically after 2026-11-19 administration; a separate monitoring assessment/case changes. Cases never trigger treatment changes.

## 7. Configuration, files, migrations and runtime

`backend/app/core/config.py` uses Pydantic Settings to parse the documented `.env.example`. Load root `.env` in backend *only*. All secrets server-side; frontend accesses only `NEXT_PUBLIC_API_BASE_URL` (public API URL). CORS permits only `FRONTEND_ORIGIN`. `LLM_ENABLED=false` keeps local evaluator, job worker and monitoring operational; extraction must return labeled **unavailable** or use prepared non-AI rule fixture requiring approval; AI investigations show `UNAVAILABLE`, not a fabricated `SUCCEEDED`. LLM provider SDK/tool compatibility is verified at implementation time; no hard-coded model vendor behavior in contracts.

Startup commands from repository root (files are *planned implementation targets*, not delivered code):

```bash
cp .env.example .env                     # set paths / keys locally; do not commit .env
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ./backend -e ./ai          # engineer-owned package manifests
python -m alembic -c backend/alembic.ini upgrade head
python -m backend.app.seed --dataset px104-15 --reset-demo   # explicit, destructive demo-only seed
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
# another terminal:
npm --prefix frontend install
# frontend/.env.local must contain ONLY NEXT_PUBLIC_API_BASE_URL (no LLM secrets)
printf 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1\n' > frontend/.env.local
npm --prefix frontend run dev
```

SQLite URI default `sqlite:///./backend/var/protocolpulse.db` resolves relative to **root working directory**; create the directory before migration. Use SQLite `PRAGMA foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout=5000`. Alembic revision is migration authority; never mix `Base.metadata.create_all()` into production/demo startup. Schema version, protocol version, approved criterion set hash, engine version (`ENGINE_VERSION` frozen string), terminology-map version and seed version are independently persisted and returned when relevant. Corrections create new evidence versions/events; no destructive overwrites of audit history.

## 8. Errors, observability and failure modes

Every JSON response uses header `X-Request-ID` (generated UUID/ULID if absent), and body includes `request_id` for structured result objects. Error envelope: `{"error":{"code":"...","message":"...","details":[{"field":"...","reason":"..."}],"retryable":false},"request_id":"..."}`. `400` invalid operation, `401` missing demo actor, `403` simulated role disallowed, `404` not found in scoped trial, `409` conflict/ETag/idempotency collision, `413` PDF oversize, `422` schema/semantic validation, `429` model quota if applicable, `500` unhandled, `503` readiness/AI unavailable as appropriate. Never leak note text or key material in logs.

Audit records contain request/correlation ID, actor/role, action, target IDs/version, input/output hashes, time UTC, outcome and case/review references. Agent trace is **tool name + input ID references + outcome category + elapsed time + error**, not chain-of-thought. Failed jobs retain error code, attempts, retryability and previous valid snapshot ID. Health includes API/database/worker readiness; do not report `healthy` if migrations are missing.

Threat boundary: uploaded protocol pages and patient narratives are untrusted *data*, including prompt injections. AI tool router only authorizes whitelisted read-scoped operations and optional verification-task proposals; never honors instructions embedded in source content. Mock actors are openly nonsecure demonstration identities.

## 9. Test pyramid and acceptance mapping

- **Engine pure/unit:** age-at-screen; lab date-inclusivity and units; source completeness; all six explicit evidence states; interval endpoints across Athens DST; partial dates; order vs dispense vs administration; unknown class; contradictory notes; `FAIL > UNKNOWN > all PASS`; operational error separately.
- **Database/transaction:** unique version and event keys; failed audit rolls back case; expired lease replay; correction/upsert preserves historical records; approval cannot be forged by coordinator; duplicate submission yields one finding.
- **API contract:** Pydantic schema, OpenAPI generation, `401/403/409/422`, page cursors, idempotency replay, `202→GET jobs→200` correlation, no hidden endpoints.
- **Agent eval:** real dynamic tool selection and branch/no evidence, prompt injection, citation verification, bounded steps, `LLM_ENABLED=false` accurate status. Do not require LLM for AC-01–10 deterministic correctness.
- **End-to-end:** J-01 through J-06 and AC-01–10, AC-12–20 (AC-11 P2) using exactly 15 patients; scripted P-042 approval→screen→participation→day-18 administration→case→investigator acknowledge/close→audit; unrelated event no case; duplicate no duplicate; late effective event and stale job indicator.
- **Nonfunctional proof:** measured screening time on actual 15-patient dataset (source's 250-record under-10s target is not automatically evidence about this demo); measured event-to-case latency where tested. No unsupported clinical-efficacy or compliance claims.

## 10. Contract scope and cross-references

API types, operation IDs and all extra necessary paths: [API_CONTRACTS.md](API_CONTRACTS.md). Persistence and 12-section history mapping: [DATA_MODEL.md](DATA_MODEL.md). Tool specs/LLM OFF truthfulness: [AGENT_DESIGN.md](AGENT_DESIGN.md). Ownership: [TEAM_OWNERSHIP.md](TEAM_OWNERSHIP.md). Time gates: [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md). `.env.example` is the sole variable-name authority. **No `PROJECT_CONTEXT.md` at this stage**; Stage 2.1 derives it after human contract approval.
