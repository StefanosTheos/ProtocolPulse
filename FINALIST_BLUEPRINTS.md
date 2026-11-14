# FINALIST BLUEPRINTS — five judge-ready products

Prepared 14 November 2026. Rankings reflect the weighted 16-concept audit and applied explicit adversarial penalties. A **real action** here means a change in the team's owned prototype (or a separately authorized integration); a generated paragraph is not counted. **No biomedical, legal, accessibility or rights certification is claimed.**

## PART IV — CRITICAL FILTERING

### 16. Adversarial review of the highest eight

Five lenses are condensed into each challenge: skeptic investor, domain expert, senior engineer, hackathon judge, potential customer. Each critique names the strongest argument *against* that product and a concrete, scope-reducing countermeasure. The adjusted scores were calculated consistently in `AI_HACKATHON_IDEAS.md`.

#### B1 — ProtocolPulse (initial 90.5; penalty 1; revised **89.5**)

- **Five skeptical lenses:** Investor: tiny clinical study teams may not pay; domain: regulatory consequences of inaccurate edits; engineer: edge cases in table/text extraction; judge: needs live writable proof; user: may already own Veeva.
- **Strongest objection:** Veeva already provides clinical document processes and AI; novelty cannot be asserted from a generic change detector.
- **Revision adopted:** Narrow to cohort-specific protocol deltas, exact quotes and editable owned checklist; no claim of regulated compliance.
- **Remaining validation:** Compare against Veeva workflow via real buyer interview; demand unverified.

#### O1 — TenderTrace (initial 89.0; penalty 1; revised **88.0**)

- **Five skeptical lenses:** Investor: tender matching is crowded; domain: real eligibility depends on complex annexes and legal interpretations; engineer: annex extraction could fail; judge: live TED might rate-limit; user: irrelevant tenders are noisy.
- **Strongest objection:** Existing alert and tender consulting platforms could already offer requirement extraction; public notice alone may not prove originality.
- **Revision adopted:** Focus on requirement-by-requirement *bid/no-bid* evidence and authorized missing-document task creation, not alerting.
- **Remaining validation:** Use cached notice with provenance, verify TED retrieval independently, no bidding submission.

#### O2 — PolicyPath (initial 88.5; penalty 1; revised **87.5**)

- **Five skeptical lenses:** Investor: horizontal compliance is expensive to sell; domain: legal advice liability; engineer: web diff instability; judge: unclear scope; user: needs low false-positive rate.
- **Strongest objection:** Broad AI policy interpreters are generic and dangerous if actioned without bounded applicability.
- **Revision adopted:** Scope demo to a published, currently-effective rule in a single vertical, explicit entity thresholds, an internal SOP and reviewer signoff.
- **Remaining validation:** Source availability and duty owner must be confirmed before production.

#### C2 — AccessCut (initial 87.5; penalty 1; revised **86.5**)

- **Five skeptical lenses:** Investor: caption and description tooling exists; domain: accessibility expert must certify; engineer: vision inference costly; judge: is sound cue reliable?; user: need editable final SRT.
- **Strongest objection:** AI caption systems already exist and a generic subtitle tool is a wrapper.
- **Revision adopted:** Target multimodal omission QA of meaningful sounds and non-spoken visual content; deliver parsable corrected SRT plus unresolved issue report.
- **Remaining validation:** Do not claim automated WCAG compliance; recruit a specialist to score output.

#### C1 — LocaleProof (initial 84.5; penalty 1; revised **83.5**)

- **Five skeptical lenses:** Investor: crowded AI dubbing market; domain: legal phrasing varies; engineer: translation regression may false flag; judge: no voice generation if credits missing; user: wants faithful version.
- **Strongest objection:** YouTube and others already translate/dub; language generation alone is not defensible.
- **Revision adopted:** Position strictly as locale-specific *claim preservation and release gate* after generation, with testable numeric/phrase invariants.
- **Remaining validation:** Export SRT without synthesizing voice; test with bilingual reviewer.

#### B2 — TrialTrace (initial 83.2; penalty 0; revised **83.2**)

- **Five skeptical lenses:** Investor: registry QC customer base is small; domain: public CTIS data incomplete; engineer: no guarantee registry document machine access; judge: lookup might fail; user: update still manual.
- **Strongest objection:** Mapping publicly visible registry fields and PDF is nontrivial, and may remain a simple QA tool.
- **Revision adopted:** Use one documented public accessible record and an intentionally mismatched protocol fixture; write internal discrepancy log only.
- **Remaining validation:** Compare against sponsor CTMS and available CTIS export in validation.

#### C4 — RightsRail (initial 81.8; penalty 1; revised **80.8**)

- **Five skeptical lenses:** Investor: rights management is saturated; domain: metadata not license proof; engineer: C2PA assets sometimes missing manifests; judge: license contract interpretation uncertain; user: legal gate can slow release.
- **Strongest objection:** C2PA provenance is not copyright ownership or rights clearance.
- **Revision adopted:** Treat manifest as one signal; require human signed rights document with allowed channel/territory.
- **Remaining validation:** If manifest missing, represent unknown instead of making authenticity claim.

#### V4 — AccessExit (initial 80.8; penalty 1; revised **79.8**)

- **Five skeptical lenses:** Investor: identity management is a commodity; domain: account owner transfers; engineer: permissions can lock company out; judge: demo fake SaaS may look fake; user: IdP already does most.
- **Strongest objection:** SCIM/IdP automated offboarding exists; unsupervised revocation is risky.
- **Revision adopted:** Narrow to cross-system reconciliation and second-read verification in two owned test apps.
- **Remaining validation:** Cannot show value beyond IdP until a real missing-permission case is measured.

### 17. Revised shortlist and filtering decision

The top five are **B1 ProtocolPulse, O1 TenderTrace, O2 PolicyPath, C2 AccessCut, C1 LocaleProof**, ordered by revised scores. **B2 TrialTrace** remains promising but less visually dramatic and partly reliant on public registry data completeness. **C4 RightsRail** is a governance idea worth revisiting but cannot prove licensing or authenticity merely by reading C2PA metadata. **V4 AccessExit** has strong scope-limited technical feasibility but suffers substantial IAM product parity. **O4 PatchPilot** has the largest commodity penalty because Snyk and Renovate automate material portions of its pitch. [S21] [S22] [S25] [S39] [S40]

## PART V — FIVE DETAILED FINALIST BLUEPRINTS

Each blueprint enumerates the requested 25 operational dimensions. Engineering schemas, data conditions, approvals and failure modes are deliberately specified so the team can begin with compatible API contracts.

## Finalist 1 — ProtocolPulse (B1) — 89.5/100

1. **Name/tagline:** ProtocolPulse — A changed trial protocol becomes a traceable and executable downstream-document amendment plan.
2. **Tracks:** Primary Biotech & AI; secondary Voice/Enterprise (only the listed aspect is material).
3. **Research-supported pain:** Schedule, consent, site checklist and registry fields repeat the same concept. Public context: [S15] [S16] [S21] [S22]. The precise buyer need is not measured.
4. **Stakeholders:** Clinical study coordinator, QA, small sponsor, reviewer/approver, affected document owner and audit recipient.
5. **Existing alternatives:** Veeva CTMS/eTMF and manual QC already cover portions.
6. **Defensible differentiation hypothesis:** Version-to-version semantic delta linked to sentence-level evidence, condition-aware impact, and verified creation of a corrected owned study artifact.
7. **Intended complete product:** Load two synthetic protocol versions + four study documents → extract changed facts → find inconsistent clauses → rank → reviewer approves → patch checklist and read it back. Future release adds secure organization connectors, long-term monitoring, retention rules and audit export.
8. **Core journeys:** Happy path — one source trigger, verified effect. Counterexample — a near-match whose applicability/impact differs. Failure path — missing evidence or denied approval, with no write.
9. **Agent responsibilities:** If the visit applies only to one cohort, update corresponding site document and leave other cohort untouched; unresolved conflicts become review tasks. It is prohibited from treating inference as verified fact.
10. **Exact tool catalog:** `documents.diff(old,new)->changes`, `references.find(claim)->occurrences`, `impact.classify(change,occurrence)->finding`, `documents.patch(approved)->new_version`, `documents.read(id)->text`. Tool schemas are proposed implementation contracts, not existing undocumented vendor endpoints.
11. **Workflow and branches:** If text contradicts amendment, draft a change; if a document merely quotes old history, mark not impacted; if uncertain ask QA. The planner checks confidence, source version, authorization and previous tool result before deciding the next call.
12. **Data and dependencies:** Two versioned 2-page synthetic protocols, 4 dependent synthetic text/DOCX artifacts, cohorts A/B and 3 seeded false-positive traps. Completely synthetic trial and consent; public SPIRIT guidance; no patient data.
13. **Human-approval boundaries:** QA must approve text, risk classification and every version write; no registry write or clinical authority action.
14. **Real side effects:** `impact_case`, `evidence_span`, `proposed_patch`, `approval`, `document_version`, `verification` records; approved new checklist file.
15. **Success verification:** Exact source and target excerpts, resulting version hash, passed contradiction check. Compare persisted versions, not only messages.
16. **Main screens:** Case workspace, aligned version diff, affected-document graph, approve patch, evidence and verification timeline.
17. **Technical architecture:** `Next.js UI -> FastAPI / typed case services -> SQLite evidence/event/version store`; `Agent planner -> read-only adapters -> constrained proposal`; `approval gate -> owned write service -> independent readback verifier`. **Suggested HTTP contract:** POST /cases -> caseId; POST /cases/{id}/analyze -> findings[]; POST /proposals/{id}/approve -> approvalId; POST /proposals/{id}/apply -> versionId; GET /versions/{id}/verify -> {pass,evidence}. **Safety:** Exact document version precondition; if stale source hash, reject writes; no patient data. QMS/IRB is not accessed.
18. **Three-engineer ownership:** E1: diff and impact graph + accessible approval. E2: versioned documents, optimistic-lock write and independent verifier. E3: factual delta JSON extractor, case branch and 3 adversarial fixtures. Create a stable OpenAPI / Zod contract; E1 owns `frontend/`, E2 `backend/`, E3 `agent/`; shared `contracts/` frozen after kickoff agreement.
19. **Smallest integrated demo:** One genuine source (or date-stamped local cache), one second supporting artifact, one conditional branch, one accepted proposal, one new owned state/version, a readback receipt. **Build note:** Use text+DOCX only; deterministic sentence anchors; optional LLM role is relation mapping. Force every finding to carry source/version and target range.
20. **Expansion:** OAuth connectors, tenant access, full document/version formats, source monitors, regression evaluation and multi-case dashboards.
21. **Live demo storyboard (judge-visible):** The judge changes protocol visit window from day 28±3 to 21±2 for Cohort A; the system identifies the precise informed-consent paragraph, site checklist and visit table that became stale, intentionally leaves Cohort B unchanged, and rewrites an approved owned checklist. A reread proves consistency.
22. **Estimated difficulty:** 3 engineers, one 29-hour sprint; yes for a 90-minute minimal demonstrator; core logic possible using selected constrained data, not production deployment.
23. **Major risks:** Semantic false positives, regulated document risks, near-identical existing vendor tools. In every case include timeouts, uncertainty gates, source hashes, API failure handling and logs.
24. **Evidence for feasibility and de-risk validation:** 5 real protocol amendments anonymized or synthetic reviewed by clinical QA expert; measure precision of impacted clause matches and missed dependencies. **Fallback:** If semantic relation unreliable, deterministic known changed visit-window + explicit pairwise spans; fail closed on uncertainty.. References [S15] [S16] [S21] [S22].
25. **Weighted ranking:** raw 90.5/100; explicit penalty 1; **final 89.5/100**.

**Single most compelling moment:** The judge changes protocol visit window from day 28±3 to 21±2 for Cohort A; the system identifies the precise informed-consent paragraph, site checklist and visit table that became stale, intentionally leaves Cohort B unchanged, and rewrites an approved owned checklist. A reread proves consistency.

## Finalist 2 — TenderTrace (O1) — 88.0/100

1. **Name/tagline:** TenderTrace — Turns live EU procurement notices into a sourced, eligibility-aware bid execution plan and approved internal artifacts.
2. **Tracks:** Primary Open; secondary Voice/Enterprise (only the listed aspect is material).
3. **Research-supported pain:** Notice fields, annexes, certifications, deadlines, and company profile are not in one place. Public context: [S31] [S32] [S45] [S30]. The precise buyer need is not measured.
4. **Stakeholders:** SME bid owner, reviewer/approver, affected document owner and audit recipient.
5. **Existing alternatives:** Tender portals, notification services, human consultants.
6. **Defensible differentiation hypothesis:** Public-data-to-approved-action loop: rank, explain disqualifying requirements, identify missing evidence, create task/document packet, verify saved state.
7. **Intended complete product:** Query TED API → pick notice → read annexes where accessible → compare example SME profile → branch eligible/blocked → approve → create bid tasks and evidence pack. Future release adds secure organization connectors, long-term monitoring, retention rules and audit export.
8. **Core journeys:** Happy path — one source trigger, verified effect. Counterexample — a near-match whose applicability/impact differs. Failure path — missing evidence or denied approval, with no write.
9. **Agent responsibilities:** If required turnover exceeds company criteria or cert absent, block and request evidence; otherwise create bid tasks. It is prohibited from treating inference as verified fact.
10. **Exact tool catalog:** `ted.search(CPV,region)->notices` (public), `annex.extract(url)->requirements` (if accessible), `eligibility.evaluate(reqs,profile)->status`, `bidpack.write(approved)->id`, `bidpack.read(id)->record`. Tool schemas are proposed implementation contracts, not existing undocumented vendor endpoints.
11. **Workflow and branches:** Deadline before production capacity? Flag no-bid; otherwise request only missing certificate; uncertain requirement is not invented. The planner checks confidence, source version, authorization and previous tool result before deciding the next call.
12. **Data and dependencies:** Public TED search query (example CPV/region), a cached dated notice, one supplied illustrative annex, sample SME capacity and certificate portfolio. Public notices accessible without auth; annex downloads may be gated; use dated fixtures.
13. **Human-approval boundaries:** SME approver decides bid/no-bid and approves documents; never submit to TED or pay fees.
14. **Real side effects:** `notice`, `requirement`, `evidence_item`, `eligibility_decision`, `bid_task`, `bid_pack`, and approval receipts.
15. **Success verification:** Saved bid project with deadline, source links, checked requirements and task readback. Compare persisted versions, not only messages.
16. **Main screens:** Tender feed, document viewer, requirement matrix, bid/no-bid decision, evidence collection, committed tasks.
17. **Technical architecture:** `Next.js UI -> FastAPI / typed case services -> SQLite evidence/event/version store`; `Agent planner -> read-only adapters -> constrained proposal`; `approval gate -> owned write service -> independent readback verifier`. **Suggested HTTP contract:** GET /ted/search?cpv=...; POST /bidprojects -> id; POST /bidprojects/{id}/requirements -> findings; POST /bidprojects/{id}/tasks/approve -> taskId; GET /bidprojects/{id}/tasks -> list. **Safety:** User controls company evidence; no claims about legal eligibility or third-party credential access; source notice date/URL pinned; no bid submission.
18. **Three-engineer ownership:** E1: searchable tender/requirement UX. E2: TED adapter, cached fixture, tasks and source logging. E3: requirement extraction with abstentions, CPV reranking and edge-case tests. Create a stable OpenAPI / Zod contract; E1 owns `frontend/`, E2 `backend/`, E3 `agent/`; shared `contracts/` frozen after kickoff agreement.
19. **Smallest integrated demo:** One genuine source (or date-stamped local cache), one second supporting artifact, one conditional branch, one accepted proposal, one new owned state/version, a readback receipt. **Build note:** One public TED Search API adapter, parser for controlled annex text, local company profile and a task database. Distinguish notice metadata from externally linked tender attachments.
20. **Expansion:** OAuth connectors, tenant access, full document/version formats, source monitors, regression evaluation and multi-case dashboards.
21. **Live demo storyboard (judge-visible):** A real TED notice is displayed with a link. The company has two certifications and lacks one required annex: the agent does **not** say bid-ready, creates one evidence request with a deadline, and after human approval verifies it exists in the internal bid project.
22. **Estimated difficulty:** 3 engineers, one 29-hour sprint; yes for a 90-minute minimal demonstrator; core logic possible using selected constrained data, not production deployment.
23. **Major risks:** Product similarity to tender alert vendors; annex permissions; legal interpretations. In every case include timeouts, uncertainty gates, source hashes, API failure handling and logs.
24. **Evidence for feasibility and de-risk validation:** One professional bidder scores missed mandatory criteria, false exclusion, and willingness to pay vs alert-only tools. **Fallback:** If TED inaccessible at demo, show captured notice timestamp and still perform a real new database write/readback in local project.. References [S31] [S32] [S45] [S30].
25. **Weighted ranking:** raw 89.0/100; explicit penalty 1; **final 88.0/100**.

**Single most compelling moment:** A real TED notice is displayed with a link. The company has two certifications and lacks one required annex: the agent does **not** say bid-ready, creates one evidence request with a deadline, and after human approval verifies it exists in the internal bid project.

## Finalist 3 — PolicyPath (O2) — 87.5/100

1. **Name/tagline:** PolicyPath — Converts a source-grounded rule change into an impact map, approved work orders and version-verified internal updates.
2. **Tracks:** Primary Open; secondary Voice/Enterprise (only the listed aspect is material).
3. **Research-supported pain:** Human must compare primary rule, current policy, template, process owner and due date. Public context: [S30] [S42]. The precise buyer need is not measured.
4. **Stakeholders:** SME compliance manager / municipal operations lead, reviewer/approver, affected document owner and audit recipient.
5. **Existing alternatives:** Compliance software, legal newsletters, checklists.
6. **Defensible differentiation hypothesis:** Produces artifact-specific evidence map and actually updates an authorized SOP/task after reviewer signoff, not general Q&A.
7. **Intended complete product:** Load official source + before-version → parse rule delta → scan sample SOP/forms → identify contradictions → assign owners → approve one edit → verify new file version. Future release adds secure organization connectors, long-term monitoring, retention rules and audit export.
8. **Core journeys:** Happy path — one source trigger, verified effect. Counterexample — a near-match whose applicability/impact differs. Failure path — missing evidence or denied approval, with no write.
9. **Agent responsibilities:** If language imposes obligation only after size threshold, do not update below-threshold organization; if ambiguous, mark legal review. It is prohibited from treating inference as verified fact.
10. **Exact tool catalog:** `sources.fetch(official_url)->version`, `documents.search(claim)->matches`, `changeplan.create()->tasks`, `sop.apply(approved)->version`, `sop.read(version)->text`. Tool schemas are proposed implementation contracts, not existing undocumented vendor endpoints.
11. **Workflow and branches:** A deadline already passed results in immediate escalation; future proposed EU measure does not trigger current obligation. The planner checks confidence, source version, authorization and previous tool result before deciding the next call.
12. **Data and dependencies:** One real official rule excerpt with dated effective text; 2 synthetic organization profiles; prior/updated SOP paragraphs and owner registry. Verified public rules + synthetic organization policies; document provenance essential.
13. **Human-approval boundaries:** Professional reviewer approves scope; no legal advice, filing or transmission autonomously.
14. **Real side effects:** `source_version`, `regulatory_rule`, `applicability_case`, `affected_artifact`, `approval`, `sop_version`, `task`, `verification`.
15. **Success verification:** SOP diff, stored task, source citations, readback and unresolved ambiguities. Compare persisted versions, not only messages.
16. **Main screens:** Source chronology, legal applicability cards, SOP dependency graph, owner workflow, approval and evidence ledger.
17. **Technical architecture:** `Next.js UI -> FastAPI / typed case services -> SQLite evidence/event/version store`; `Agent planner -> read-only adapters -> constrained proposal`; `approval gate -> owned write service -> independent readback verifier`. **Suggested HTTP contract:** POST /regulations/ingest -> sourceVersion; POST /impact/analyze -> proposals; POST /impact/{id}/approve -> approvalId; PATCH /sops/{id} -> version; GET /sops/{id}/verify -> result. **Safety:** No generated legal obligations absent exact cite and applicability; human counsel approval for legal interpretations; never auto-file reports.
18. **Three-engineer ownership:** E1: change cards, evidence/approval. E2: versioned SOP storage and tasks. E3: applicability rule testing and mapping to affected clauses. Create a stable OpenAPI / Zod contract; E1 owns `frontend/`, E2 `backend/`, E3 `agent/`; shared `contracts/` frozen after kickoff agreement.
19. **Smallest integrated demo:** One genuine source (or date-stamped local cache), one second supporting artifact, one conditional branch, one accepted proposal, one new owned state/version, a readback receipt. **Build note:** One named rule family, local SOPs, hard-coded date applicability rules backed by official text, LLM only maps semantic mentions.
20. **Expansion:** OAuth connectors, tenant access, full document/version formats, source monitors, regression evaluation and multi-case dashboards.
21. **Live demo storyboard (judge-visible):** The judge toggles entity classification above/below a regulatory threshold. The same official rule produces two different branches: one approved SOP update and one justified no-action, both with cited clause and timestamp.
22. **Estimated difficulty:** 3 engineers, one 29-hour sprint; yes for a 90-minute minimal demonstrator; core logic possible using selected constrained data, not production deployment.
23. **Major risks:** Legal scope risk and broad domain; restrict to one concrete rule family. In every case include timeouts, uncertainty gates, source hashes, API failure handling and logs.
24. **Evidence for feasibility and de-risk validation:** Ask two compliance practitioners to classify the same two organizations, compare false positives and missed edge conditions. **Fallback:** Offline archived officially sourced excerpt and exact old/new SOP files; all actions still local and fresh.. References [S30] [S42].
25. **Weighted ranking:** raw 88.5/100; explicit penalty 1; **final 87.5/100**.

**Single most compelling moment:** The judge toggles entity classification above/below a regulatory threshold. The same official rule produces two different branches: one approved SOP update and one justified no-action, both with cited clause and timestamp.

## Finalist 4 — AccessCut (C2) — 86.5/100

1. **Name/tagline:** AccessCut — An accessibility production agent detects missing caption and visual information and exports a corrected deliverable.
2. **Tracks:** Primary Content & Digital Art; secondary Open (only the listed aspect is material).
3. **Research-supported pain:** Automatic transcript omits sound cues and salient visual instructions. Public context: [S23] [S24]. The precise buyer need is not measured.
4. **Stakeholders:** Accessible media producer, reviewer/approver, affected document owner and audit recipient.
5. **Existing alternatives:** Captions services, editors, platform auto-captions.
6. **Defensible differentiation hypothesis:** Uses audible and visual evidence to request missing content, checks against WCAG-style checklist, outputs SRT + description track script and manifest.
7. **Intended complete product:** Import original video → extract speech/frames → label sound and key visual actions → suggest caption/audio description → human review → export SRT + report. Future release adds secure organization connectors, long-term monitoring, retention rules and audit export.
8. **Core journeys:** Happy path — one source trigger, verified effect. Counterexample — a near-match whose applicability/impact differs. Failure path — missing evidence or denied approval, with no write.
9. **Agent responsibilities:** If a visual instruction is already spoken, no duplicate description; if a non-speech alarm is meaningful, add caption. It is prohibited from treating inference as verified fact.
10. **Exact tool catalog:** `media.extract(video)->audio,frames`, `caption.audit(transcript,features)->issues`, `deliverables.write(approved)->SRT,JSON`, `deliverables.validate()->issues`. Tool schemas are proposed implementation contracts, not existing undocumented vendor endpoints.
11. **Workflow and branches:** For audible alarm uncaptioned, add [alarm]; for visible button not described, propose narration, never claim WCAG certification. The planner checks confidence, source version, authorization and previous tool result before deciding the next call.
12. **Data and dependencies:** Rights-cleared 20–30-second video with separate corrected reference labels and intentionally flawed captions. Rights-cleared short clip.
13. **Human-approval boundaries:** Human checks accuracy and timing before release.
14. **Real side effects:** `media_asset`, `timeline_segment`, `accessibility_finding`, `approved_caption`, `approved_description`, `render_job`, `validation_report`.
15. **Success verification:** Parse generated SRT, verify timecode order and counts and list unaddressed visual events. Compare persisted versions, not only messages.
16. **Main screens:** Original and corrected caption timeline, video player, QA missing-cue cards, export and validator.
17. **Technical architecture:** `Next.js UI -> FastAPI / typed case services -> SQLite evidence/event/version store`; `Agent planner -> read-only adapters -> constrained proposal`; `approval gate -> owned write service -> independent readback verifier`. **Suggested HTTP contract:** POST /media/import -> assetId; POST /media/{id}/audit -> findings; POST /media/{id}/fixes/approve -> approvalId; POST /exports/srt -> fileId; GET /exports/{id}/validate -> {pass,errors}. **Safety:** Human reviewer verifies meaningful sounds and image descriptions. Generated narration is optional; no certification claim.
18. **Three-engineer ownership:** E1: synchronized player, editor, issue cards. E2: FFmpeg extraction, SRT writer, timecode validation. E3: audiovisual QA, prompt fixtures, uncertainty scoring. Create a stable OpenAPI / Zod contract; E1 owns `frontend/`, E2 `backend/`, E3 `agent/`; shared `contracts/` frozen after kickoff agreement.
19. **Smallest integrated demo:** One genuine source (or date-stamped local cache), one second supporting artifact, one conditional branch, one accepted proposal, one new owned state/version, a readback receipt. **Build note:** Use FFmpeg, provided transcript and representative frames; multimodal extraction can be optional if token/cost too high.
20. **Expansion:** OAuth connectors, tenant access, full document/version formats, source monitors, regression evaluation and multi-case dashboards.
21. **Live demo storyboard (judge-visible):** A 20-second instruction clip includes an audible alarm and a silent screen demonstration. The app catches both omissions, creates corrected SRT with “[alarm sounding]”, produces a visual-description narration cue and passes a timecode validator.
22. **Estimated difficulty:** 3 engineers, one 29-hour sprint; yes for a 90-minute minimal demonstrator; core logic possible using selected constrained data, not production deployment.
23. **Major risks:** A/V inference cost, accessibility quality subjectivity. In every case include timeouts, uncertainty gates, source hashes, API failure handling and logs.
24. **Evidence for feasibility and de-risk validation:** Deaf/hard-of-hearing and blind/low-vision user testers plus expert caption review; count critical omitted cues. **Fallback:** Provided sample frames and editable transcript if real-time vision/audio request unavailable; still generate final SRT live.. References [S23] [S24].
25. **Weighted ranking:** raw 87.5/100; explicit penalty 1; **final 86.5/100**.

**Single most compelling moment:** A 20-second instruction clip includes an audible alarm and a silent screen demonstration. The app catches both omissions, creates corrected SRT with “[alarm sounding]”, produces a visual-description narration cue and passes a timecode validator.

## Finalist 5 — LocaleProof (C1) — 83.5/100

1. **Name/tagline:** LocaleProof — Constraint-aware multilingual creative localization with hard claim preservation checks.
2. **Tracks:** Primary Content & Digital Art; secondary Voice/Enterprise (only the listed aspect is material).
3. **Research-supported pain:** Translation may modify percentages, guarantees, geography or approved wording. Public context: [S23] [S28] [S49]. The precise buyer need is not measured.
4. **Stakeholders:** Localization producer / brand compliance, reviewer/approver, affected document owner and audit recipient.
5. **Existing alternatives:** YouTube translation, automated dubbing and human agencies.
6. **Defensible differentiation hypothesis:** Detect and repair exact claim drift, show auditable source-to-target paired approval, export corrected SRT.
7. **Intended complete product:** Load video transcript + approved claims → translate → parse numbers/claims → produce error report → correct → approve → export. Future release adds secure organization connectors, long-term monitoring, retention rules and audit export.
8. **Core journeys:** Happy path — one source trigger, verified effect. Counterexample — a near-match whose applicability/impact differs. Failure path — missing evidence or denied approval, with no write.
9. **Agent responsibilities:** If legally approved claim lacks approved locale equivalent, block publication instead of inventing one. It is prohibited from treating inference as verified fact.
10. **Exact tool catalog:** `transcript.segment(file)->segments`, `claims.check(segments,policy)->findings`, `subtitles.export(approved)->SRT`, optional `fal.generate` only if credits. Tool schemas are proposed implementation contracts, not existing undocumented vendor endpoints.
11. **Workflow and branches:** A product percentage changes meaning; the agent rewrites only affected lines. The planner checks confidence, source version, authorization and previous tool result before deciding the next call.
12. **Data and dependencies:** Original and target captions, numbers/brand/legal constraints, approved locale glossary. Sample rights-cleared 30-second video or transcript.
13. **Human-approval boundaries:** Editor signs off on approved terms; no auto publishing.
14. **Real side effects:** `claim_constraint`, `locale_segment`, `violation`, `approved_revision`, `subtitle_artifact`, `quality_report`.
15. **Success verification:** SRT and regression report with preserved figures. Compare persisted versions, not only messages.
16. **Main screens:** Source/target subtitle aligned view, constraint badges, revision approvals, export validation.
17. **Technical architecture:** `Next.js UI -> FastAPI / typed case services -> SQLite evidence/event/version store`; `Agent planner -> read-only adapters -> constrained proposal`; `approval gate -> owned write service -> independent readback verifier`. **Suggested HTTP contract:** POST /locales/check -> violations; POST /locales/revise -> proposals; POST /locales/approve -> receipt; POST /locales/export -> srtId; GET /locales/verify/{id} -> report. **Safety:** Does not assert translation is legally adequate or generate unlicensed voice clones; human bilingual review.
18. **Three-engineer ownership:** E1: paired transcript editor. E2: subtitle parser, export, file hashes. E3: semantic claim verification and locale glossary constraints. Create a stable OpenAPI / Zod contract; E1 owns `frontend/`, E2 `backend/`, E3 `agent/`; shared `contracts/` frozen after kickoff agreement.
19. **Smallest integrated demo:** One genuine source (or date-stamped local cache), one second supporting artifact, one conditional branch, one accepted proposal, one new owned state/version, a readback receipt. **Build note:** Start with text-level SRT-to-SRT audit; optional fal audio media production only if confirmed credit and rights.
20. **Expansion:** OAuth connectors, tenant access, full document/version formats, source monitors, regression evaluation and multi-case dashboards.
21. **Live demo storyboard (judge-visible):** A product campaign claims “50% fewer steps”; the target-language transcript accidentally says “15%”. The tool refuses publication, highlights the specific segments, and delivers a corrected locale SRT with a passing claim-check log.
22. **Estimated difficulty:** 3 engineers, one 29-hour sprint; yes for a 90-minute minimal demonstrator; core logic possible using selected constrained data, not production deployment.
23. **Major risks:** Existing dubbing competition, multilingual nuances, voice licensing. In every case include timeouts, uncertainty gates, source hashes, API failure handling and logs.
24. **Evidence for feasibility and de-risk validation:** Bilingual reviewer scores terminology, numeric fidelity and false positive rate against existing tools. **Fallback:** Never require dubbing or media generation for core; correct SRT export is real artifact.. References [S23] [S28] [S49].
25. **Weighted ranking:** raw 84.5/100; explicit penalty 1; **final 83.5/100**.

**Single most compelling moment:** A product campaign claims “50% fewer steps”; the target-language transcript accidentally says “15%”. The tool refuses publication, highlights the specific segments, and delivers a corrected locale SRT with a passing claim-check log.

## 19. Five-finalist comparison matrix

| Product | Track | User | Pain / Novelty / Agent* | Meaningful tools | Data | Sponsor optional | Hardware | Feasibility / Demo / Wow* | Potential and central weakness | Final |
|---|---|---|---|---|---|---|---|---|---|---:|
| ProtocolPulse | Biotech & AI | Clinical study coordinator, QA, small sponsor | 9.5/8.5/9.5 | 3–5 reads+approved write+readback | Completely synthetic trial and consent | Gemini / Firecrawl or fal as relevant | No | 8.5/9.5/9.0 | Semantic false positives, regulated document risks, near-identical existing vendor tools.; value 9/10 | 89.5 |
| TenderTrace | Open | SME bid owner | 9/8/9 | 3–5 reads+approved write+readback | Public notices accessible without auth | Gemini / Firecrawl or fal as relevant | No | 9/9.5/8.8 | Product similarity to tender alert vendors; value 9/10 | 88.0 |
| PolicyPath | Open | SME compliance manager / municipal operations lead | 9/8/9.5 | 3–5 reads+approved write+readback | Verified public rules + synthetic organization policies | Gemini / Firecrawl or fal as relevant | No | 8.5/9/8.5 | Legal scope risk and broad domain; value 9.5/10 | 87.5 |
| AccessCut | Content & Digital Art | Accessible media producer | 9/8/9 | 3–5 reads+approved write+readback | Rights-cleared short clip. | Gemini / Firecrawl or fal as relevant | No | 8.5/9.5/8.8 | A/V inference cost, accessibility quality subjectivity.; value 8.5/10 | 86.5 |
| LocaleProof | Content & Digital Art | Localization producer / brand compliance | 8/8.5/8.5 | 3–5 reads+approved write+readback | Sample rights-cleared 30-second video or transcript. | Gemini / Firecrawl or fal as relevant | No | 8.5/9/8.8 | Existing dubbing competition, multilingual nuances, voice licensing.; value 8/10 | 83.5 |

\*All component ratings are analyst judgment on a 0–10 scale. Wow is a qualitative proxy (average novelty/demo), **not** a separate scoring category. Competitor coverage and data accessibility are discussed per blueprint.

### 20. Best demonstrated moments

**Overall/agentic:** ProtocolPulse's selective cohort-aware downstream update is independently rechecked. **Fastest 90-minute MVP:** LocaleProof can take two SRT files, catch a numeric claim drift and export corrected SRT; TenderTrace requires TED adapter and more UI but creates stronger end-to-end business value. **Most original hypothesis:** ProtocolPulse, relative to the set reviewed, because of targeted change propagation—not a claim of global patent novelty. **Longest-term platform upside:** PolicyPath if a narrow initial rule family proves reliable and clients pay. **Hardware-enhanced exploratory opportunity:** LeakSignal (O05 in the 24-problem map): ESP32 + conductive moisture sensor → calibrated threshold → timestamped signal → verified owned incident ticket; no autonomous valve control. Device cost is an **unverified purchase estimate** and hardware is **not confirmed available**. Simulator is mandatory fallback; not one of the final 16 chosen products.

### 21. Execution and integration risk matrix

| Risk | Failure symptom | Pre-emptive mitigation | Live fallback |
|---|---|---|---|
| Sponsor key/credit missing | 401 / budget error | Do not depend on Wonderful, fal, boxd or event credit for MVP | Use own local fixture + Gemini account if configured or deterministic mapper |
| Public API/website unavailable | timeout or CORS | Server-side proxy, 2s deadlines, pinned response provenance | Date-stamped cached real TED/registry record |
| LLM invents obligations | unsupported clause | exact cite to source span, source hash, abstain if no support | Show blocked proposal with unresolved evidence |
| File-write conflict | a user changed document in meantime | optimistic version guard + human approval | Reject stale write, ask user to re-review |
| Multimodal media too slow | generation queue blocks demo | isolate media generation from critical path | preloaded original video, live SRT QA and export |
| Regulatory/privacy issue | protected content or unsafe action | fully synthetic cases, no patients and no government writes | anonymized fixtures and local action log |
| Demo machine/network fails | site unreachable | repo, reproducible docker start, offline export | locally hosted backend + prerecorded evidence video, clearly labeled |

### 22. Shared typed contract and build schedule

**Typed objects:** `Case{id,owner,domain,sourceIds,status}`, `EvidenceSpan{sourceId,version,locator,quote,sha256,confidence}`, `Finding{id,claim,evidenceRefs,applicability,severity,unknowns}`, `ProposedAction{id,preconditionHash,payload,needsApproval}`, `Approval{id,userId,scope,approvedAt}`, `Receipt{actionId,objectId,beforeHash,afterHash,readbackStatus}`. Never let the agent mutate the database directly; it requests whitelisted service actions.

**29-hour sprint (relative to opening 13:00; organizer terms conflict by one hour):** H0–1 freeze project scope/contracts; H1–5 parallel front/back/AI vertical slice; H5–9 integrate real source read + fixture; H9–14 approved write + independent verifier; H14–19 edge cases and UI; H19–23 refine demo and test retries; H23–26 record 2–3 minute demo, README, reproducibility; H26–29 submission buffer and repo/video checks. Treat breaks and sleep as necessary; avoid unnecessary overnight features. **Source of deadline:** [S02] [S03].


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
