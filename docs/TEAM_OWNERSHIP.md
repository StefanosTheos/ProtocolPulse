# ProtocolPulse — Three-Engineer Ownership and Integration Handshake

**Approved documentation freeze:** `PP-S2-CF-20261114-01` / `1.0.0-rc2`. [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) records the user-authorized reconciliation and serves as the Stage 2.1 freeze manifest. The following is the planned implementation tree; delivered files are the product specification, six `docs/*.md` files, `.env.example` and `PROJECT_CONTEXT.md`. Engineering acknowledgements and runtime handoffs remain pending.

## 1. Exact future tree and exclusive ownership

Ownership legend: `E1` frontend, `E2` backend, `E3` AI, `IC` designated **integration coordinator** (one person with explicitly limited release permissions). **No shared unowned paths.** If an unlisted file is needed, propose it to IC for owner assignment before creating it.

```text
ProtocolPulse/
├── PRODUCT_SPECIFICATION.md                  [IC; versioned product authority]
├── PROJECT_CONTEXT.md                       [IC; derived context + freeze manifest]
├── .env.example                             [IC — delivered in this stage]
├── .gitignore                               [IC]
├── README.md                                [IC]
├── Makefile                                 [IC]
├── .github/workflows/ci.yml                 [IC]
├── docs/                                    [IC; seven-stage artifacts below]
│   ├── SYSTEM_ARCHITECTURE.md               [IC]
│   ├── AGENT_DESIGN.md                      [IC]
│   ├── API_CONTRACTS.md                     [IC]
│   ├── DATA_MODEL.md                        [IC]
│   ├── TEAM_OWNERSHIP.md                    [IC]
│   └── DEVELOPMENT_PLAN.md                 [IC]
├── contracts/                               [IC; generated at implementation handoff, absent now]
│   ├── openapi.snapshot.json                [IC generated from backend; never hand-edited]
│   └── agent_interface.schema.json          [IC, derived from API/AGENT docs]
├── frontend/
│   ├── package.json                         [IC; dependencies/scripts changed via request]
│   ├── package-lock.json                    [IC]
│   ├── tsconfig.json                        [IC]
│   ├── next.config.ts                       [IC]
│   ├── postcss.config.mjs                   [IC]
│   ├── tailwind.config.ts                   [E1]
│   ├── app/                                 [E1 exclusively]
│   │   ├── layout.tsx                       [E1]
│   │   ├── page.tsx                         [E1]
│   │   ├── globals.css                      [E1]
│   │   ├── trials/[trialId]/page.tsx        [E1]
│   │   ├── trials/[trialId]/protocol/page.tsx[E1]
│   │   ├── trials/[trialId]/selector/page.tsx[E1]
│   │   ├── trials/[trialId]/patients/[patientId]/page.tsx [E1]
│   │   ├── trials/[trialId]/monitor/page.tsx [E1]
│   │   ├── trials/[trialId]/cases/page.tsx   [E1]
│   │   └── trials/[trialId]/audit/page.tsx   [E1]
│   ├── components/                          [E1 exclusively]
│   │   ├── TrialHeader.tsx                  [E1]
│   │   ├── ProtocolCoverageReview.tsx       [E1]
│   │   ├── CandidateTable.tsx               [E1]
│   │   ├── EvidenceTimeline.tsx             [E1]
│   │   ├── EventSimulator.tsx               [E1]
│   │   ├── CaseReviewPanel.tsx              [E1]
│   │   └── SyntheticNotice.tsx              [E1]
│   ├── lib/api/                             [E1 exclusively]
│   │   ├── client.ts                        [E1]
│   │   ├── types.ts                         [E1; mirrors frozen contracts]
│   │   ├── endpoints.ts                     [E1]
│   │   └── mocks.ts                         [E1; exact typed fixture replies]
│   └── tests/                               [E1 exclusively]
│       ├── contract.test.ts                 [E1]
│       └── flow.test.tsx                    [E1]
├── backend/
│   ├── pyproject.toml                        [IC package manifest]
│   ├── alembic.ini                          [E2]
│   ├── app/                                 [E2 exclusively]
│   │   ├── __init__.py                      [E2]
│   │   ├── main.py                          [E2]
│   │   ├── seed.py                          [E2; exactly 15 synthetic fixtures]
│   │   ├── core/config.py                   [E2]
│   │   ├── core/actors.py                   [E2]
│   │   ├── db/session.py                    [E2]
│   │   ├── db/base.py                       [E2]
│   │   ├── api/routes_health.py             [E2]
│   │   ├── api/routes_trials.py             [E2]
│   │   ├── api/routes_protocols.py          [E2]
│   │   ├── api/routes_screening.py          [E2]
│   │   ├── api/routes_patients.py           [E2]
│   │   ├── api/routes_events.py             [E2]
│   │   ├── api/routes_cases.py              [E2]
│   │   ├── api/routes_agents.py             [E2]
│   │   ├── api/routes_audit.py              [E2]
│   │   ├── api/routes_jobs.py               [E2]
│   │   ├── schemas/                         [E2 exclusively]
│   │   │   ├── common.py                    [E2; enums and envelopes]
│   │   │   ├── trial.py                     [E2]
│   │   │   ├── protocol.py                  [E2]
│   │   │   ├── patient.py                   [E2]
│   │   │   ├── event.py                     [E2]
│   │   │   ├── assessment.py                [E2]
│   │   │   ├── review.py                    [E2]
│   │   │   └── job.py                       [E2]
│   │   ├── models/                          [E2 exclusively]
│   │   │   ├── core.py                      [E2; trial, protocol, criteria, actor]
│   │   │   ├── clinical.py                  [E2; 12-section facts, evidence, med/lab]
│   │   │   ├── assessment.py                [E2]
│   │   │   └── workflow.py                  [E2]
│   │   ├── services/                        [E2 exclusively]
│   │   │   ├── approval.py                  [E2]
│   │   │   ├── evaluator.py                 [E2; deterministic authority]
│   │   │   ├── evidence.py                  [E2]
│   │   │   ├── event_processor.py           [E2]
│   │   │   ├── monitoring.py                [E2]
│   │   │   ├── case_workflow.py             [E2]
│   │   │   ├── pdf_extractor.py             [E2]
│   │   │   ├── jobs.py                      [E2; durable job poller]
│   │   │   └── audit.py                     [E2]
│   │   └── integrations/                    [E2 exclusively]
│   │       ├── agent_adapter.py             [E2 ONLY; consumes agent wire interface]
│   │       └── evidence_gateway.py          [E2 ONLY; scope/allowlist/DB reads]
│   ├── alembic/                              [E2 exclusively]
│   │   ├── env.py                           [E2]
│   │   └── versions/0001_initial.py        [E2]
│   ├── tests/                                [E2 exclusively]
│   │   ├── test_api_contract.py             [E2]
│   │   ├── test_approval.py                 [E2]
│   │   ├── test_evaluator.py                [E2]
│   │   ├── test_event_idempotency.py        [E2]
│   │   ├── test_case_workflow.py            [E2]
│   │   └── test_jobs.py                     [E2]
│   └── var/                                  [runtime/gitignored; IC config, not committed]
│       ├── protocolpulse.db
│       └── protocols/
└── ai/
    ├── pyproject.toml                       [IC package manifest]
    ├── __init__.py                          [E3]
    ├── entrypoints.py                       [E3 ONLY; provides run_agent(request,gateway)]
    ├── agents/                              [E3 exclusively]
    │   ├── coordinator.py                   [E3]
    │   ├── protocol_intelligence.py         [E3]
    │   ├── evidence_investigator.py         [E3]
    │   ├── medication_investigator.py       [E3]
    │   └── monitoring_workflow.py           [E3]
    ├── tools/                               [E3 exclusively]
    │   ├── schemas.py                       [E3; requests/results, NO DB access]
    │   ├── selection.py                     [E3; allowed tool chooser]
    │   └── fake_gateway.py                  [E3; deterministic mock]
    ├── prompts/                             [E3 exclusively]
    │   ├── system.py                        [E3]
    │   └── roles.py                         [E3]
    ├── evals/                               [E3 exclusively]
    │   ├── fixtures.py                      [E3]
    │   └── run_evals.py                     [E3]
    └── tests/                               [E3 exclusively]
        ├── test_branching.py                [E3]
        ├── test_prompt_injection.py         [E3]
        └── test_llm_disabled.py             [E3]
```

**Single ownership of additional files:** `frontend/app/**`, `frontend/components/**`, `frontend/lib/api/**`, `frontend/tests/**` exclusively E1; `backend/app/**`, `backend/alembic/**`, `backend/tests/**` exclusively E2; `ai/**` excluding `ai/pyproject.toml` exclusively E3. `docs/**`, `contracts/**`, root config, CI and the three package manifest files exclusively IC. Package dep changes requested as a PR comment/issue and implemented by IC; no separate engineer edits the same manifests. `backend/alembic.ini` belongs E2. Noncommitted `backend/var/**` created by runtime, never an ownership conflict.

## 2. Backend↔AI fixed import boundary

**One protocol**: `ai.entrypoints.run_agent(request: dict, gateway: AsyncToolGateway) -> dict` is async, versioned (`contract_version='1.0.0-rc2'`), and returns `AgentResult` described in AGENT_DESIGN. `AsyncToolGateway.invoke(tool_name: str,payload: dict) -> dict` is implemented by `backend/app/integrations/evidence_gateway.py`. The E2 adapter loads `ai.entrypoints`, validates input/output with *backend's* Pydantic mirror of frozen JSON, applies `LLM_ENABLED` guard and can swap `FakeAgentAdapter`. E3 **must not** import E2 models, session, FastAPI routes, environment loader or use raw network to read patient data; E2 **must not** import E3 internal tool modules. Only call `ai.entrypoints` at this boundary.

Only the backend service performs `reevaluate_affected`, `create_or_update_finding`, `append_audit`, approval and clinician state transitions. AI can ask the gateway for scoped evidence and constrained verification tasks; no credentials or patient database handles passed to model provider. Both sides test matching JSON contract with one saved sample: P-083 order-only, no use confirmation, `UNKNOWN(ORDER_ONLY)`; plus P-042 day-18 monitoring. `AgentResult.status=UNAVAILABLE` when `LLM_ENABLED=false` and the task actually needs AI; **never fake agent success**.

## 3. Frontend↔backend fixed mock-first contract

E1 writes `frontend/lib/api/types.ts` from API_CONTRACTS (all DTO names and required nullable fields), and `client.ts` with `Envelope<T>`, typed `ErrorEnvelope`, real `GET /jobs/{job_id}` poller, request/correlation display, actor header, mutation idempotency and required revision headers. `mocks.ts` implements the **same** exact envelopes, status enums and error codes—no alternate shape such as `{success:true}` or simulated fake enrollment. The mock may drive UX work, but merge/release requires actual backend responses for protocol upload/approval, computed selection, event case creation and review. In production-like demo UI, a mock actor switcher must be visibly labeled simulation. UI derives counts from the 15 assessments.

## 4. Worktrees, branch protocol and integration handshake

1. IC manages the integration branch `master` (current local branch; configure protection before engineering merges). The Stage 2.1 **freeze manifest** is the approval record in `PROJECT_CONTEXT.md`; it records user authorization, not fabricated engineer signatures. IC owns package/CI config. E1/E2/E3 will use separate worktrees/branches `feat/frontend`, `feat/backend`, `feat/ai` with distinct allowlisted paths; their creation and individual acknowledgements remain pending.
2. H2: each engineer checks out freeze `PP-S2-CF-20261114-01`, acknowledges contracts/actor roles, and produces a **mock vertical path** immediately. No cross-tree source editing.
3. H4: E2 shares running OpenAPI `app.openapi()` output in a review artifact (not a silently edited shared file); E1 reports TS mismatches; E3 shares one `AgentRequest`/`AgentResult` serialized round trip. IC reviews and, if accepted, updates `/docs` + future `contracts/*` as a **new** revision, then all owners rebase.
4. H6 **first real smoke**: backend `GET health`, `GET trials`, `GET P-042`, approve seeded criteria, `POST screenings→GET job→GET assessments`; E1 front end renders real backend data. E3 independently demonstrates its mocked dynamic evidence selection via the gateway wire shape.
5. H10–H14: E2 integrates E3 entrypoint through E2-owned adapter; E1 switches mock to actual typed client without changes to screens. IC runs end-to-end P-042 day-18 event, duplicate and review, records passing AC IDs.
6. IC alone merges, resolves root/contract conflicts, and creates release tag after contract audit. One document/API modification -> proposed issue describing exact affected types/endpoints -> IC accepts/rejects -> bumps contract freeze version -> all three engineers revise under exclusive ownership. **No implicit editing another person's files**, even to fix a one-line import.

## 5. Mandatory owner tests and handoff proof

| Owner | Local commands (from repo root) | Must demonstrate before handoff |
|---|---|---|
| E1 | `npm --prefix frontend run typecheck`; `npm --prefix frontend run test`; `npm --prefix frontend run build` | all six P0 screens, labeled synthetic data, no status guessed from UI, API `202` polling, error/unknown/stale states; type-check against frozen DTOs |
| E2 | `python -m pytest backend/tests -q`; `python -m alembic -c backend/alembic.ini upgrade head`; `python -m backend.app.seed --dataset px104-15 --reset-demo` | 15 cases seeded with 12-section schema; real approval guard, all 8 rules, AC-01–10/12–20, idempotent event T1/T2, audit rollback, no unexpected routes |
| E3 | `python -m pytest ai/tests -q`; `python -m ai.evals.run_evals` | a variable tool sequence for missing/contradictory sources, verifiable citations, prompt-injection rejection, bounded steps, `UNAVAILABLE` while off; no clinical status writes |
| IC | E1/E2/E3 checks + `python -m pytest backend/tests ai/tests -q` + documented six-screen walkthrough | cross-module contracts, actual end-to-end DB records, acceptance and release checklist; package/root ownership enforced |

**Escalation**: critical clinical rule mismatch, missing signed approval, seed count not 15, case duplication or contract discrepancy = block merge until IC approves a revision. If time short, cut P2 amendments, FHIR and decorative analytics before any P0 safety/traceability. Mock-only screenshots cannot satisfy definition of done.

**Precedence:** API_CONTRACTS governs API/wire definitions, DATA_MODEL governs persistence, and this file governs path/change ownership. PROJECT_CONTEXT is derived. All disagreements require coordinator review and a versioned contract revision; no owner may reinterpret another domain locally.
