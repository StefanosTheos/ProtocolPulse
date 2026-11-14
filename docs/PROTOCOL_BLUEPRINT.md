# PX-104 v1.0 — Fictional Protocol Blueprint

**Wire freeze:** `PP-S2-CF-20261114-01 / 1.0.0-rc2`. **Fixture release:** `px104-protocol-v1`.
**Owner:** IC. This additive source/fixture handoff is authorized by the user's request. It instantiates the eight frozen rules; it changes no API, clinical rule, patient registry or approval boundary. The synthetic protocol is not a real clinical protocol or an operationally approved rule set.

## 1. Purpose, scope and authoritative inputs

Create one text-readable, source-citable fictional protocol for the J-01 → screening → monitoring demo. Its sole executable content is [product §8.2](../PRODUCT_SPECIFICATION.md#82-demonstration-protocol-v10-fictional): five eligibility rules and three monitoring rules. [API_CONTRACTS §2](API_CONTRACTS.md#2-canonical-typescript-api-dtos-normative-field-presence) governs extracted field names/types; [DATA_MODEL](DATA_MODEL.md) governs persistence; [TEAM_OWNERSHIP](TEAM_OWNERSHIP.md) governs changes. Any disagreement goes to IC; no engineer independently revises the shared source or expected outputs.

There are no additional disease-severity, genotype, pregnancy, laboratory, visit-frequency, dosing, treatment-arm, consent, washout or adverse-event-reporting requirements. Patient history fields outside the five eligibility rules remain available evidence, not additional selection filters. PX-104 and its thresholds/codes are wholly fictional; no clinical or pharmacological validity is claimed.

## 2. Files, identities and version boundaries

All artifacts below are in [`fixtures/protocols/px104-v1/`](../fixtures/protocols/px104-v1/).

| Artifact | Purpose |
|---|---|
| [source_document.json](../fixtures/protocols/px104-v1/source_document.json) | Editable authoring source: twelve document sections and the curated field mapping for eight rules. IC-only. |
| [PX-104-v1.0-fictional.pdf](../fixtures/protocols/px104-v1/PX-104-v1.0-fictional.pdf) | Five-page unencrypted, selectable-text protocol; source given to the extractor/reviewer. No scanned pages or external links. |
| [source_pages.json](../fixtures/protocols/px104-v1/source_pages.json) | Actual extracted page text, extractor version and section spans. Reference provenance, not a substitute for parsing uploads. |
| [expected_extraction.json](../fixtures/protocols/px104-v1/expected_extraction.json) | Exact `CriteriaReplaceRequest` body with eight `CriterionDraftInput` objects, twelve `CoverageItem` objects and `change_reason`. |
| [expected_protocol_detail.json](../fixtures/protocols/px104-v1/expected_protocol_detail.json) | Raw `ProtocolDetail` for mock review state: proposed criteria, zero blockers, unsigned coverage, no approval/hash or fabricated extraction job. Client wraps it in `Envelope<ProtocolDetail>` with its request ID. |
| [expected_extraction.schema.json](../fixtures/protocols/px104-v1/expected_extraction.schema.json) | Structural mirror of the existing request DTOs for fixture validation; API_CONTRACTS remains authoritative. It adds no API fields. |
| [extraction_checks.json](../fixtures/protocols/px104-v1/extraction_checks.json) | Eleven output-mutation test recipes and expected fixture-validator diagnostics. These are not source amendments or new API error enums. |
| [manifest.json](../fixtures/protocols/px104-v1/manifest.json) | SHA-256 of each artifact, source/protocol identity, counts and explicit curated/unapproved flags. |

Stable fixture IDs: `TR-PX104`, `PV-PX104-1.0`, source `SRC-PROTOCOL-PX104-V1` / version `1`, site `SITE-SYN-01`, terminology map `px104-terminology-v1`. Source creation time `2026-10-30T10:00:00Z` is synthetic metadata, not the current build time. Section IDs, site/map IDs, `clinical_subject` values and logical group IDs are fixture binding choices within the frozen DTOs, not new clinical semantics. E2 must reuse these bindings in the seed; do not rename existing patient IDs.

Version distinctions: clinical protocol **1.0**; product specification **1.1**; API schema **1.0.0-rc2**; fixture release **px104-protocol-v1**. Any PDF edit, even typography, changes its byte hash and may change anchors. IC regenerates the complete package and records a new fixture release for later source changes. Clinical-rule changes still require coordinated product/contract review.

## 3. Required protocol document sections

Coverage includes every numbered section once. Headers/footers are presentation metadata; section text contains all eligibility/monitoring content. Four informational sections explain the eight rules without creating extra executable criteria.

| PDF page | Section / stable `section_id` | Required contents / expected coverage |
|---|---|---|
| 1 | 1 / `PX-INFO-IDENTITY` | Fictional study, indication, 12-week scope, synthetic-only limits; `INFORMATIONAL`. |
| 1 | 2 / `PX-INFO-CALENDAR` | Screening, study days, timezone, evidence watermark and clock separation; `INFORMATIONAL`. |
| 2 | 3 / `PX-SECTION-INC-01` | Inclusive age 40–70 at screening; `MAPPED` to `PX-INC-01`. |
| 2 | 4 / `PX-SECTION-INC-02` | Confirmed `SYN-CONDITION-A`; `MAPPED` to `PX-INC-02`. |
| 2 | 5 / `PX-SECTION-INC-03` | Latest timely eGFR ≥60 in approved units; `MAPPED` to `PX-INC-03`. |
| 3 | 6 / `PX-SECTION-EXC-01` | No confirmed active excluded condition; reviewed absence; `MAPPED` to `PX-EXC-01`. |
| 3 | 7 / `PX-SECTION-EXC-02` | Restricted use lookback, sufficient no-use reconciliation, order/use distinction; `MAPPED` to `PX-EXC-02`. |
| 4 | 8 / `PX-SECTION-MON-01` | Confirmed restricted use during participation; `MAPPED` to `PX-MON-01`. |
| 4 | 9 / `PX-SECTION-MON-02` | Restricted order/dispense without confirmed use; `MAPPED` to `PX-MON-02`. |
| 4 | 10 / `PX-SECTION-MON-03` | New eGFR below 60 during participation; `MAPPED` to `PX-MON-03`. |
| 5 | 11 / `PX-INFO-EVIDENCE` | Approved fictional mapping, evidence types, uncertainty; `INFORMATIONAL`. |
| 5 | 12 / `PX-INFO-REVIEW` | Human approval, candidate aggregation, case authority, audit/safety limits; `INFORMATIONAL`. |

## 4. Exact executable mappings and date conventions

| Criterion | Operator | Threshold / unit | Meaning |
|---|---|---|---|
| `PX-INC-01` | `AGE_RANGE_INCLUSIVE` | `[40,70]`, `years` | Age on screening date; imprecise birth date unresolved if it changes the result. |
| `PX-INC-02` | `CODE_CONFIRMED` | `SYN-CONDITION-A`, null | Verified code or adjudicated synthetic note; unconfirmed/ambiguous diagnosis is unknown. |
| `PX-INC-03` | `LAB_GTE` | `60`, `mL/min/1.73m²` | Latest relevant specimen in the inclusive local-date window; missing/stale/unsupported unit is unknown. |
| `PX-EXC-01` | `ABSENCE_CONFIRMED_ACTIVE` | `SYN-EXCLUDED-CONDITION`, null | Confirmed active condition fails; passing needs reviewed completeness supporting absence. |
| `PX-EXC-02` | `NO_RESTRICTED_USE` | `SYN-CLASS-R`, null | Dated administration/reliable use in window fails; passing needs full-window no-use reconciliation. |
| `PX-MON-01` | `EVENT_RESTRICTED_USE` | `SYN-CLASS-R`, null | Confirmed in-participation use → `CONFIRMED_PROTOCOL_CONFLICT` for investigator review. |
| `PX-MON-02` | `EVENT_ORDER_ONLY` | `SYN-CLASS-R`, null | Order/dispense without confirmed use → `POTENTIAL_SAFETY_REVIEW`; no assertion of ingestion. |
| `PX-MON-03` | `EVENT_LAB_LT` | `60`, `mL/min/1.73m²` | New low eGFR during participation → rule-specific clinical review. No new finding-category/priority mapping is invented by this fixture. |

`Europe/Athens`: screening `2026-10-31`; day 0 `2026-11-01`; day 18 `2026-11-19`. Medication lookback is `[2026-10-01 00:00,2026-10-31 00:00)` local time. Lab specimen dates are inclusive `[2026-10-01,2026-10-31]`. Data watermark is `2026-11-01T00:00:00+02:00` = `2026-10-31T22:00:00Z`. Use timezone-aware local-calendar arithmetic across the October DST change, not thirty fixed 24-hour intervals.

`WindowSpec` bindings: age/diagnosis/excluded-condition are screening-date point assessments (`0,0`, both inclusive); this is an as-of scope, not a requirement that the diagnosis originated that day. Lab offsets `-30,0` include both local dates. Medication offsets `-30,0` exclude the end. Monitoring uses `PARTICIPATION` with null offsets, `INSTANT` granularity and `[start,end)` participation bounds. Null offsets here select recorded participation bounds; they do not make an unknown medication stop date infinite or invent an enrollment/end timestamp.

All criteria retain `missing_data_policy=UNKNOWN_UNLESS_RECONCILED`. Eligibility group `PX104-ELIGIBILITY-ALL` combines five rules with `FAIL > UNKNOWN > all PASS`. Monitoring group `PX104-MONITORING-INDEPENDENT` labels three independently triggered rules and never enters baseline aggregation. `SYN-MED-R1/R2→SYN-CLASS-R`; `SYN-MED-N1→SYN-CLASS-N`. No additional mappings are allowed.

## 5. Source anchors, extraction expectations and approval gates

Expected quotes and anchors are computed **after extracting the actual generated PDF**, not invented from document prose. Page numbers are one-based; span indices are zero-based end-exclusive **Unicode code points** within persisted page text. For every rule, `page_text[start:end] == source_quote`. Coverage spans include the section heading and body; rule quotes contain the body. The `²` unit character exercises non-ASCII offsets; UTF-8 byte counts cannot substitute for code-point indices.

The reference profile is `PyMuPDF 1.27.2.3`, `get_text("text", sort=False)`, preserving extracted LF line breaks and final newline, without further whitespace/Unicode normalization. This is fixture tooling, not a new frozen backend dependency. A different parser must either reproduce that persisted canonical text or independently re-anchor verified quotes against its actual persisted text; never reuse offsets from a different text representation. Compare live extraction by frozen semantics, coverage and verified source linkage; arbitrary JSON order/model prose is not a correctness requirement.

Expected positive output: eight `PROPOSED` criteria, twelve complete coverage rows (eight `MAPPED`, four `INFORMATIONAL`), no invented rule, no unresolved ambiguity for this prepared source. `blocking_count=0` describes this **reviewable proposal**, not approval. Reviewer identity/time, signed coverage and approved-set hash remain null. `expected_protocol_detail.json` is a **post-proposal review mock**, not the reset seed state; reset still registers the source/version as `DRAFT` and requires explicit investigator approval before screening.

These JSONs are curated test/fallback oracles, not captured model output. An enabled model must inspect the PDF through the permitted tools; expected outputs must not be inserted into the model evidence gateway. If AI is disabled, E2 may load a visibly labeled curated proposal after validating the actual source/hash/text, and a human still reviews it. E3 returns `UNAVAILABLE`, without fake `SUCCEEDED`, tool traces or approvals. Invalid or unreadable uploads cannot silently use this fixture while claiming that upload was extracted successfully.

## 6. Verification and regeneration

Authoring tools are IC-owned and separate from the application manifests. Install only if needed:

```bash
python -m pip install -r tools/requirements-protocol-fixture.txt
python tools/protocol_fixture.py --check
# IC regeneration after an authorized source/layout change:
python tools/protocol_fixture.py --build
# Optional visual inspection; writes PNGs to a new temporary directory:
python tools/protocol_fixture.py --check --preview
```

`--check` reads only. It verifies artifact hashes, reproducible PDF bytes, text on all five pages, quote/coverage spans, eight-rule inventory, twelve-section coverage, proposal schema/API field presence, unchanged generated outputs and all eleven negative mutations. Diagnostics in `extraction_checks.json` are fixture-validator labels only. This does **not** execute a model, prove backend rule evaluation, generate patient records, exercise HTTP approval or satisfy AC-12/17 runtime extraction/security tests. Those remain engineer obligations.

Handoff to E1/E2/E3: read [parallel engineer prompt updates](PARALLEL_ENGINEER_PROMPT_UPDATES.md), keep these shared artifacts read-only, and use only assigned implementation paths.
