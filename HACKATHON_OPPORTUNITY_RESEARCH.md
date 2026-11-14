# HACKATHON OPPORTUNITY RESEARCH

Research cutoff: **14 November 2026**. Prepared for three engineers; 4 organizer-provided tracks. This report uses **VERIFIED FACT**, **RESEARCH-SUPPORTED INFERENCE**, and **UNVALIDATED HYPOTHESIS**. Source keys resolve in the source inventory (Part VII). A webpage describing a product does not prove any account-specific integration works.

## PART I — HACKATHON OPPORTUNITY LANDSCAPE

### 1. Executive overview

**Recommendation direction:** the highest-return candidates are a cross-document clinical study amendment assistant, a public-tender evidence/action agent, a narrowly-scoped regulatory change-to-workflow engine, and an accessibility production QA pipeline. These are research-grounded **product hypotheses**, not already-validated businesses. Avoid generic copilots and expensive sponsor-dependent demos.

**Important organizer discrepancy:** the event's official terms say the *build starts at 12:00* on Sat 14 Nov; its detailed agenda says *hacking starts at 13:00*; both point to the 14 Nov start and the agenda sets a **Sunday 15 Nov 18:00** code freeze, with repo + video + project details due then. The implementation window is ~29–30 hours, although the website calls it a 36-hour event (including presentation activities). Treat event staff guidance as controlling; do not assume prebuilt app code is allowed. [S01] [S02] [S03]

### 2. Four-track research

| Track | Directly supported industry friction | Distinctive demo requirement | Primary evidence |
|---|---|---|---|
| Voice & Enterprise Agents | Invoices still need cross-system processing; medical prior authorizations and disruption claims are rules/evidence intensive; offboarding requires many access checks | Voice must materially improve a hands-busy workflow, otherwise demonstrate real enterprise actions | [S33] [S34] [S35] [S38] |
| Biotech & AI | Trial protocols vary in completeness; protocol/registry consistency, GCP and evidence trails matter | Display specific amendment and verified propagation into a dependent controlled document; expert approval | [S15] [S16] [S17] [S21] |
| Content & Digital Art | Captions must represent speech and meaningful sounds; media description matters; provenance and AI transparency have standards | Produce a playable corrected artifact, not merely a script | [S23] [S24] [S25] [S27] |
| Open Track | Greek administrative friction stems partly from repeated document collection; TED exposes public procurement notices; cyber patches remain difficult | Public API input, evidence-linked branch, authorized mutation and independent readback | [S30] [S31] [S38] |

Athens LifeTech Park describes incubator, laboratory infrastructure and development services; this is **not** evidence it endorses any particular idea. [S14]

### 3. Sponsor/tool capability assessment (do not confuse service with hackathon access)

| Provider | Verified offering & API | Auth/price/integration | Permission / availability verdict |
|---|---|---|---|
| **Wonderful** | Enterprise OS/agents for voice, chat, email and document work; vendor describes integrated enterprise actions and an exported Swagger API [S04] [S05] | Enterprise onboarding and permissions likely; no independent working hackathon tenant/API credentials verified | **Capability vendor-confirmed; hackathon access UNVERIFIED.** Never make it critical path |
| **Google Gemini** | Function calling yields tool instructions; *your backend executes the function*, plus schema outputs [S06] | Key/project; quotas and model pricing vary [S07] [S43] | **Public developer API CONFIRMED**, account credits/limits unknown |
| **fal** | Hosted image/video/audio/3D model inference [S08] [S09] | Key and prepaid credits; output-unit charges vary by model | **Public API CONFIRMED; event credits UNVERIFIED**; avoid long video as required critical path |
| **Firecrawl** | `/v2/scrape` and `/v2/agent` extraction and structured outputs [S10] [S11] | API key; bounded crawl quotas/cost | **Public API CONFIRMED**; not an authenticated ERP writer |
| **boxd** | Persistent isolated cloud Linux VMs with CLI, Python/TS SDK and gRPC [S12] [S50] | CLI login and account credits (vendor advertises default signup credits) | **Public product CONFIRMED**, hardware/quotas/event credits UNVERIFIED |
| **Oumi** | Open-source model train/evaluate/infer workflows [S13] | Python package; bigger models need compute | **OSS CONFIRMED**; 29h makes training poor critical path |
| **terg** | No credible exact-identity official tech/service documentation found in searches | Unknown | **UNVERIFIED**; ask representative at kickoff, do not guess API or role |

Practical ranking: use the minimum number of stable integrations. A system that works on a reproducible local dataset, one public API and an owned demo database is far safer than five sponsor-dependent services.

### 4. Key inefficient workflows

The repeatable pattern is **a trigger, dispersed evidence, ambiguous implication, decision, authorized external effect, and readback**. Complexity is particularly high where the same fact exists in different representations: protocol vs informed-consent text, tender notice vs annex, regulation vs internal SOP, transcript vs localized subtitle, invoice vs PO and receipt. Pure extraction is not the result; a **reviewable evidence-backed change** is.

### 5. Evidence quality and limitations

- Tier 1 (high confidence *context*): EMA, FDA, BMJ SPIRIT, EU TED API, European Commission, OECD, W3C, official API docs.
- Supplier/competitor pages prove offered features or claims, **not independent efficacy** or a gap in those products.
- Customer discovery, verified ROI, real integration permission, trial sponsor systems, and specific hackathon credits are **not established**. The official kickoff deck/credits URLs were inaccessible to this research tool; track names and provider list are treated as **user-provided organizer context**, not independently verified rules.
- Some concepts are explicitly marked **hypothesis** (especially lab inventory, sensing and creative review) because direct user interviews and controlled measurements are missing.

## PART II — PROBLEM DISCOVERY

### 6. Twenty-four opportunity records

6 in each track; the minimum five-per-track plus four extras is satisfied **without claiming 24 validated markets**. Each record identifies 15 requested dimensions, including data, competitor and feasibility confidence.

### E01 — Supplier delivery exceptions

- **Track / affected user:** Voice/Enterprise; Operations planner.
- **Actual trigger and workflow:** A late shipment email triggers PO check, carrier lookup and reschedule.
- **Root cause and existing inefficiency:** Email/ERP/carrier status are disconnected. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Manual chasing delays production; cost depends on site.
- **Supporting evidence:** [S33]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Vendor portals, spreadsheets, ERP exception screens. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** ERP permissions and carrier API; Purchase orders + synthetic shipping feeds. **Feasibility:** Medium; real write to owned demo ERP.
- **Research confidence:** moderate; separate availability of public evidence from market validation.

### E02 — Invoice–PO disagreement

- **Track / affected user:** Voice/Enterprise; AP analyst.
- **Actual trigger and workflow:** Invoice arrives; compare PO, receipt, taxes and contract, request clarification.
- **Root cause and existing inefficiency:** Document fields and approvals cross systems. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Hold, double-payment, lost time; no quantified claim.
- **Supporting evidence:** [S33]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** ERP three-way match, outsourced AP automation. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Sample PDFs and database; Owned demo data only. **Feasibility:** High: local deterministic reconciliation + draft dispute.
- **Research confidence:** high problem / medium market; separate availability of public evidence from market validation.

### E03 — Field repair notes lost in speech

- **Track / affected user:** Voice/Enterprise; Field technician.
- **Actual trigger and workflow:** During inspection, verbal observations need matching to asset history and work order.
- **Root cause and existing inefficiency:** Hands occupied; speech and equipment records disconnected. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Incomplete repair history/repeat visits.
- **Supporting evidence:** [S04]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Mobile CMMS, speech transcription. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Speech mic + work order demo API; Owned demo data only. **Feasibility:** High with browser mic; low if unreliable STT.
- **Research confidence:** hypothesis; separate availability of public evidence from market validation.

### E04 — IT offboarding access gaps

- **Track / affected user:** Voice/Enterprise; IT admin.
- **Actual trigger and workflow:** HR termination triggers app access inventory, approvals, revocation evidence.
- **Root cause and existing inefficiency:** SaaS accounts not centralized. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Residual access or delayed account recovery.
- **Supporting evidence:** [S38]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** IdP, SaaS admin, ticket tools. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Sample directory and 2 test APIs; Owned demo data only. **Feasibility:** High in owned sandbox only.
- **Research confidence:** high problem / medium solution; separate availability of public evidence from market validation.

### E05 — Customer claim evidence fragments

- **Track / affected user:** Voice/Enterprise; Airline/disruption claims team.
- **Actual trigger and workflow:** Disruption triggers entitlement check, receipt retrieval, reply prep.
- **Root cause and existing inefficiency:** Rules + bookings + receipts scattered. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Slow case closure and inconsistent claims.
- **Supporting evidence:** [S35]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Airline portals, claim agencies. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Public rules + synthetic itinerary; Owned demo data only. **Feasibility:** High case pack; no carrier writes.
- **Research confidence:** high; separate availability of public evidence from market validation.

### E06 — Insurance prior-authorization follow-up

- **Track / affected user:** Voice/Enterprise; Clinic coordinator.
- **Actual trigger and workflow:** Medical request denied; detect reason, gather missing documents, resubmit.
- **Root cause and existing inefficiency:** Payer rule variation and clinical review gates. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Treatment delays/admin time.
- **Supporting evidence:** [S34] [S41]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Payer portals, EHR, clearinghouses. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** CMS rules, synthetic FHIR records; Owned demo data only. **Feasibility:** Medium; avoid medical decisions.
- **Research confidence:** high problem / low access; separate availability of public evidence from market validation.

### B01 — Trial protocol amendments ripple

- **Track / affected user:** Biotech; Clinical operations coordinator.
- **Actual trigger and workflow:** Protocol visit-window change demands consent, schedule, SOP, registry, training updates.
- **Root cause and existing inefficiency:** Same scientific facts copied across artifacts. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Inconsistency and preventable amendment errors.
- **Supporting evidence:** [S15] [S16] [S21] [S22]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Veeva CTMS/eTMF, manual review. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Two controlled protocol versions + 4 sample study docs; Owned demo data only. **Feasibility:** High with fully local evidence graph.
- **Research confidence:** high; separate availability of public evidence from market validation.

### B02 — Trial registry–protocol mismatches

- **Track / affected user:** Biotech; Research coordinator.
- **Actual trigger and workflow:** Compare public registry endpoints against protocol methods/outcomes.
- **Root cause and existing inefficiency:** Registry and protocol use different schemas/version cycles. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Public inconsistencies and correction work.
- **Supporting evidence:** [S15] [S18]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** CTIS/ClinicalTrials.gov, manual QC. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Public registry + example protocol PDFs; Owned demo data only. **Feasibility:** High read-only; write to internal checklist.
- **Research confidence:** medium-high; separate availability of public evidence from market validation.

### B03 — Contradictory preclinical literature

- **Track / affected user:** Biotech; Translational researcher.
- **Actual trigger and workflow:** Collect claims for target/assay, reconcile contradictory evidence.
- **Root cause and existing inefficiency:** Unstructured outcomes, conditions and species vary. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Weak target prioritization.
- **Supporting evidence:** [S19] [S20]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** PubMed/OpenAlex/reference managers. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Europe PMC/OpenAlex queries + sourced abstracts; Owned demo data only. **Feasibility:** High for evidence map, not conclusions.
- **Research confidence:** medium; separate availability of public evidence from market validation.

### B04 — Reagent substitution uncertainty

- **Track / affected user:** Biotech; Lab manager.
- **Actual trigger and workflow:** Stockout creates need to check equivalence, safety, pricing and protocols.
- **Root cause and existing inefficiency:** Vendor specs and methods not standardized. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Aborted experiments; purchasing waste.
- **Supporting evidence:** [S14]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Labguru / LIMS / catalog search. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Demo inventory + synthetic SDS/specs; Owned demo data only. **Feasibility:** Medium; substitutions require expert signoff.
- **Research confidence:** hypothesis; separate availability of public evidence from market validation.

### B05 — Lab sample chain-of-custody defects

- **Track / affected user:** Biotech; QA lead.
- **Actual trigger and workflow:** Sample scan fails/metadata conflicts before assay.
- **Root cause and existing inefficiency:** Labels, instruments and notebooks differ. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Untraceable sample / invalid experiment.
- **Supporting evidence:** [S16]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** LIMS, ELN and barcode tracking. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Simulated barcode input and sample ledger; Owned demo data only. **Feasibility:** High deterministic plus anomaly review.
- **Research confidence:** hypothesis; separate availability of public evidence from market validation.

### B06 — Multi-source protein target evidence gaps

- **Track / affected user:** Biotech; Bioinformatician.
- **Actual trigger and workflow:** Join protein annotations, papers and trial records for candidate.
- **Root cause and existing inefficiency:** Heterogeneous IDs and confidence conventions. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Time lost and mistaken biological assumptions.
- **Supporting evidence:** [S19] [S20] [S47]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** UniProt, PubChem, curated databases. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** OpenAlex, UniProt access verify; Owned demo data only. **Feasibility:** Medium; data quality limits.
- **Research confidence:** medium; separate availability of public evidence from market validation.

### C01 — Multilingual claim drift

- **Track / affected user:** Content/Digital Art; Brand localization editor.
- **Actual trigger and workflow:** Video/ad localized for new market; claims and meaning must remain approved.
- **Root cause and existing inefficiency:** Translation and review separate from approval policy. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Misleading translated claims; repeated rounds.
- **Supporting evidence:** [S28] [S49]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** YouTube dubs, ElevenLabs, agencies. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Transcript + approved claims + optional fal; Owned demo data only. **Feasibility:** High local QA; audio optional.
- **Research confidence:** medium; separate availability of public evidence from market validation.

### C02 — Video accessibility QA gaps

- **Track / affected user:** Content/Digital Art; Accessibility producer.
- **Actual trigger and workflow:** Existing video requires captions, descriptions, timing and delivery checks.
- **Root cause and existing inefficiency:** Meaningful sound/visual content omitted in automated captions. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Exclusion and rework.
- **Supporting evidence:** [S23] [S24]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Caption vendors, cloud video platforms. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Short CC video + transcript; Owned demo data only. **Feasibility:** High captions SRT + checks; audio optional.
- **Research confidence:** high; separate availability of public evidence from market validation.

### C03 — Scene asset continuity drift

- **Track / affected user:** Content/Digital Art; Creative producer.
- **Actual trigger and workflow:** A product spot gets revised; logo, package and color drift scene to scene.
- **Root cause and existing inefficiency:** Generative frames lack shared constraints. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Brand compliance failures and redo cost.
- **Supporting evidence:** [S29]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Adobe Frame.io, image generation QA. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Product reference images and generated frames; Owned demo data only. **Feasibility:** Medium latency and perception risk.
- **Research confidence:** medium; separate availability of public evidence from market validation.

### C04 — Unclear media provenance/rights

- **Track / affected user:** Content/Digital Art; Publisher and agency.
- **Actual trigger and workflow:** Before release, validate licenses, authorship, AI labels, asset evidence.
- **Root cause and existing inefficiency:** Metadata, approvals and provenance spread across vendors. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Distribution risk / delayed clearance.
- **Supporting evidence:** [S25] [S26] [S27]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** C2PA tools, DAM, spreadsheets. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Sample licenses and manifests; Owned demo data only. **Feasibility:** High provenance checks, licensing needs people.
- **Research confidence:** high need / low access; separate availability of public evidence from market validation.

### C05 — Creative comments to actionable fixes

- **Track / affected user:** Content/Digital Art; Video editor.
- **Actual trigger and workflow:** Reviewer notes scattered across timestamps and messaging.
- **Root cause and existing inefficiency:** Unstructured feedback loses time and ownership. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Rework cycles.
- **Supporting evidence:** [S29]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Frame.io and collaborative editing. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Review JSON + video timeline; Owned demo data only. **Feasibility:** High case demo; low differentiated value.
- **Research confidence:** medium; separate availability of public evidence from market validation.

### C06 — Campaign aspect ratios break assets

- **Track / affected user:** Content/Digital Art; Growth designer.
- **Actual trigger and workflow:** One approved creative adapted into multiple sizes while preserving required text.
- **Root cause and existing inefficiency:** Automated crops omit legal or product text. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Ads rejected / manual export overhead.
- **Supporting evidence:** [S23] [S29]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Editing suites, templates, generative apps. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Local sample images + constraints; Owned demo data only. **Feasibility:** High deterministic crop QA.
- **Research confidence:** medium; separate availability of public evidence from market validation.

### O01 — Public tender eligibility maze

- **Track / affected user:** Open; SME bid manager.
- **Actual trigger and workflow:** Find matching notice, read requirements, check evidence and draft bid plan.
- **Root cause and existing inefficiency:** TED notice, annexes and certifications fragmented. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Missed bids/unqualified work.
- **Supporting evidence:** [S31] [S32]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Tender alert platforms, consultants. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** TED public search + sample tender annex; Owned demo data only. **Feasibility:** High: public input, internal write.
- **Research confidence:** high; separate availability of public evidence from market validation.

### O02 — Public policy-to-action ambiguity

- **Track / affected user:** Open; SME compliance manager.
- **Actual trigger and workflow:** New rule impacts SOP, notices and form versions; change work must be assigned.
- **Root cause and existing inefficiency:** Legal language vs internal artifacts not mapped. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Untracked obligations and outdated artifacts.
- **Supporting evidence:** [S30] [S42]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Compliance software, legal teams. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Official rule excerpt + internal synthetic SOPs; Owned demo data only. **Feasibility:** High if narrow sector and source-grounded.
- **Research confidence:** high problem / medium differentiation; separate availability of public evidence from market validation.

### O03 — Building-renovation decision deadlock

- **Track / affected user:** Open; Condo administrator.
- **Actual trigger and workflow:** Compare property data, proposals, incentives, consent and timelines.
- **Root cause and existing inefficiency:** Engineering/legal docs/owner votes disparate. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Energy waste and stalled renovations.
- **Supporting evidence:** [S36] [S37]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Energy advisors, portals. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Synthetic building, real EU policy context; Owned demo data only. **Feasibility:** Medium; never automate permit/legal approval.
- **Research confidence:** high macro / low direct demand; separate availability of public evidence from market validation.

### O04 — Critical security patch choice

- **Track / affected user:** Open; Small SaaS maintainer.
- **Actual trigger and workflow:** New CVE triggers codebase dependency map, safe patch branch and regression test.
- **Root cause and existing inefficiency:** Advisories do not reflect local usage/exploitability. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Unpatched critical issues.
- **Supporting evidence:** [S38] [S39] [S40]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Snyk, Renovate, Dependabot. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** OSV/NVD public data + test repo; Owned demo data only. **Feasibility:** High technically, differentiation low.
- **Research confidence:** high problem / crowded; separate availability of public evidence from market validation.

### O05 — Building leak alerts without response

- **Track / affected user:** Open; Facility manager.
- **Actual trigger and workflow:** Moisture sensor threshold triggers verification, plumber dispatch, incident evidence.
- **Root cause and existing inefficiency:** Cheap sensors do not coordinate action. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Water damage, tenant disruption.
- **Supporting evidence:** [S36]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** IoT leak alarms and CMMS. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** ESP32 + sensor optional; simulator fallback; Owned demo data only. **Feasibility:** Medium; hardware safety constraints.
- **Research confidence:** hypothesis; separate availability of public evidence from market validation.

### O06 — Public administrative document cycles

- **Track / affected user:** Open; Citizen service office.
- **Actual trigger and workflow:** Application repeatedly requires same certificates and status updates.
- **Root cause and existing inefficiency:** Unconnected authority systems and evidence sharing. Staff generally reconcile fragments and pass requests between people; exact baseline must be observed in a pilot.
- **Consequence/cost:** Travel, re-submission, avoidable delay.
- **Supporting evidence:** [S30] [S42]. These sources establish a relevant regulatory, operational or technical context, **not measured demand or ROI** for this precise product.
- **Existing substitutes:** Gov portals, once-only infrastructure. **Residual gap hypothesis:** case-specific interpretation, coordination, or verification remains manual; requires competitor demonstration.
- **Potential agentic advantage:** identify the next missing evidence, branch on conflicting facts, prepare an approved action, then check the resulting system state.
- **Required external tools/data/access:** Government guidance + synthetic forms; Owned demo data only. **Feasibility:** Medium; no automated gov submission.
- **Research confidence:** high; separate availability of public evidence from market validation.

### 7. Prioritized bottlenecks

1. **Information propagation:** trial amendments (B01), regulations (O02), supplier exceptions (E01).
2. **Fragmented evidence plus time windows:** tenders (O01), passenger claims (E05), clinical prior auth (E06).
3. **Quality-constrained generated output:** accessibility (C02), localization claims (C01), provenance (C04).
4. **Real physical-world sensing:** maintenance voice (E03), water leak response (O05); keep fallback simulated and avoid unsafe actuation.

### 8. Competitor and substitute landscape

- **Clinical:** Veeva offers an integrated eTMF/CTMS stack, document QC, clinical agents and connections. It would be false to claim that protocol/document coordination is untouched. The possible niche is *vendor-neutral, per-sentence change impact with testable local evidence* for resource-constrained teams, not an alternative enterprise CTMS. [S21] [S22]
- **Creative:** Adobe/Frame.io already supports time-accurate comments, versions and approvals; YouTube and dubbing providers offer language tracks. Value must lie in verifying claims, WCAG-critical content and creating production-ready corrected files, not providing comment buttons. [S28] [S29] [S49]
- **Cybersecurity:** Snyk already scans and suggests patches, Renovate opens dependency PRs. PatchPilot would need a demonstrably better verification or scenario-specific strategy; as designed it is a risky originality bet. [S39] [S40]
- **Procurement and public policy:** TED search and notice downloads are officially accessible, while electronic submissions are a different authenticated workflow. Position products around *read, compare, assemble internal evidence and seek approval*, never pretend to auto-submit a bid. [S31] [S32] [S45]
- **Enterprise:** ERP/AP, workflow suites, CMMS, IdPs and insurance clearinghouses already automate slices. Any agent must show a missing-context branch and verified resolution, not just replace a fixed integration script. [S33] [S34]

### 9. Strongest underexplored hypotheses

The most defensible **demo gap** is the *cross-artifact delta*: a single upstream change produces a traceable set of downstream inconsistencies and optionally edits an **owned** artifact after approval. Distinguish an unvalidated commercial gap from the demonstrable integration pattern. Test with one real professional and two adversarial input cases before claiming differentiation.


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
