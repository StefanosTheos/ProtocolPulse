# Six-change AI remediation and verification

User-authorized implementation on 2026-11-15 (Europe/Athens), based on commit `21f46d0d1edd29e2302b9f979d2a7d75d133215a` plus the worktree fingerprinted in [the verification manifest](../artifacts/integration/six-step-manifest.json). Public contract remains `PP-S2-CF-20261114-01 / 1.0.0-rc2`; fixture release remains `px104-protocol-v1`. These are observed prototype results, not clinical validation or a reliability guarantee.

## Sequential implementation checkpoints

Each numbered change passed its checkpoint before work proceeded to the next. The full real-API flow and regression suite were then rerun.

| Change | Implemented behavior | Checkpoint evidence |
|---|---|---|
| 1. Role-specific output | Patient/monitoring schemas cannot express protocol criteria, coverage, approvals or clinical state. Code constructs the unchanged public AgentResult. | [73 AI tests passed](../artifacts/integration/six-step-01.log), including real SDK serialization with mocked HTTP. |
| 2. Verified citation selection | Private final output selects execution-local registry keys. Code reconstructs exact source/version/evidence/time/Unicode-span references; unknown, duplicate or cross-execution selections fail. Gateway argument schemas remain unchanged. | [76 AI tests passed](../artifacts/integration/six-step-02.log), including fabricated-selection rejection and timestamp/version preservation. |
| 3. Compact interpretation | Deterministic preparation reads actual page text and locates clauses through the gateway. The model interprets two batches of at most four clauses; code attaches observed source anchors and expands the frozen window profile. Rule and coverage validators run before success. | [80 tests passed](../artifacts/integration/six-step-03-batched.log). [First successful live check](../artifacts/integration/six-step-03-live-vocabulary.log): 6.241s, four gateway calls. |
| 4. Monitoring completion | Evidence-dependent retrieval remains model-selected. Once relevance, evaluation delta, case and sufficient sourced context are observed, final drafting disables further tools. Low remaining budget forces an explicitly incomplete draft. NO_ACTION stops immediately. | [83 tests passed](../artifacts/integration/six-step-04.log). [Live monitoring](../artifacts/integration/six-step-04-live.log): SUCCEEDED, 17.54s, four gateway calls. |
| 5. Diagnostics/deadlines | Server-only logs distinguish model phases, actual usage/timing, provider errors and output rejection stages. Backend/AI use the same absolute deadline, including setup, with reserved handoff time. Model-call timeout and overall timeout are distinct. | [86 AI tests](../artifacts/integration/six-step-05-ai.log), [21 backend boundary tests](../artifacts/integration/six-step-05-backend.log), [live extraction](../artifacts/integration/six-step-05-live.log) and [actual model telemetry](../artifacts/integration/six-step-model-telemetry.log). Later timeout regressions pass [88 AI tests](../artifacts/integration/six-step-final-timeout-regression.log). |
| 6. Uploaded-source integration | Enabled extraction creates a durable bounded agent execution for the uploaded source, validates without requiring existing rules, and atomically persists complete unapproved proposals. Source page references are persisted before inference. OFF remains explicitly curated; enabled failures never substitute curated answers. | [Five upload/approval/replay/failure/race tests passed](../artifacts/integration/six-step-06-concurrent-approval.log); [real uploaded-source workflow](../artifacts/integration/six-step-live.json). |

The single all-rules interpretation initially still timed out. Two bounded batches reduced its output size; restricting subject/unit spellings to the supported vocabulary fixed an observed `clinical_subject` mismatch. Those failures remain in `six-step-03-live*.log`; no budget was increased and no clinical answer was inserted to force a pass.

## What remains agentic

PDF byte parsing, section boundaries and citation offsets are mechanical. `GeminiProvider.interpret` supplies source-derived operators, clinical subjects, thresholds, units, window interpretations, evidence requirements and ambiguity. `protocol_preparation.assemble` has no extraction-oracle reads and does not fill clinical thresholds from the validation registry. It attaches exact observed clauses and fixed structural bindings. Runtime frozen-rule checks remain independent validators, outside model evidence.

The private compact representation is not a replacement wire DTO: every published rule remains exact `CriterionDraftInput`; every result remains exact `AgentResult`. Two interpretation batches are internal model calls within one coordinator, not communicating agents. Parsing, lookup, validation and coverage consume four observed gateway invocations total. Each model invocation stays inside 10s and the remaining execution deadline; the coordinator caps the interpretation phase as a whole as well.

Patient roles continue selecting relevant tools conditionally. The final live run observed different paths for order-only P-083, missing/stale-lab P-124 and conflicting-note P-140. Actual traces are in the live evidence; no fake model logs were substituted. Registry keys do not waive evidence validation or establish that prose is clinically correct.

## Real API/Gemini/SQLite workflow

Created a separate migrated database at ignored `backend/var/qa-six-live-02/protocolpulse.db`, seeded exactly fifteen patients and served it temporarily on port 8002. Existing main-demo approvals and cases were preserved. The same selected provider/key/model configuration was used for every role; no mocked provider participated in this flow.

1. Uploaded the allowlisted five-page fictional PDF under a new source/version ID. The extraction job returned `proposal_origin=MODEL`, `agent_status=SUCCEEDED`; eight unsigned rules and twelve sections persisted, with zero blockers and four INFORMATIONAL sections. Every quote was checked against the API's actual persisted page text.
2. Confirmed screening returns 409 before approval. A scripted **synthetic QA investigator action**, separate from the model, reviewed/approved the frozen proposals. This is a demo-actor test, not real clinician signoff or certification.
3. Screened all fifteen patients. P-042 and P-118 were POTENTIAL_MATCH; P-175 and P-117 PROTOCOL_CONFLICT; P-124 NEEDS_REVIEW. The medication exclusion failed for P-117 and passed for P-118. Backend alone computed all results.
4. Recorded synthetic external participation, posted a new P-042 administration and replayed the identical idempotency key. The deterministic job persisted the assessment/finding and deduplicated into one case; its optional AI execution SUCCEEDED with four actual tools and produced AI_DRAFT. Case status remained OPEN.
5. Submitted irrelevant SYN-MED-N1 for P-151: NO_ACTION, no additional case, one relevance call in the explicit agent investigation.
6. P-083, P-124 and P-140 investigations completed PARTIAL with no errors, preserving ORDER_ONLY, missing lab and conflicting evidence respectively. These are appropriate unresolved clinical-evidence outcomes, not false success verdicts.
7. Restarted the actual API process and reloaded SQLite. Six selected API resources, including proposals/approvals, screening/assessments, case/execution and audit, compared exactly: [restart evidence](../artifacts/integration/six-step-persistence.json).

The first harness attempt used an unregistered external reference; the second incorrectly treated EventReceipt as JobReceipt. These were QA-runner defects, corrected without changing the contracts. Their failed logs and partial evidence are preserved. The successful [resumed command](../artifacts/integration/six-step-06-live-flow-resumed.log) continued the already-verified upload/approval/screening state without a destructive reset. A distinct earlier event remains in that isolated database; material distinct events may create distinct findings in the same case. Identical replay created no additional case.

Final main-demo restart loaded all six changes on port 8000, preserving its original database and local `LLM_ENABLED=true`. [Final live extraction](../artifacts/integration/six-step-final-main-live.log) SUCCEEDED in 5.98s. Temporary APIs on 8001/8002 were stopped after persistence verification.

## Verification and operating limits

- Combined suite: **175 passed (88 AI, 87 backend)** in the [final backend/AI regression](../artifacts/integration/six-step-final-all.log). One existing Starlette/AnyIO deprecation warning is retained.
- [Twelve mocked/disabled evaluations passed](../artifacts/integration/six-step-evals.log). These remain separate from real Gemini evidence.
- [API/AI contract audit](../artifacts/integration/six-step-contracts.log): 26 routes, zero issues; TypeScript comparison: 73 declarations, zero mismatches. Fixture checker passed five pages, eight rules, twelve sections and eleven negative-output mutations. No frozen fixture bytes changed.
- [Focused new-code checks](../artifacts/integration/six-step-new-code-lint.log) pass F/E9. Existing repository-wide import/style and frontend development-dependency/accessibility backlogs are not claimed fixed. No frontend implementation changed.
- The concurrent-review regression proves an older in-flight model result cannot replace or demote a newer human-approved version. Recovery reuses the same child execution; interrupted work cannot obtain fresh model budgets.
- Runtime source reads and model prompts never consume the expected extraction oracle. Evaluation mocks may consume it on the test side. No real health data was used; no configured key is committed, logged or included in model input/DTOs.
- Live tests demonstrate the recorded runs, not sustained quota availability, latency percentiles or resistance to every injection. Malformed/unreadable/ambiguous/injected source and unavailable-provider defenses have reproducible tests; unrestricted real-document ingestion remains outside the synthetic allowlist.
- No automatic approval, enrollment, treatment change or model-written clinical finding was added. Only complete independently validated model proposals enter review; incomplete extraction stays explicitly failed/partial for source review. The deterministic system continues through AI failures.
- Prompt E independent judging remains pending. This document is a coordinator implementation/verification record.
