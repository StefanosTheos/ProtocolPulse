"""Strict mirrors of AGENT_DESIGN / API_CONTRACTS 1.0.0-rc2.

No backend imports. DTOs here are validated again by the backend adapter.
"""

from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

VERSION = "1.0.0-rc2"
AgentRole = Literal["PROTOCOL_INTELLIGENCE", "EVIDENCE_INVESTIGATOR",
                    "MEDICATION_SAFETY_INVESTIGATOR", "MONITORING_WORKFLOW"]
AgentStatus = Literal["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "UNAVAILABLE", "PARTIAL"]
MedicationType = Literal["ORDER", "DISPENSE", "ADMINISTRATION", "REPORTED_USE",
                         "DISCONTINUATION", "CANCELLATION"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class AgentRequest(StrictModel):
    contract_version: Literal["1.0.0-rc2"]
    execution_id: str = Field(min_length=1, max_length=64)
    role: AgentRole
    objective: str = Field(min_length=1, max_length=4000)
    trial_id: str = Field(min_length=1, max_length=64)
    protocol_version_id: str = Field(min_length=1, max_length=64)
    criterion_ids: list[str] = Field(default_factory=list, max_length=8)
    patient_id: str | None = None
    event_id: str | None = None
    evidence_snapshot_id: str | None = None
    correlation_id: str = Field(min_length=1)
    max_steps: int = Field(ge=1, le=8)


class EvidenceReference(StrictModel):
    source_id: str = Field(min_length=1)
    source_version: int = Field(ge=1)
    evidence_id: str = Field(min_length=1)
    page: int | None = Field(default=None, ge=1)
    span_start: int | None = Field(default=None, ge=0)
    span_end: int | None = Field(default=None, ge=1)
    effective_at: str | None = None

    @field_validator("effective_at")
    @classmethod
    def aware_instant(cls, value):
        if value is not None and datetime.fromisoformat(value.replace("Z", "+00:00")).utcoffset() is None:
            raise ValueError("An instant must have an offset")
        return value

    @model_validator(mode="after")
    def span_pair(self):
        if (self.span_start is None) != (self.span_end is None):
            raise ValueError("Both span bounds are required together")
        if self.span_start is not None and self.span_end <= self.span_start:
            raise ValueError("Invalid source span")
        return self


class ToolTrace(StrictModel):
    tool_name: str
    input_reference_ids: list[str]
    output_reference_ids: list[str]
    result_code: str
    elapsed_ms: int = Field(ge=0)
    error_code: str | None = None


class SourceAnchor(StrictModel):
    start: int = Field(ge=0)
    end: int = Field(gt=0)

    @model_validator(mode="after")
    def ordered(self):
        if self.end <= self.start:
            raise ValueError("Invalid anchor")
        return self


class WindowSpec(StrictModel):
    anchor: Literal["SCREENING_DATE", "EVENT_EFFECTIVE_AT", "PARTICIPATION"]
    start_offset_days: int | None
    end_offset_days: int | None
    start_inclusive: bool
    end_inclusive: bool
    time_zone: str
    anchor_granularity: Literal["LOCAL_DATE", "INSTANT"]


class CriterionDraftInput(StrictModel):
    criterion_id: str
    protocol_version_id: str
    type: Literal["INCLUSION", "EXCLUSION", "MONITORING"]
    clinical_subject: str
    operator: Literal["AGE_RANGE_INCLUSIVE", "CODE_CONFIRMED", "LAB_GTE", "ABSENCE_CONFIRMED_ACTIVE",
                      "NO_RESTRICTED_USE", "EVENT_RESTRICTED_USE", "EVENT_ORDER_ONLY", "EVENT_LAB_LT"]
    threshold: int | float | str | list[int | float] | None
    unit: str | None
    window: WindowSpec | None
    evidence_requirement: str
    missing_data_policy: Literal["UNKNOWN_UNLESS_RECONCILED"]
    source_quote: str = Field(min_length=1)
    source_id: str
    source_page: int = Field(ge=1)
    source_anchor: SourceAnchor
    applicable_site_ids: list[str]
    terminology_map_version: str
    logical_group_id: str
    workflow_status: Literal["PROPOSED", "NEEDS_CLARIFICATION"]
    ambiguity: str | None

    @field_validator("threshold")
    @classmethod
    def numeric_pair(cls, value):
        if isinstance(value, list) and len(value) != 2:
            raise ValueError("Threshold tuple must contain exactly two numbers")
        return value


class CoverageItem(StrictModel):
    section_id: str
    source_id: str
    page: int = Field(ge=1)
    span_start: int = Field(ge=0)
    span_end: int = Field(gt=0)
    status: Literal["MAPPED", "INFORMATIONAL", "BLOCKING"]
    criterion_ids: list[str]
    review_note: str | None


class AgentResult(StrictModel):
    contract_version: Literal["1.0.0-rc2"]
    execution_id: str
    status: AgentStatus
    role: AgentRole
    summary: str | None = None
    evidence_refs: list[EvidenceReference]
    unknown_reasons: list[str]
    conflict_refs: list[str]
    proposed_criteria: list[CriterionDraftInput]
    coverage: list[CoverageItem]
    verification_questions: list[str]
    trace: list[ToolTrace]
    error_code: str | None = None
    model_id: str | None = None


class FinalProposal(StrictModel):
    """Internal model output only; coordinator supplies identities/status/trace."""

    summary: str | None
    evidence_refs: list[EvidenceReference]
    unknown_reasons: list[str]
    conflict_refs: list[str]
    proposed_criteria: list[CriterionDraftInput]
    coverage: list[CoverageItem]
    verification_questions: list[str]
    incomplete: bool


class PageSpan(StrictModel):
    source_id: str
    source_version: int = Field(ge=1)
    page: int = Field(ge=1)
    text: str
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    sha256: str
    quality: Literal["OK", "LOW", "UNREADABLE"]


class GatewaySuccess(StrictModel):
    tool_name: str
    data: dict[str, Any]
    evidence_refs: list[EvidenceReference]
    source_watermark: str
    result_code: str

    @field_validator("result_code")
    @classmethod
    def categorical_code(cls, value):
        if not re.fullmatch(r"[A-Z][A-Z0-9_]{0,63}", value):
            raise ValueError("Expected a categorized outcome, not source text")
        return value


class GatewayError(StrictModel):
    tool_name: str
    error_code: str
    retryable: bool


class VerificationTaskProposal(StrictModel):
    patient_id: str
    criterion_id: str
    reason_code: str
    evidence_refs: list[EvidenceReference]
    question: str = Field(min_length=1, max_length=2000)
    requested_for_role: Literal["COORDINATOR", "INVESTIGATOR"]


class AsyncToolGateway(Protocol):
    async def invoke(self, name: str, payload: dict) -> dict: ...


def wire(model: BaseModel) -> dict:
    return model.model_dump(mode="json")
