# ProtocolPulse — Project Context

**Freeze manifest:** `PP-S2-CF-20261114-01` · **Revision:** `1.0.0-rc2` · **Status:** APPROVED documentation design · **Synchronized:** 2026-11-14.

**Approval basis:** the user authorized the documentation maintainer to choose and reconcile discrepancies. This revision supersedes the prior candidate revision; product specification is v1.1, fictional clinical protocol remains PX-104 v1.0. This records design approval only. Engineer acknowledgements, worktrees, application code, clinical rule approvals and runtime validation remain pending.

## 1. Mission, lifecycle and authority

ProtocolPulse turns a fictional protocol into reviewed, source-linked rules, screens synthetic candidates, then monitors participating patients for relevant new evidence. **Recruitment:** upload → propose rules/coverage → investigator approval → deterministic screening → evidence investigation → investigator disposition. **Monitoring:** separately record external participation → ingest dated event → reevaluate affected rules → deduplicated case → human review → audit. Screening never enrolls a patient.

Actors: `COORDINATOR` prepares protocols/screens/events; `INVESTIGATOR` approves rules and records clinical dispositions/participation and case closure; `MONITOR` triages/assigns/investigates; `AUDITOR` reads evidence/audit; `SPONSOR_OPS` sees aggregates; `RESEARCH_IT` manages technical setup/imports. Named synthetic actors and site scope are demo controls, not production authentication.

Synthetic-only; no real records/EHR access, outreach, diagnosis, pharmacological inference, treatment/prescription changes, automatic enrollment/withdrawal, SAE reporting or compliance/clinical-validation claims. Missing evidence is not negative evidence; an order or dispense is not ingestion. Clinical decisions remain human. See [product §§1–4, 7–8](PRODUCT_SPECIFICATION.md).

## 2. Modules and priority journey

Six P0 modules: **J-01 Trial Setup**, **J-02 Patient Selector**, **J-03 Patient 360**, **J-04 Safety Monitor**, **J-05 Clinical Review Queue**, **J-06 Agent Activity & Audit**. J-07 Amendment Impact is P2.

Priority slice: reset 15 patients → investigator `ACT-INV-01` reviews eight anchored rules and coverage → approve/activate → screen for `2026-10-31` → open P-042 evidence → investigator records external `PARTICIPATING` reference → post day-18 administration → await job → inspect one linked case → investigator acknowledges/investigates/resolves/closes with evidence and rationale → inspect audit. Historical screening stays unchanged. [Development plan §6](docs/DEVELOPMENT_PLAN.md#6-high-value-integration-script-and-expected-assertions) defines assertions.

## 3. Stack, paths and local launch

Frozen: `frontend/` Next.js App Router, React, TypeScript, Tailwind; `backend/` Python **3.12**, FastAPI, Pydantic **v2**, SQLAlchemy **2.0**, Alembic, SQLite WAL, pytest; `ai/` Python 3.12, Pydantic, optional tool-capable provider. Other exact package versions/model are unchosen; IC owns manifests/lockfile. No Redis/Celery/vector database. One Uvicorn process, one durable SQLite job runner; no horizontal scaling.

Commands below are **planned implementation contracts**, run from repository root after those packages/files exist; no application exists in this documentation handoff. POSIX-shell setup from [architecture §7](docs/SYSTEM_ARCHITECTURE.md#7-configuration-files-migrations-and-runtime):

```bash
cp .env.example .env
python3.12 -m venv .venv && source .venv/bin/activate
pip install -e ./backend -e ./ai
mkdir -p backend/var/protocols
python -m alembic -c backend/alembic.ini upgrade head
python -m backend.app.seed --dataset px104-15 --reset-demo
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
# another terminal:
npm --prefix frontend install
printf 'NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1\n' > frontend/.env.local
npm --prefix frontend run dev
```

Reset is destructive to the local synthetic dataset and requires deliberate confirmation. Startup never auto-seeds or uses `create_all()`. Root `.env` is backend-only; browser configuration contains only `NEXT_PUBLIC_API_BASE_URL`. Defaults: DB `sqlite:///./backend/var/protocolpulse.db`, immutable PDF store `./backend/var/protocols`, UI `http://localhost:3000`. Never commit `.env`, keys or `backend/var/**`. [`.env.example`](.env.example) governs variable names/defaults.

## 4. System map and wire conventions

```text
Next.js UI :3000
  | /api/v1 JSON; multipart PDF; demo actor + mutation headers
  v
FastAPI :8000 -> role/validation guards -> deterministic services
  |                         |                     |
  v                         v                     v
SQLite WAL <---------- durable job runner      private PDF store
  ^                         |
  |                 E2 agent_adapter.py
  |                         v
  +-- scoped EvidenceGateway <-> ai/entrypoints.py -> optional LLM
       reads/task proposals      one coordinator, four logical roles
```

API base: `http://127.0.0.1:8000/api/v1`. `Envelope<T>={data:T,request_id:string}`; collection `Page<T>` includes `items` and cursor `page`; errors use `ErrorEnvelope={error:{code,message,details,retryable},request_id}`. JSON responses include `X-Request-ID`; request/correlation identifiers are UUIDs. `X-Demo-Actor-Id` is required except health. POST requires `Idempotency-Key`; PUT/PATCH and approval POST require `If-Match`; PATCH also requires matching `expected_revision`. Identical replay preserves IDs; changed hash/revision conflicts return 409.

`202` means accepted durable work; poll `GET /api/v1/jobs/{job_id}`. Job kinds: `PROTOCOL_EXTRACT|SCREEN_COHORT|INGEST_EVENT|AGENT_INVESTIGATION`. Job success is `SUCCEEDED`; screening run completion is `COMPLETE`; baseline readiness requires both. Event replay returns `200`, same event/job, `deduplicated:true`. Required nullable fields remain present. `*_at` inputs are offset-aware RFC3339, outputs UTC `Z`; `*_date` uses site-local calendar. [API §§1–2](docs/API_CONTRACTS.md) governs full types.

## 5. Entity glossary and exact states

`Trial` owns versions/site/calendar; `ProtocolVersion` owns immutable PDF/hash; `Criterion` is one approved atomic rule; `ExtractionCoverage` accounts for every relevant clause. Versioned facts and `EvidenceSource`/`SourceSpan` establish provenance; `EvidenceSnapshot` freezes exact membership. `ScreeningRun` groups baseline work; immutable `PatientTrialAssessment`/`CriterionResult` records outcomes. `PatientEvent` is immutable source/version input; `MonitoringFinding` records a causal issue; `ReviewCase` groups its lifecycle. `ReviewDecision`, `ScreeningDisposition`, `ParticipationRecord` and `AuditEntry` preserve attributed history. `AgentExecution` records observed tools/results; `Job` records durable work. [Data model](docs/DATA_MODEL.md) governs tables/keys.

| Domain | Exact states |
|---|---|
| Criterion result | `PASS|FAIL|UNKNOWN` |
| Candidate | `POTENTIAL_MATCH|NEEDS_REVIEW|PROTOCOL_CONFLICT` |
| Evaluation | `COMPLETE|EVALUATION_ERROR`; error means `candidate_status=null` |
| Job | `QUEUED|RUNNING|SUCCEEDED|FAILED` |
| Screening run | `QUEUED|RUNNING|COMPLETE|FAILED` |
| Protocol | `DRAFT|EXTRACTING|EXTRACTION_REVIEW|EXTRACTION_FAILED|APPROVED|ACTIVE|SUPERSEDED` |
| Criterion workflow | `PROPOSED|NEEDS_CLARIFICATION|APPROVED|REJECTED` |
| Candidate workflow | `NOT_REVIEWED|REVIEW_PENDING|INVESTIGATOR_DISPOSITIONED` |
| Participation | `NOT_ENROLLED|PARTICIPATING|ENDED` |
| Review case | `OPEN|ACKNOWLEDGED|INVESTIGATING|RESOLVED|CLOSED|REOPENED` |
| Agent | `QUEUED|RUNNING|SUCCEEDED|FAILED|UNAVAILABLE|PARTIAL` |
| Evidence | `NOT_RECORDED|EXPLICITLY_NEGATIVE|NOT_ASSESSED|NOT_APPLICABLE|UNCERTAIN|POSITIVE` |

Baseline aggregates **five eligibility rules**: any `FAIL` → `PROTOCOL_CONFLICT`; otherwise any `UNKNOWN` → `NEEDS_REVIEW`; otherwise all `PASS` → `POTENTIAL_MATCH`. Operational error is separate. Persisted finding categories: `CONFIRMED_PROTOCOL_CONFLICT|POTENTIAL_SAFETY_REVIEW|DATA_QUALITY_DISCREPANCY|POSSIBLE_PROTOCOL_DEVIATION`; `NO_ACTION` is relevance trace only. Priorities `HIGH|MEDIUM|LOW` are workflow labels. Screening dispositions: `INVITE_FOR_FORMAL_SCREENING|NOT_SUITABLE|SEEK_MORE_INFORMATION`.

Medication evidence: `ORDER|DISPENSE|ADMINISTRATION|REPORTED_USE|DISCONTINUATION|CANCELLATION`; blinded study product stays separate. Evidence quality `HIGH|MODERATE|LOW|UNVERIFIED`, verification `VERIFIED|UNVERIFIED|CONFLICTED`, clinical condition state `ACTIVE|RESOLVED|SUSPECTED`, date precision `INSTANT|DAY|MONTH|YEAR|UNKNOWN`. Coverage is `MAPPED|INFORMATIONAL|BLOCKING`. Full reason codes and remaining DTO enums: [API §2](docs/API_CONTRACTS.md#2-canonical-typescript-api-dtos-normative-field-presence).

## 6. Exact route inventory

All **26** method/path pairs from [API_CONTRACTS §3](docs/API_CONTRACTS.md#3-endpoint-operations-and-exact-requestresponse-dto-mapping); consult that table for bodies, roles, filters and response types.

| Method | Absolute path |
|---|---|
| GET | `/api/v1/health` |
| GET | `/api/v1/trials` |
| POST | `/api/v1/trials` |
| GET | `/api/v1/trials/{trial_id}` |
| GET | `/api/v1/trials/{trial_id}/protocols` |
| POST | `/api/v1/trials/{trial_id}/protocols` |
| GET | `/api/v1/trials/{trial_id}/protocols/{version_id}` |
| POST | `/api/v1/trials/{trial_id}/protocols/{version_id}/extract` |
| PUT | `/api/v1/trials/{trial_id}/protocols/{version_id}/criteria` |
| POST | `/api/v1/trials/{trial_id}/protocols/{version_id}/approve` |
| POST | `/api/v1/trials/{trial_id}/screenings` |
| GET | `/api/v1/screenings/{run_id}` |
| GET | `/api/v1/screenings/{run_id}/assessments` |
| GET | `/api/v1/trials/{trial_id}/patients/{patient_id}` |
| POST | `/api/v1/patients/{patient_id}/events` |
| GET | `/api/v1/trials/{trial_id}/findings` |
| GET | `/api/v1/trials/{trial_id}/cases` |
| GET | `/api/v1/cases/{case_id}` |
| PATCH | `/api/v1/cases/{case_id}` |
| GET | `/api/v1/agent-executions/{execution_id}` |
| GET | `/api/v1/trials/{trial_id}/audit` |
| GET | `/api/v1/jobs/{job_id}` |
| GET | `/api/v1/trials/{trial_id}/evidence/{source_id}` |
| POST | `/api/v1/trials/{trial_id}/patients/{patient_id}/dispositions` |
| POST | `/api/v1/trials/{trial_id}/patients/{patient_id}/participation` |
| POST | `/api/v1/agent-investigations` |

No hidden business routes; `/openapi.json`, `/docs`, `/redoc` are framework documentation only. v1 approval activates the first version; replacement/amendment activation requires a future coordinated extension.

## 7. Agent roles, tools and human gates

Only boundary: async `ai.entrypoints.run_agent(request: dict, gateway: AsyncToolGateway) -> dict`; E2 adapter validates `AgentRequest`/`AgentResult`, injects scope and persists execution. AI cannot import backend models, open DB or fetch patient data through raw HTTP. `CriterionDraft` uses exact API `CriterionDraftInput` fields.

| Logical role | Named capabilities (subject to per-tool allowlist) |
|---|---|
| `PROTOCOL_INTELLIGENCE` | `parse_protocol`, `locate_clause`, `validate_rule_schema`, `report_coverage`; internal `propose_rule` |
| `EVIDENCE_INVESTIGATOR` | `retrieve_patient_evidence`, `search_notes`, `get_lab_history`, `get_condition_history`, `get_medication_timeline`, `get_evidence_link`, `request_verification_task` |
| `MEDICATION_SAFETY_INVESTIGATOR` | Evidence/notes/timeline, `resolve_approved_terminology`, `evaluate_approved_rule`, `request_verification_task`, `request_med_reconciliation` |
| `MONITORING_WORKFLOW` | Evidence/labs/terminology/source/rule reads, `classify_event_relevance`, `get_prior_evaluation`, `get_case_status`, `request_verification_task`; internal `draft_review_summary` |

Backend-only writes: `reevaluate_affected`, `create_or_update_finding`, `append_audit`; never model-callable. AI task proposals cannot resolve facts or close cases. Investigator alone approves rules/coverage, records dispositions/participation and resolves/closes cases. Source text is untrusted data. Trace contains tool/reference IDs, result and duration; no chain-of-thought. Exact permissions: [AGENT_DESIGN §4](docs/AGENT_DESIGN.md#4-tool-catalogue-typed-schema-authorization-semantics).

## 8. Ownership and change procedure

| Owner | Exclusive paths |
|---|---|
| E1 | `frontend/app/**`, `frontend/components/**`, `frontend/lib/api/**`, `frontend/tests/**`, `frontend/tailwind.config.ts` |
| E2 | `backend/app/**` including `integrations/agent_adapter.py` and `evidence_gateway.py`; `backend/alembic/**`, `backend/alembic.ini`, `backend/tests/**` |
| E3 | `ai/**` except `ai/pyproject.toml`; includes `ai/entrypoints.py`, agents/tools/prompts/evals/tests |
| IC | Product/context, `docs/**`, `contracts/**`, root configuration/README/Makefile/CI; `frontend/package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`; `backend/pyproject.toml`, `ai/pyproject.toml` |

`backend/var/**` is uncommitted runtime output. Unlisted paths need IC assignment. Branches planned: `feat/frontend`, `feat/backend`, `feat/ai`; integration branch `master`. Only IC accepts shared-contract changes and merges: proposal with affected types/routes → IC review → source/contract revision bump → owners update/rebase and verify. No cross-owner one-line fixes. Exact tree: [TEAM_OWNERSHIP](docs/TEAM_OWNERSHIP.md).

## 9. Synthetic seed, dates and replay

`SEED=10415`, `DEMO_SEED_VERSION=px104-15-v1`, `ENGINE_VERSION=px104-eval-v1`, `SYNTHETIC_DATA_ONLY=true`. Exactly `P-042,P-175,P-124,P-161,P-117,P-118,P-083,P-140,P-151,P-201,P-202,P-203,P-204,P-205,P-206`; all have 12 source-linked sections plus narrative. Reset leaves draft rules; approval and screening follow through normal services.

Archetypes: P-042 match/later event; P-175 excluded condition; P-124 missing/stale lab; P-161 low eGFR; P-117 in-window use; P-118 outside-window use plus reconciliation; P-083 order-only; P-140 conflicting notes; P-151 irrelevant event. P-201–206: age-low, age-high, unmapped code, partial date, unverified absence, serial eGFR decline. [Product §§8, 14–15](PRODUCT_SPECIFICATION.md) and [data model §6](docs/DATA_MODEL.md#6-exact-15-patient-fixture--source-sections) govern inputs.

Rules: `PX-INC-01` age 40–70; `PX-INC-02` confirmed `SYN-CONDITION-A`; `PX-INC-03` eGFR ≥60; `PX-EXC-01` no confirmed active excluded condition; `PX-EXC-02` reconciled no restricted use. Monitoring: `PX-MON-01` confirmed use, `PX-MON-02` order/dispense without use, `PX-MON-03` new low eGFR. `SYN-MED-R1/R2→SYN-CLASS-R`; `SYN-MED-N1→SYN-CLASS-N`; no real pharmacology.

`Europe/Athens`: screen `2026-10-31`, day 0 `2026-11-01`, day 18 `2026-11-19`. Medication window `[2026-10-01,2026-10-31)`; lab specimen dates inclusive `[2026-10-01,2026-10-31]`. Baseline cutoff `2026-11-01T00:00:00+02:00` = `2026-10-31T22:00:00Z`.

Replay procedure: record P-042 participation; submit [API §4 event JSON](docs/API_CONTRACTS.md#4-concrete-requestresponse-examples-timestamps-causality-errors) with clinical time `2026-11-19T09:30:00+02:00`, recorded time `2026-11-20T11:00:00+02:00`; poll job and retrieve finding/case. Resubmit identical source ID/version/body: same IDs, no duplicate case. A changed same-version payload is 409; correction uses new source version and `supersedes_event_id`. Late evidence creates new snapshots, preserving historical screen. Evaluation replay requires original rules, engine, map and evidence snapshot; unavailable engine yields `REPLAY_UNAVAILABLE`.

## 10. Verification and fallback modes

Planned commands, from root after implementation:

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run test
npm --prefix frontend run build
python -m pytest backend/tests ai/tests -q
python -m ai.evals.run_evals
```

Required release scenarios: AC-01–10, AC-12–14, AC-16–18, AC-20; AC-15/19 robustness; AC-11 P2. Check H6 real smoke, H10 core event/case, H14 integration, H17 quality, H20 release; all runtime gates remain pending. [Ownership §5](docs/TEAM_OWNERSHIP.md#5-mandatory-owner-tests-and-handoff-proof) assigns verification.

Gateway timeout **5s**, model invocation **10s**, execution deadline **30s**, max **8** gateway calls including retries; all operations respect remaining deadline. Keys: `TOOL_TIMEOUT_SECONDS`, `LLM_CALL_TIMEOUT_SECONDS`, `AGENT_TIMEOUT_SECONDS`, `MAX_AGENT_STEPS`. Worker: poll 500ms, lease 60s, max 3 job attempts, retry backoff 2s, batch 1.

LLM off: deterministic screening/events/cases continue; curated rule fixture must be labeled and investigator-approved. Agent output is `UNAVAILABLE`; explicit investigation POST returns `503 AGENT_UNAVAILABLE` without fake job. Unreadable PDF/coverage gaps block activation; unsupported citations fail verification. Missing/stale/conflicting evidence yields `UNKNOWN`; infrastructure failure yields operational error/stale prior result. Audit/case persistence failure rolls back the worker transaction; accepted event survives for bounded retry. No fabricated counts, tools or success badges.

## 11. Decision register and fixed constraints

[Architecture §11](docs/SYSTEM_ARCHITECTURE.md#11-architecture-decision-register--approved-at-100-rc2) is the decision register: **ADR-01** design approval; **02** 15 patients/five eligibility/eight approved rules; **03** job/run status distinction; **04** Unicode spans; **05** split timeouts; **06** backend authority/exact agent draft schema; **07** revision-gated first activation; **08** domain precedence/IC ownership; **09** date windows/watermark; **10** valid unmapped evidence/draft seed.

Do not independently change route/type/enum names, nullability, clinical rule semantics/IDs, dates/windows, 15-patient registry, terminology, immutable provenance, approval gates, timeout budgets, import boundary, ownership, manifests or worker topology. Text spans are zero-based end-exclusive Unicode code points into persisted page/note text; byte hashes and JS UTF-16 indices are distinct.

## 12. Sources and precedence

Authoritative detail: [product v1.1](PRODUCT_SPECIFICATION.md), [architecture](docs/SYSTEM_ARCHITECTURE.md), [agent design](docs/AGENT_DESIGN.md), [API contracts](docs/API_CONTRACTS.md), [data model](docs/DATA_MODEL.md), [ownership](docs/TEAM_OWNERSHIP.md), [development plan](docs/DEVELOPMENT_PLAN.md), [configuration](.env.example).

Approved **API_CONTRACTS**, **DATA_MODEL** and **TEAM_OWNERSHIP** govern their respective domains. Product governs mission, clinical semantics and safety; architecture/agent design govern implementation boundaries; configuration governs variable names. This context is derived. **All disagreements require coordinator review and a versioned revision, never local reinterpretation.** No unresolved documentation discrepancies are recorded for this revision; runtime behavior remains unverified.
