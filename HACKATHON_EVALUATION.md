# ProtocolPulse — independent hackathon evaluation

**Reviewed:** 15 November 2026, Europe/Athens. **Internal score: 74.5/100.**

This review tested existing code and added only evaluation harnesses/evidence. I did not implement ProtocolPulse. This is a software/product assessment of a synthetic prototype, not a clinical validation, certification, or prediction of the competition result. Scores are judging opinions; observed outcomes below are supported by recorded runs.

## A. Ten-line executive verdict

1. **This is a functioning clinical monitoring prototype:** a fresh HTTP event caused persisted reassessment, a finding, and a review case; it is more than patient matching.
2. All fifteen candidates were actually screened: **3 potential matches, 6 needing review, 6 protocol conflicts, 0 evaluation errors** in the independent run.
3. Approval, medication timing, stale evidence, order-versus-use, duplicate suppression, irrelevant-event suppression, review history, and API restart behaved correctly in the tested scenarios.
4. **AI is real but its contribution is narrower than the product’s full workflow:** rules and backend services determine results; AI interprets the supported protocol, selects evidence, requests verification, and drafts material for humans.
5. Real network-enabled runs showed different laboratory, order-only, contradictory-medication, relevant-event, and irrelevant-event tool paths with persisted action outcomes.
6. A fresh uploaded PDF produced eight unsigned **MODEL** proposals; a fresh medication event automatically reopened the existing case and produced a successful **AI_DRAFT** using four observed tools.
7. The protocol capability remains a fixed PX-104 interpreter with independent hardcoded semantic validation, not demonstrated general protocol understanding or four cooperating autonomous agents.
8. The largest user-value gap is after investigation: Patient 360 does not follow the job to its result, and persisted verification tasks lack a dedicated actionable user workflow.
9. A live medication question confused the clinical event date with the documentation date; verified citation IDs alone did not prevent misleading prose.
10. **Ship the synthetic hackathon demo with explicit boundaries; do not ship clinical use.** Spend the remaining five hours making existing investigations visible, temporally faithful, and actionable rather than adding agents.

### Evidence and review method

Read the project context, product specification, architecture, agent design, API contracts, data model, development plan, integration report, AI remediation record, and relevant implementation/tests. Historical implementation reports were treated as claims to investigate. Current independent evidence takes precedence.

| Evidence | What I actually ran/observed |
|---|---|
| [Source manifest](artifacts/integration/judge/manifest.json) | Current commit and selected source fingerprints. Some AI hashes differ from the older integration manifest; older logs are not substituted for current tests. |
| [HTTP probe](artifacts/integration/judge/http-probe.json), [runner](tools/integration/judge_probe.py), [command](artifacts/integration/judge-http.command.json) | New migrated/seeded SQLite database; actual Uvicorn on 8015; extraction, approval, screening, custom event, duplicate, irrelevant event, review, and process restart. LLM deliberately OFF for this reproducible core run. |
| [Live agents](artifacts/integration/judge/live-probe.json), [command](artifacts/integration/judge-live-single-worker.command.json), [runner](tools/integration/judge_live.py) | Actual configured Gemini service, backend gateway, SQLite, and one worker. Six investigations; no substituted model. PARTIAL is distinguished from failure and from complete investigation. |
| [Uploaded-source and automatic-monitoring run](artifacts/integration/judge/live-workflow.json), [command](artifacts/integration/judge-live-workflow.command.json) | Actual PDF upload/extraction and a new SYN-MED-R2 administration posted through HTTP, automatic AI enrichment, case reopening and AI draft persistence. |
| [Browser evidence](artifacts/integration/judge/browser.json), [command](artifacts/integration/judge-browser-edge.command.json), [runner](tools/integration/judge_browser.cjs) | Real headless Edge/Chromium, Next development server on 3015, actual API on 8016. Six pages, source/evidence display, selector/case reloads, screenshots, axe checks; no mocked transport. This was a navigation/refresh audit, not a fresh full browser mutation journey. |
| [Python regression](artifacts/integration/judge-python.log) | **175 passed**, one Starlette/AnyIO deprecation warning, 98.83 seconds. Includes mocked-model tests, which are not counted as live inference. |
| [Frontend regression](artifacts/integration/judge-frontend-tests.log) | **42 passed, 10 skipped**; `--configLoader runner` avoided a sandbox directory-access failure in the default loader. The opt-in live client suite was not run here. |
| [Type checking](artifacts/integration/judge-typecheck.log), [frontend lint](artifacts/integration/judge-lint.log), [fixture check](artifacts/integration/judge-fixture.log) | All passed. Fixture checks cover five pages, eight rules, twelve sections, exact hashes/spans and eleven negative mutations. |
| [Production build](artifacts/integration/judge-build.log), [command](artifacts/integration/judge-build.command.json) | `npm.cmd --prefix frontend run build` passed, including compilation, lint/type validation and page generation. Production serving/deployment was not tested. |

Environment/harness caveats: README’s `.venv` was absent; the existing `backend/var/venv312` worked. `npm.cmd` avoided PowerShell’s script policy without changing it. The initial sandbox-network model run failed `PROVIDER_ERROR`; network-enabled runs succeeded. An intermediate run accidentally had two judge workers sharing the audit DB and is explicitly excluded from AI reliability conclusions (`live-probe-two-workers-invalid.json`). Its artifacts remain for transparency. The first HTTP harness used the wrong multipart field; after correcting the harness, a new database passed. Default bundled Chromium was absent; installed Edge worked. These are not counted as product defects. No existing demo database or `.env` was reset or edited.

**Unverified:** sustained provider success/latency, clinical benefit, unrestricted PDFs, production authentication, production deployment, real EHR/FHIR ingestion, broad adversarial robustness, complete keyboard/screen-reader accessibility, and a fresh full browser mutation journey with AI enabled. The production build passed; the observed browser used the development server.

### Official event criteria, separately from this rubric

The [Gen AI Summit Hackathon event page](https://hackathon.polymath42.com/) identifies the Athens 14–15 November event and publicly names **usefulness, craft, and aura points**, with emphasis on agents performing real multistep work. It supplies no numerical weights in the inspected page. Its build-window rule also makes provenance relevant; this review did not verify when the implementation was built.

Mapping only: usefulness relates to this report’s workflow/challenge categories; craft relates to completeness, evidence, UX and reliability; an honest working demonstration relates partly to presentation. “Aura points” has no published numerical definition here. **The ten weights below are the user’s internal rubric, not official organizer scoring.** No unrelated hackathon’s judging page was adopted.

## B. Transparent weighted rubric

Weighted points = category score / 10 × weight. UNVERIFIED capabilities receive no assumed implementation credit; each score reflects the tested portion and explicitly carries the stated limits.

| Category | Score /10 | Weight | Points /100 | Observed evidence | Uncertainty / deduction |
|---|---:|---:|---:|---|---|
| Real-world workflow usefulness and safety-aware value | 8.0 | 18% | 14.40 | New event → evidence-linked case → four attributed review steps; no automatic enrollment/treatment. HTTP probe and live workflow. | No coordinator usability study; agent follow-up is fragmented. |
| Risk-based Clinical Trial Monitoring fit | 8.0 | 12% | 9.60 | Relevant-event targeting, no irrelevant-event case, grouped findings, priority and reopening. | Three monitoring rules; no demonstrated site-level KRIs, visit adherence, consent or endpoint monitoring. |
| Differentiation beyond patient-to-trial matching | 7.0 | 12% | 8.40 | Source-linked rules connect baseline selection to dated participation monitoring and disposition history. | No verified competitive exclusivity; no integration with existing trial systems. |
| Real agentic autonomy/tool use/branching | 7.0 | 15% | 10.50 | Real lab/medication paths, persisted verification writes, NO_ACTION early stop, automatic four-tool monitoring draft. | Protocol path is programmed; explicit monitoring consumed seven tools without case context; no measured advantage over simpler retrieval. |
| End-to-end completeness and persistence | 7.0 | 12% | 8.40 | HTTP extraction/approval/screening/event/review; identical checked resources after process restart; fresh MODEL extraction. | Task lifecycle and investigation-result UX incomplete; no fresh browser mutation replay. |
| Clinical evidence, temporal accuracy and uncertainty | 7.5 | 10% | 7.50 | Criterion-level citations; stale labs/order-only/conflicts UNKNOWN; DST/window tests pass; historical baseline preserved. | Actual AI question misstated recorded date; citations do not verify every sentence. |
| UX and information architecture | 7.5 | 8% | 6.00 | Six real pages, readable criterion matrix, source details, case decisions, reload persistence; screenshots inspected. | Async investigations become a job-ID notice; mixed display zones; no permanent synthetic banner; one axe finding. |
| Reliability/error handling/reproducibility/tests | 8.0 | 6% | 4.80 | 175 Python + 42 frontend tests; HTTP restart and guard negatives; bounded tools/provider failure handling. | Small live sample; original setup command unavailable locally; skipped live frontend tests; no load or soak test. |
| Synthetic-prototype security/privacy boundaries | 7.0 | 4% | 2.80 | Synthetic-only server guard, PDF byte allowlist, role/site/tool gates, verified source references, server-side credential use. | Actor header is impersonable by design; no production authentication; live UI does not prominently identify synthetic data. |
| Presentation clarity/demo readiness | 7.0 | 3% | 2.10 | Working protocol, candidate, monitoring, case and audit views; honest curated/model separation in API. | Technical rule vocabulary, investigation dead end, future fixture dates and unavailable README venv make an unrehearsed demo harder. |
| **Total** | | **100%** | **74.50** | | |

## C. Tested strengths and required scenario coverage

### Initial protocol and real screening

The fresh OFF-mode extraction job explicitly returned `CURATED_FIXTURE`, not AI success. It left source-linked rules/coverage unsigned. Screening before approval returned **409 PROTOCOL_NOT_ACTIVE**. A separate synthetic investigator action approved/activated the eight rules and coverage; actual screening then returned fifteen assessments. Approval in this audit is a QA action, not a clinician endorsement.

Separately, the live upload created a new PDF source and protocol `PV-4a126e0ae56241db8d22fe0859e1e4e2`. Its extraction job returned **SUCCEEDED / proposal_origin=MODEL**, and eight unsigned rules persisted with twelve coverage sections. This newly uploaded version was not activated because another version was already active; independent approval/screening were exercised on the earlier curated version. The existing mocked-model upload/approval test also passed, but it is not represented as a second live approval run.

References: `backend/tests/test_model_extraction.py::test_uploaded_model_proposals_persist_unsigned_then_human_approves_and_screens`; `backend/tests/test_approval.py`; [protocol screenshot](artifacts/integration/judge/browser-protocol.png).

### Seven archetypes, inspecting criteria rather than an aggregate score

All rows below come from `http-probe.json → assessments.items`; five eligibility criteria were evaluated for each patient. No percentage match score was used as proof.

| Patient | Actual overall result | Decisive criterion and exact evidence | Clinical interpretation permitted by this fixture |
|---|---|---|---|
| P-042 | POTENTIAL_MATCH | `PX-EXC-02 PASS`, `FACT-P-042-no_restricted_use`; `PX-INC-03 PASS`, `LAB-P-042-0` | Explicit reviewed no-use plus timely lab; screening still does not enroll. |
| P-175 | PROTOCOL_CONFLICT | `PX-EXC-01 FAIL`, `COND-P-175-X` | Verified active excluded fictional condition. |
| P-124 | NEEDS_REVIEW | `PX-INC-03 UNKNOWN / OUTDATED_LAB`, `LAB-P-124-0` | September specimen cannot satisfy October window. A numerical value alone is insufficient. |
| P-117 | PROTOCOL_CONFLICT | `PX-EXC-02 FAIL`, `MED-P-117-1` | Confirmed October 15 use overlaps the lookback window. |
| P-118 | POTENTIAL_MATCH | `PX-EXC-02 PASS`, `FACT-P-118-no_restricted_use` | September 20 historical use is outside the window; passing also requires the explicit full-window reconciliation. |
| P-083 | NEEDS_REVIEW | `PX-EXC-02 UNKNOWN / ORDER_ONLY`, `MED-P-083-1` | Order is not administration or ingestion. |
| P-140 | NEEDS_REVIEW | `PX-EXC-02 UNKNOWN / CONFLICTING_SOURCES`, `MED-P-140-1`, blocking source-conflict context | Conflicting evidence is retained instead of choosing the convenient assertion. The baseline result’s citation alone is not a complete presentation of both conflicting claims. |

The medication considered interval is **2026-09-30T21:00Z to 2026-10-30T22:00Z**, i.e. `[October 1, October 31)` in Athens across the DST change. The lab window includes October 31. Verified tests include `test_calendar_dst_and_distinct_windows`, `test_washout_boundaries`, `test_without_reconciliation_outside_use_is_unknown`, and `test_lab_specimen_inclusive_not_record_date` in `backend/tests/test_evaluator.py`.

### Monitoring, noise, disposition and persistence

- A newly generated `JUDGE-<uuid>` source identity was posted through `POST /api/v1/patients/P-042/events`, independently of the preset UI. The worker persisted an immutable monitoring assessment, `PX-MON-01` finding and one case. This disproves a button-only illusion for the tested inputs, although supported clinical semantics remain intentionally fixed.
- Identical event content with a **different Idempotency-Key** returned the original event with `deduplicated=true`; changed content under the same source version returned **409 EVENT_VERSION_CONFLICT**. Exactly one logical case remained.
- P-151 was first recorded as participating. SYN-MED-N1 then yielded **NO_ACTION**, empty assessment/finding/case IDs, and no case; this was not just a nonparticipation shortcut.
- Coordinator resolution was **403 ROLE_FORBIDDEN**. Investigator transitions ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED persisted four attributed, evidence-cited decisions.
- The original baseline assessments stayed identical after monitoring. Stopping/restarting the actual API process preserved the five checked resource payloads, including audit and case decisions.
- A later fresh SYN-MED-R2 event reopened the same case, preserved the earlier decisions, and automatically produced a successful AI draft. Its backend core classification preceded AI work.

References: [HTTP probe](artifacts/integration/judge/http-probe.json); [automatic event](artifacts/integration/judge/live-workflow.json); `backend/tests/test_api_contract.py::test_full_h6_h10_and_review`; `backend/tests/test_transactions.py`; [case screenshot](artifacts/integration/judge/browser-case.png).

### Failure and safety checks

| Requested check | Observed result and limit |
|---|---|
| Unavailable LLM | OFF explicit investigation returned 503 AGENT_UNAVAILABLE; deterministic case/review worked. Actual restricted-network provider failures were recorded without fake tools/summaries. |
| Malformed protocol | Public malformed non-allowlisted PDF rejected 403; this proves the allowlist, not arbitrary malformed-document understanding. Executed parser/private-file-damage and eleven proposal-mutation tests cover additional failure paths. |
| Stale labs / contradictions | Actual P-124/P-140 results UNKNOWN; real investigations retained uncertainty. Multiple evaluator cases and mocked conflict paths passed. |
| Unauthorized review | Actual coordinator resolution returned 403; role/closure/rollback tests passed. Anyone deliberately choosing the investigator demo header can impersonate that actor: this is not authentication. |
| UI refresh | Real selector/case reloads retained patient/run and CLOSED review history in captured browser evidence. |
| API restart | Actual process termination/start, no reseed; selected payloads matched. This is not a mid-model-execution crash test. Lease/interruption behavior is covered separately by automated tests. |
| Unsafe medical conclusions / live PHI | Tested outputs preserved order-versus-use and human review; no treatment instruction was observed. Data came from seeded fictional records and synthetic events. No live patient source was connected. Temporal prose error is documented below rather than dismissed. |

## D. Concrete defects and limits

Severity: **P0** unacceptable safety/data failure; **P1** major user or evidence failure; **P2** material limitation; **P3** minor presentation/accessibility issue. **No P0 was observed in the exercised synthetic scope.** Static findings are labeled and are not claimed as runtime reproductions.

### D1 — P1: live AI question confuses effective and recorded dates

**Reproduction:** inspect `live-probe.json`, execution `EXEC-d308d8ac71864f32b340079fe014c8cf`, `verification_questions[0]`, then `patients_after.P-083.medications[0].evidence`. The question says the order “was recorded on 2026-10-14.” Actual `recorded_at` is **2026-10-30T10:00:00Z**; `effective_at` is **2026-10-14T21:00:00Z**, October 15 in Athens.

**Hypothesis/module:** free-text model drafting in `ai/providers/gemini.py` and role prompts; reference registry verifies identity/spans, not every temporal statement. **Impact:** misleading evidence chronology despite valid citations. No wrong deterministic candidate classification was observed. **Fix direction:** construct an authoritative effective/recorded/site-local fact block in code and require prose/questions to use those labels; add a targeted semantic regression rather than relying on citation validity.

### D2 — P1: Patient 360 starts an investigation without completing the interaction

**Reproduction/source inspection:** `frontend/components/PatientActions.tsx:74` always requests EVIDENCE_INVESTIGATOR, stores only a job-ID notice, and neither polls the job nor links/renders `resource_id` with AgentExecutionPanel. On the patient page there is no completed investigation result even though the independent API investigation persisted one. The audit page offers a separate technical discovery route.

**Root cause/module:** request handling stops at acceptance. **Impact:** valuable work is hidden from the coordinator, medication-specific role is bypassed from this button, and a user cannot judge completion or act on the result in context. The runtime screenshot confirms the entry point; successful UI submission-to-result was not independently exercised.

### D3 — P1: verification tasks persist without an operational follow-up loop

**Reproduction:** successful `request_verification_task` appears in actual live traces; inspect [task rows](artifacts/integration/judge/tasks.json). Then inspect `Patient360.open_items` serialization in `backend/app/services/evidence.py:328` and all 26 API routes: it returns OpenItem rows, not the persisted VerificationTask records; there is no dedicated task completion operation. `PatientSections` renders those open items rather than an actionable task inbox.

**Root cause/modules:** separate task persistence was not connected to public task presentation/lifecycle. **Impact:** real agent writes have limited practical value; users cannot reliably find ownership/status or complete the proposed verification through a supported task flow. Existing case review works and should not be conflated with this missing evidence-resolution loop.

### D4 — P2: explicit monitoring investigation is deprived of linked case context

**Reproduction:** actual explicit P-042 monitoring run `EXEC-9465880c4a454cb9885f8a990a1b564f` used seven tools, requested verification, and returned PARTIAL / INCOMPLETE_INVESTIGATION without `get_case_status`. Automatic run `EXEC-1a72102418f748c3ba4d0c77637dfce4` used four tools including case status and SUCCEEDED.

**Hypothesis/module:** `agent_adapter.execute_job` populates `context['case_ids']` from cases whose `agent_execution_id` equals the new execution, rather than finding the event’s existing case. A newly requested explicit execution is not that case’s linked automatic execution. `Coordinator.monitoring_ready()` requires a case-status read. **Impact:** avoidable tool calls and forced incomplete handoff. The actual comparison supports the hypothesis; it is not a controlled statistical latency comparison.

### D5 — P2: task creation can add work without a criterion-specific unresolved gap

**Observed:** the explicit P-042 run requested verification of an already confirmed administration despite no clinical unknown in its returned reasons; only INCOMPLETE_INVESTIGATION remained. **Static cause:** `evidence_gateway.py:439` accepts any existing OPEN patient OpenItem as the prerequisite for a task. The semantic key also incorporates model-supplied reason text and evidence membership, which can vary between investigations (`coordinator.py:182`).

**Impact:** possible task noise and repeat tasks for the same clinical gap. No duplicate-event case multiplication occurred; task deduplication is a different issue. Multiple P-124 tasks exist in the audit DB, but one came from the excluded mixed-worker run, so those rows are not presented as a clean repeatability experiment. **Fix:** criterion-linked unresolved reasons and normalized reason codes; repeat the same investigation to establish behavior before changing keys.

### D6 — P2: synthetic provenance is insufficiently visible in live UI

**Reproduction:** real screenshots of patient/monitor pages identify the study and give a decision-support footer but no permanent synthetic-only/fictional-protocol label. `EnvironmentNotice.tsx` returns null in live mode and production; actor labels displayed are ordinary role names.

**Impact:** a screenshot or live pitch can look more clinically authoritative than the dataset warrants. The fixed future event dates also produce “occurred Nov 19 / recorded Nov 20 / found Nov 15” in the monitor screenshot. That is explainable as a fixture replay, but the interface should say so. This is a presentation boundary issue in a synthetic demo, not proof of real-world prospective-event handling.

### D7 — P2: fixed protocol support is narrower than broad extraction language

**Static reproduction:** PDF upload accepts only the fixture’s SHA-256 (`routes.py:357`); `pdf_extractor.py:111` requires eight known criterion IDs and exact fixed semantics; `protocol_preparation.clause_sections` recognizes PX headings; the extraction coordinator uses a fixed four-tool order.

**Impact:** a new fictional threshold/protocol is rejected, not independently understood and operationalized. This is an intentional safety boundary, not fake live inference. Describe it as a supported-protocol demonstration; generic extraction/atomic-clause discovery remains unverified. Do not remove the guards during the last five hours.

### D8 — P3: PARTIAL message incorrectly attributes clinical uncertainty to failed tools

**Reproduction:** live P-124/P-083/P-140 are PARTIAL with `error_code=null` and successful tool traces. `AgentExecutionPanel.tsx:32` says “some tools did not complete.” **Impact:** users cannot distinguish a completed investigation with unresolved clinical evidence from an interrupted technical investigation. Use actual errors/incomplete reasons to select the wording.

### D9 — P3: inconsistent time-zone presentation increases review burden

**Reproduction:** [patient screenshot](artifacts/integration/judge/browser-patient.png) shows considered windows in UTC but evidence in Athens time; [monitor screenshot](artifacts/integration/judge/browser-monitor.png) shows EET event dates and UTC case updates. `CriterionMatrix.tsx:41` and `CaseRow.tsx:22` omit the trial timezone.

**Impact:** harder boundary checking, particularly across DST. The labels are explicit, so this is not a demonstrated interval-calculation error.

### D10 — P3: monitor patient link fails an axe distinction check

**Reproduction:** `judge_browser.cjs` on `/trials/TR-PX104/monitor`; `browser.json` records `link-in-text-block`, serious automated impact, for the patient link. Text-to-surrounding contrast was reported as 1.59:1 without a persistent underline. **Impact:** link discoverability. Five other tested pages had zero selected WCAG A/AA violations; this is not a comprehensive accessibility certification.

## E. Agentic authenticity and individual agent value

There is **one coordinator with four logical roles**, not a society of four autonomous agents. Three tiny role modules mainly supply guard helpers; the shared coordinator/provider and scoped backend gateway do the work. Adding more files or agents would not increase value by itself.

### Actual action paths

| Execution / situation | Observed tools, in order | Outcome and necessity |
|---|---|---|
| Protocol `EXEC-a54ab679848b45db80a81c28e25c1380` | parse_protocol → locate_clause → validate_rule_schema → report_coverage | SUCCEEDED, eight proposals. Two model interpretation batches provide semantics; tool order is programmed. Parsing and exact anchors need code; for this single frozen PDF, a curated parser could already supply the same rules. Generalization value is unproven. |
| Lab P-124 `EXEC-3707fce571ee49489533ef66a84fa96f` | retrieve_patient_evidence → get_lab_history → search_notes → get_evidence_link → request_verification_task | PARTIAL, no error, 18.172s including polling. A real task persisted. Relevant-note selection and a contextual human question add value; deterministic logic already knew that screening evidence was inadequate. |
| Order-only P-083 `EXEC-d308d8ac71864f32b340079fe014c8cf` | get_medication_timeline → resolve_approved_terminology → evaluate_approved_rule → request_verification_task → search_notes → get_evidence_link → retrieve_patient_evidence | PARTIAL, no error, 27.422s. Real branching/writes; task requested before all later retrieval, substantial headroom risk, and temporal wording error. Class mapping and rule evaluation themselves are deterministic tools. |
| Conflict P-140 `EXEC-699a2d5ccb084c8ea80ddaf4d5b33447` | get_medication_timeline → resolve_approved_terminology → evaluate_approved_rule → request_verification_task | PARTIAL, no error, 18.797s. Retains conflict; did not perform the richer two-note contradiction investigation suggested by the design. |
| Explicit P-042 `EXEC-9465880c4a454cb9885f8a990a1b564f` | classify_event_relevance → get_prior_evaluation → retrieve_patient_evidence → get_evidence_link → resolve_approved_terminology → evaluate_approved_rule → request_verification_task | PARTIAL / INCOMPLETE_INVESTIGATION, 23.125s. Missing case-status read; extra work after the deterministic conflict. |
| Irrelevant P-151 `EXEC-d8a4366cf3de4ae988f0970afde02c29` | classify_event_relevance | SUCCEEDED, 2.953s. Correct short circuit. Backend already supplies NO_ACTION; this particular model invocation is dispensable. |
| Automatic P-042 `EXEC-1a72102418f748c3ba4d0c77637dfce4` | get_case_status → classify_event_relevance → get_prior_evaluation → retrieve_patient_evidence | SUCCEEDED, no unknowns; AI_DRAFT persisted on REOPENED case. Useful case/evidence handoff; AI did not create the conflict or decide reopening. |

These timings are individual observations, not latency percentiles or clinical productivity measurements. Source: independent live JSON and sanitized model logs. The later workflow run uses a separate current server log; earlier per-role trace evidence remains in the saved JSON.

### Per-role value rating

These are separate qualitative ratings of **incremental current user value**, not extra weighted categories.

| Logical role | Value /10 | What earns it | What limits it | Best five-hour improvement |
|---|---:|---|---|---|
| PROTOCOL_INTELLIGENCE | **6.0** | Actual model-derived interpretations, exact source attachment, validation, unsigned persisted uploaded-source proposals. | One accepted PDF/fixed semantics, programmed tool pipeline, no demonstrated new-protocol capability. | Show MODEL versus CURATED, source and reviewer corrections clearly; preserve frozen scope. |
| EVIDENCE_INVESTIGATOR | **7.0** | Finds relevant lab/narrative context and produces a persisted, sourced verification request. | Output hidden from the patient workflow; retrieval can restate an already-known gap. | Poll and display the result in Patient 360; make the question/owner visible. |
| MEDICATION_SAFETY_INVESTIGATOR | **6.5** | Actual timeline/terminology/rule branching; respects order-versus-use and conflicting evidence. | Temporal prose error, long order-only path, conflict path does not show a full evidence comparison. | Use structured effective/recorded dates; dispatch medication unknowns to this role; show both claims. |
| MONITORING_WORKFLOW | **6.0** | Successful automatic source-linked draft, reads actual case/evaluation delta, stops for irrelevant events. | Often summarizes a backend result; explicit context gap/incomplete run; irrelevant model call adds little. | Supply the correct existing case context and finalize once the review packet is sufficient. |

**Shared coordinator/guard layer: 8/10 as engineering infrastructure, not a fifth agent.** It enforces scope, tool allowlists, exact reference registry membership, eight tool attempts, five-second tools, ten-second model calls and a thirty-second overall budget. The backend compares claimed traces with observed gateway actions and exclusively owns findings/state changes. Executed boundary/injection tests support those controls; they do not prove clinical correctness of every sentence or universal prompt-injection resistance.

**Authenticity verdict:** patient investigations are genuinely tool-using, model-directed and capable of bounded writes through the gateway. They are not chatbot-only flows. The protocol path is a deterministic AI-assisted pipeline. Monitoring detection, relevance, case creation, priorities, grouping and lifecycle are backend automation; calling those “autonomous AI clinical decisions” would be false. The strongest AI demonstration is the evidence investigation and human handoff, not the mere existence of a case.

## F. User value and competitor positioning

**What the product truly does:** supports one fictional trial with source-linked approved rules, three-valued temporal screening, recorded external participation, event-driven review findings, case lifecycle and optional evidence investigations. It connects recruitment and monitoring at the patient/protocol/evidence level. It does not yet connect every agent task back into an effective daily workflow.

**What remains mock or constrained:** demo actors; synthetic patients/terminology; single allowlisted PDF; externally recorded participation references; preset UI event choices; OFF-mode curated rules. Public API event persistence and live AI behavior are real within those constraints. No EHR feed, drug-interaction database, live recruitment, patient contact, clinical adjudication, production identity, amendment activation or compliance certification was demonstrated.

Existing matching is not a novel category: [TriNetX LIVE](https://trinetx.com/solutions/trinetx-live/) advertises cohort definition, feasibility and site/patient identification. Existing monitoring also matters: [Medidata Centralized Monitoring](https://www.medidata.com/en/clinical-trial-products/clinical-operations/rbqm/centralized-monitoring/) describes central monitoring and targeted source review. These are vendor descriptions, not independent vendor-product tests.

The defensible positioning is **an inspectable supported-protocol workflow joining temporal patient evidence to event-triggered review**, with bounded AI investigation. It is not defensible to claim the first AI trial matcher, superior clinical accuracy, replacement of CTMS/RBQM, measured workload savings, or competitive exclusivity. No financial ROI or measured clinical benefit was established.

## G. Ranked improvement backlog and realistic five-hour plan

Assumption for scheduling: the documented team of **three engineers** is available. Estimates are planning judgments, not measured implementation times. Keep the clinical rules, model choice, budgets and safe write boundaries fixed. A single engineer should focus on rows 1–3 plus verification and pitch, rather than attempt all rows.

| Rank | Improvement / value | Complexity | Dependencies | Regression risk | Acceptance test | Owner | Before deadline? |
|---:|---|---|---|---|---|---|---|
| 1 | Complete Patient 360 investigation: poll job, show AgentExecutionPanel, cited questions, retry/failure state; select medication role for medication-only unknowns. Makes existing AI useful immediately. | Small–medium, ~75–100 min | Existing job receipt/resource_id, polling and panel; mixed-criterion behavior kept simple. | Medium: duplicate requests, stale patient context. | Click once on P-083/P-124; observe actual role, terminal result and trace inline; navigation/reload can recover the selected execution; no local invented success. | E1 | **Yes, primary target.** |
| 2 | Prevent date-label invention: authoritative effective/recorded/site-local fact block plus constrained question phrasing. Protects clinical chronology. | Medium, ~60–90 min | Existing facts/reference registry; preserve public DTO. | Medium: wording changes may affect output validity. | P-083 question must distinguish Oct 15 local clinical time from Oct 30 documentation; late-event case retains both dates; invented recorded-date regression fails. | E3, E2 review | **Yes.** |
| 3 | Fix explicit monitoring context: derive case IDs from event findings/patient/version, not only current execution link. Reduces unnecessary investigation. | Small–medium, ~40–60 min | Existing event/finding/case relations and scope guards. | Medium: cross-event/version leakage. | Explicit investigation of existing P-042 event sees the correct case; cross-patient case denied; relevant read/finalize path fits original budget. | E2 | **Yes.** |
| 4 | Surface actual task handoff with patient/criterion, question, role, evidence and OPEN status. Make persisted writes reviewable. | Medium, ~90–120 min | E2/E1 agree minimal contract extension or reuse existing verified execution questions as an explicitly partial interim view. | Medium: presenting a question as a completed verification. | A created task is findable from Patient 360 with real task identity/status; if only questions are exposed, UI explicitly says task lifecycle is unavailable. Case closure never changes clinical facts. | E2 + E1 | **Conditional.** Full task closure/evidence resolution is deferred; do not rush it. |
| 5 | Make task requests criterion-specific; normalize reason codes; inspect repeated evidence before writing; finalize when evidence is sufficient. Reduces task noise and budget waste. | Medium, ~60–90 min | Correct case context; existing open-item semantics and allowed reason registry. | Medium: suppressing a legitimate verification need. | Confirmed administration with no criterion gap does not create a redundant verification task; ORDER_ONLY still does; repeated same-gap investigation does not create another logical task. | E3 + E2 | **Conditional; narrow guard fix only.** |
| 6 | Add permanent synthetic/fictional label, explain fixture replay clock, distinguish unresolved-evidence PARTIAL from technical interruption, unify displayed trial zone, underline failing link. Improves honesty and review comprehension. | Small, ~45–60 min total | Existing layout/status/time helpers. | Low. | All six views show synthetic boundary; P-083 PARTIAL with successful tools says evidence unresolved; axe link check clears; period and source timestamps use labeled Athens time. | E1 | **Yes; reduce scope if row 1 slips.** |
| 7 | Rehearse and record evidence of three AI paths plus provider-OFF fallback; run focused regressions and one clean end-to-end demo. Makes claims reproducible. | Small–medium, reserve final 60 min | Rows 1–3 merged; exactly one backend worker; clean separate synthetic DB. | Low if no late feature changes. | Uploaded MODEL proposal → separate human approval → baseline → custom API event → automatic trace → review → replay/noise checks → refresh/restart; save actual outputs. | IC, all engineers | **Yes, mandatory time reserve.** |

### Five-hour execution schedule

| Time from now | E1 frontend | E2 backend/integration | E3 AI |
|---|---|---|---|
| 0:00–0:15 | Agree job/result UI and visible handoff. | Agree case-context fix and minimal task representation. | Pin the temporal regression and expected date labels. |
| 0:15–1:45 | Implement row 1 with existing polling/panel. | Implement row 3; scoped regression. | Implement row 2; output/temporal regression. |
| 1:45–2:45 | Add synthetic label and accurate PARTIAL wording. | Surface tasks only if contract/workflow change is small and agreed. Otherwise expose existing execution questions as the interim. | Tighten only the specific redundant-task/sufficiency path if tests support it. |
| 2:45–3:45 | Integrate result/task presentation; time/link fixes if time remains. | One clean full workflow and persistence checks; help integration. | Repeat live lab, order-only and automatic monitoring; inspect output sentences, not just status. |
| 3:45–4:00 | Freeze features and resolve demonstrated blockers. | Freeze features and identify release state. | Freeze prompts and record actual traces. |
| 4:00–5:00 | Rehearse operator journey. | Run final relevant regressions/health/restart; preserve evidence. | Prepare truthful AI explanation and fallback demo. |

**Cut order:** extra agents, general-PDF ingestion, FHIR, vector search, new medical rules, site-risk dashboards, amendment simulation and production authentication. Those are larger efforts and threaten the working slice. Do not cut date fidelity, human gates, persistent outcomes, or the final verification hour. No numeric score gain is promised by this backlog.

## H. Suggested pitch/demo, using only tested behavior

**Suggested opening:** “A candidate can look suitable at screening and still need new protocol review when later evidence arrives. ProtocolPulse preserves the original decision and assembles the new review case.”

1. **Working:** show supported fictional PDF and source anchors. If AI is enabled, show the actual extraction job’s MODEL origin and unsigned rules. With AI OFF, explicitly say the proposals are curated.
2. **Working:** investigator approves; screen fifteen patients. Compare P-117/P-118 timing and P-083 order-only uncertainty. Explain that a match is not enrollment.
3. **Working:** demonstrate a real evidence investigation and show actual tool selection, citations, unresolved question and persisted task. **Current limitation:** today its result is easiest to inspect through API/audit; do not pretend Patient 360 completes that journey until row 1 is delivered and retested.
4. **Working:** record external participation. Post a new synthetic restricted medication event, preferably using a fresh source identity rather than only a memorized preset.
5. **Working:** show the deterministic event job, source/effective/recorded dates, new assessment/finding, grouped case, then the separately persisted automatic AI draft and observed tools. Replay the same event and show no extra case.
6. **Working:** show irrelevant event NO_ACTION, a human decision with cited evidence, preserved history, and refresh. **Mock:** actor identity and external participation source. **Proposed:** live hospital feeds, complete task resolution and general-protocol support.

Say: **“AI investigates and drafts; approved rules and backend services determine the result; investigators own disposition.”** Do not say “AI discovered the drug was unsafe,” “clinically validated accuracy,” “four autonomous clinicians,” or “integrates with hospital records.” Also avoid reporting the model’s incorrect recorded-date wording as fact; correct it with the source record.

## I. Re-test checklist after engineer changes

- [ ] Start one worker against a new migrated synthetic DB; record source revision/config without credentials.
- [ ] Upload allowlisted fictional PDF with AI ON; verify MODEL proposal origin, source binding, eight unsigned rules, twelve coverage sections and actual model telemetry. Repeat OFF separately with CURATED label.
- [ ] Screening before approval fails; qualified synthetic investigator review activates; concurrent old model result cannot replace an approved version.
- [ ] Screen all fifteen; compare P-042/P-175/P-124/P-117/P-118/P-083/P-140 criterion status, reasons, exact source/version and considered interval.
- [ ] From Patient 360 request lab and medication investigations; observe actual chosen role, job polling, final execution, task/question, source links and failure handling.
- [ ] Inspect every generated chronology statement for effective versus recorded dates and Athens calendar conversion; reproduce P-083 regression.
- [ ] Repeat same unresolved investigation: confirm appropriate task behavior; no duplicate logical task or unrelated task for confirmed evidence.
- [ ] Post a fresh custom administration through API; verify persisted backend result, automatic agent trace, sourced draft and human review case. Preserve baseline results.
- [ ] Explicitly investigate that event; correct existing case context must be available and scoped. No extra case should be created by investigation.
- [ ] Replay identical source/version using both same and different request keys; compare IDs and case/finding counts. Changed content under same source version must conflict.
- [ ] Participating P-151 irrelevant event: NO_ACTION, no new case; order-only event: review/uncertainty, not confirmed ingestion.
- [ ] Coordinator cannot resolve/close; investigator must cite evidence and rationale. Check attributed decisions, reopening and audit after later material evidence.
- [ ] OFF/missing key/provider timeout, malformed PDF/proposals, stale labs, conflicting sources and unavailable evidence retain honest status without curated fallback when enabled.
- [ ] Refresh patient/result/case, restart actual API without reseeding, compare persisted payloads; test interrupted execution separately if recovery code changed.
- [ ] Check synthetic labels and PARTIAL wording across live/production UI; rerun axe on monitor; verify source and period time zones.
- [ ] Run relevant backend/AI regressions, frontend tests/typecheck/lint and production build; distinguish skipped/mocked/live checks. Record failures rather than relying on previous logs.

## J. Ship/no-ship

**SHIP for the synthetic hackathon demonstration**, provided the operator describes the single-protocol scope, demo identities, curated fallback and incomplete task workflow accurately. The tested core is persistent and does meaningful monitoring work. A fresh upload and automatic event-enrichment path actually ran; this judgment does not rely on screenshots alone.

**NO-SHIP for clinical operations or real patient data.** Reasons: impersonable demo identity, narrowly fixed protocol/input support, no validated clinical performance or external system integration, incomplete verification-task resolution, and an observed AI temporal error despite valid citations. No demonstrated safety or regulatory certification follows from passing tests.

**AI investment decision:** retain the four logical roles and current safety boundary. The highest return within five hours is to deliver each existing investigation to the person who must act on it, with faithful source/time evidence and an explicit next step. More autonomous agents would currently multiply orchestration without closing that gap.
