// Mirrors docs/API_CONTRACTS.md §2 (freeze PP-S2-CF-20261114-01 / 1.0.0-rc2) field-for-field.
// `T | null` = required but nullable; `?` would mean omittable (the contract uses none here).
// Do not add, rename or relax fields locally: request a contract revision through IC.

export const CONTRACT_VERSION = '1.0.0-rc2' as const;

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
 api_version:'v1'; contract_version:'1.0.0-rc2';}

// Query parameter types for the allowlisted filters in API_CONTRACTS §3.
export interface PageQuery {limit?: number; cursor?: string}
export interface AssessmentQuery extends PageQuery {
  status?: CandidateStatus; reason?: UnknownReason; sort?: 'patient_id'|'-evidence_completeness_percent';
}
export interface FindingQuery extends PageQuery {
  category?: FindingCategory; patient_id?: ID; priority?: FindingPriority;
  from_at?: IsoInstant; to_at?: IsoInstant; sort?: '-created_at'|'created_at';
}
export interface CaseQuery extends PageQuery {
  status?: CaseStatus; category?: FindingCategory; assigned_actor_id?: ID; patient_id?: ID;
  sort?: '-updated_at'|'updated_at';
}
export interface AuditQuery extends PageQuery {
  action?: string; actor_id?: ID; from_at?: IsoInstant; to_at?: IsoInstant; sort?: '-occurred_at'|'occurred_at';
}
export interface EvidenceQuery {version?: number; page?: number; span_start?: number; span_end?: number}
