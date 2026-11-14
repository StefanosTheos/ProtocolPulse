# Engineer 3 handoff — ProtocolPulse

Contract `PP-S2-CF-20261114-01 / 1.0.0-rc2`; fixture `px104-protocol-v1`. All implementation changes are under `ai/**`. No shared documents, fixture bytes, backend/frontend files or IC-owned `ai/pyproject.toml` were edited.

## Delivered

- `entrypoints.py`: exact async `run_agent(request: dict, gateway: AsyncToolGateway) -> dict`; strict input and wire-compatible `AgentResult` output. OFF/unconfigured operation returns `UNAVAILABLE` with no model/gateway calls, invented trace or model ID.
- `agents/coordinator.py`: one model-directed loop for four logical roles. At most eight gateway attempts including retries; gateway/model/execution limits 5/10/30 seconds; scoped argument checks, sanitized errors and observed reference-only traces. Cancellation preserves the attempted tool in the trace. Only explicitly retryable timeout/source errors retry, within the same budget.
- `providers/gemini.py`: Gemini 3.8 Flash (`gemini-3.8-flash`) via the Google GenAI async SDK. Native function calling is manual (`automatic_function_calling.disable=True`); model function requests are validated by the coordinator before the gateway runs. Original opaque thought signatures are retained only in private provider history for SDK replay. Final proposals use JSON Schema and Pydantic; private model reasoning is not exported. Output is capped at 8,192 tokens and thinking level is `low` within the existing deadlines.
- `tools/schemas.py`, `tools/selection.py`: frozen DTO field names, seventeen callable tool schemas and exact per-role permissions. Internal AI procedures are not gateway tools. Backend-only evaluation/finding/audit writes and human transitions cannot be requested through the model's tool definitions.
- Source-grounded extraction guards verify actual page-text slices, eight allowed rule semantics, source/version consistency, twelve-section coverage and backend validation/coverage receipts. These guards encode frozen product constraints, not PDF answers; production code never reads the expected-output oracle. Ambiguity remains a blocked, unapproved proposal.
- Patient/lab/medication investigations retain missing/contradictory/order-only evidence. Tasks carry deterministic semantic keys; actual persistence, authorization and deduplication remain gateway responsibilities. A backend `NO_ACTION` result stops monitoring enrichment without unnecessary scans.
- `evals/fixtures.py` and `tools/fake_gateway.py` are explicitly test doubles. `evals/handoff_examples.json` contains serialized P-083 and P-042 request/results from observed **mock-model/mock-gateway** executions; it is not evidence of live inference or case persistence.

The conservative language guard rejects certain explicit clinical directives in summaries/questions. It is not clinical validation or proof of semantic truth. Every displayed AI summary remains a human-review draft; the backend independently validates stored sources and owns clinical classifications.

## Observed verification

On local **Python 3.13.6**, using isolated `ai/.venv` with inherited Pydantic/PyMuPDF:

```powershell
ai/.venv/Scripts/python.exe -m pytest ai/tests -q
ai/.venv/Scripts/python.exe -m ai.evals.run_evals --live
```

Observed before handoff: **67 tests passed**; **12 scenario evaluations passed** (mocked model/gateway, plus actual OFF entrypoint). Coverage includes all eleven invalid-output fixture mutations; real source-PDF text and Unicode anchors; complete/ambiguous/unreadable-source responses; order/use and missing/stale/conflicting evidence branches; role/scope violations; source injection; forged citations/approvals; task identity stable under rephrasing/ref ordering; retries, deadlines and cancellation; DTO field parity; OFF/SDK-unavailable behavior; and prevention of production imports of answer oracles/backend storage.

The installed **google-genai 3.3.0** was exercised through its actual async request serialization using a mock HTTP transport: function declarations, JSON output configuration, function-response IDs and thought signatures were checked without making a network model request. `--live` reported **SKIP LIVE** because enabled credentials are absent. No actual account access, quota, live latency, live model behavior or E2 persistence/integration is claimed. The inherited anyio pytest plugin emits a non-failing deprecation warning. Python **3.12** remains the frozen deployment target and still needs a run in IC's target environment.

The shared `python tools/protocol_fixture.py --check` also passed before implementation. Fixture hashes and shared contract files remain unchanged.

## IC dependency/configuration request

The shared manifests/scaffold were absent. Please supply the IC-owned `ai/pyproject.toml` with appropriate packaging and dependencies. Tested local versions to review/pin: **Pydantic 2.13.4**, **google-genai 3.3.0**; development **pytest 9.2.0**. PyMuPDF is needed only for the existing shared fixture check and PDF text parity test, not runtime AI storage access. No manifest was created or modified by E3.

Provider config is read from **server process environment only**: `LLM_ENABLED`, `LLM_PROVIDER=gemini`, `LLM_MODEL=gemini-3.8-flash`, `LLM_API_KEY`, existing deadline/step/retry variables. Root `.env` loading belongs to E2. Pydantic Settings reading a `.env` file alone does not export these values into `os.environ`; E2 must arrange server-side process configuration before calling the entrypoint. The SDK receives `LLM_API_KEY` explicitly. Do not send it via `AgentRequest`, tool payloads, source/model input or a browser bundle. No second key variable is required.

SDK/model references used: [Google GenAI SDK](https://googleapis.github.io/python-genai/), [Gemini function calling](https://aistudio.google.com/docs/function-calling), [structured outputs with tools](https://aistudio.google.com/docs/structured-output#tools). The installed SDK's `FunctionResponse.id` is preserved with its matching `FunctionCall.id`; no arbitrary provider REST format was invented.

## E2 integration requirements and remaining checks

1. Validate actor/site/trial/approved-version scope before `run_agent`; extraction alone may use an unapproved source. Supply a fresh, appropriately scoped gateway. AI cannot inspect backend tables or verify authorization independently of that gateway.
2. Implement the exact `invoke(name,payload)` contracts in AGENT_DESIGN §4: common version/execution/trial/protocol/correlation fields, patient ID for patient-scoped executions, typed tool fields, success `{tool_name,data,evidence_refs,source_watermark,result_code}` or error `{tool_name,error_code,retryable}`. The coordinator supplies the authorized request's patient ID even for case/source reads; gateway authorization must independently check stored ownership. Result codes are categorized uppercase identifiers; do not include narrative or exception details. Verify every evidence reference against persistence.
3. Supply exact persisted page text and hashes in `PageSpan`; spans are Unicode code points, not bytes. `parse_protocol` and `locate_clause` must use the same source version/text. A model finishing extraction must have actually used backend `validate_rule_schema` and `report_coverage`; zero blockers still does not approve rules.
4. Backend alone performs reassessment, finding/case creation, review lifecycle, approvals and audit. Task proposals alone can write through constrained gateway permissions; use unique `(execution_id,tool_name,semantic_key)`/business keys. Store returned `AgentResult` and trace with append-only attempt metadata. A tool cancellation leaves side-effect receipt unknown, so use the same semantic key on retry rather than assuming a task was never created.
5. Persist execution attempts, step/deadline accounting and completed results. Do not restart an exhausted `execution_id` with fresh budgets or execute the same completed run again. E3 deliberately has no global patient-result cache or substitute database; durable replay protection across calls/restarts belongs to E2's existing execution/job ledger. Each invocation enforces its supplied request/config limits.
6. `request_med_reconciliation.source_event_ids` must be real authorized source-event references. Screening fact DTOs do not expose natural event IDs; the provided order-only example uses `request_verification_task` with verified evidence refs rather than inventing event identifiers. Backend can persist that as the human reconciliation request.
7. Run the actual E2 gateway against the P-083 and P-042 scenarios, the H6/H14 vertical slice, real upload/parser failures and real persistence/idempotency/approval tests. Example snapshot/execution/case/evidence IDs are from the mock gateway; substitute the corresponding actual persisted IDs without changing DTO fields or frozen patient/protocol bindings. Mock-gateway security tests do not prove the absent backend parser or authorization service. Run a real enabled Gemini smoke with permitted synthetic inputs once a key/account is configured; measure latency under the frozen deadlines. `python -m ai.evals.run_evals --live` uses a synthetic gateway even when the model is live and explicitly labels that limitation.

No clinical criteria were approved, patients enrolled, treatments changed, cases persisted or external messages sent by this workstream.
