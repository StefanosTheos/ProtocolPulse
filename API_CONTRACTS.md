# ProtocolPulse — REST API Contracts

**Freeze candidate** `PP-S2-CF-20261114-01` / **API** `v1` / **schema** `1.0.0-rc1` (signoff pending). **All paths below are authoritative**: the requested 19 paths plus explicitly enumerated operational paths for PDF registration, job polling, participation, investigator screening disposition, source evidence and optional investigations. No hidden Next.js API or unversioned endpoints. These are implementable, OpenAPI 3.1-compatible contracts intended to generate Pydantic-v2 schemas and TypeScript client types; examples are synthetic.

## 1. Wire rules and global OpenAPI semantics

- Base `http://127.0.0.1:8000`, prefix `/api/v1`. Every JSON response has header `X-Request-ID` and top-level `request_id: string` (UUID); inner `data` is object or list page. No opaque success envelope. `Content-Type: application/json` except PDF upload (`multipart/form-data`). JSON `additionalProperties:false` for request DTOs; output extension fields require contract revision.
- `X-Demo-Actor-Id` required on all endpoints except `GET /health`; it identifies one of server-registered **fictional** actors and maps to a server-stored role/site. This is **mock role simulation, not authentication/security**. `401` missing/unknown actor; `403` known actor forbidden. No API keys embedded in browser. `X-Request-ID` optional request header, validated and echoed.
- Every mutating `POST` requires `Idempotency-Key: string` (1–128 UTF-8 chars; stable per intended logical operation); response replay returns original logical result, never a second side effect; same key/different canonical request hash => `409 IDEMPOTENCY_CONFLICT`. `PUT` and `PATCH` require `If-Match: "<revision>"`; same revision mismatch => `409 REVISION_CONFLICT`. `PATCH` additionally takes `expected_revision` matching header.
- All fields named `*_at` are RFC-3339 ISO-8601 **offset-aware** date-time, normalized to UTC in storage, serialized UTC `Z` in API responses. `*_date` are ISO local calendar dates `YYYY-MM-DD`, interpreted with trial's `site_timezone` (`IANA`, `Europe/Athens` in PX-104). Never assume timestamps and dates are interchangeable. `effective_at` is clinical time, `recorded_at` is source documentation time, `ingested_at` is ingestion; `decided_at` is reviewer/system decision. Date-imprecise facts have `date_precision`, `possible_interval` and no fabricated point time.
- IDs are stable opaque strings (e.g. `TR-PX104`, `PV-PX104-1.0`, `P-042`, `RUN-...`, `EVT-...`, `CASE-...`). Client never parses IDs for meaning. UUID strings are used for `request_id`/correlation. JSON numbers finite only. All numeric observations require `unit`; supported units and medication terminology are approved/versioned, not inferred.
- Pagination on all collection GET endpoints: `limit` integer 1–100 default 25, `cursor` opaque string optional; `data.items` array, `data.page.next_cursor:string|null`, `data.page.limit:number`, `data.page.total_count:number|null`. Sort is allowlisted per endpoint; stable tie-breaker ID ascending. Invalid filter => `422`. Filter params require exact spelling shown in section 4.
- **Job** statuses: `QUEUED|RUNNING|SUCCEEDED|FAILED`; source domain `ScreeningRun.status` remains `QUEUED|RUNNING|COMPLETE|FAILED`. A `202` means durable work **accepted**, never screening completed. Poll `GET /jobs/{job_id}`. `AgentExecution.status` additionally supports `UNAVAILABLE|PARTIAL` and is independent of jobs.
- `CandidateStatus` = `POTENTIAL_MATCH|NEEDS_REVIEW|PROTOCOL_CONFLICT` (**nullable** on engine `EVALUATION_ERROR`); criterion status `PASS|FAIL|UNKNOWN`. Never treat lack of an event/contraindication as proven absence. Original screening assessments are immutable after later events.

## 2. Canonical TypeScript API DTOs (normative field presence)

For `data: T`, a field declared `?` is optional/omittable; `T | null` is **required but nullable**. Lists are required even when empty. Same field names and constraints must appear in backend Pydantic models (`extra='forbid'`, strict enum validation, `AwareDatetime` for `*_at`, `date` for `*_date`, positive units/IDs, `Field` limits). Avoid generating new, unnamed client models.

```typescript
export type ID = string;
export type IsoInstant = string; // RFC3339 offset-aware on input; UTC 'Z' on output
export type IsoDate = string;    // YYYY-MM-DD in trial.site_timezone
export type ActorRole = 'SPONSOR_OPS'|'INVESTIGATOR'|'COORDINATOR'|'MONITOR'|'AUDITOR'|'RESEARCH_IT';
export type CriterionStatus = 'PASS'|'FAIL'|'UNKNOWN';
export type CandidateStatus = 'POTENTIAL_MATCH'|'NEEDS_REVIEW'|'PROTOCOL_CONFLICT';
export type EvaluationState = 'COMPLETE'|'EVALUATION_ERROR';
export type UnknownReason = 'MISSING_LAB'|'OUTDATED_LAB'|'DATE_AMBIGUOUS'|'ORDER_ONLY'|
 'CONFLICTING_SOURCES'|'UNMAPPED_CODE'|'UNAPPROVED_RULE'|'INCOMPLETE_EXTRACTION'|
 'INSUFFICIENT_ABSENCE_EVIDENCE'|'UNIT_UNSUPPORTED'|'SOURCE_UNAVAILABLE';
export type EvidenceState = 'NOT_RECORDED'|'EXPLICITLY_NEGATIVE'|'NOT_ASSESSED'|'NOT_APPLICABLE'|'UNCERTAIN'|'POSITIVE';
export type EvidenceQuality = 'HIGH'|'MODERATE'|'LOW'|'UNVERIFIED';
export type DatePrecision = 'INSTANT'|'DAY'|'MONTH'|'YEAR'|'UNKNOWN';
export type MedicationEvidenceType = 'ORDER'|'DISPENSE'|'ADMINISTRATION'|'REPORTED_USE'|'DISCONTINUATION'|'CANCELLATION';
export type ProtocolState = 'DRAFT'|'EXTRACTING'|'EXTRACTION_REVIEW'|'EXTRACTION_FAILED'|'APPROVED'|'ACTIVE'|'SUPERSEDED';
export type CriterionWorkflow = 'PROPOSED'|'NEEDS_CLARIFICATION'|'APPROVED'|'REJECTED';
export type CriterionType = 'INCLUSION'|'EXCLUSION'|'MONITORING';
export type JobStatus = 'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED';
export type ScreeningRunStatus = 'QUEUED'|'RUNNING'|'COMPLETE'|'FAILED';
export type ParticipationStatus = 'NOT_ENROLLED'|'PARTICIPATING'|'ENDED';
export type CandidateWorkflow = 'NOT_REVIEWED'|'REVIEW_PENDING'|'INVESTIGATOR_DISPOSITIONED';
export type FindingCategory = 'CONFIRMED_PROTOCOL_CONFLICT'|'POTENTIAL_SAFETY_REVIEW'|
 'DATA_QUALITY_DISCREPANCY'|'POSSIBLE_PROTOCOL_DEVIATION'; // NO_ACTION is evaluation trace, never persisted as a finding
export type RelevanceResult = 'RELEVANT'|'NO_ACTION';
export type FindingPriority = 'HIGH'|'MEDIUM'|'LOW';
export type CaseStatus = 'OPEN'|'ACKNOWLEDGED'|'INVESTIGATING'|'RESOLVED'|'CLOSED'|'REOPENED';
export type AgentRole = 'PROTOCOL_INTELLIGENCE'|'EVIDENCE_INVESTIGATOR'|'MEDICATION_SAFETY_INVESTIGATOR'|'MONITORING_WORKFLOW';
export type AgentStatus = 'QUEUED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'UNAVAILABLE'|'PARTIAL';
export type WindowOperator = 'AGE_RANGE_INCLUSIVE'|'CODE_CONFIRMED'|'LAB_GTE'|
 'ABSENCE_CONFIRMED_ACTIVE'|'NO_RESTRICTED_USE'|'EVENT_RESTRICTED_USE'|'EVENT_ORDER_ONLY'|'EVENT_LAB_LT';
export type ObservationKind = 'LAB'|'FUNCTIONAL'|'PULMONARY'|'ECG'|'IMAGING'|'VITAL';
export type EventKind = 'MEDICATION'|'LAB'|'CONDITION'|'NOTE'|'OBSERVATION';
export type Detail = {field:string; reason:string};
export interface ErrorEnvelope {
  error: {code:string; message:string; details:Detail[]; retryable:boolean}; request_id:string;
}
export interface Envelope<T> {data:T; request_id:string}
export interface Page<T> {items:T[]; page:{next_cursor:string|null; limit:number; total_count:number|null}}
export interface EvidenceRef {
  evidence_id:ID; source_id:ID; source_version:number; evidence_type:string;
  effective_at:IsoInstant|null; recorded_at:IsoInstant|null;
  page:number|null; span_start:number|null; span_end:number|null;
}
export interface TimeUncertainty {raw_date:string; precision:DatePrecision;
 possible_interval:{earliest:IsoInstant; latest_exclusive:IsoInstant}|null}
export interface ProvenancedFact<T> {
  fact_id:ID; value:T|null; unit:string|null; effective_at:IsoInstant|null;
  onset_date:IsoDate|null; recorded_at:IsoInstant; ingested_at:IsoInstant;
  source:EvidenceRef; evidence_quality:EvidenceQuality; evidence_state:EvidenceState;
  time_uncertainty:TimeUncertainty|null; verification_status:'VERIFIED'|'UNVERIFIED'|'CONFLICTED';
}
export interface Trial {
 trial_id:ID; title:string; fictional_product_code:string; site_id:ID; site_timezone:string;
 planned_start_date:IsoDate; planned_end_date:IsoDate; synthetic_only:true;
 active_protocol_version_id:ID|null; created_at:IsoInstant; revision:number;
}
export interface TrialCreate {title:string; fictional_product_code:string; site_id:ID;
 site_timezone:string; planned_start_date:IsoDate; planned_end_date:IsoDate; synthetic_only:true}
export interface TrialDetail extends Trial {protocol_version_ids:ID[]; patient_count:number;
 finding_count:number; trial_notice:string}
export interface SourceRef {source_id:ID; source_version:number; sha256:string;
 filename:string; mime_type:string; created_at:IsoInstant; synthetic_only:true}
export interface WindowSpec {anchor:'SCREENING_DATE'|'EVENT_EFFECTIVE_AT'|'PARTICIPATION';
 start_offset_days:number|null; end_offset_days:number|null;
 start_inclusive:boolean; end_inclusive:boolean; time_zone:string;
 anchor_granularity:'LOCAL_DATE'|'INSTANT'}
export interface Criterion {
 criterion_id:ID; protocol_version_id:ID; revision:number; type:CriterionType;
 clinical_subject:string; operator:WindowOperator;
 threshold:number|string|[number,number]|null; unit:string|null; window:WindowSpec|null;
 evidence_requirement:string; missing_data_policy:'UNKNOWN_UNLESS_RECONCILED';
 source_quote:string; source_id:ID; source_page:number; source_anchor:{start:number;end:number};
 applicable_site_ids:ID[]; terminology_map_version:string; logical_group_id:ID;
 workflow_status:CriterionWorkflow; ambiguity:string|null;
 approved_by:ID|null; approved_at:IsoInstant|null;
}
export interface CoverageItem {section_id:string; source_id:ID; page:number;
 span_start:number; span_end:number; status:'MAPPED'|'INFORMATIONAL'|'BLOCKING';
 criterion_ids:ID[]; review_note:string|null}
export interface ProtocolDetail {protocol_version_id:ID; trial_id:ID; label:string;
 state:ProtocolState; revision:number; source:SourceRef; file_sha256:string;
 criteria:Criterion[]; coverage:CoverageItem[]; coverage_signed_by:ID|null;
 coverage_signed_at:IsoInstant|null; approved_set_hash:string|null;
 approved_at:IsoInstant|null; extraction_job_id:ID|null; blocking_count:number;
}
export interface CriterionDraftInput {
 criterion_id:ID; protocol_version_id:ID; type:CriterionType;
 clinical_subject:string; operator:WindowOperator;
 threshold:number|string|[number,number]|null; unit:string|null; window:WindowSpec|null;
 evidence_requirement:string; missing_data_policy:'UNKNOWN_UNLESS_RECONCILED';
 source_quote:string; source_id:ID; source_page:number;
 source_anchor:{start:number;end:number}; applicable_site_ids:ID[];
 terminology_map_version:string; logical_group_id:ID;
 workflow_status:'PROPOSED'|'NEEDS_CLARIFICATION'; ambiguity:string|null;
}
export interface CriteriaReplaceRequest {criteria:CriterionDraftInput[]; coverage:CoverageItem[];
 change_reason:string}
export interface ApprovalRequest {criterion_ids:ID[]; coverage_attestation:true;
 activate:true; decision_reason:string}
export interface ApprovalReceipt {protocol_version_id:ID; approved_set_hash:string;
 signed_criterion_ids:ID[]; approved_by:ID; approved_at:IsoInstant;
 state:'ACTIVE'; superseded_version_id:ID|null}
export interface JobReceipt {job_id:ID; kind:'PROTOCOL_EXTRACT'|'SCREEN_COHORT'|'INGEST_EVENT'|'AGENT_INVESTIGATION';
 status:JobStatus; resource_id:ID|null; correlation_id:ID; poll_url:string;
 created_at:IsoInstant;}
export interface JobDetail extends JobReceipt {attempts:number; max_attempts:number;
 started_at:IsoInstant|null; finished_at:IsoInstant|null; progress_percent:number|null;
 result:Record<string,unknown>|null;
 error:{code:string;message:string;retryable:boolean}|null;}
export interface ScreeningCreate {protocol_version_id:ID; screening_date:IsoDate;
 evidence_cutoff_at:IsoInstant; patient_ids:ID[]|null; purpose:'BASELINE'}
export interface ScreeningRun {run_id:ID; trial_id:ID; protocol_version_id:ID;
 approved_set_hash:string; screening_date:IsoDate; evidence_cutoff_at:IsoInstant;
 evidence_snapshot_id:ID; engine_version:string; terminology_map_version:string;
 status:ScreeningRunStatus; job_id:ID; patient_count:number;
 counts:{POTENTIAL_MATCH:number; NEEDS_REVIEW:number; PROTOCOL_CONFLICT:number;
   EVALUATION_ERROR:number}; created_at:IsoInstant; completed_at:IsoInstant|null;
 stale:boolean; error_code:string|null}
export interface CriterionResult {
 criterion_result_id:ID; criterion_id:ID; protocol_version_id:ID;
 status:CriterionStatus; reason_codes:UnknownReason[];
 evidence_refs:EvidenceRef[]; considered_interval:{start:IsoInstant;end:IsoInstant} | null;
 explanation:string; evaluated_at:IsoInstant;
}
export interface PatientAssessment {
 assessment_id:ID; run_id:ID|null; trial_id:ID; patient_id:ID;
 protocol_version_id:ID; approved_set_hash:string; evidence_snapshot_id:ID;
 assessment_type:'SCREENING'|'MONITORING'; screening_date:IsoDate|null;
 evaluation_at:IsoInstant; evaluation_state:EvaluationState;
 candidate_status:CandidateStatus|null; criteria:CriterionResult[];
 before_assessment_id:ID|null; caused_by_event_id:ID|null;
 related_finding_ids:ID[]; evidence_completeness_percent:number|null;
 participation_status:ParticipationStatus; stale:boolean;
}
export interface MedicationEvidence {
 exposure_id:ID; medication_code:string; mapped_class:string|null;
 evidence_type:MedicationEvidenceType; asserted_start_at:IsoInstant|null;
 asserted_end_exclusive_at:IsoInstant|null; dose:ProvenancedFact<number>|null;
 route:ProvenancedFact<string>|null; last_changed_at:IsoInstant|null;
 stop_reason:string|null; adverse_reactions:string[];
 evidence:ProvenancedFact<string>; source:EvidenceRef;
}
export interface ClinicalNarrative {note_id:ID; recorded_at:IsoInstant; source:EvidenceRef;
 text:string; extraction_status:'NOT_ASSESSED'|'REVIEWED'|'CONFLICTED'}
export interface OpenItem {open_item_id:ID; reason_code:string; description:string;
 blocking:boolean; status:'OPEN'|'RESOLVED'; conflicting_evidence_ids:ID[];
 requested_for_role:ActorRole|null}
export interface PriorResearch {research_id:ID; kind:'OBSERVATIONAL'|'INTERVENTIONAL';
 exposure:ProvenancedFact<string>|null; last_dose_at:IsoInstant|null;
 half_life_hours:ProvenancedFact<number>|null; completion_status:EvidenceState;
 ongoing_restrictions:ProvenancedFact<string>[]; source:EvidenceRef}
export interface Patient360 {
 patient_id:ID; trial_id:ID; synthetic_only:true; site_id:ID;
 screening_snapshot_date:IsoDate;
 demographics:{birth_date:ProvenancedFact<IsoDate>; sex_at_birth:ProvenancedFact<string>;
  location_jurisdiction:ProvenancedFact<string>};
 index_disease:{code:string; diagnosis_criteria:ProvenancedFact<string>[];
  severity:ProvenancedFact<string>; first_onset:ProvenancedFact<IsoDate>;
  diagnostic_evidence:EvidenceRef[]};
 medical_conditions:ProvenancedFact<string>[];
 surgeries_hospitalizations:ProvenancedFact<string>[];
 family_history:ProvenancedFact<string>[];
 genetics:ProvenancedFact<string>[];
 symptom_history:ProvenancedFact<string>[];
 observations:{kind:ObservationKind; analyte_code:string|null;
  observation:ProvenancedFact<number|string>; interpretation:ProvenancedFact<string>|null}[];
 medications:MedicationEvidence[];
 study_product_exposure:{blinded:true; assignment_masked:ProvenancedFact<string>|null;
  exposures:MedicationEvidence[]};
 prior_clinical_research:PriorResearch[];
 procedures_and_imaging:ProvenancedFact<string>[];
 allergies:ProvenancedFact<string>[];
 pregnancy_contraception:ProvenancedFact<string>[];
 decision_capacity:ProvenancedFact<string>;
 study_partner:ProvenancedFact<string>;
 administration_ability:ProvenancedFact<string>;
 encounters:{encounter_id:ID;occurred_at:IsoInstant;source_ids:ID[];summary:string}[];
 source_document_index:SourceRef[]; clinical_narratives:ClinicalNarrative[];
 open_items:OpenItem[]; participation_status:ParticipationStatus;
 current_assessment_id:ID|null; data_watermark:IsoInstant;}
export interface EventCreate {
 trial_id:ID; event_kind:EventKind; source_event_id:string; source_version:number;
 source_id:ID; source_document_version:number; effective_at:IsoInstant|null;
 recorded_at:IsoInstant; time_uncertainty:TimeUncertainty|null;
 evidence_state:EvidenceState; evidence_quality:EvidenceQuality;
 medication:{code:string; evidence_type:MedicationEvidenceType;
   dose_value:number|null; dose_unit:string|null; route:string|null;
   interval_end_exclusive_at:IsoInstant|null}|null;
 lab:{analyte_code:string; value:number; unit:string}|null;
 condition:{code:string;clinical_status:'ACTIVE'|'RESOLVED'|'SUSPECTED'}|null;
 note:{text:string;span_start:number|null;span_end:number|null}|null;
 observation:{kind:ObservationKind;value:number|string;unit:string|null}|null;
 supersedes_event_id:ID|null;
}
export interface EventReceipt {event_id:ID; patient_id:ID; trial_id:ID;
 ingested_at:IsoInstant; deduplicated:boolean; job:JobReceipt;
}
export interface MonitoringFinding {finding_id:ID; trial_id:ID; patient_id:ID;
 protocol_version_id:ID; criterion_id:ID; triggering_event_id:ID;
 before_assessment_id:ID|null; after_assessment_id:ID;
 category:FindingCategory; priority:FindingPriority;
 case_id:ID; evidence_refs:EvidenceRef[]; issue_key:string;
 created_at:IsoInstant;}
export interface ReviewDecision {decision_id:ID; actor_id:ID; actor_role:ActorRole;
 from_status:CaseStatus|null; to_status:CaseStatus|null;
 disposition:string; rationale:string; cited_evidence_ids:ID[]; decided_at:IsoInstant;}
export interface ReviewCase {case_id:ID; trial_id:ID; patient_id:ID;
 protocol_version_id:ID; criterion_id:ID; issue_key:string;
 status:CaseStatus; priority:FindingPriority; assigned_actor_id:ID|null;
 finding_ids:ID[]; current_summary:string|null; summary_origin:'SYSTEM_DETERMINISTIC'|'AI_DRAFT'|null;
 agent_execution_id:ID|null; revision:number; opened_at:IsoInstant;
 updated_at:IsoInstant; decisions:ReviewDecision[];}
export interface CasePatch {expected_revision:number; next_status:CaseStatus;
 assigned_actor_id:ID|null; disposition:string;
 rationale:string; cited_evidence_ids:ID[];}
export interface AgentInvestigationCreate {role:AgentRole; trial_id:ID;
 protocol_version_id:ID; patient_id:ID|null;
 criterion_ids:ID[]; event_id:ID|null; objective:string}
export interface AgentExecution {execution_id:ID; role:AgentRole; status:AgentStatus;
 trial_id:ID; patient_id:ID|null; protocol_version_id:ID;
 criterion_ids:ID[]; event_id:ID|null; correlation_id:ID;
 evidence_refs:EvidenceRef[]; summary:string|null;
 unknown_reasons:string[]; verification_questions:string[];
 trace:{tool_name:string;input_reference_ids:ID[];output_reference_ids:ID[];
 result_code:string;elapsed_ms:number;error_code:string|null}[];
 error_code:string|null; model_id:string|null; created_at:IsoInstant;
 finished_at:IsoInstant|null;}
export interface AuditEntry {audit_id:ID; trial_id:ID; actor_id:ID; actor_role:ActorRole;
 action:string; target_type:string; target_id:ID; target_version:string|null;
 correlation_id:ID; request_id:ID; input_hash:string|null; output_ref_ids:ID[];
 result_code:string; occurred_at:IsoInstant;}
export interface EvidenceSourceDetail extends SourceRef {kind:'PDF'|'NOTE'|'LAB'|'MEDICATION'|'ENCOUNTER'|'OTHER';
 page_count:number|null; spans:{page:number|null;start:number;end:number;text:string}[];
}
export interface ScreeningDispositionCreate {assessment_id:ID;
 disposition:'INVITE_FOR_FORMAL_SCREENING'|'NOT_SUITABLE'|'SEEK_MORE_INFORMATION';
 rationale:string; cited_evidence_ids:ID[];}
export interface ScreeningDisposition {disposition_id:ID; patient_id:ID; trial_id:ID;
 assessment_id:ID; disposition:ScreeningDispositionCreate['disposition'];
 rationale:string; cited_evidence_ids:ID[]; actor_id:ID; decided_at:IsoInstant;
 workflow_status:'INVESTIGATOR_DISPOSITIONED';}
export interface ParticipationCreate {next_status:'PARTICIPATING'|'ENDED';
 external_record_source_id:ID; external_record_reference:string; rationale:string;}
export interface ParticipationRecord {participation_id:ID; trial_id:ID; patient_id:ID;
 from_status:ParticipationStatus; to_status:ParticipationStatus;
 source_id:ID; external_record_reference:string; actor_id:ID; decided_at:IsoInstant;}
export interface Health {status:'ok'|'degraded'; database:'ok'|'unavailable';
 migrations:'current'|'pending'|'unknown'; worker:'running'|'stopped';
 llm:'enabled'|'disabled'|'unavailable'; synthetic_only:true;
 api_version:'v1'; contract_version:'1.0.0-rc1';}
```

**Nested data persistence**: patient DTO's 12 required sections are assembled from typed tables + versioned generic `PatientFact` and `ClinicalNote`. A field that is unknown is **present** with `evidence_state`, null value and source link where one exists; `NOT_RECORDED` may have no clinical source but retains a system provenance entry documenting the gap. Never substitute `[]` as explicit negative evidence: empty section means no entries were returned, not clinically absent. `StudyProductExposure` is separate and blinded; exposure is not guessed from an allocation code.

## 3. Endpoint operations and exact request/response DTO mapping

Table format: `ROLE` gives allowed simulated roles; `REQ` defines path/query/header/body, `SUCCESS` names the `Envelope<...>` body; errors are from §5. All mutating endpoints include the headers from §1. `GET` filters are **not** silently ignored. Query omitted means default.

| Method and absolute path | Operation ID / role | Request (beyond global headers) | Success / durable side effect |
|---|---|---|---|
| `GET /api/v1/health` | `getHealth` / public | none | `200 Envelope<Health>`; degraded readiness may be `503` |
| `GET /api/v1/trials` | `listTrials` / all known actors | `limit,cursor,sort=created_at|-created_at|title` | `200 Envelope<Page<Trial>>` |
| `POST /api/v1/trials` | `createTrial` / `COORDINATOR,RESEARCH_IT` | `TrialCreate` JSON | `201 Envelope<Trial>`; inserts trial and audit |
| `GET /api/v1/trials/{trial_id}` | `getTrial` / site-scoped roles | `trial_id` path | `200 Envelope<TrialDetail>` |
| `GET /api/v1/trials/{trial_id}/protocols` | `listProtocols` / site-scoped roles | `limit,cursor,sort=label|-created_at` | `200 Envelope<Page<ProtocolDetail>>` |
| `POST /api/v1/trials/{trial_id}/protocols` | `uploadProtocol` / `COORDINATOR,RESEARCH_IT` | multipart `file` required PDF bytes, `version_label` string required, `source_declared_synthetic=true` | `201 Envelope<ProtocolDetail>`; original PDF and version persisted (no extraction yet) |
| `GET /api/v1/trials/{trial_id}/protocols/{version_id}` | `getProtocol` / site-scoped roles | path `trial_id,version_id` | `200 Envelope<ProtocolDetail>` |
| `POST /api/v1/trials/{trial_id}/protocols/{version_id}/extract` | `extractProtocol` / `COORDINATOR,INVESTIGATOR` | body `{force_reinspect:boolean}` | `202 Envelope<JobReceipt>`; durable `PROTOCOL_EXTRACT` job; returns `409` if currently extracting with different key |
| `PUT /api/v1/trials/{trial_id}/protocols/{version_id}/criteria` | `replaceProposedCriteria` / `INVESTIGATOR` (or delegated qualified synthetic reviewer) | `CriteriaReplaceRequest`, `If-Match` protocol revision | `200 Envelope<ProtocolDetail>`; pending rules only, revision increments; cannot edit approved rules |
| `POST /api/v1/trials/{trial_id}/protocols/{version_id}/approve` | `approveProtocol` / **`INVESTIGATOR` only** | `ApprovalRequest`; exact criterion ID set, signed coverage, valid anchors and zero blockers | `200 Envelope<ApprovalReceipt>`; approved set signed + first-version activation atomically; no artificial reviewer identity |
| `POST /api/v1/trials/{trial_id}/screenings` | `createScreening` / `COORDINATOR,INVESTIGATOR` | `ScreeningCreate`; `patient_ids:null` means all 15, ID list must be subset | `202 Envelope<JobReceipt>` `SCREEN_COHORT`; requires active approved version; creates `ScreeningRun` and job |
| `GET /api/v1/screenings/{run_id}` | `getScreeningRun` / site-scoped roles | run ID | `200 Envelope<ScreeningRun>`; `202` polling ONLY job endpoint, not GET run |
| `GET /api/v1/screenings/{run_id}/assessments` | `listAssessments` / site-scoped roles | `limit,cursor,status=CandidateStatus,reason=UnknownReason,sort=patient_id|-evidence_completeness_percent` | `200 Envelope<Page<PatientAssessment>>`; includes all criterion-level evidence refs |
| `GET /api/v1/trials/{trial_id}/patients/{patient_id}` | `getPatient360` / `COORDINATOR,INVESTIGATOR,MONITOR,AUDITOR` scoped | path IDs, optional `as_of` RFC3339 UTC for evidence watermark | `200 Envelope<Patient360>`; clinical narratives cannot override structured data |
| `POST /api/v1/patients/{patient_id}/events` | `createPatientEvent` / `COORDINATOR,RESEARCH_IT` | `EventCreate` JSON with trial ID; clinical `effective_at != recorded_at` allowed | `202 Envelope<EventReceipt>` creates immutable event + `INGEST_EVENT` job; **same event/version/body replay `200`**, same key different body `409` |
| `GET /api/v1/trials/{trial_id}/findings` | `listFindings` / `MONITOR,INVESTIGATOR,COORDINATOR,AUDITOR` | `limit,cursor,category=FindingCategory,patient_id,priority=HIGH|MEDIUM|LOW,from_at,to_at,sort=-created_at|created_at` | `200 Envelope<Page<MonitoringFinding>>` |
| `GET /api/v1/trials/{trial_id}/cases` | `listCases` / `MONITOR,INVESTIGATOR,COORDINATOR,AUDITOR` | `limit,cursor,status=CaseStatus,category=FindingCategory,assigned_actor_id,patient_id,sort=-updated_at|updated_at` | `200 Envelope<Page<ReviewCase>>` (decisions may be empty in list) |
| `GET /api/v1/cases/{case_id}` | `getCase` / site-scoped review roles | case ID | `200 Envelope<ReviewCase>`; all review decisions included |
| `PATCH /api/v1/cases/{case_id}` | `transitionCase` / `MONITOR,INVESTIGATOR` | `CasePatch`, required `If-Match` revision | `200 Envelope<ReviewCase>`; validates allowed transition+role; appends `ReviewDecision` with actual simulated actor and timestamp; `RESOLVED/CLOSED` investigator-only |
| `GET /api/v1/agent-executions/{execution_id}` | `getAgentExecution` / site-scoped roles | execution ID | `200 Envelope<AgentExecution>`; `UNAVAILABLE` is explicit, not fake trace |
| `GET /api/v1/trials/{trial_id}/audit` | `listAudit` / `AUDITOR,INVESTIGATOR,MONITOR,SPONSOR_OPS` (aggregate-only sponsor) | `limit,cursor,action,actor_id,from_at,to_at,sort=-occurred_at|occurred_at` | `200 Envelope<Page<AuditEntry>>`; append-only references |
| `GET /api/v1/jobs/{job_id}` | `getJob` / initiating actor or investigator/monitor at trial | job ID | `200 Envelope<JobDetail>`; durable polling endpoint |
| `GET /api/v1/trials/{trial_id}/evidence/{source_id}` | `getEvidenceSource` / scoped clinical roles | `source_id`, optional `version` int and `span_start,span_end` ints (together) | `200 Envelope<EvidenceSourceDetail>`; no public PDF exposure; verify byte offsets and scope |
| `POST /api/v1/trials/{trial_id}/patients/{patient_id}/dispositions` | `recordScreeningDisposition` / **`INVESTIGATOR`** | `ScreeningDispositionCreate` with completed assessment | `201 Envelope<ScreeningDisposition>`; external-screening recommendation only; no enrollment |
| `POST /api/v1/trials/{trial_id}/patients/{patient_id}/participation` | `recordParticipation` / **`INVESTIGATOR`** | `ParticipationCreate`, references already registered synthetic external participation evidence | `201 Envelope<ParticipationRecord>`; human-entered external state only; transition `NOT_ENROLLED→PARTICIPATING→ENDED` |
| `POST /api/v1/agent-investigations` | `createAgentInvestigation` / `COORDINATOR,MONITOR,INVESTIGATOR` | `AgentInvestigationCreate`, references trial's active version or unapproved extraction context | `202 Envelope<JobReceipt>`; queues `AGENT_INVESTIGATION` when LLM enabled; **`503 AGENT_UNAVAILABLE` with no fabricated job** if disabled |

**Required input validation details:** `TrialCreate.site_timezone` must be a valid IANA timezone, all declared `synthetic_only` booleans literally true, `ScreeningCreate.screening_date` in trial calendar, `evidence_cutoff_at` after local screening date start, `CriteriaReplaceRequest.criteria[].protocol_version_id` must match path, `ApprovalRequest.criterion_ids` must cover all executable approved candidates exactly, `EventCreate` requires exactly one nonnull payload section corresponding to `event_kind`; either exact offset-aware `effective_at` **or** `time_uncertainty` with a validated possible interval, never a fabricated instant for partial dates; `MedicationEvidenceType` never implies administration from an `ORDER` or `DISPENSE`; `StudyProductExposure` cannot accept unblinded fields via event endpoint. An **unmapped but syntactically valid** medication code is accepted as evidence and evaluated `UNKNOWN/UNMAPPED_CODE`; it is not rejected as a schema error or silently classified safe. Patient IDs in path and body must not conflict. `PATCH` cannot put an unsupported status or omit rationale; reviewer-only transitions enforced server-side. Immutable protocol source cannot be changed by PUT; upload creates a new version.

## 4. Concrete request/response examples (timestamps, causality, errors)

### Create/approve workflow

```http
POST /api/v1/trials/TR-PX104/protocols/PV-PX104-1.0/approve
X-Demo-Actor-Id: ACT-INV-01
Idempotency-Key: approve-px104-v1
Content-Type: application/json

{"criterion_ids":["PX-INC-01","PX-INC-02","PX-INC-03","PX-EXC-01","PX-EXC-02","PX-MON-01","PX-MON-02","PX-MON-03"],"coverage_attestation":true,"activate":true,"decision_reason":"Reviewed mock PDF clause anchors and fictional rule semantics"}
```

```json
{"data":{"protocol_version_id":"PV-PX104-1.0","approved_set_hash":"sha256:8b27...demo","signed_criterion_ids":["PX-INC-01","PX-INC-02","PX-INC-03","PX-EXC-01","PX-EXC-02","PX-MON-01","PX-MON-02","PX-MON-03"],"approved_by":"ACT-INV-01","approved_at":"2026-10-31T12:00:00Z","state":"ACTIVE","superseded_version_id":null},"request_id":"d98ea1bc-9611-4c2a-8bb3-d45e8ae87136"}
```

### Start cohort screen; use durable job polling

```http
POST /api/v1/trials/TR-PX104/screenings
X-Demo-Actor-Id: ACT-COORD-01
Idempotency-Key: px104-baseline-oct31
Content-Type: application/json

{"protocol_version_id":"PV-PX104-1.0","screening_date":"2026-10-31","evidence_cutoff_at":"2026-10-31T22:00:00Z","patient_ids":null,"purpose":"BASELINE"}
```

```json
{"data":{"job_id":"JOB-SCREEN-01","kind":"SCREEN_COHORT","status":"QUEUED","resource_id":"RUN-BASELINE-01","correlation_id":"CORR-BASELINE-01","poll_url":"/api/v1/jobs/JOB-SCREEN-01","created_at":"2026-10-31T22:01:00Z"},"request_id":"d98ea1bc-9611-4c2a-8bb3-d45e8ae87136"}
```

`evidence_cutoff_at` is `2026-11-01T00:00:00+02:00` expressed in UTC. Test and UI label this **end-of-screening-day evidence watermark**, not medication-window end. Completion of `SCREEN_COHORT` gives a `ScreeningRun` with `patient_count=15`; computed four status counts sum to 15, never hardcoded from the old 250-person illustration.

### Day-18 medication administration, separately dated documentation

```http
POST /api/v1/patients/P-042/events
X-Demo-Actor-Id: ACT-COORD-01
Idempotency-Key: mock-source-day18-v1
Content-Type: application/json

{"trial_id":"TR-PX104","event_kind":"MEDICATION","source_event_id":"SRC-EVT-D18-P042","source_version":1,"source_id":"SRC-MED-D18-P042","source_document_version":1,"effective_at":"2026-11-19T09:30:00+02:00","recorded_at":"2026-11-20T11:00:00+02:00","time_uncertainty":null,"evidence_state":"POSITIVE","evidence_quality":"HIGH","medication":{"code":"SYN-MED-R1","evidence_type":"ADMINISTRATION","dose_value":1,"dose_unit":"synthetic-unit","route":"ORAL","interval_end_exclusive_at":null},"lab":null,"condition":null,"note":null,"observation":null,"supersedes_event_id":null}
```

```json
{"data":{"event_id":"EVT-P042-D18-01","patient_id":"P-042","trial_id":"TR-PX104","ingested_at":"2026-11-20T09:00:01Z","deduplicated":false,"job":{"job_id":"JOB-EVT-D18","kind":"INGEST_EVENT","status":"QUEUED","resource_id":"EVT-P042-D18-01","correlation_id":"CORR-P042-D18","poll_url":"/api/v1/jobs/JOB-EVT-D18","created_at":"2026-11-20T09:00:01Z"}},"request_id":"b6b484c6-2ca2-41f1-bc8f-f43c6e9a1e3c"}
```

When the job succeeds: `P-042` historical `SCREENING` assessment remains `POTENTIAL_MATCH` at Oct 31; a **new** `MONITORING` assessment with `caused_by_event_id="EVT-P042-D18-01"`, `before_assessment_id` and criterion `PX-MON-01` links an `OPEN` case with `CONFIRMED_PROTOCOL_CONFLICT`. An `ORDER` event with same class must instead trigger `PX-MON-02` and `POTENTIAL_SAFETY_REVIEW` (not confirmed ingestion). Reposting the identical `source_event_id`, version and canonical payload returns `200` with the same `event_id`, `job_id` and `deduplicated:true`; `recorded_at` is an immutable source assertion and may be later than clinical time.

### Update a human-owned case

```http
PATCH /api/v1/cases/CASE-P042-R
X-Demo-Actor-Id: ACT-INV-01
If-Match: "1"
Content-Type: application/json

{"expected_revision":1,"next_status":"ACKNOWLEDGED","assigned_actor_id":"ACT-INV-01","disposition":"REVIEW_REQUIRED","rationale":"Source administration requires investigator review under fictional PX-MON-01","cited_evidence_ids":["EV-MED-P042-D18"]}
```

Result `200 Envelope<ReviewCase>` with incremented `revision=2` and appended `ReviewDecision`. **Do not** automatically mark withdrawal or drug cessation.

### Stable error

```http
HTTP/1.1 409 Conflict
X-Request-ID: d98ea1bc-9611-4c2a-8bb3-d45e8ae87136
Content-Type: application/json
```

```json
{"error":{"code":"APPROVAL_BLOCKED","message":"One or more protocol criteria or coverage items remain unresolved.","details":[{"field":"coverage","reason":"BLOCKING section PX-EXCLUSION-P3 has no approved resolution"}],"retryable":false},"request_id":"d98ea1bc-9611-4c2a-8bb3-d45e8ae87136"}
```

## 5. Stable HTTP errors and ownership of decisions

| HTTP | Error codes (examples, exhaustive for core operation classes) | Domain semantics |
|---|---|---|
| `400` | `BAD_REQUEST`, `INVALID_TRANSITION`, `UNSUPPORTED_OPERATION` | structurally valid JSON but invalid state request; never clinical UNKNOWN |
| `401` | `ACTOR_REQUIRED`, `ACTOR_UNKNOWN` | mock actor check only, not real authentication |
| `403` | `ROLE_FORBIDDEN`, `SITE_SCOPE_FORBIDDEN`, `SYNTHETIC_ONLY` | role/site/tool source denied, with audit |
| `404` | `TRIAL_NOT_FOUND`, `PATIENT_NOT_FOUND`, `VERSION_NOT_FOUND`, `JOB_NOT_FOUND`, `SOURCE_NOT_FOUND`, `CASE_NOT_FOUND` | not found in actor's scope |
| `409` | `IDEMPOTENCY_CONFLICT`, `REVISION_CONFLICT`, `VERSION_ALREADY_ACTIVE`, `APPROVAL_BLOCKED`, `PROTOCOL_NOT_ACTIVE`, `EVENT_VERSION_CONFLICT`, `JOB_ALREADY_RUNNING` | guard fails; never silent overwrite |
| `413` | `PDF_TOO_LARGE` | respects `MAX_PDF_MB` |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | PDF signature or content type invalid |
| `422` | `VALIDATION_ERROR`, `UNSUPPORTED_UNIT`, `INVALID_DATE_PRECISION`, `INVALID_TIME_INTERVAL`, `NON_SYNTHETIC_INPUT` | validation problem; no evidence/clinical assertion created |
| `429` | `RATE_LIMITED` | optional provider-limited AI call; core engine unaffected |
| `500` | `INTERNAL_ERROR`, `PERSISTENCE_FAILED`, `AUDIT_WRITE_FAILED` | operational error; prior assessment stale but never reinterpreted as `UNKNOWN` |
| `503` | `SERVICE_NOT_READY`, `AGENT_UNAVAILABLE` | worker/migration or LLM unavailable; core availability separately indicated |

**Uncertainty is response data**, not HTTP error: a valid patient criterion with missing lab is `200` with `status='UNKNOWN',reason_codes=['MISSING_LAB']`. **Infrastructure error is not uncertainty**: run/assessment has `evaluation_state='EVALUATION_ERROR',candidate_status=null`; previous authoritative result remains with stale flag.

## 6. Pydantic-v2 implementation mapping / OpenAPI compatibility

```python
from datetime import date
from enum import StrEnum
from typing import Annotated, Literal
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

class ContractBase(BaseModel):
    model_config = ConfigDict(extra='forbid')

class EvidenceState(StrEnum):
    NOT_RECORDED='NOT_RECORDED'; EXPLICITLY_NEGATIVE='EXPLICITLY_NEGATIVE'
    NOT_ASSESSED='NOT_ASSESSED'; NOT_APPLICABLE='NOT_APPLICABLE'
    UNCERTAIN='UNCERTAIN'; POSITIVE='POSITIVE'

class EventMedication(ContractBase):
    code: str
    evidence_type: Literal['ORDER','DISPENSE','ADMINISTRATION','REPORTED_USE','DISCONTINUATION','CANCELLATION']
    dose_value: float | None
    dose_unit: str | None
    route: str | None
    interval_end_exclusive_at: AwareDatetime | None

class PossibleIntervalModel(ContractBase):
    earliest: AwareDatetime
    latest_exclusive: AwareDatetime

class TimeUncertaintyModel(ContractBase):
    raw_date: str
    precision: Literal['INSTANT','DAY','MONTH','YEAR','UNKNOWN']
    possible_interval: PossibleIntervalModel | None

class LabEvent(ContractBase):
    analyte_code: str
    value: float
    unit: str

class ConditionEvent(ContractBase):
    code: str
    clinical_status: Literal['ACTIVE','RESOLVED','SUSPECTED']

class NoteEvent(ContractBase):
    text: str
    span_start: int | None
    span_end: int | None

class ObservationEvent(ContractBase):
    kind: Literal['LAB','FUNCTIONAL','PULMONARY','ECG','IMAGING','VITAL']
    value: float | str
    unit: str | None

class EventCreateModel(ContractBase):
    trial_id: str
    event_kind: Literal['MEDICATION','LAB','CONDITION','NOTE','OBSERVATION']
    source_event_id: str
    source_version: Annotated[int, Field(ge=1)]
    source_id: str
    source_document_version: Annotated[int, Field(ge=1)]
    effective_at: AwareDatetime | None
    recorded_at: AwareDatetime
    time_uncertainty: TimeUncertaintyModel | None
    evidence_state: EvidenceState
    evidence_quality: Literal['HIGH','MODERATE','LOW','UNVERIFIED']
    medication: EventMedication | None
    lab: LabEvent | None
    condition: ConditionEvent | None
    note: NoteEvent | None
    observation: ObservationEvent | None
    supersedes_event_id: str | None

    @model_validator(mode='after')
    def validate_payload_and_date(self):
        payloads = [self.medication,self.lab,self.condition,self.note,self.observation]
        if sum(x is not None for x in payloads) != 1:
            raise ValueError('Exactly one event payload is required')
        expected = {'MEDICATION':self.medication,'LAB':self.lab,'CONDITION':self.condition,
                    'NOTE':self.note,'OBSERVATION':self.observation}
        if expected[self.event_kind] is None:
            raise ValueError('Payload must match event_kind')
        if (self.effective_at is None) == (self.time_uncertainty is None):
            raise ValueError('Provide exact effective_at OR uncertain possible interval')
        if self.time_uncertainty is not None and self.time_uncertainty.possible_interval is None:
            raise ValueError('Uncertain clinical date requires a possible interval')
        return self
```

Use the typed payload models above; for `PossibleIntervalModel` add a Pydantic `model_validator` enforcing strictly increasing UTC-aware bounds. For numeric `ObservationEvent`, require a nonempty unit; text observations may use `null`. Never infer missing clinical instants from recorded timestamps. Generate actual Python `BaseModel`s for **every TypeScript DTO** in §2 under backend-owned `backend/app/schemas/` using field names exactly as written; import enums from backend's sole enum module. `model_json_schema()` from these DTOs becomes FastAPI OpenAPI 3.1 JSON schema; coordinator verifies response schemas and request examples against `app.openapi()`, rather than hand-drifting parallel OpenAPI files. List/response components are `Envelope[T]` Pydantic generics and `Page[T]`. `IsoInstant` is `AwareDatetime` (not permissive `datetime`), `IsoDate` is `date`, IDs are constrained strings, list limits use `Field`, and `Json` observations use tagged union with discriminator `event_kind`. APIs must reject `NaN`, invalid units and ambiguous dates. Python `date` handles inclusive **local date**, while timestamp comparisons are normalized aware UTC.

**No unversioned hidden paths**: tests must enumerate exactly the route table above (`/openapi.json`, `/docs` and `/redoc` are framework documentation endpoints, nonbusiness, optionally disabled outside local demo). Any new application route requires coordinated contract revision before implementation. In particular, no silent `/api/patients`, `/api/approve`, or proxy route with altered schema.

## 7. Cross-document invariants and API release test

- Pydantic schemas and TypeScript DTO names, enums and nullable fields identical. `CriteriaReplaceRequest` **includes** source anchors for every proposed rule and omits approval metadata (the server alone supplies signoff), signed `ApprovalReceipt` is immutable, and first activation only after complete attestation.
- New event references source ID/version, effective and recorded timestamps, and idempotency key; correlation ID links event→assessment delta→finding→case→audit. `CASE` never represents a medical diagnosis.
- `NO_ACTION` exists only in event relevance/audit trace, not as a finding row. Candidate status is null on engine error, not a fourth clinical outcome.
- In local tests OpenAPI must expose all methods listed in §3, and deny invalid actors, unknown paths, wrong content types and inconsistent IDs. Contract tests assert `POST event →202 →GET job SUCCEEDED →one case`, replay `200`, source-linked criterion outcomes and closed-case actor timestamp.
- `Patient360` returns all 12 required sections (arrays may be empty but cannot be interpreted as explicit negatives); no direct identifiers or real health records.

**Do not create `PROJECT_CONTEXT.md` yet.** Its Stage 2.1 owner must copy this frozen contract only after the approval checklist in `DEVELOPMENT_PLAN.md` is signed.
