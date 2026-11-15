# Development roadmap and release gates

The implemented product connects supported protocol review, deterministic screening, external participation, event monitoring and human case review. See [workflow](WORKFLOW.md), [architecture](SYSTEM_ARCHITECTURE.md) and [verification](verification/README.md) for behavior and evidence.

Contract `PP-S2-CF-20261114-01 / 1.0.0-rc2` and fixture `px104-protocol-v1` remain unchanged. The original fifteen acceptance archetypes remain frozen; normal setup adds fifteen profiles for a thirty-patient cohort.

## Current release scope

- One supported fictional PX-104 protocol: five eligibility and three monitoring rules, twelve coverage sections.
- Sponsor protocol preparation and aggregate participation; Clinical Lead approval, screening, evidence, Safety and Audit.
- Deterministic dated evaluation, immutable screening snapshots and idempotent event/case processing.
- Optional bounded Gemini interpretation/investigation with explicit OFF and failure states.
- Local SQLite persistence with a single API/worker process; synthetic data only.

This describes implementation scope, not a claim that every release gate has been rerun on the latest commit.

## Prioritized work

| Priority | Improvement | Acceptance condition | Owner |
|---|---|---|---|
| P1 | Make investigation completion and verification tasks actionable throughout Patient 360 | A user follows a job to its result and can trace an unresolved task to source evidence and a human resolution. | E1 + E2; E3 result support |
| P1 | Strengthen temporal fidelity of generated prose | Effective and recorded dates remain distinct in questions and summaries across order-only/conflicting-event cases. | E3 + E2 |
| P2 | Recheck accessibility and error recovery on the latest UI | Keyboard/contrast/error-state checks cover all current role tabs and pending jobs. | E1 |
| P2 | Repeat full-system live validation after workflow changes | Fresh upload-to-case journey, duplicate/noise branches and restart proof are recorded against one commit. | IC + all owners |
| Future | Extend protocol support | New documents/operators have explicit semantics, validation and evaluation coverage before becoming executable. | IC + E2 + E3 |
| Future | Production identity and data integrations | Reviewed authentication, site authorization, deployment and privacy architecture precede any real patient data. | IC + E1 + E2 |

These are proposed priorities, not implemented capabilities or delivery-date promises.

## Release gates

1. All eight rules and twelve coverage sections require attributed human approval; unapproved or unsupported rules cannot screen.
2. Missing/stale/conflicting evidence remains `UNKNOWN`; orders do not imply use; units, time precision and washout boundaries are respected.
3. New material events produce targeted persisted reassessment, before/after provenance and deduplicated cases. Irrelevant events do not fabricate alerts.
4. Human review owns disposition and participation; no automated enrollment or treatment action is permitted.
5. Backend/frontend/AI contracts and fixture hashes pass. Current cohort counts come from actual assessments.
6. AI OFF/provider failures are explicit; live evidence and mocked tests are reported separately.
7. Refresh/restart preserve durable data. Tests that reset or mutate data run on disposable installations.
8. A verification record names the commit, commands, results, skipped checks and unresolved defects.

API_CONTRACTS governs wire behavior, DATA_MODEL persistence and TEAM_OWNERSHIP path/change ownership. Disagreements require coordinator review; changes to shared contracts are coordinated and versioned.

The original time-boxed development plan and engineer prompts remain in [the pre-cleanup source revision](https://github.com/StefanosTheos/ProtocolPulse/tree/3cec7371a146fdd59011c58bccd5f12aadfecda3).
