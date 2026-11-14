# AI HACKATHON IDEAS — 16 developed concepts

Research cutoff **14 November 2026**. Supporting external evidence is catalogued in `HACKATHON_OPPORTUNITY_RESEARCH.md` and `HACKATHON_RECOMMENDATION.md`. **Scores are analyst estimates, not empirically calibrated probabilities**. Sponsor access is not assumed. Track designations below use the organizer context supplied in the research request.

## PART III — INNOVATIVE PRODUCT CONCEPTS

### 10–14. Sixteen product dossiers (A–M)

Every tool name prefixed `project-defined` is a function *to implement*, not a claim that a sponsor offers that endpoint. A proposed live external service is explicitly identified as such. Every proposed write occurs only in an owned demo application or with a scope-limited authorized API.

## V1 — ExceptionRelay

**A. Product identity.** Supplier delivery exception agent: confirm a late PO and create an approved revised dispatch plan. **Primary:** Voice/Enterprise. **Secondary:** Open.

**B. Real problem.** **User:** Operations scheduler / supplier coordinator. **Trigger/current workflow:** Carrier ETA differs from PO requested date. **Root cause:** Multiple emails, ETA sources, production priority, and vendor commitments must be reconciled. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S33].

**C. Current alternatives.** ERP exception screen and manual calls. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Upload late-delivery email → fetch purchase order → compare customer deadlines → select recovery option → approve → update demo schedule. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** A time-critical exception case gets an evidence-backed, approved workaround and a verified operations-record update.

**E. Agentic design.** **Goal and inputs:** Carrier ETA differs from PO requested date, using permitted data. **Autonomous evidence-dependent decision:** Check whether delay affects critical production; if not, archive; else rank substitutes, shipping or schedule impact. **Tool catalog with sample input→output signatures:** Project-defined `po.lookup(order_id)->record`, `carrier.status(tracking)->evidence`, `schedule.propose(case)->diff`, `schedule.commit(approved_diff)->id`. These functions require backend implementations, except published external APIs separately described. **Branch:** If alternate stock exists, reserve after approval; otherwise create escalation with shortage evidence. **Authorization:** Human signs off on supplier messages and any order changes. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Re-read affected PO/schedule and show new version plus audit log.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If alternate stock exists, reserve after approval; otherwise create escalation with shortage evidence.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Alert dashboard; PO detail; resolution alternatives; approval drawer; state-diff timeline. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Next.js/FastAPI/SQLite, Gemini tool calling, adapter for synthetic carrier feed. **Data and permissions:** Synthetic PO and carrier snapshots; real ERP connectivity NOT required. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds alert dashboard; po detail; resolution alternatives; approval drawer; state-diff timeline. and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Show a late shipment, branch on inventory, approve a temporary stock allocation, then see dispatch date change. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** False ETA; no real vendor API; vendor-specific rules. **Fallback:** Local snapshot + simulated integration clearly labeled. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce time-to-action and the number of unresolved disruptions; buyer operations teams. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *A time-critical exception case gets an evidence-backed, approved workaround and a verified operations-record update.* The core must be regression tested on two counterexamples. **Initial weighted score:** 80.0/100; **post-critique score:** 79.0/100 (penalty 1).

## V2 — VoiceField Ledger

**A. Product identity.** Hands-busy field inspector speaks evidence; the agent reconciles with asset history and creates a verified work order. **Primary:** Voice/Enterprise. **Secondary:** Open/hardware optional.

**B. Real problem.** **User:** Maintenance technician / property operator. **Trigger/current workflow:** Engineer sees an abnormal gauge and speaks an observation. **Root cause:** Speech without asset context and missing measurements causes incomplete tickets. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S04].

**C. Current alternatives.** Speech note app, CMMS mobile forms. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Select asset → speak reading → query history → ask missing measurement → propose work order → confirm → write. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** The agent asks aloud for an absent measurement and makes the technician confirm the asset ID before writing.

**E. Agentic design.** **Goal and inputs:** Engineer sees an abnormal gauge and speaks an observation, using permitted data. **Autonomous evidence-dependent decision:** Distinguish emergency safety issue from routine maintenance and request only necessary follow-up. **Tool catalog with sample input→output signatures:** Project `speech.transcribe(blob)->text`, `asset.history(id)->records`, `workorder.create(approved)->id`, `workorder.get(id)->record`. These functions require backend implementations, except published external APIs separately described. **Branch:** If temperature is above safe fixture threshold, flag for human and stop actuation; else create routine inspection ticket. **Authorization:** Technician confirms inferred values and ticket; never controls machinery. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Read back work-order ID, recorded measurement and status aloud.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If temperature is above safe fixture threshold, flag for human and stop actuation; else create routine inspection ticket.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Hands-free microphone view, confirmation and ticket card. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Browser media capture, Web Speech or chosen STT, FastAPI/SQLite. **Data and permissions:** Synthetic machine history; sample voice from consenting team member. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds hands-free microphone view and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Inspector speaks while holding tool; agent asks for missing gauge value; new ticket appears. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Venue noise, accent transcription, hallucinated measurements. **Fallback:** Typed transcript fallback and replay captured speech. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Decrease missing inspection fields; facilities/industrial teams. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *The agent asks aloud for an absent measurement and makes the technician confirm the asset ID before writing.* The core must be regression tested on two counterexamples. **Initial weighted score:** 79.2/100; **post-critique score:** 79.2/100 (penalty 0).

## V3 — ClaimBridge

**A. Product identity.** Recovery assistant turning disrupted travel evidence into an approved passenger-rights case package. **Primary:** Voice/Enterprise. **Secondary:** Open.

**B. Real problem.** **User:** Traveler services or airline liaison. **Trigger/current workflow:** Flight cancelled; receipts and rebooking alternatives need organization. **Root cause:** Entitlement, evidence and itinerary are spread across booking emails and provider pages. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S35].

**C. Current alternatives.** Claims firms, airline self-service portal. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Import flight/receipt → apply public rule graph → identify missing evidence → choose claim vs refund → produce case PDF and support record. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Produces verifiable option and cites why a particular compensation path is not available.

**E. Agentic design.** **Goal and inputs:** Flight cancelled; receipts and rebooking alternatives need organization, using permitted data. **Autonomous evidence-dependent decision:** If extraordinary-circumstances status unknown, label uncertain rather than promising compensation. **Tool catalog with sample input→output signatures:** `booking.read(ref)->flight`, `receipt.parse(file)->items`, `rights.evaluate(facts)->eligible/unknown`, `case.save(approved)->id`. These functions require backend implementations, except published external APIs separately described. **Branch:** If ticket refund chosen, do not also claim same fare refund twice; if cancellation status unclear ask for evidence. **Authorization:** Traveler approves any outgoing claim; no airline submission. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Record saved claim package, checksum and retrieved receipt list.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If ticket refund chosen, do not also claim same fare refund twice; if cancellation status unclear ask for evidence.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Rights options pane, receipt gallery, evidence confidence view. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Python, deterministic rules, source references, local DB. **Data and permissions:** Synthetic itinerary plus official EU rules; actual flights not claimed verified. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds rights options pane and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Show cancelled-flight receipts and an exact missing document blocking a claim. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Country-specific rules, stale flight data, customer privacy. **Fallback:** Offline rules and sample evidence packet. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Fewer unsupported claims, prepared case time. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Produces verifiable option and cites why a particular compensation path is not available.* The core must be regression tested on two counterexamples. **Initial weighted score:** 76.8/100; **post-critique score:** 75.8/100 (penalty 1).

## V4 — AccessExit

**A. Product identity.** Account offboarding agent cross-checks HR departure against app inventory and creates verified revocation steps. **Primary:** Voice/Enterprise. **Secondary:** Open.

**B. Real problem.** **User:** IT access administrator. **Trigger/current workflow:** Employee departure record is opened. **Root cause:** Identity directory only partially reflects SaaS permissions. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S38].

**C. Current alternatives.** IdP/SaaS user management and ticket software. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Open sample HR change → enumerate mock SaaS memberships → flag ownership → obtain approval → revoke in controlled sandbox → verify. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Shows divergence between authorized demo app accounts and creates an auditable access-removal record.

**E. Agentic design.** **Goal and inputs:** Employee departure record is opened, using permitted data. **Autonomous evidence-dependent decision:** If resource owner is unclear, preserve access and escalate; otherwise revoke in safe test tenant. **Tool catalog with sample input→output signatures:** `hr.departures()->list`, `app.accounts(email)->list`, `app.revoke(approved)->result`, `app.accounts(email)->list`. These functions require backend implementations, except published external APIs separately described. **Branch:** If the account is service owner, transfer ownership before revoking; unresolved owner becomes exception. **Authorization:** Two-person approval for privileged access; never touch production accounts. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Post-revocation independent account list and audit trail.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If the account is service owner, transfer ownership before revoking; unresolved owner becomes exception.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Departure list, system-specific permissions, revoke queue. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Next.js, demo IdP adapter, signed audit events. **Data and permissions:** Entirely synthetic staff and demo SaaS APIs. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds departure list and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Revocation appears in two separate demo systems with second read verifying absence. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Identity-matching collisions; privilege safety. **Fallback:** Write to an owned fake app; log manual verification elsewhere. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce orphaned accounts; IT/security buyers. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Shows divergence between authorized demo app accounts and creates an auditable access-removal record.* The core must be regression tested on two counterexamples. **Initial weighted score:** 80.8/100; **post-critique score:** 79.8/100 (penalty 1).

## B1 — ProtocolPulse

**A. Product identity.** A changed trial protocol becomes a traceable and executable downstream-document amendment plan. **Primary:** Biotech & AI. **Secondary:** Voice/Enterprise.

**B. Real problem.** **User:** Clinical study coordinator, QA, small sponsor. **Trigger/current workflow:** Visit day changes 28±3 to 21±2 in a new protocol revision. **Root cause:** Schedule, consent, site checklist and registry fields repeat the same concept. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S15] [S16] [S21] [S22].

**C. Current alternatives.** Veeva CTMS/eTMF and manual QC already cover portions. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Load two synthetic protocol versions + four study documents → extract changed facts → find inconsistent clauses → rank → reviewer approves → patch checklist and read it back. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Version-to-version semantic delta linked to sentence-level evidence, condition-aware impact, and verified creation of a corrected owned study artifact.

**E. Agentic design.** **Goal and inputs:** Visit day changes 28±3 to 21±2 in a new protocol revision, using permitted data. **Autonomous evidence-dependent decision:** If the visit applies only to one cohort, update corresponding site document and leave other cohort untouched; unresolved conflicts become review tasks. **Tool catalog with sample input→output signatures:** `documents.diff(old,new)->changes`, `references.find(claim)->occurrences`, `impact.classify(change,occurrence)->finding`, `documents.patch(approved)->new_version`, `documents.read(id)->text`. These functions require backend implementations, except published external APIs separately described. **Branch:** If text contradicts amendment, draft a change; if a document merely quotes old history, mark not impacted; if uncertain ask QA. **Authorization:** QA must approve text, risk classification and every version write; no registry write or clinical authority action. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Exact source and target excerpts, resulting version hash, passed contradiction check.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If text contradicts amendment, draft a change; if a document merely quotes old history, mark not impacted; if uncertain ask QA.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Evidence graph, side-by-side before/after clauses, approval queue, audit events. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Next.js, FastAPI, SQLite, python-docx/PDF text extraction; Gemini structured decisions. **Data and permissions:** Completely synthetic trial and consent; public SPIRIT guidance; no patient data. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds evidence graph and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Judge changes one protocol window: system highlights four affected documents, patches approved checklist, verifies mismatch gone. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Semantic false positives, regulated document risks, near-identical existing vendor tools. **Fallback:** Text and DOCX only; deterministic changed-phrase fixture and direct download. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Count downstream inconsistencies caught, review effort, exact quote precision; target small sponsors/research ops. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Version-to-version semantic delta linked to sentence-level evidence, condition-aware impact, and verified creation of a corrected owned study artifact.* The core must be regression tested on two counterexamples. **Initial weighted score:** 90.5/100; **post-critique score:** 89.5/100 (penalty 1).

## B2 — TrialTrace

**A. Product identity.** Public registry fields cross-check against trial documentation and create a transparent discrepancy register. **Primary:** Biotech & AI. **Secondary:** Open.

**B. Real problem.** **User:** Research coordinator, trial transparency reviewer. **Trigger/current workflow:** An outcome measure is amended. **Root cause:** Registry field and scientific narrative no longer align. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S15] [S18].

**C. Current alternatives.** CTIS/ClinicalTrials.gov, standard QC tools. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Fetch public sample trial → import authorized protocol → map outcomes → detect mismatch → save review case. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Provenance-aware mapping across differently named outcome/timepoint concepts with human-readable evidence.

**E. Agentic design.** **Goal and inputs:** An outcome measure is amended, using permitted data. **Autonomous evidence-dependent decision:** If primary outcome names align but timepoint differs, escalate; if dates are registry metadata only, ignore. **Tool catalog with sample input→output signatures:** `registry.fetch(nct)->record` (documented public read), `protocol.parse(file)->statements`, `mapping.compare()->findings`, `case.save()->id`. These functions require backend implementations, except published external APIs separately described. **Branch:** If protocol says 6 months and registry says 12 months, create discrepancy; if one is historical amendment label uncertain. **Authorization:** Researcher reviews; platform never edits external registry. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Saved discrepancy row with URLs, extracted spans, reproducible mapping JSON.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If protocol says 6 months and registry says 12 months, create discrepancy; if one is historical amendment label uncertain.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Registry panel, linked evidence, unresolved cases. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Python/TypeScript, trial registry public data, SQLite. **Data and permissions:** Public records; synthetic protocol used to avoid claiming real protocol permission. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds registry panel and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Live registry record mapped to protocol with one intentionally introduced mismatch. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Registry API field schema drift, incomplete public docs. **Fallback:** Offline fixture from documented example. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Fewer inconsistent public reporting fields. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Provenance-aware mapping across differently named outcome/timepoint concepts with human-readable evidence.* The core must be regression tested on two counterexamples. **Initial weighted score:** 83.2/100; **post-critique score:** 83.2/100 (penalty 0).

## B3 — EvidenceWeaver

**A. Product identity.** Builds condition-aware contradiction maps for biomedical targets using public literature. **Primary:** Biotech & AI. **Secondary:** Open.

**B. Real problem.** **User:** Translational scientist. **Trigger/current workflow:** Scientist asks whether a proposed target has conflicting preclinical evidence. **Root cause:** Published conclusions vary by model, dose and endpoints. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S19] [S20].

**C. Current alternatives.** PubMed / reference manager / evidence synthesis platforms. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Search papers → extract species/assay/outcome into structured claims → compare -> generate adjudication questions → save evidence matrix. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Identifies *why* papers disagree by conditions and plots required replication rather than just summarizing.

**E. Agentic design.** **Goal and inputs:** Scientist asks whether a proposed target has conflicting preclinical evidence, using permitted data. **Autonomous evidence-dependent decision:** If two papers use different species, do not label direct contradiction; if same model/opposite outcome, flag. **Tool catalog with sample input→output signatures:** `literature.search(query)->ids`, `article.metadata(ids)->records`, `claims.extract(text)->struct`, `matrix.save(approved)->id`. These functions require backend implementations, except published external APIs separately described. **Branch:** Open access text unavailable? Mark abstract-only and downgrade evidence. **Authorization:** Scientist validates scientific interpretation; no wet-lab recommendations without review. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Evidence matrix cites IDs and exact excerpts, stored to project.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *Open access text unavailable? Mark abstract-only and downgrade evidence.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Search, claim cards, contradictory clusters. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** OpenAlex/Europe PMC, Gemini, SQLite. **Data and permissions:** Public abstracts, OA licensing subject to check. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds search and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Same target: opposing paper results become conditional not contradictory after model checks. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Paywalled text, fabricated inference, summary commoditization. **Fallback:** Use 6 licensed public abstracts with manual source audit. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Help researchers focus replication questions. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Identifies *why* papers disagree by conditions and plots required replication rather than just summarizing.* The core must be regression tested on two counterexamples. **Initial weighted score:** 80.0/100; **post-critique score:** 79.0/100 (penalty 1).

## B4 — ReagentSwitch

**A. Product identity.** Reagent stockout agent proposes verifiable, expert-approved alternatives and updates experiment schedule. **Primary:** Biotech & AI. **Secondary:** Voice/Enterprise.

**B. Real problem.** **User:** Lab manager. **Trigger/current workflow:** Needed reagent is missing or expired. **Root cause:** Supplier listings, compatibility, SDS and inventory are disconnected. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S14].

**C. Current alternatives.** Labguru / LIMS + procurement search. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Stock check → review method specs → compare alternatives → human signoff → reserve stock or move run. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Can refuse substitution when purity/grade/protocol incompatibility cannot be proven.

**E. Agentic design.** **Goal and inputs:** Needed reagent is missing or expired, using permitted data. **Autonomous evidence-dependent decision:** If substitute matches grade & specification and SOP permits, recommend; otherwise defer experiment. **Tool catalog with sample input→output signatures:** `inventory.lookup(sku)->lot`, `catalog.lookup(type)->options` (sample data), `schedule.update(approved)->id`. These functions require backend implementations, except published external APIs separately described. **Branch:** Matching chemical name alone is insufficient; block if incompatible grade. **Authorization:** Scientific owner approves and reviews SDS, procurement is never automatic. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Inventory count and amended run schedule in sample DB.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *Matching chemical name alone is insufficient; block if incompatible grade.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Reagent availability board, substitution evidence, lab calendar. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Next.js/SQLite with synthetic reagent specs. **Data and permissions:** Synthetic catalogs; chemical safety review required. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** no; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds reagent availability board and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** A stockout blocks unsafe alternative and moves experiment only with permission. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Data validation; dangerous substitution; unverified market demand. **Fallback:** No substitution; show reliable reroute to later date. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce abandoned experiments; small lab ops. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Can refuse substitution when purity/grade/protocol incompatibility cannot be proven.* The core must be regression tested on two counterexamples. **Initial weighted score:** 74.2/100; **post-critique score:** 71.2/100 (penalty 3).

## C1 — LocaleProof

**A. Product identity.** Constraint-aware multilingual creative localization with hard claim preservation checks. **Primary:** Content & Digital Art. **Secondary:** Voice/Enterprise.

**B. Real problem.** **User:** Localization producer / brand compliance. **Trigger/current workflow:** Video campaign enters a new locale. **Root cause:** Translation may modify percentages, guarantees, geography or approved wording. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S23] [S28] [S49].

**C. Current alternatives.** YouTube translation, automated dubbing and human agencies. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Load video transcript + approved claims → translate → parse numbers/claims → produce error report → correct → approve → export. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Detect and repair exact claim drift, show auditable source-to-target paired approval, export corrected SRT.

**E. Agentic design.** **Goal and inputs:** Video campaign enters a new locale, using permitted data. **Autonomous evidence-dependent decision:** If legally approved claim lacks approved locale equivalent, block publication instead of inventing one. **Tool catalog with sample input→output signatures:** `transcript.segment(file)->segments`, `claims.check(segments,policy)->findings`, `subtitles.export(approved)->SRT`, optional `fal.generate` only if credits. These functions require backend implementations, except published external APIs separately described. **Branch:** A product percentage changes meaning; the agent rewrites only affected lines. **Authorization:** Editor signs off on approved terms; no auto publishing. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** SRT and regression report with preserved figures.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *A product percentage changes meaning; the agent rewrites only affected lines.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Timeline captions, paired claims, signoff panel. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Whisper/open STT or transcript input; Gemini, FFmpeg. **Data and permissions:** Sample rights-cleared 30-second video or transcript. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds timeline captions and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Judge spots 50% vs 15% incorrect translation; auto-revision updates export. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Existing dubbing competition, multilingual nuances, voice licensing. **Fallback:** Text/SRT deliverable even without fal/voice. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce review rounds, correctness of localized claims. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Detect and repair exact claim drift, show auditable source-to-target paired approval, export corrected SRT.* The core must be regression tested on two counterexamples. **Initial weighted score:** 84.5/100; **post-critique score:** 83.5/100 (penalty 1).

## C2 — AccessCut

**A. Product identity.** An accessibility production agent detects missing caption and visual information and exports a corrected deliverable. **Primary:** Content & Digital Art. **Secondary:** Open.

**B. Real problem.** **User:** Accessible media producer. **Trigger/current workflow:** Company has a training clip to publish. **Root cause:** Automatic transcript omits sound cues and salient visual instructions. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S23] [S24].

**C. Current alternatives.** Captions services, editors, platform auto-captions. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Import original video → extract speech/frames → label sound and key visual actions → suggest caption/audio description → human review → export SRT + report. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Uses audible and visual evidence to request missing content, checks against WCAG-style checklist, outputs SRT + description track script and manifest.

**E. Agentic design.** **Goal and inputs:** Company has a training clip to publish, using permitted data. **Autonomous evidence-dependent decision:** If a visual instruction is already spoken, no duplicate description; if a non-speech alarm is meaningful, add caption. **Tool catalog with sample input→output signatures:** `media.extract(video)->audio,frames`, `caption.audit(transcript,features)->issues`, `deliverables.write(approved)->SRT,JSON`, `deliverables.validate()->issues`. These functions require backend implementations, except published external APIs separately described. **Branch:** For audible alarm uncaptioned, add [alarm]; for visible button not described, propose narration, never claim WCAG certification. **Authorization:** Human checks accuracy and timing before release. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Parse generated SRT, verify timecode order and counts and list unaddressed visual events.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *For audible alarm uncaptioned, add [alarm]; for visible button not described, propose narration, never claim WCAG certification.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Video side-by-side player, caption timeline, QA issues, files. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** FFmpeg, optional Gemini vision/audio, SRT tools, SQLite. **Data and permissions:** Rights-cleared short clip. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds video side-by-side player and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Silent on-screen visual instruction + sound alarm becomes corrected subtitle and descriptive cue. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** A/V inference cost, accessibility quality subjectivity. **Fallback:** Supply annotated frames and transcript fixtures if media inference fails. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Better information accessibility; media producers/public agencies. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Uses audible and visual evidence to request missing content, checks against WCAG-style checklist, outputs SRT + description track script and manifest.* The core must be regression tested on two counterexamples. **Initial weighted score:** 87.5/100; **post-critique score:** 86.5/100 (penalty 1).

## C3 — SceneGuard

**A. Product identity.** Multi-scene creative QA finds brand drift and requests only targeted scene regeneration. **Primary:** Content & Digital Art. **Secondary:** Biotech optional.

**B. Real problem.** **User:** Brand video producer. **Trigger/current workflow:** Campaign wants 3 generated scenes and quick client revisions. **Root cause:** Generated assets lose product colors, props, typography and consistency. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S09] [S29].

**C. Current alternatives.** Frame.io, image generation platforms. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Load reference/constraints → generate or upload 3 frames → compare brand requirements → choose fail frame → approve targeted replacement → verify. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Auto-select the lowest-cost one-scene repair under constraints, with image-diff justification.

**E. Agentic design.** **Goal and inputs:** Campaign wants 3 generated scenes and quick client revisions, using permitted data. **Autonomous evidence-dependent decision:** If a minor background discrepancy, accept; if product logo changes, regenerate selected asset only. **Tool catalog with sample input→output signatures:** `assets.inspect(frames)->attributes`, `constraints.check(attrs)->failures`, `assets.replace(approved)->version`, optional fal model inference. These functions require backend implementations, except published external APIs separately described. **Branch:** If image edit fails twice, stop and ask editor. **Authorization:** No unauthorized use of client logos or copyrighted marks. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** New asset version and documented before/after constraint checks.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If image edit fails twice, stop and ask editor.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Storyboard with per-frame pass/fail and edit trace. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Next.js, image comparison, fal optional. **Data and permissions:** Synthetic brand style guide and owned assets. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** no; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds storyboard with per-frame pass/fail and edit trace. and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Frame 2 gets wrong product color; targeted edit passes re-check. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Visual judgment uncertainty, generation latency/cost. **Fallback:** Pre-generated 3 alternatives, still do live QA and replace. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Less expensive re-rendering and review time. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Auto-select the lowest-cost one-scene repair under constraints, with image-diff justification.* The core must be regression tested on two counterexamples. **Initial weighted score:** 77.0/100; **post-critique score:** 75.0/100 (penalty 2).

## C4 — RightsRail

**A. Product identity.** Asset publication preflight combines C2PA provenance, usage licenses and disclosure checklist. **Primary:** Content & Digital Art. **Secondary:** Open.

**B. Real problem.** **User:** Agency operations / publisher. **Trigger/current workflow:** New media package gets approved for release. **Root cause:** License terms, AI generation records and manifest state are scattered. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S25] [S26] [S27].

**C. Current alternatives.** DAM systems, contracts spreadsheets, C2PA verification tools. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Import asset + rights evidence → read manifest → verify license scope against channel → create release gate → approve → write publish-ready manifest. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Combines multiple independently checkable prerequisites and creates a release block that names missing rights—not a generic provenance viewer.

**E. Agentic design.** **Goal and inputs:** New media package gets approved for release, using permitted data. **Autonomous evidence-dependent decision:** If license covers web not social ads, stop; if provenance absent, note unknown rather than fake C2PA claim. **Tool catalog with sample input→output signatures:** `c2patool.inspect(asset)->manifest`, `licenses.check(asset,channel)->decision`, `release.record(approved)->state`. These functions require backend implementations, except published external APIs separately described. **Branch:** If contract expired, block and request renewed rights even if image visually fine. **Authorization:** Legal reviewer signs rights/territory and label decisions. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Audit register, file hash and C2PA report (if supported).

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If contract expired, block and request renewed rights even if image visually fine.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Asset list, permission cards, publish gate. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** c2patool subprocess, SQLite; rights mapping internal. **Data and permissions:** Synthetic sample licenses and own media. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds asset list and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** A visually acceptable ad cannot be released due to territory restriction; gate blocks it. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Cannot prove rightfulness from metadata alone; exceptions and licensing. **Fallback:** Signed release record with C2PA unverified warning. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce unlicensed distributions and decision delays. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Combines multiple independently checkable prerequisites and creates a release block that names missing rights—not a generic provenance viewer.* The core must be regression tested on two counterexamples. **Initial weighted score:** 81.8/100; **post-critique score:** 80.8/100 (penalty 1).

## O1 — TenderTrace

**A. Product identity.** Turns live EU procurement notices into a sourced, eligibility-aware bid execution plan and approved internal artifacts. **Primary:** Open. **Secondary:** Voice/Enterprise.

**B. Real problem.** **User:** SME bid owner. **Trigger/current workflow:** Matching TED notice is published. **Root cause:** Notice fields, annexes, certifications, deadlines, and company profile are not in one place. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S30] [S31] [S32] [S45].

**C. Current alternatives.** Tender portals, notification services, human consultants. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Query TED API → pick notice → read annexes where accessible → compare example SME profile → branch eligible/blocked → approve → create bid tasks and evidence pack. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Public-data-to-approved-action loop: rank, explain disqualifying requirements, identify missing evidence, create task/document packet, verify saved state.

**E. Agentic design.** **Goal and inputs:** Matching TED notice is published, using permitted data. **Autonomous evidence-dependent decision:** If required turnover exceeds company criteria or cert absent, block and request evidence; otherwise create bid tasks. **Tool catalog with sample input→output signatures:** `ted.search(CPV,region)->notices` (public), `annex.extract(url)->requirements` (if accessible), `eligibility.evaluate(reqs,profile)->status`, `bidpack.write(approved)->id`, `bidpack.read(id)->record`. These functions require backend implementations, except published external APIs separately described. **Branch:** Deadline before production capacity? Flag no-bid; otherwise request only missing certificate; uncertain requirement is not invented. **Authorization:** SME approver decides bid/no-bid and approves documents; never submit to TED or pay fees. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Saved bid project with deadline, source links, checked requirements and task readback.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *Deadline before production capacity? Flag no-bid; otherwise request only missing certificate; uncertain requirement is not invented.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Public notice feed, requirement evidence grid, no-bid/bid approval, timeline. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** TED Search API, local company profile, FastAPI/SQLite, Gemini; Firecrawl optional only for allowed pages. **Data and permissions:** Public notices accessible without auth; annex downloads may be gated; use dated fixtures. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds public notice feed and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Live notice becomes a filtered requirements matrix; one missing certificate creates a real approved task in owned app. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Product similarity to tender alert vendors; annex permissions; legal interpretations. **Fallback:** Demo with cached genuine published notice and local editable requirement annex. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce bid triage time and noncompliant applications; SMEs/consultants. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Public-data-to-approved-action loop: rank, explain disqualifying requirements, identify missing evidence, create task/document packet, verify saved state.* The core must be regression tested on two counterexamples. **Initial weighted score:** 89.0/100; **post-critique score:** 88.0/100 (penalty 1).

## O2 — PolicyPath

**A. Product identity.** Converts a source-grounded rule change into an impact map, approved work orders and version-verified internal updates. **Primary:** Open. **Secondary:** Voice/Enterprise.

**B. Real problem.** **User:** SME compliance manager / municipal operations lead. **Trigger/current workflow:** Regulatory guidance changed. **Root cause:** Human must compare primary rule, current policy, template, process owner and due date. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S30] [S42].

**C. Current alternatives.** Compliance software, legal newsletters, checklists. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Load official source + before-version → parse rule delta → scan sample SOP/forms → identify contradictions → assign owners → approve one edit → verify new file version. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Produces artifact-specific evidence map and actually updates an authorized SOP/task after reviewer signoff, not general Q&A.

**E. Agentic design.** **Goal and inputs:** Regulatory guidance changed, using permitted data. **Autonomous evidence-dependent decision:** If language imposes obligation only after size threshold, do not update below-threshold organization; if ambiguous, mark legal review. **Tool catalog with sample input→output signatures:** `sources.fetch(official_url)->version`, `documents.search(claim)->matches`, `changeplan.create()->tasks`, `sop.apply(approved)->version`, `sop.read(version)->text`. These functions require backend implementations, except published external APIs separately described. **Branch:** A deadline already passed results in immediate escalation; future proposed EU measure does not trigger current obligation. **Authorization:** Professional reviewer approves scope; no legal advice, filing or transmission autonomously. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** SOP diff, stored task, source citations, readback and unresolved ambiguities.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *A deadline already passed results in immediate escalation; future proposed EU measure does not trigger current obligation.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Rule timeline, affected files, traceable decisions and approval queue. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Next.js, typed tool orchestration, SQLite, optional Firecrawl for allowed sources. **Data and permissions:** Verified public rules + synthetic organization policies; document provenance essential. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds rule timeline and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** A changed eligibility threshold propagates to one SOP, but not an exempt business; audit proves update. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Legal scope risk and broad domain; restrict to one concrete rule family. **Fallback:** Preapproved official excerpt and sample SOP in local store. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Fewer stale internal policies; SMEs, public-service units. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Produces artifact-specific evidence map and actually updates an authorized SOP/task after reviewer signoff, not general Q&A.* The core must be regression tested on two counterexamples. **Initial weighted score:** 88.5/100; **post-critique score:** 87.5/100 (penalty 1).

## O3 — RenovationRelay

**A. Product identity.** Condo retrofit coordination converts owners’ proposals and energy estimates into a consent/contract execution plan. **Primary:** Open. **Secondary:** Voice/Enterprise.

**B. Real problem.** **User:** Condominium manager, energy consultant. **Trigger/current workflow:** Residents receive two renovation offers. **Root cause:** Technical quotes, legislation, votes and money are fragmented. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S36] [S37].

**C. Current alternatives.** Energy consultants, building management apps. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Import proposals → normalize scope/amounts → identify missing certificates → draft owner questions → approve meeting packet. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Compares line items and missing approvals and creates vote-ready documents, not an automatic property permit.

**E. Agentic design.** **Goal and inputs:** Residents receive two renovation offers, using permitted data. **Autonomous evidence-dependent decision:** If quote omits insulation performance value, request clarification instead of comparing misleading bids. **Tool catalog with sample input→output signatures:** `quote.parse(pdf)->items`, `offer.compare()->differences`, `meetingpacket.save(approved)->id`. These functions require backend implementations, except published external APIs separately described. **Branch:** If legally sensitive consent rule unclear, route to legal adviser. **Authorization:** Owner and engineer sign off; never certify legal majority without documents. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Stored owner packet and unresolved missing-line list.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If legally sensitive consent rule unclear, route to legal adviser.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Comparison, cost items, questions, agenda. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Next.js, file parsing, SQLite. **Data and permissions:** Synthetic condo and proposals, EU buildings guidance. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** yes; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds comparison and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Two proposals look equal until missing energy rating creates an evidence request. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Building-specific law, low API access, market competition. **Fallback:** Offline quote fixture. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce decision delays; small property administrators. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Compares line items and missing approvals and creates vote-ready documents, not an automatic property permit.* The core must be regression tested on two counterexamples. **Initial weighted score:** 76.8/100; **post-critique score:** 75.8/100 (penalty 1).

## O4 — PatchPilot

**A. Product identity.** Vulnerability agent tests a candidate dependency fix in an isolated environment and proposes a verified PR. **Primary:** Open. **Secondary:** Voice/Enterprise.

**B. Real problem.** **User:** Small SaaS maintainer. **Trigger/current workflow:** Critical dependency advisory issued. **Root cause:** CVE severity alone does not show whether app uses vulnerable path. The economic or societal loss has **not been measured for this target user**; buyer willingness to pay remains unvalidated. Context evidence: [S38] [S39] [S40] [S12].

**C. Current alternatives.** Snyk Agent Fix, Renovate, Dependabot already strong. The differentiation thesis must be proven by benchmarking a real end-to-end workflow against this substitute, not by assuming it lacks AI.

**D. Product and complete user journey.** Load test repo + advisory → map usage → spawn isolated box → patch safe branch → run tests → approve PR draft. **Key modules:** ingestion, evidence ledger, branch planner, approval gate, readback-and-history. **Distinctive result:** Only compelling if tool tests exploitability and regression in a disposable fork with a source-grounded explanation.

**E. Agentic design.** **Goal and inputs:** Critical dependency advisory issued, using permitted data. **Autonomous evidence-dependent decision:** If package not used in vulnerable path, downgrade; if tests fail, do not propose merge. **Tool catalog with sample input→output signatures:** `osv.query(package,version)->advisories`, `sandbox.fork(repo)->id`, `tests.run(branch)->results`, `pr.draft(approved)->link` (project code / integrations conditional). These functions require backend implementations, except published external APIs separately described. **Branch:** If fix breaks snapshot, choose alternative patch version or escalate. **Authorization:** Maintainer approval required before PR creation and all merges. **Tool failure:** show partial evidence and block further writes; retry only idempotent reads with bounded backoff. **Verification:** Test results, version diff and re-scan advisory status.

**F. Concrete execution trace.** User opens case → tool ingests the source → agent extracts required facts with exact evidence → tool retrieves secondary source → agent evaluates *If fix breaks snapshot, choose alternative patch version or escalate.* → proposed change is shown → user authorizes → project-defined write tool commits → independent read tool confirms changed state → UI displays before/after plus source references. No simulated output is labeled as an external side effect.

**G. User experience.** Vulnerability report, sandbox logs, PR diff. Show in the interface which claims are **Verified / Inferred / Unknown** and the exact data used in the decision.

**H. Technical feasibility.** **Stack:** Git, pytest, OSV, optional boxd; GitHub token conditional. **Data and permissions:** Owned repository + public vulnerability data. **Latency/cost:** one bounded LLM planning call plus project-defined actions; optional network service includes timeout/caching and cost cap. **90-minute mini-demo:** no; a full product is not expected in that time.

**I. Three-engineer parallel execution.** E1 builds vulnerability report and approval UI from a fixed JSON fixture; E2 implements typed storage/adapters, event journal and idempotent write/readback; E3 implements claim extraction, decision branch, test cases and a bounded tool loop. They agree on `Case`, `EvidenceSpan`, `Decision`, `ProposedAction`, `Approval`, `ExecutionReceipt` types before coding; no file ownership overlap.

**J. Demonstration storyboard.** Sandbox runs regression and blocks insecure upgrade, then selects test-passing version. **Judges see** an actual state change and an independent verification screen, not a text-only answer.

**K. Risks, MVP, fallback, expansion.** **Smallest convincing demo:** one input, two distinct tool reads, one evidence branch, one approved state change, one readback. **Primary risk:** Highly commoditized; no access to code host; test fragility. **Fallback:** Local git branch and patch file, not fake PR. **After event:** production auth, real customer integrations, evaluations, audit export, data retention controls and accessibility.

**L. Commercial/social outcome.** Reduce unsafe patch time; difficult standalone differentiation. Pricing is **hypothetical** until customer interviews and pilot measurement establish demand.

**M. Anti-wrapper verdict.** If the agent only summarized input, the product would fail. The defensible behavior here is *Only compelling if tool tests exploitability and regression in a disposable fork with a source-grounded explanation.* The core must be regression tested on two counterexamples. **Initial weighted score:** 76.0/100; **post-critique score:** 72.0/100 (penalty 4).

### 15. Anti-generic audit

The following checks were applied to all 16: **LLM removal** (does interpreting unstructured evidence change decisions?), **agent removal** (does the evidence-dependent tool loop stop?), **standard-software substitution** (could rules/ETL solve it cheaper?), **competitor parity**, **external side effect**, **real user**, **evidence**, **live demo**, and **wow**. The core risk is not lacking enough agents but confusing output generation with a verified act. For **B1/O1/O2/C2**, the distinguishing component is source-linked contradiction detection plus a real approved artifact or state change. For **O4**, most patch + PR features are commodity and penalty is deliberately high [S39] [S40]. For **C3**, generating several attractive frames is not enough; targeted revision QA must be visible [S29]. For **B4**, no unsafe chemical substitution can be delegated to an LLM.

### 16. Initial scoring — seven weighted components

Weights: severity 15, novelty 20, genuine agent decisions 20, feasibility 15, demo 15, access 5, beyond-event usefulness 10. For each criterion the row shows its **0–10 raw points**; final total = weighted sum / 10. Deduct explicit penalties for weaker evidence, competition, unavailable data or risks. All scores are judgment-based, not scientific measurements.

| ID | Product | Severity | Novelty | Agentic | Feasible | Demo | Access | Enduring | Raw /100 | Penalty | Revised /100 |
|---|---|---|---|---|---|---|---|---|---:|---:|---:|
| B1 | ProtocolPulse | 9.5 | 8.5 | 9.5 | 8.5 | 9.5 | 8.5 | 9 | 90.5 | 1 | 89.5 |
| O1 | TenderTrace | 9 | 8 | 9 | 9 | 9.5 | 9.5 | 9 | 89.0 | 1 | 88.0 |
| O2 | PolicyPath | 9 | 8 | 9.5 | 8.5 | 9 | 8.5 | 9.5 | 88.5 | 1 | 87.5 |
| C2 | AccessCut | 9 | 8 | 9 | 8.5 | 9.5 | 9 | 8.5 | 87.5 | 1 | 86.5 |
| C1 | LocaleProof | 8 | 8.5 | 8.5 | 8.5 | 9 | 8.5 | 8 | 84.5 | 1 | 83.5 |
| B2 | TrialTrace | 8.5 | 7.5 | 8.5 | 8.5 | 8.5 | 9 | 8.5 | 83.2 | 0 | 83.2 |
| C4 | RightsRail | 8.5 | 7.5 | 8.5 | 8 | 8.5 | 7.5 | 8.5 | 81.8 | 1 | 80.8 |
| V4 | AccessExit | 8.5 | 7 | 8.5 | 8.5 | 8.5 | 7 | 8 | 80.8 | 1 | 79.8 |
| V2 | VoiceField Ledger | 7.5 | 7 | 8.5 | 8 | 9 | 8 | 7.5 | 79.2 | 0 | 79.2 |
| V1 | ExceptionRelay | 8.5 | 7 | 8.5 | 8 | 8.5 | 7 | 8 | 80.0 | 1 | 79.0 |
| B3 | EvidenceWeaver | 8 | 7.5 | 8 | 8.5 | 7.5 | 9 | 8.5 | 80.0 | 1 | 79.0 |
| V3 | ClaimBridge | 8 | 6.5 | 7.5 | 8.5 | 8 | 9 | 7.5 | 76.8 | 1 | 75.8 |
| O3 | RenovationRelay | 8.5 | 6.5 | 7.5 | 8 | 7.5 | 8.5 | 8.5 | 76.8 | 1 | 75.8 |
| C3 | SceneGuard | 7 | 7.5 | 8 | 7.5 | 9 | 6.5 | 7.5 | 77.0 | 2 | 75.0 |
| O4 | PatchPilot | 9 | 5 | 8.5 | 7.5 | 8.5 | 8 | 7.5 | 76.0 | 4 | 72.0 |
| B4 | ReagentSwitch | 7 | 7 | 8 | 7.5 | 7.5 | 6.5 | 8 | 74.2 | 3 | 71.2 |

### 17. Scoring rationale and penalty discipline

- **Severity:** high for regulated trial consistency, public tender rework, security and accessibility; lower for aesthetic review conveniences.
- **Novelty:** discount existing well-funded product capabilities (Veeva, Snyk, Frame.io, common tender alerts). Novelty means a workflow improvement, not absence of competitors.
- **Agentic value:** high only when missing data affects a branch, approved external state changes and readback occurs. Simple text classification is insufficient.
- **Feasibility / access:** owned files, TED Search, public scholarly metadata and local DB outperform tenant-dependent ERP/clinical write access; only public APIs documented as such are assumed.
- **Demo:** high for a clear before/after result with source snippets; lower if a video generation queue, hardware or enterprise permission could block critical path.
- **Penalty 1–4:** direct reductions for product parity, high-stakes safety, unverified demand, specialized data and excess integration; these are intentionally **not hidden** in narrative scores.

### 18. Per-concept readiness: 90-minute blocker, permissible pre-event preparation, event-time build

The official terms permit **ideas, tooling and boilerplate**, not substantially built products [S03]. The matrix describes what the team can *prepare* and what it must *build during the event*; final eligibility interpretation belongs to organizers. The 90-minute demo is an engineering prototype, not the whole product.

| Idea | Minimal demo type (A–F) | Main blocker to a credible 90-minute build | Pre-event: ideas/tooling only | During event: new product implementation |
|---|---|---|---|---|
| V1 | F | ERP credential and shipping scenario setup | Review ERP docs and create adapter interface design | Implement owned PO database, branch planner and verified resolution |
| V2 | F | Robust real-time speech capture in noise | Research browser mic compatibility and consent | Implement actual capture, field verification, ticket write |
| V3 | D+F | Live carrier and booking APIs unavailable | Read EU rules; design sample booking schema | Implement rights case engine and evidence pack output |
| V4 | F | True SaaS admin rights and owner transfer | Review IdP permissions and synthetic identity rules | Implement test SaaS permission stores and revocation readback |
| B1 | F | Multi-file parsing and exact-span verification | Read SPIRIT and prepare illustrative problem framing | Create source version fixtures, impact graph and approved DOCX patch |
| B2 | D+F | Registry field schema and public attachments | Study registry API schemas and published examples | Create registry adapter, comparison and saved discrepancy list |
| B3 | D+E | Literature text licensing and extraction quality | Review Europe PMC/OpenAlex usage policies | Implement literature search adapter, claims and condition matching |
| B4 | B+D+F | Supplier equivalence, permissions, scientific signoff | Consult lab expert; review public safety rules | Create inventory ledger, stop/approve gate and reschedule |
| C1 | D+F | Licensed voice/translation model integration | Review subtitle and dubbing SDK terms | Implement claim preservation checks and corrected SRT exporter |
| C2 | D+F | Video/frame inference latency and annotation | Review WCAG checkpoints and FFmpeg docs | Implement caption QA, corrected SRT and synchronized player |
| C3 | D+F | Multi-scene generation latency and QA | Review reference-image permissions and fal docs | Build asset checker, version store and targeted replacement |
| C4 | B+D+F | Rights interpretation and manifest support | Review C2PA and content license guidance | Implement manifest reader, license rules and release register |
| O1 | F | Tender annex access and robust extraction | Read TED API docs; understand CPV/eForms | Create TED integration, requirement extraction and committed task store |
| O2 | F | Applicability edge cases/legal scope | Choose official narrow rule and review its provenance | Build narrow applicability engine, SOP diff and signed version update |
| O3 | D+F | Property-specific legislation and source documents | Review EU building directives and sample workflows | Build quote comparison and approved meeting packet |
| O4 | B+F | Secure sandbox/PR credentials and test reliability | Read OSV/git/renovate licenses and APIs | Build isolated patch runner, tests and local diff readback |

**Agent category key:** A=standard software, B=deterministic automation, C=ML inference, D=LLM interpretation, E=autonomous tool selection, F=human-in-loop actions. Categories are *implementation mixes*, not quality labels. The non-AI core remains conventional data validation and persistence. The model is used only where evidence mapping, contextual applicability or missing-information decisions cannot reliably be expressed as fixed rules; if a test shows ordinary matching is equally reliable, remove the LLM from that step.


See [complete source descriptions and limitations](HACKATHON_RECOMMENDATION.md#part-vii--research-sources).


<!-- Inline linked source identifiers used in this research -->
[S01]: https://hackathon.polymath42.com/ "Organizers: Gen AI Summit Hackathon"
[S02]: https://hackathon.polymath42.com/agenda "Organizers: Hackathon agenda"
[S03]: https://hackathon.polymath42.com/terms "Organizers: Hackathon terms"
[S04]: https://www.wonderful.ai/agents "Wonderful: Enterprise AI OS and agents"
[S05]: https://www.wonderful.ai/blog-articles/open-by-default-competitive-by-design "Wonderful: Wonderful platform open API"
[S06]: https://ai.google.dev/gemini-api/docs/function-calling "Google AI for Developers: Gemini API function calling"
[S07]: https://ai.google.dev/gemini-api/docs/pricing "Google AI for Developers: Gemini API pricing and free tier"
[S08]: https://fal.ai/docs/documentation/model-apis/pricing "fal: fal model pricing"
[S09]: https://fal.ai/inference "fal: fal inference catalog"
[S10]: https://www.firecrawl.dev/agent "Firecrawl: Firecrawl Agent"
[S11]: https://github.com/firecrawl/firecrawl-docs/blob/main/advanced-scraping-guide.mdx "Firecrawl: Firecrawl v2 API guide"
[S12]: https://boxd.sh/faq/ "boxd: boxd FAQ"
[S13]: https://oumi.ai/docs/en/latest/index.html "Oumi: Oumi OSS docs"
[S14]: https://www.athenslifetechpark.com/ "ALTP: Athens LifeTech Park"
[S15]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12035670/ "BMJ / SPIRIT consortium: SPIRIT 2025 statement"
[S16]: https://www.ema.europa.eu/en/scientific-guidelines/ich-e6-good-clinical-practice "EMA: GCP E6(R3)"
[S17]: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/protocol-deviations-clinical-investigations-drugs-biological-products-and-devices "US FDA: Protocol deviation guidance"
[S18]: https://www.ema.europa.eu/en/human-regulatory-overview/research-development/clinical-trials-human-medicines/clinical-trials-information-system-ctis "EMA: CTIS public portal"
[S19]: https://dev.europepmc.org/RestfulWebService "Europe PMC: Europe PMC RESTful Web Service"
[S20]: https://help.openalex.org/api/ "OpenAlex: OpenAlex API"
[S21]: https://www.veeva.com/products/clinical-operations/ "Veeva: Veeva Clinical Operations"
[S22]: https://www.veeva.com/products/vault-platform/veeva-connections/clinical-operations/ "Veeva: Veeva connected clinical systems"
[S23]: https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html "W3C WAI: W3C captions criterion"
[S24]: https://www.w3.org/WAI/WCAG22/Understanding/audio-description-or-media-alternative-prerecorded "W3C WAI: W3C audio description criterion"
[S25]: https://spec.c2pa.org/specifications/ "C2PA: C2PA specifications"
[S26]: https://github.com/contentauth/c2patool "Content Authenticity Initiative: c2patool"
[S27]: https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act "European Commission: EU AI Act transparency"
[S28]: https://support.google.com/youtube/answer/13338784?hl=en "YouTube Help: YouTube multilingual audio"
[S29]: https://experienceleague.adobe.com/en/docs/workfront/using/review-and-approve-work/move-to-adobe-cloud-storage/adobe-cloud-storage-whats-different "Adobe: Adobe Workfront Frame.io integration"
[S30]: https://www.oecd.org/en/publications/oecd-regulatory-policy-outlook-2025_56b60e39-en/full-report/regulating-for-people_6d2fc8d4.html "OECD: OECD Regulatory Policy Outlook Greece"
[S31]: https://docs.ted.europa.eu/api/latest/search.html "EU Publications Office: EU TED published tender Search API"
[S32]: https://docs.ted.europa.eu/api/latest/ "EU Publications Office: EU TED API overview"
[S33]: https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/einvoicing_en "European Commission: EU eInvoicing overview"
[S34]: https://www.cms.gov/initiatives/burden-reduction/overview/interoperability/policies-regulations/cms-interoperability-prior-authorization-final-rule-cms-0057-f "CMS: CMS prior authorization reform"
[S35]: https://europa.eu/youreurope/citizens/travel/passenger-rights/air/ "Your Europe: EU air passenger rights"
[S36]: https://energy.ec.europa.eu/topics/energy-efficiency/energy-performance-buildings/energy-renovation-buildings_en "European Commission: Energy renovation of buildings"
[S37]: https://energy.ec.europa.eu/topics/energy-efficiency/energy-performance-buildings/energy-performance-buildings-directive_en "European Commission: EU Energy Performance of Buildings Directive"
[S38]: https://www.enisa.europa.eu/news/whats-driving-cybersecurity-investments-and-where-lie-the-challenges "ENISA: ENISA 2025 investment findings"
[S39]: https://snyk.io/product/snyk-code/ "Snyk: Snyk Code + Agent Fix"
[S40]: https://docs.renovatebot.com/ "Mend Renovate: Renovate"
[S41]: https://www.cms.gov/initiatives/burden-reduction/overview/interoperability/frequently-asked-questions/improving-prior-authorization-processes "CMS: CMS prior auth FAQ"
[S42]: https://ec.europa.eu/digital-building-blocks/sites/spaces/TDD/pages/973932933/1.%2BOnce-Only%2BTechnical%2BSystem%2BHigh%2BLevel%2BArchitecture%2Bv2.0.1%2BJuly%2B2026 "European Commission: Once-Only Technical System"
[S43]: https://ai.google.dev/gemini-api/docs/rate-limits?hl=en "Google AI for Developers: Gemini rate limits"
[S44]: https://help.openalex.org/api/authentication/ "OpenAlex: OpenAlex auth"
[S45]: https://docs.ted.europa.eu/home/eforms/FAQ/index.html "EU Publications Office: European Commission eForms validation"
[S46]: https://digital-strategy.ec.europa.eu/en/news/commission-starts-enforcing-ai-act-rules-and-new-transparency-requirements-2-august "European Commission: EU Commission AI Act official status"
[S47]: https://www.uniprot.org/help/api_queries "UniProt: UniProt API queries"
[S48]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12128891/ "BMJ: Lab protocol SPIRIT explanation"
[S49]: https://support.google.com/youtube/answer/15569972?hl=en "YouTube Help: YouTube automatic dubbing"
[S50]: https://boxd.sh/blog/we-raised-2m-to-kill-localhost/ "boxd: boxd engineering context"
