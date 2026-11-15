# Recruitment and monitoring workflow

Start at Overview and select a study. Both workspaces use the same persisted study; no study-specific data is loaded before selection. The role dropdown switches simulated identities without creating accounts.

| Workspace | Tabs | Responsibility |
|---|---|---|
| Sponsor (`ACT-COORD-01`, `COORDINATOR`) | Overview, Protocol, Participation | Prepare protocol proposals and inspect aggregate participation across studies. |
| Clinical Lead (`ACT-INV-01`, `INVESTIGATOR`) | Overview, Protocol, Screen patients, Safety, Audit trail | Approve rules, screen, review evidence, record external participation and disposition cases. |

These are UI workspace assignments. The authoritative API permission and scope rules remain in [API_CONTRACTS](API_CONTRACTS.md).

## 1. Prepare the protocol

On a fresh PX-104 installation, rules are unapproved. Sponsor opens Protocol and uploads [the supported fictional PDF](../fixtures/protocols/px104-v1/PX-104-v1.0-fictional.pdf) using a new version label, then starts extraction.

With AI enabled and configured, actual page text is passed through the gateway to Gemini. With AI off, the application identifies the proposal as curated. Both paths leave rules unapproved. Enabled-model failures stay explicit.

Sponsor sees **Waiting for a Clinical Lead to approve these rules** while review is pending.

## 2. Review and approve

Switch to Clinical Lead. Inspect source quotes, page references, operators, units, date windows and coverage. There are **eight rules** and **twelve coverage sections**, of which four are informational. Informational text does not create additional rules.

Resolve blockers and approve the rules and coverage through the human review action. Zero blockers alone does not constitute approval. The application permits only one active version; use a fresh disposable study/database when repeating initial activation.

## 3. Screen and inspect evidence

Open Screen patients and use screening date **2026-10-31**. A fresh standard setup contains **30 patients**; original acceptance scenarios use the first fifteen. Wait for the job to succeed and screening run to complete.

The backend evaluates the five eligibility rules. Counts come from the persisted assessments; they are not predetermined by the interface.

| Patient | What to inspect |
|---|---|
| P-042 | Potential-match baseline and subsequent participation/event monitoring. |
| P-175 | Clear protocol conflict. |
| P-117 / P-118 | Restricted medication inside versus outside the washout window. |
| P-083 | Medication order without confirmed use: retain uncertainty. |
| P-124 | Missing/currently invalid lab evidence. |
| P-140 | Contradictory medication records and source provenance. |

Open patient evidence and chronology. Compare clinical-effective time with documentation time; an order does not establish administration. `PASS/FAIL/UNKNOWN` are rule results; candidate status, screening disposition and participation are distinct concepts.

## 4. Record external participation

Clinical Lead opens P-042 from screening and uses the human participation action. The current UI labels it **Approve** and records `PARTICIPATING` against a registered external source, such as `SRC-P-042-external` / `EXT-P-042`.

This records externally confirmed participation; screening and AI never enroll a patient. Sponsor's Participation tab shows aggregate cohort, participating and ended counts without patient identities.

## 5. Introduce a new event

As Clinical Lead, open Safety and simulate the day-18 restricted medication administration. The reference scenario uses **2026-11-19 09:30 Europe/Athens** as effective time and **2026-11-20 11:00** as recorded time.

The backend persists the event, identifies relevant approved monitoring rules, reevaluates them and creates or updates a case before optional AI enrichment. The original screening result remains unchanged. A finding requests clinical review; it is not a diagnosis or a drug-interaction prediction.

Replay the same event/idempotency key: it must not multiply logical events or cases. An unrelated `SYN-MED-N1` event must not produce a fabricated high-priority finding.

## 6. Review the case

Open the case, examine source evidence and prior/current findings, assign it to the Clinical Lead and record a review action with rationale and cited evidence. Inspect the attributed audit history.

When enabled, AI may retrieve scoped evidence, draft a cited summary or request verification. It cannot determine the clinical disposition. Missing evidence, provider failures and pending enrichment remain visible; they do not suppress deterministic monitoring findings.

## Persistence and scope

Refreshing the browser and restarting the API preserve durable data. The supported source, rules and synthetic cohort are specified in [PROTOCOL_BLUEPRINT](PROTOCOL_BLUEPRINT.md). [Verification](verification/README.md) separates retained historical runs from current automated checks and explains how to reproduce scenarios safely.
