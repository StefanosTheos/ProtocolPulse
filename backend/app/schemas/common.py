from datetime import date
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

ID = Annotated[str, Field(min_length=1, max_length=64)]
Text = Annotated[str, Field(min_length=1, max_length=10000)]
IsoInstant = AwareDatetime
IsoDate = date
ActorRole = Literal["SPONSOR_OPS", "INVESTIGATOR", "COORDINATOR", "MONITOR", "AUDITOR", "RESEARCH_IT"]
CriterionStatus = Literal["PASS", "FAIL", "UNKNOWN"]
CandidateStatus = Literal["POTENTIAL_MATCH", "NEEDS_REVIEW", "PROTOCOL_CONFLICT"]
EvaluationState = Literal["COMPLETE", "EVALUATION_ERROR"]
UnknownReason = Literal[
    "MISSING_LAB",
    "OUTDATED_LAB",
    "DATE_AMBIGUOUS",
    "ORDER_ONLY",
    "CONFLICTING_SOURCES",
    "UNMAPPED_CODE",
    "UNAPPROVED_RULE",
    "INCOMPLETE_EXTRACTION",
    "INSUFFICIENT_ABSENCE_EVIDENCE",
    "UNIT_UNSUPPORTED",
    "SOURCE_UNAVAILABLE",
]
EvidenceState = Literal[
    "NOT_RECORDED", "EXPLICITLY_NEGATIVE", "NOT_ASSESSED", "NOT_APPLICABLE", "UNCERTAIN", "POSITIVE"
]
EvidenceQuality = Literal["HIGH", "MODERATE", "LOW", "UNVERIFIED"]
DatePrecision = Literal["INSTANT", "DAY", "MONTH", "YEAR", "UNKNOWN"]
MedicationEvidenceType = Literal[
    "ORDER", "DISPENSE", "ADMINISTRATION", "REPORTED_USE", "DISCONTINUATION", "CANCELLATION"
]
ProtocolState = Literal[
    "DRAFT", "EXTRACTING", "EXTRACTION_REVIEW", "EXTRACTION_FAILED", "APPROVED", "ACTIVE", "SUPERSEDED"
]
CriterionWorkflow = Literal["PROPOSED", "NEEDS_CLARIFICATION", "APPROVED", "REJECTED"]
CriterionType = Literal["INCLUSION", "EXCLUSION", "MONITORING"]
JobStatus = Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]
JobKind = Literal["PROTOCOL_EXTRACT", "SCREEN_COHORT", "INGEST_EVENT", "AGENT_INVESTIGATION"]
ScreeningRunStatus = Literal["QUEUED", "RUNNING", "COMPLETE", "FAILED"]
ParticipationStatus = Literal["NOT_ENROLLED", "PARTICIPATING", "ENDED"]
CandidateWorkflow = Literal["NOT_REVIEWED", "REVIEW_PENDING", "INVESTIGATOR_DISPOSITIONED"]
FindingCategory = Literal[
    "CONFIRMED_PROTOCOL_CONFLICT",
    "POTENTIAL_SAFETY_REVIEW",
    "DATA_QUALITY_DISCREPANCY",
    "POSSIBLE_PROTOCOL_DEVIATION",
]
RelevanceResult = Literal["RELEVANT", "NO_ACTION"]
FindingPriority = Literal["HIGH", "MEDIUM", "LOW"]
CaseStatus = Literal["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "CLOSED", "REOPENED"]
AgentRole = Literal[
    "PROTOCOL_INTELLIGENCE", "EVIDENCE_INVESTIGATOR", "MEDICATION_SAFETY_INVESTIGATOR", "MONITORING_WORKFLOW"
]
AgentStatus = Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "UNAVAILABLE", "PARTIAL"]
WindowOperator = Literal[
    "AGE_RANGE_INCLUSIVE",
    "CODE_CONFIRMED",
    "LAB_GTE",
    "ABSENCE_CONFIRMED_ACTIVE",
    "NO_RESTRICTED_USE",
    "EVENT_RESTRICTED_USE",
    "EVENT_ORDER_ONLY",
    "EVENT_LAB_LT",
]
ObservationKind = Literal["LAB", "FUNCTIONAL", "PULMONARY", "ECG", "IMAGING", "VITAL"]
EventKind = Literal["MEDICATION", "LAB", "CONDITION", "NOTE", "OBSERVATION"]


class ContractBase(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


T = TypeVar("T")


class Detail(ContractBase):
    field: str
    reason: str


class ErrorBody(ContractBase):
    code: str
    message: str
    details: list[Detail]
    retryable: bool


class ErrorEnvelope(ContractBase):
    error: ErrorBody
    request_id: str


class Envelope(ContractBase, Generic[T]):
    data: T
    request_id: str


class PageInfo(ContractBase):
    next_cursor: str | None
    limit: int
    total_count: int | None


class Page(ContractBase, Generic[T]):
    items: list[T]
    page: PageInfo
