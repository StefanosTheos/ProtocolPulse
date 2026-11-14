# Parallel Engineer Prompt Addenda — Protocol Fixture Handoff

**Contract:** `PP-S2-CF-20261114-01 / 1.0.0-rc2` unchanged. **Fixture release:** `px104-protocol-v1`.

**Yes, the parallel engineer prompts need small additions.** This repository contains role task lists in [DEVELOPMENT_PLAN](DEVELOPMENT_PLAN.md), not standalone original prompts. The blocks below are ready to append to the corresponding prompts; their existing tasks, frozen rules and ownership remain in force. No separate agent/branch work has been started by this handoff.

## Common addition — append to all three prompts

Read `PROJECT_CONTEXT.md`, `docs/PROTOCOL_BLUEPRINT.md`, the existing source contracts and your ownership limits before implementing. Use the shared `fixtures/protocols/px104-v1/` release `px104-protocol-v1`. It contains the actual five-page text PDF, canonical extracted pages, eight-rule/twelve-section expected extraction, review-state mock, schema, manifest and negative-output checks. Do not invent a replacement protocol, extra restrictions, rules or source citations. IC owns `fixtures/protocols/**`, `tools/protocol_fixture.py`, its requirements file, documentation and package manifests; request changes through IC. Only your existing implementation paths are writable. Keep wire schema `1.0.0-rc2` and the fifteen patient IDs unchanged.

Fixture IDs are `TR-PX104`, `PV-PX104-1.0`, `SRC-PROTOCOL-PX104-V1` source version `1`, site `SITE-SYN-01`, map `px104-terminology-v1`. Eight rules are approved individually by a named synthetic investigator; baseline evaluates the five eligibility rules only. Twelve-section coverage includes four informational sections. Zero coverage blockers and correct extraction do not constitute clinical approval. Curated JSON is test/fallback data, never evidence of model execution. Run `python tools/protocol_fixture.py --check` when consuming the handoff; report an unavailable fixture-tool environment honestly.

**Provider selection:** the user selected Gemini 3.8 Flash for all logical agent roles: `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.8-flash`. E2 handles backend config and E3 implements the Gemini SDK integration through the existing entrypoint/gateway. IC owns SDK dependencies. Use `LLM_API_KEY` server-side, explicitly supplied to the SDK client; no credentials enter browser/model inputs or wire DTOs. `LLM_ENABLED=false` remains the credential-free default. Exact model ID/capabilities are documented by [Google](https://aistudio.google.com/docs/models/gemini-3.8-flash); runtime account access/latency remain untested.

## Engineer 1 — frontend addition

Use `expected_protocol_detail.json` as the `ProtocolDetail` data of your typed mock `Envelope<ProtocolDetail>`; generate the wrapper's request ID in the mock. The JSON represents `EXTRACTION_REVIEW`, not `ACTIVE`: all eight criteria are `PROPOSED`, approval fields and approved hash are null, and coverage is unsigned. Render twelve sections, including the informational ones, and preserve exact source page/quote references. Test that this valid-looking unapproved proposal cannot start operational screening.

Use the manifest PDF and stored page references for your upload/review mock. In live mode retrieve source information through the existing authorized API; do not publish backend-private protocol files or add a hidden Next.js endpoint. Preserve Unicode code-point indexing when displaying anchors; JavaScript UTF-16 offsets differ for supplementary characters. Show extraction unavailable/failed, coverage blockers and approval revision conflicts without fabricated success. Keep the actor guard and `If-Match`/idempotency behavior from API_CONTRACTS.

Handoff evidence: J-01 mock uses the exact fixture and unsigned state; H6 renders real source/criteria/coverage from the backend and records actual human approval through the API. Continue the existing frontend typecheck, tests and build.

## Engineer 2 — backend addition

Consume `PX-104-v1.0-fictional.pdf` and verify its SHA-256 from `manifest.json`; store immutable bytes in configured private runtime storage and register the fixture source/version. Seed the same site and terminology-map bindings. Reset seeds the source/version as `DRAFT` and rule proposals without approvals or baseline screening. Do not seed the review mock verbatim as an active protocol, forge signatures or insert approved hashes directly.

Implement actual text parsing and persist page text/source spans. Use the reference extraction profile described in PROTOCOL_BLUEPRINT or re-anchor verified quotes against your actual persisted text; never attach golden offsets to different text. Validate `CriterionDraftInput`/coverage using existing Pydantic DTOs. `expected_extraction.json` is an exact `CriteriaReplaceRequest` body; the schema file mirrors the current contract and cannot replace its authority. In LLM-off mode, explicitly labeled curated proposal loading is permitted only after source/hash/text validation. Failed upload parsing stays failed; no silent substitution.

Use the eight-rule oracle to test signoff and five-rule baseline evaluation. Add backend tests corresponding to the eleven negative output mutations, including full coverage, source quote/page/offset checks, changed thresholds/windows, a ninth rule and forged approval metadata. These fixture checks do not replace real API-role, PDF-failure, transaction, patient scenario or idempotency tests. Preserve investigator approval with current protocol revision, complete coverage and append-only audit. Then pass the existing H6/H10 flow with actual stored source references.

## Engineer 3 — AI addition

Use the same PDF/page-text snapshot through the E2 gateway as `PROTOCOL_INTELLIGENCE` input. Keep `expected_extraction.json` and rule metadata in `source_document.json` on the evaluation side only; do not expose either as model evidence or claim that reading the oracle is extraction. `propose_rule` output must use the exact `CriterionDraftInput` shape; all proposals remain `PROPOSED` unless clarification is required. Each claim must reference verified page text, and section coverage must account for all twelve sections without generating extra executable criteria from informational content.

Evaluate rule ID/type/operator/threshold/unit/window/policy fidelity, complete section mapping and exact quote/anchor validity. Model wording/order may differ where the frozen semantics and verified source reference remain equivalent. Use the negative-output checks to test adapter rejection of invented criteria/citations and approval fields. They are output-validation cases, not unreadable-PDF or prompt-injection source tests; continue implementing AC-12, AC-17 and the existing agent evals separately. Reference fixture tools do not replace dynamic evidence-dependent tool choices.

With `LLM_ENABLED=false`, return `UNAVAILABLE` and no model trace, even when the backend shows a labeled curated proposal. Keep backend-only write tools out of model definitions; gateway 5s/model 10s/execution 30s and eight gateway steps remain unchanged. Handoff the existing serialized `AgentRequest`/`AgentResult` roundtrip and actual citation/evaluation evidence through the E2 adapter.

## Coordinator handoff

Commit/distribute the same fixture release to all worktrees before independent implementation. Run the fixture check, verify package hashes and confirm each prompt includes the common and corresponding role block. IC alone regenerates the PDF/oracles after an approved change and publishes the updated fixture release. This additive handoff does not reassign application ownership, modify route/type definitions or approve clinical criteria; actual engineer acknowledgements and application release checks remain pending.
