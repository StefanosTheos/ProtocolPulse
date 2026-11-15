# AI implementation

The public integration boundary is `ai.entrypoints.run_agent(request: dict, gateway: AsyncToolGateway) -> dict`, with contract version `1.0.0-rc2`. Backend owns the gateway, authorization, persistence and audit. [AGENT_DESIGN](AGENT_DESIGN.md) defines the normative tools and DTOs.

## Responsibilities and authority

One coordinator serves four logical responsibilities, rather than four independent agent services:

| Responsibility | Evidence-dependent work |
|---|---|
| Protocol intelligence | Interpret supported source clauses and return unapproved, cited rule proposals with coverage. |
| Patient evidence investigation | Choose relevant labs, conditions, notes and source lookups; expose missing or conflicting evidence. |
| Medication investigation | Compare dated orders/use with the exact approved restriction and approved terminology mapping. |
| Monitoring workflow | Read backend relevance, evaluation delta and existing case; prepare a summary or verification proposal when useful. |

Only backend services compute authoritative rule results, findings and case state. Only human actions approve rules and record clinical transitions. An unspecified interaction remains unknown.

## Source preparation and interpretation

PDF parsing, section location and Unicode offsets are mechanical procedures. Protocol preparation obtains actual persisted page text through `parse_protocol` and `locate_clause`. Gemini interprets clauses in two concurrent batches of at most four.

Code attaches verified source anchors and expands the private compact output into the exact public `CriterionDraftInput` and `CoverageItem` shapes. The gateway validates rule semantics and coverage before complete unapproved proposals are persisted.

Runtime evidence does not include the expected extraction oracle. Expected JSON remains on the evaluation side or in the explicitly labeled non-AI fallback. The independent validator intentionally supports the frozen PX-104 rules; this is not a general-purpose protocol parser.

## Structured results and citations

Private response schemas differ by logical responsibility. Patient/monitoring outputs cannot express protocol approvals or authoritative clinical status.

Patient responses select execution-local verified reference keys. Code reconstructs source/version/evidence/time/span references and rejects invented or cross-execution selections. Exact citation identity does not prove every sentence in a generated summary; human review remains necessary.

Monitoring finishes with tool-free drafting once sufficient context is observed or the remaining deadline requires an incomplete handoff. Irrelevant events can stop after a single relevance read.

## Bounds, failures and observability

- At most **8 gateway invocations**, including retries.
- At most **5 seconds per tool**, **10 seconds per model call** and **30 seconds overall**.
- The adapter and coordinator share an absolute deadline; recovery does not reset budgets.
- Only permitted transient failures retry. Malformed evidence and unmapped terminology do not become certainty.
- Public traces contain observed tool names, result/error codes, reference IDs and elapsed time. Server logs record sanitized phase/timing/usage diagnostics.
- Source PDFs and notes are untrusted data. No SQL access, arbitrary URL reads or model-generated code execution is permitted.

Selected configuration is `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.8-flash`, using an explicit server-side `LLM_API_KEY`. All responsibilities use the same configured model.

With `LLM_ENABLED=false` or missing configuration, agents return `UNAVAILABLE` without fabricated calls. Enabled-provider failures return explicit `FAILED/PARTIAL` results. Backend monitoring persists findings/cases independently. Extraction's curated OFF path is labeled and never presented as model success.

## Evidence and limitations

[Verification](verification/README.md) links real model/backend executions separately from mocked evaluations. It retains source provenance and historical failures through versioned review records.

Live account availability, sustained latency, unrestricted protocol support, clinical validity and exhaustive prompt-injection resistance are not established by those runs. The earlier review also identified a generated question confusing clinical and documentation dates; verified reference IDs alone do not eliminate that risk.

Implementation checkpoints and the original engineer handoff remain available in [repository history](https://github.com/StefanosTheos/ProtocolPulse/tree/3cec7371a146fdd59011c58bccd5f12aadfecda3).
