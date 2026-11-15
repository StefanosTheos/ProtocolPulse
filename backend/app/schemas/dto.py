from datetime import timezone
from typing import Any, Generic, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import field_validator, model_validator

from backend.app.schemas.common import *  # noqa: F403


class EvidenceRef(ContractBase):
    evidence_id: ID
    source_id: ID
    source_version: Annotated[int, Field(ge=1)]
    evidence_type: str
    effective_at: IsoInstant | None
    recorded_at: IsoInstant | None
    page: int | None
    span_start: int | None
    span_end: int | None


class PossibleInterval(ContractBase):
    earliest: IsoInstant
    latest_exclusive: IsoInstant

    @model_validator(mode="after")
    def increasing(self):
        if self.earliest >= self.latest_exclusive:
            raise ValueError("Interval bounds must increase")
        return self


class TimeUncertainty(ContractBase):
    raw_date: str
    precision: DatePrecision
    possible_interval: PossibleInterval | None


class ProvenancedFact(ContractBase, Generic[T]):
    fact_id: ID
    value: T | None
    unit: str | None
    effective_at: IsoInstant | None
    onset_date: IsoDate | None
    recorded_at: IsoInstant
    ingested_at: IsoInstant
    source: EvidenceRef
    evidence_quality: EvidenceQuality
    evidence_state: EvidenceState
    time_uncertainty: TimeUncertainty | None
    verification_status: Literal["VERIFIED", "UNVERIFIED", "CONFLICTED"]


class TrialCreate(ContractBase):
    title: Text
    fictional_product_code: ID
    site_id: ID
    site_timezone: str
    planned_start_date: IsoDate
    planned_end_date: IsoDate
    synthetic_only: Literal[True]

    @model_validator(mode="after")
    def valid_calendar(self):
        try:
            ZoneInfo(self.site_timezone)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError("Valid IANA site timezone required") from exc
        if self.planned_end_date < self.planned_start_date:
            raise ValueError("Trial dates reversed")
        return self


class Trial(TrialCreate):
    trial_id: ID
    active_protocol_version_id: ID | None
    created_at: IsoInstant
    revision: int


class TrialDetail(Trial):
    protocol_version_ids: list[ID]
    patient_count: int
    finding_count: int
    trial_notice: str


class ParticipationSummary(ContractBase):
    """Aggregate counts only; no patient identifiers or clinical data."""

    trial_id: ID
    cohort_count: int
    participating_count: int
    ended_count: int


class SourceRef(ContractBase):
    source_id: ID
    source_version: int
    sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    filename: str
    mime_type: str
    created_at: IsoInstant
    synthetic_only: Literal[True]


class WindowSpec(ContractBase):
    anchor: Literal["SCREENING_DATE", "EVENT_EFFECTIVE_AT", "PARTICIPATION"]
    start_offset_days: int | None
    end_offset_days: int | None
    start_inclusive: bool
    end_inclusive: bool
    time_zone: str
    anchor_granularity: Literal["LOCAL_DATE", "INSTANT"]


class Anchor(ContractBase):
    start: Annotated[int, Field(ge=0)]
    end: Annotated[int, Field(gt=0)]


class CriterionDraftInput(ContractBase):
    criterion_id: ID
    protocol_version_id: ID
    type: CriterionType
    clinical_subject: ID
    operator: WindowOperator
    threshold: float | str | tuple[float, float] | None
    unit: str | None
    window: WindowSpec | None
    evidence_requirement: Text
    missing_data_policy: Literal["UNKNOWN_UNLESS_RECONCILED"]
    source_quote: Text
    source_id: ID
    source_page: Annotated[int, Field(ge=1)]
    source_anchor: Anchor
    applicable_site_ids: list[ID]
    terminology_map_version: ID
    logical_group_id: ID
    workflow_status: Literal["PROPOSED", "NEEDS_CLARIFICATION"]
    ambiguity: str | None


class Criterion(CriterionDraftInput):
    revision: int
    workflow_status: CriterionWorkflow
    approved_by: ID | None
    approved_at: IsoInstant | None


class CoverageItem(ContractBase):
    section_id: ID
    source_id: ID
    page: Annotated[int, Field(ge=1)]
    span_start: Annotated[int, Field(ge=0)]
    span_end: Annotated[int, Field(gt=0)]
    status: Literal["MAPPED", "INFORMATIONAL", "BLOCKING"]
    criterion_ids: list[ID]
    review_note: str | None


class CriteriaReplaceRequest(ContractBase):
    criteria: list[CriterionDraftInput]
    coverage: list[CoverageItem]
    change_reason: Text


class ProtocolDetail(ContractBase):
    protocol_version_id: ID
    trial_id: ID
    label: str
    state: ProtocolState
    revision: int
    source: SourceRef
    file_sha256: str
    criteria: list[Criterion]
    coverage: list[CoverageItem]
    coverage_signed_by: ID | None
    coverage_signed_at: IsoInstant | None
    approved_set_hash: str | None
    approved_at: IsoInstant | None
    extraction_job_id: ID | None
    blocking_count: int


class ExtractRequest(ContractBase):
    force_reinspect: bool


class ApprovalRequest(ContractBase):
    criterion_ids: list[ID]
    coverage_attestation: Literal[True]
    activate: Literal[True]
    decision_reason: Text


class ApprovalReceipt(ContractBase):
    protocol_version_id: ID
    approved_set_hash: str
    signed_criterion_ids: list[ID]
    approved_by: ID
    approved_at: IsoInstant
    state: Literal["ACTIVE"]
    superseded_version_id: ID | None


class JobReceipt(ContractBase):
    job_id: ID
    kind: JobKind
    status: JobStatus
    resource_id: ID | None
    correlation_id: ID
    poll_url: str
    created_at: IsoInstant


class JobError(ContractBase):
    code: str
    message: str
    retryable: bool


class JobDetail(JobReceipt):
    attempts: int
    max_attempts: int
    started_at: IsoInstant | None
    finished_at: IsoInstant | None
    progress_percent: float | None
    result: dict[str, Any] | None
    error: JobError | None


class ScreeningCreate(ContractBase):
    protocol_version_id: ID
    screening_date: IsoDate
    evidence_cutoff_at: IsoInstant
    patient_ids: list[ID] | None
    purpose: Literal["BASELINE"]


class ScreeningCounts(ContractBase):
    POTENTIAL_MATCH: int
    NEEDS_REVIEW: int
    PROTOCOL_CONFLICT: int
    EVALUATION_ERROR: int


class ScreeningRun(ContractBase):
    run_id: ID
    trial_id: ID
    protocol_version_id: ID
    approved_set_hash: str
    screening_date: IsoDate
    evidence_cutoff_at: IsoInstant
    evidence_snapshot_id: ID
    engine_version: str
    terminology_map_version: str
    status: ScreeningRunStatus
    job_id: ID
    patient_count: int
    counts: ScreeningCounts
    created_at: IsoInstant
    completed_at: IsoInstant | None
    stale: bool
    error_code: str | None


class ConsideredInterval(ContractBase):
    start: IsoInstant
    end: IsoInstant


class CriterionResult(ContractBase):
    criterion_result_id: ID
    criterion_id: ID
    protocol_version_id: ID
    status: CriterionStatus
    reason_codes: list[UnknownReason]
    evidence_refs: list[EvidenceRef]
    considered_interval: ConsideredInterval | None
    explanation: str
    evaluated_at: IsoInstant


class PatientAssessment(ContractBase):
    assessment_id: ID
    run_id: ID | None
    trial_id: ID
    patient_id: ID
    protocol_version_id: ID
    approved_set_hash: str
    evidence_snapshot_id: ID
    assessment_type: Literal["SCREENING", "MONITORING"]
    screening_date: IsoDate | None
    evaluation_at: IsoInstant
    evaluation_state: EvaluationState
    candidate_status: CandidateStatus | None
    criteria: list[CriterionResult]
    before_assessment_id: ID | None
    caused_by_event_id: ID | None
    related_finding_ids: list[ID]
    evidence_completeness_percent: float | None
    participation_status: ParticipationStatus
    stale: bool


class MedicationEvidence(ContractBase):
    exposure_id: ID
    medication_code: str
    mapped_class: str | None
    evidence_type: MedicationEvidenceType
    asserted_start_at: IsoInstant | None
    asserted_end_exclusive_at: IsoInstant | None
    dose: ProvenancedFact[float] | None
    route: ProvenancedFact[str] | None
    last_changed_at: IsoInstant | None
    stop_reason: str | None
    adverse_reactions: list[str]
    evidence: ProvenancedFact[str]
    source: EvidenceRef


class ClinicalNarrative(ContractBase):
    note_id: ID
    recorded_at: IsoInstant
    source: EvidenceRef
    text: str
    extraction_status: Literal["NOT_ASSESSED", "REVIEWED", "CONFLICTED"]


class OpenItem(ContractBase):
    open_item_id: ID
    reason_code: str
    description: str
    blocking: bool
    status: Literal["OPEN", "RESOLVED"]
    conflicting_evidence_ids: list[ID]
    requested_for_role: ActorRole | None


class PriorResearch(ContractBase):
    research_id: ID
    kind: Literal["OBSERVATIONAL", "INTERVENTIONAL"]
    exposure: ProvenancedFact[str] | None
    last_dose_at: IsoInstant | None
    half_life_hours: ProvenancedFact[float] | None
    completion_status: EvidenceState
    ongoing_restrictions: list[ProvenancedFact[str]]
    source: EvidenceRef


class Demographics(ContractBase):
    birth_date: ProvenancedFact[IsoDate]
    sex_at_birth: ProvenancedFact[str]
    location_jurisdiction: ProvenancedFact[str]


class IndexDisease(ContractBase):
    code: str
    diagnosis_criteria: list[ProvenancedFact[str]]
    severity: ProvenancedFact[str]
    first_onset: ProvenancedFact[IsoDate]
    diagnostic_evidence: list[EvidenceRef]


class Observation(ContractBase):
    kind: ObservationKind
    analyte_code: str | None
    observation: ProvenancedFact[float | str]
    interpretation: ProvenancedFact[str] | None


class StudyExposure(ContractBase):
    blinded: Literal[True]
    assignment_masked: ProvenancedFact[str] | None
    exposures: list[MedicationEvidence]


class Encounter(ContractBase):
    encounter_id: ID
    occurred_at: IsoInstant
    source_ids: list[ID]
    summary: str


class Patient360(ContractBase):
    patient_id: ID
    trial_id: ID
    synthetic_only: Literal[True]
    site_id: ID
    screening_snapshot_date: IsoDate
    demographics: Demographics
    index_disease: IndexDisease
    medical_conditions: list[ProvenancedFact[str]]
    surgeries_hospitalizations: list[ProvenancedFact[str]]
    family_history: list[ProvenancedFact[str]]
    genetics: list[ProvenancedFact[str]]
    symptom_history: list[ProvenancedFact[str]]
    observations: list[Observation]
    medications: list[MedicationEvidence]
    study_product_exposure: StudyExposure
    prior_clinical_research: list[PriorResearch]
    procedures_and_imaging: list[ProvenancedFact[str]]
    allergies: list[ProvenancedFact[str]]
    pregnancy_contraception: list[ProvenancedFact[str]]
    decision_capacity: ProvenancedFact[str]
    study_partner: ProvenancedFact[str]
    administration_ability: ProvenancedFact[str]
    encounters: list[Encounter]
    source_document_index: list[SourceRef]
    clinical_narratives: list[ClinicalNarrative]
    open_items: list[OpenItem]
    participation_status: ParticipationStatus
    current_assessment_id: ID | None
    data_watermark: IsoInstant


class EventMedication(ContractBase):
    code: Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9-]{1,63}$")]
    evidence_type: MedicationEvidenceType
    dose_value: float | None
    dose_unit: str | None
    route: str | None
    interval_end_exclusive_at: IsoInstant | None


class LabEvent(ContractBase):
    analyte_code: ID
    value: float
    unit: Text


class ConditionEvent(ContractBase):
    code: ID
    clinical_status: Literal["ACTIVE", "RESOLVED", "SUSPECTED"]


class NoteEvent(ContractBase):
    text: Text
    span_start: int | None
    span_end: int | None


class ObservationEvent(ContractBase):
    kind: ObservationKind
    value: float | str
    unit: str | None


class EventCreate(ContractBase):
    trial_id: ID
    event_kind: EventKind
    source_event_id: ID
    source_version: Annotated[int, Field(ge=1)]
    source_id: ID
    source_document_version: Annotated[int, Field(ge=1)]
    effective_at: IsoInstant | None
    recorded_at: IsoInstant
    time_uncertainty: TimeUncertainty | None
    evidence_state: EvidenceState
    evidence_quality: EvidenceQuality
    medication: EventMedication | None
    lab: LabEvent | None
    condition: ConditionEvent | None
    note: NoteEvent | None
    observation: ObservationEvent | None
    supersedes_event_id: ID | None

    @model_validator(mode="after")
    def valid_payload(self):
        names = ["medication", "lab", "condition", "note", "observation"]
        if sum(getattr(self, name) is not None for name in names) != 1:
            raise ValueError("Exactly one payload is required")
        if getattr(self, self.event_kind.lower()) is None:
            raise ValueError("Payload must match event kind")
        if (self.effective_at is None) == (self.time_uncertainty is None):
            raise ValueError("Provide exact time OR uncertain interval")
        if self.time_uncertainty and not self.time_uncertainty.possible_interval:
            raise ValueError("Uncertain date requires interval bounds")
        if self.medication and self.medication.interval_end_exclusive_at:
            if not self.effective_at or self.medication.interval_end_exclusive_at <= self.effective_at:
                raise ValueError("Medication end must follow start")
        if self.note and (self.note.span_start is not None or self.note.span_end is not None):
            a, b = self.note.span_start, self.note.span_end
            if a is None or b is None or not 0 <= a < b <= len(self.note.text):
                raise ValueError("Invalid note span")
        if (
            self.observation
            and isinstance(self.observation.value, (int, float))
            and not self.observation.unit
        ):
            raise ValueError("Numeric observation requires a unit")
        return self

    @field_validator("effective_at", "recorded_at")
    @classmethod
    def utc(cls, value):
        return value.astimezone(timezone.utc) if value else None


class EventReceipt(ContractBase):
    event_id: ID
    patient_id: ID
    trial_id: ID
    ingested_at: IsoInstant
    deduplicated: bool
    job: JobReceipt


class MonitoringFinding(ContractBase):
    finding_id: ID
    trial_id: ID
    patient_id: ID
    protocol_version_id: ID
    criterion_id: ID
    triggering_event_id: ID
    before_assessment_id: ID | None
    after_assessment_id: ID
    category: FindingCategory
    priority: FindingPriority
    case_id: ID
    evidence_refs: list[EvidenceRef]
    issue_key: str
    created_at: IsoInstant


class ReviewDecision(ContractBase):
    decision_id: ID
    actor_id: ID
    actor_role: ActorRole
    from_status: CaseStatus | None
    to_status: CaseStatus | None
    disposition: str
    rationale: str
    cited_evidence_ids: list[ID]
    decided_at: IsoInstant


class ReviewCase(ContractBase):
    case_id: ID
    trial_id: ID
    patient_id: ID
    protocol_version_id: ID
    criterion_id: ID
    issue_key: str
    status: CaseStatus
    priority: FindingPriority
    assigned_actor_id: ID | None
    finding_ids: list[ID]
    current_summary: str | None
    summary_origin: Literal["SYSTEM_DETERMINISTIC", "AI_DRAFT"] | None
    agent_execution_id: ID | None
    revision: int
    opened_at: IsoInstant
    updated_at: IsoInstant
    decisions: list[ReviewDecision]


class CasePatch(ContractBase):
    expected_revision: int
    next_status: CaseStatus
    assigned_actor_id: ID | None
    disposition: Text
    rationale: Text
    cited_evidence_ids: list[ID]


class AgentInvestigationCreate(ContractBase):
    role: AgentRole
    trial_id: ID
    protocol_version_id: ID
    patient_id: ID | None
    criterion_ids: list[ID]
    event_id: ID | None
    objective: Text


class ToolTrace(ContractBase):
    tool_name: str
    input_reference_ids: list[ID]
    output_reference_ids: list[ID]
    result_code: str
    elapsed_ms: int
    error_code: str | None


class AgentExecution(ContractBase):
    execution_id: ID
    role: AgentRole
    status: AgentStatus
    trial_id: ID
    patient_id: ID | None
    protocol_version_id: ID
    criterion_ids: list[ID]
    event_id: ID | None
    correlation_id: ID
    evidence_refs: list[EvidenceRef]
    summary: str | None
    unknown_reasons: list[str]
    verification_questions: list[str]
    trace: list[ToolTrace]
    error_code: str | None
    model_id: str | None
    created_at: IsoInstant
    finished_at: IsoInstant | None


class AuditEntry(ContractBase):
    audit_id: ID
    trial_id: ID
    actor_id: ID
    actor_role: ActorRole
    action: str
    target_type: str
    target_id: ID
    target_version: str | None
    correlation_id: ID
    request_id: ID
    input_hash: str | None
    output_ref_ids: list[ID]
    result_code: str
    occurred_at: IsoInstant


class EvidenceSpan(ContractBase):
    page: int | None
    start: int
    end: int
    text: str


class EvidenceSourceDetail(SourceRef):
    kind: Literal["PDF", "NOTE", "LAB", "MEDICATION", "ENCOUNTER", "OTHER"]
    page_count: int | None
    spans: list[EvidenceSpan]


class ScreeningDispositionCreate(ContractBase):
    assessment_id: ID
    disposition: Literal["INVITE_FOR_FORMAL_SCREENING", "NOT_SUITABLE", "SEEK_MORE_INFORMATION"]
    rationale: Text
    cited_evidence_ids: list[ID]


class ScreeningDisposition(ScreeningDispositionCreate):
    disposition_id: ID
    patient_id: ID
    trial_id: ID
    actor_id: ID
    decided_at: IsoInstant
    workflow_status: Literal["INVESTIGATOR_DISPOSITIONED"]


class ParticipationCreate(ContractBase):
    next_status: Literal["PARTICIPATING", "ENDED"]
    external_record_source_id: ID
    external_record_reference: Text
    rationale: Text


class ParticipationRecord(ContractBase):
    participation_id: ID
    trial_id: ID
    patient_id: ID
    from_status: ParticipationStatus
    to_status: ParticipationStatus
    source_id: ID
    external_record_reference: str
    actor_id: ID
    decided_at: IsoInstant


class Health(ContractBase):
    status: Literal["ok", "degraded"]
    database: Literal["ok", "unavailable"]
    migrations: Literal["current", "pending", "unknown"]
    worker: Literal["running", "stopped"]
    llm: Literal["enabled", "disabled", "unavailable"]
    synthetic_only: Literal[True]
    api_version: Literal["v1"]
    contract_version: Literal["1.0.0-rc2"]
