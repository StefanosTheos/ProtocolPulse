# ProtocolPulse — 20-Hour Parallel Development and Release Plan

**Contract freeze:** `PP-S2-CF-20261114-01`, version `1.0.0-rc2`. **Approval status:** APPROVED documentation design; approval basis in [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md). Time windows are **elapsed hackathon hours**, not promises or completed milestones. Exactly 3 engineers + coordinator integration duty (the coordinator can be one of the engineers acting only on owned IC paths). Build the full evidence-backed protocol→selection→event→case→human review→audit slice. The sole seed cohort has **15** fully synthetic patients with the 12-section blueprint, consistent with product v1.1. Runtime implementation, engineer acknowledgements and release checks remain pending.

## 1. Frozen P0 acceptance and prioritization

**P0 = genuinely functional**: one fictional 12-week PX-104 v1.0 protocol with source PDF and eight annotated rules (five eligibility, three monitoring); signed individual rule and coverage approval by a named synthetic investigator; deterministic screening of all 15 patients with `PASS/FAIL/UNKNOWN`; source-linked Patient 360 and 12 reusable history sections; medication order vs administration and complete/uncertain washout; `PARTICIPATING` only via separately human-recorded external evidence; day-18 event -> targeted monitoring reevaluation -> before/after link -> one deduplicated review case -> investigator decisions -> audit; six screens J-01–J-06; proper job/error statuses. AI investigator may run dynamically when enabled; absent provider must be honestly `UNAVAILABLE` while core product works.

**P1 conditional after P0 green**: more robust AI protocol coverage, note-driven evidence branch, pagination polish, accessible table improvements, richer audit replay. **P2 strictly stretch**: amendment impact, local synthetic FHIR import, multitrial dashboard, vector search, fancy analytics. **No live hospital, real data, treatment action, pharmacological inference, or clinical compliance claim.**

**Definition of done:** A resettable database/API and actual browser UI can perform the source-grounded workflow, with persisted source IDs, approved criterion versions, calculated (not hardcoded) status counts, job polling, event causality, evidence-linked case, unique deduplication, named actor/timestamped human review and retrievable audit. A screenshot, mock-only list, fake success toast or model-written conclusion without backend side effect is **not done**.

## 2. Critical-path schedule, gates and accountability

| Elapsed | Critical path / exact mandatory gate | E1 frontend | E2 backend | E3 AI | IC decision |
|---|---|---|---|---|---|
| **H0–H1** | Review approved source, 15 fixtures, 8 rules, 20 AC identifiers, dates, status enums, 12-section DTOs | Mark UI dependencies | Inspect rule/data contract | Inspect available tools/capabilities | Confirm workstream readiness against approved scope |
| **H1–H2** | Each engineer acknowledges `PP-S2-CF-20261114-01 / 1.0.0-rc2` before coding | Accept `Envelope<T>` and routes | Accept DTO, migrations and event/key | Accept `run_agent`/gateway schema | Record acknowledgements and assign human IC; documentation approval is already recorded |
| **H2–H4** | Parallel scaffolds + meaningful mocks | Create six routes, API type/client, fake fixture transport | FastAPI lifespan, SQLite migration, actor/approval tables, jobs scaffold | Entry point with fake gateway and role evaluation fixtures | Ensure ownership and package manifests |
| **H4–H6** | **H6 FIRST REAL SMOKE**: protocol fetch/approval → actual screen → one Patient360 | Replace mock trial and selector calls with real API; poll jobs | Seed 15, signed rule fixture, deterministic evaluator, GET/POST routes | Implement protocol/evidence tools with mock snapshots; dynamic tests | Inspect OpenAPI vs TypeScript; patch only via revision |
| **H6–H8** | End-to-end day-18 backend behavior | Event simulator and monitor/case UI with pending/stale state | Event T1/T2, affected-rule dependencies, findings and dedup case | Medication order→timeline→verification branch | Test AC-07–10 without waiting for AI |
| **H8–H10** | Parallel workstream exit / vertical-slice ready | All six screens readable/keyboard navigable, case actions and audit | Case lifecycle, reviewer disposition/participation and source links | LLM provider adapter behind enabled flag, citation checks, OFF tests | Contract change cutoff; unresolved P0 blockers named |
| **H10–H12** | Integrate all three worktrees | Real API in screens; no visible fake aggregate | Adapter calls E3 `run_agent`; job execution and failures | Actual gateway tools, bounded and verified trace | Run P-042 path; repair transport or schema breaks |
| **H12–H14** | Integration stability, demo story | Refine evidence timeline and case details | Reconcile data seed, event replay, audit chain, role access | Investigative branch for P-140 and P-083, graceful failures | End-to-end AC matrix, demo reset verified |
| **H14–H15.5** | Test/repair loop **E/F iteration 1** | Fix UIs where engine states unclear | Fix false pass/duplicate/temporal bugs | Fix unsafe trace/incorrect tool choices | Rank blockers, assign only respective owners |
| **H15.5–H17** | Test/repair loop **E/F iteration 2** then quality gate | Accessibility and responsiveness | Migrations, rollback and failure tests | Prompt-injection and OFF evaluation | Freeze feature list; no new P2 if P0 unstable |
| **H17–H19** | Capture **2–3-minute** real UI walkthrough/video, voice-over+subtitles, final README/submission | Run demo navigation and clean UI | Ensure reset + stable API/jobs/data | Verify truthful visible agent trace | Coordinate screencapture/editing; verify claims and evidence |
| **H19–H20** | Release freeze, smoke, upload/submission | Build + click-through no code changes except critical | API tests and deterministic reset | Tool branch smoke/offline fallback | Tag release; publish known limitations and contract result |

**E/F iteration** here means repeated structured evaluation (E) → targeted fixes (F) → re-evaluation on product acceptance scenarios; it does not grant any developer authority to rewrite shared contracts unilaterally. H6 smoke is deliberately earlier than H10 integration so contract problems surface while enough time remains.

## 3. Engineer 1 — Frontend ordered task list (exclusive files)

| Order / deadline | Exact owned files | Dependency; mock-first → real test; exit |
|---|---|---|
| 1 H2–3 | `frontend/lib/api/types.ts`, `client.ts`, `endpoints.ts`, `mocks.ts` | Copy required/nullable DTOs from API_CONTRACTS; error envelope, typed role header, idempotency and job polling; mocked `202` must transition only on polling result; `contract.test.ts` asserts shapes |
| 2 H2–4 | `frontend/app/layout.tsx`, `frontend/app/page.tsx`, `frontend/app/trials/[trialId]/page.tsx`, `frontend/app/globals.css`, `frontend/components/SyntheticNotice.tsx`, `TrialHeader.tsx` | Visible fictional/synthetic badge and stage navigation; avoid clinical-safety language; keyboard focus |
| 3 H3–5 | `frontend/app/trials/[trialId]/protocol/page.tsx`, `ProtocolCoverageReview.tsx` | render real PDF source anchors, blocking/unapproved rows, manual review and approve control; no unconditional green success; simulate mock approval error then connect real |
| 4 H4–6 | `frontend/app/trials/[trialId]/selector/page.tsx`, `CandidateTable.tsx` | use `POST screenings`, `GET jobs`, `GET assessments` and derive counts. Filter `POTENTIAL_MATCH`, `NEEDS_REVIEW`, `PROTOCOL_CONFLICT`, error separately; P-042 clickable |
| 5 H5–8 | `frontend/app/trials/[trialId]/patients/[patientId]/page.tsx`, `EvidenceTimeline.tsx` | 12 sections; source/record/effective dates and evidence six-state labels; narrative conflict callout; distinguish `ORDER` vs `ADMINISTRATION`; no negative-by-omission |
| 6 H6–9 | `frontend/app/trials/[trialId]/monitor/page.tsx`, `EventSimulator.tsx`; `frontend/app/trials/[trialId]/cases/page.tsx`, `CaseReviewPanel.tsx` | send specific event on day 18 with different effective/recorded timestamps; show pending job, assessment delta, case evidence and role-based PATCH; duplicate replay no second card |
| 7 H8–10 | `frontend/app/trials/[trialId]/audit/page.tsx`, `frontend/tests/contract.test.ts`, `flow.test.tsx` | show audit/agent traces without chain-of-thought; source IDs, status and attribution; tests against mock and real server |
| 8 H10–17 | existing E1 files only | swap mock adapter to live, fix contract differences only with IC approval; accessibility/`npm --prefix frontend run typecheck && ... test && ... build` |

**E1 risks:** UI assumptions of immediate `202` success; invented counts/cases; mock forms accepting undefined values; accidentally bundling LLM keys; unreadable source uncertainty. **Fallback:** remove animations/charts and use text-first tables, never replace real functional endpoints with fabricated success.

## 4. Engineer 2 — Backend ordered task list (exclusive files)

| Order / deadline | Exact owned files | Dependencies; invariant and test |
|---|---|---|
| 1 H2–3 | `backend/app/main.py`, `core/config.py`, `core/actors.py`, `db/base.py`, `db/session.py`, `schemas/common.py`, `api/routes_health.py`, `tests/test_api_contract.py` | Pydantic settings `.env.example`, actor guard, request_id, error envelope, SQLite WAL, honest health; `/openapi.json` matches routes |
| 2 H2–4 | `backend/app/models/core.py`, `clinical.py`, `assessment.py`, `workflow.py`, `backend/alembic/env.py`, `versions/0001_initial.py`, `backend/alembic.ini` | explicit FK/UQ/index/UTC/checks; migration applies to clean DB, no create_all startup |
| 3 H3–5 | `backend/app/seed.py`, `services/pdf_extractor.py`, `services/approval.py`, `api/routes_protocols.py`, `routes_trials.py`, `tests/test_approval.py` | 15 rich synthetic source-backed records, initial prepared mock PDF, all eight rule IDs, reviewer and coverage signoff; no unsourced PASS |
| 4 H4–6 | `services/evidence.py`, `services/evaluator.py`, `api/routes_screening.py`, `routes_patients.py`, `services/jobs.py`, `api/routes_jobs.py`, `tests/test_evaluator.py`, `test_jobs.py` | deterministic `FAIL>UNKNOWN>all PASS`, immutable snapshot and job polling; H6 smoke; scenario P-042, P-175, P-124, P-161, P-117, P-118 |
| 5 H6–8 | `services/event_processor.py`, `services/monitoring.py`, `api/routes_events.py`, `tests/test_event_idempotency.py` | event T1/T2, timestamp separation, affected criteria only, unique case and finding; AC-07–10/15/20 |
| 6 H7–10 | `services/case_workflow.py`, `services/audit.py`, `api/routes_cases.py`, `routes_audit.py`, `routes_agents.py`, `tests/test_case_workflow.py` | human record/disposition, role/revision gate and audit, evidence links and agent retrieval, failure rollback |
| 7 H10–12 | `backend/app/integrations/agent_adapter.py`, `evidence_gateway.py` | consume E3 entrypoint without importing E3 internals; no LLM call within DB transaction; whitelist tools and verify cited IDs |
| 8 H12–17 | existing E2 files only | full pytest, invalid PDF/error cases, correction replay, seed reset, no 401/403 bypass; `alembic upgrade head` and real event roundtrip |

**E2 risks:** overengineering 12 clinical sections; SQLite/ORM migration clashes; ambiguous date windows; long LLM transaction; mismatch with E3 gateway; converting order/absence to pass. **Fallback:** typed clinical/core tables + versioned `PatientFact` for long-tail, SQLite one-worker job queue, approved curated fixture if AI off. Never cut temporal semantics, approval or audit.

## 5. Engineer 3 — AI ordered task list (exclusive files)

| Order / deadline | Exact owned files | Dependency; observable exit |
|---|---|---|
| 1 H2–3 | `ai/__init__.py`, `ai/entrypoints.py`, `ai/tools/schemas.py`, `fake_gateway.py`, `ai/tests/test_llm_disabled.py` | serialize `AgentRequest`/`AgentResult` exact wire contract; **`UNAVAILABLE`** when off, no fake tool calls |
| 2 H3–5 | `ai/agents/coordinator.py`, `ai/tools/selection.py`, `ai/prompts/system.py`, `roles.py`, `ai/tests/test_branching.py` | step/time limits, model-selected one-of allowed tools, no approval/enrollment tools, reference-only trace |
| 3 H4–6 | `ai/agents/protocol_intelligence.py`, `evidence_investigator.py`, `ai/evals/fixtures.py` | source span verification, missing eGFR branch (P-124), ambiguous PDF blocker and verification tasks |
| 4 H5–8 | `ai/agents/medication_investigator.py`, `monitoring_workflow.py`, `ai/evals/run_evals.py` | P-083 order-only vs P-042 administration branch, P-140 contradictory notes, `SYN-MED-N1` ignore; deterministic status is passed in, never model-assigned |
| 5 H7–10 | `ai/tests/test_prompt_injection.py`, `test_branching.py`, `ai/tools/*` | injection in PDF/note ignored, unsupported source ID rejected, bounded calls, fallback `PARTIAL`/`FAILED`; provider adapter configurable; verify SDK tool-calling interface when actually integrating |
| 6 H10–14 | `ai/entrypoints.py`, `ai/agents/*`, `ai/evals/*` | integrate through backend's actual gateway; record real dynamic tool traces and verified citations; no import of backend models or DB |
| 7 H14–17 | existing E3 files only | `python -m pytest ai/tests -q && python -m ai.evals.run_evals`; compare tool selection when data differs; AI-off path passes |

**E3 risks:** decorative agent (fixed scripted summary); model invents codes or confidence; brittle live provider; unsupported source spans; accidental tool writes. **Fallback:** AI marked unavailable and deterministic evaluator's explanation shown as a system result; if provider works, ship a bounded demonstrable P-083/P-140 evidence branch rather than an elaborate multi-agent framework.

## 6. High-value integration script and expected assertions

1. **Reset** `python -m backend.app.seed --dataset px104-15 --reset-demo`; `GET health` ready and `GET trials` one PX-104 trial. Show PDF and eight proposed rule anchors. Mock investigator `ACT-INV-01` approves eight rules + complete coverage (approved set hash persisted).
2. `POST screenings` for 2026-10-31, poll `GET jobs/{id}` to `SUCCEEDED`, verify screening run `COMPLETE`, then `GET assessments`. Exactly **15** records; count totals sum to 15, P-042 and P-118 `POTENTIAL_MATCH`, P-175/P-161/P-117 `PROTOCOL_CONFLICT`, P-124/P-083/P-140 `NEEDS_REVIEW`. Other seven fixture statuses (P-151 plus P-201–P-206) come from real evidence. Confirm no patient auto-enrolled.
3. Open Patient 360: medication evidence type, clinical-effective vs recorded dates, explicit reconciled no-use, notes, labs, source links and `open_items`; show P-083 `ORDER_ONLY`, P-140 `CONFLICTING_SOURCES` rather than clinical pass/fail by inference.
4. Investigator records a synthetic **external** participation reference for P-042 (`PARTICIPATING`); it is not a system enrollment action. Post day-18 `SYN-MED-R1/ADMINISTRATION` with `effective_at=2026-11-19T09:30:00+02:00` and `recorded_at=2026-11-20T11:00:00+02:00`, poll job. Historical Oct 31 screen remains `POTENTIAL_MATCH`, new monitoring criterion `PX-MON-01` triggers one `CONFIRMED_PROTOCOL_CONFLICT` finding and case with before/after and source.
5. Duplicate identical event same source version; `200 deduplicated=true`, no second logical event/finding/case. Post unrelated `SYN-MED-N1` for P-151; `NO_ACTION`, no case. Show restricted `ORDER` variant `POTENTIAL_SAFETY_REVIEW` rather than confirmed use.
6. Investigator acknowledges, investigates, resolves/closes with cited evidence and rationale; audit shows actor/timestamps, source/event/assessment/case/agent references. New material evidence can reopen; no autonomous drug withdrawal. Turn LLM off and repeat step 4: core works, agent shows `UNAVAILABLE`.

**Truthfulness check**: all rendered counts, links, outcomes and timestamps can be independently fetched from real API/database; model activity log contains only observed tools, not fabricated model actions. No clinical interaction safety claim.

## 7. Acceptance checkpoints, cuts and release blockers

**H6**: `GET health`, trial/protocol, approval guard, P-042 screen and source-linked criterion responses fully real. **H10**: event/monitor/case lifecycle real, duplicate safe, six UI routes exist. **H14**: integrated agent adapter has real or honest OFF path; case review/audit works end-to-end. **H17**: core release gate passes. **H20**: packaged documentation/demo/video and tag, no late behavior change.

| Gate / severity | Required assertion | Cut policy |
|---|---|---|
| **BLOCKER — approval** | unapproved/unsupported criterion cannot drive run; 8 signed rule IDs and coverage; source anchors resolve | never cut |
| **BLOCKER — evidence** | `UNKNOWN` for missing/stale/contradiction; order != administration; absence != negative reconciliation; unit and date precision honored | never cut |
| **BLOCKER — monitoring** | effective-date targeted reevaluation, immutable before/after, one idempotent case, irrelevant event no case | never cut |
| **BLOCKER — human/synthetic** | human reviewer owns clinical disposition; 15 entirely synthetic records; no real data or treatment API | never cut |
| **HIGH — source/audit** | clinical claims link to valid versioned sources, actor/time/reason; LLM OFF honest | never cut for P0 |
| **MEDIUM — polish** | responsive UI, filters, richer notes, advanced dynamic agent exploration | simplify only after base story passes |
| **STRETCH** | draft amendment simulation, FHIR export/import, decorative charts, multi-site | cut first, with explicit disabled UI not false success |

Scenario priority: **must** pass AC-01–10, AC-12–14, AC-16–18, AC-20. **Should** pass AC-15 and AC-19; AC-11 is P2. Scenarios follow product v1.1 and run over the 15 patients. Backend evaluator failure yields `EVALUATION_ERROR`, distinct from legitimate rule `UNKNOWN`. An LLM-only failure yields agent `FAILED|PARTIAL|UNAVAILABLE` without changing an independently valid deterministic assessment. Reduced functionality remains visible.

## 8. Stage 2.1 documentation approval and pending engineering handoff

**Approved documentation freeze:** `PP-S2-CF-20261114-01` / `1.0.0-rc2`. Approval basis: the user instructed the maintainer to choose appropriate resolutions and reconcile all source documents. [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) is the freeze manifest and derived context. Product v1.1 incorporates the 15-patient scope. Approval applies to design choices; clinical rule approval, engineer acknowledgements, worktree readiness and runtime acceptance are separate obligations.

Design decisions accepted: eight source-anchored rules; five eligibility rules per baseline; human-only clinical approvals; one SQLite worker; immutable evidence and case history; job `SUCCEEDED` versus run `COMPLETE`; Unicode code-point spans; five-second gateway calls, ten-second model calls and a thirty-second execution deadline; exclusive path ownership and coordinated contract revision.

Before independent coding, the assigned human IC records each engineer's acknowledgement of the revision and creates the planned worktrees. E1 owns UI/API-client tests; E2 owns rule, approval, event, persistence and API tests; E3 owns gateway/agent evaluations; IC owns cross-module release checks. H6/H10/H14/H17/H20 are still **pending**, not signed or executed by this documentation update.

## 9. Documentation verification scope and remaining work

The reconciliation checks source paths, relative document links, revision markers, all 26 API route pairs, status distinctions, fixture IDs, configuration keys, tool boundaries and the context's source references. These checks inspect design artifacts, not running services. Executable commands in SYSTEM_ARCHITECTURE and TEAM_OWNERSHIP are planned implementation contracts.

Documentation checks for `1.0.0-rc2`: nine synchronized files, 26 unique API route pairs matching the context exactly, 26 configuration keys, matching 15-patient registries, valid relative file/section links, and parseable embedded Python/JSON examples. No stale approval/version markers or unresolved documentation conflicts were found. These checks do not compile TypeScript or execute the planned application tests.

FastAPI OpenAPI generation, Alembic migrations, the complete 15-patient JSON seed, provider SDK/tool compatibility, clinical-rule tests, frontend typecheck/build and browser integration remain **PENDING IMPLEMENTATION**. Historical authoring checks are not evidence that this revised design has run.

**Historical source trace:** the original uploaded `PRODUCT_SPECIFICATION(3).md` was recorded with SHA-256 `6909b4479a5c8ee81e1731d30e37efb957bbf2bd7eb71ef4055259e3c918b93a`. This is historical provenance, not a checksum of revised product v1.1.

**Precedence:** API_CONTRACTS governs API/wire behavior, DATA_MODEL governs persistence and TEAM_OWNERSHIP governs path/change ownership. All disagreements require IC review and a versioned revision. Documentation approval makes no implementation or clinical-validation claim.
