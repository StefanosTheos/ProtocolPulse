"""Backend mirror of the frozen tool inputs, independent of E3 internals."""

from typing import Annotated, Literal

from pydantic import AwareDatetime, Field, create_model

from backend.app.integrations.agent_adapter import EvidenceReference
from backend.app.schemas.common import ID, ContractBase
from backend.app.schemas.dto import CriterionDraftInput, IsoDate


class ToolScope(ContractBase):
    contract_version: Literal["1.0.0-rc2"]
    execution_id: ID
    trial_id: ID
    protocol_version_id: ID
    correlation_id: ID


class VerificationProposal(ContractBase):
    patient_id: ID
    criterion_id: ID
    reason_code: str
    evidence_refs: list[EvidenceReference]
    question: Annotated[str, Field(min_length=1, max_length=2000)]
    requested_for_role: Literal["COORDINATOR", "INVESTIGATOR"]


PATIENT = {"patient_id": (ID, ...)}
SNAPSHOT = dict(**PATIENT, snapshot_id=(ID, ...))
BETWEEN = dict(**SNAPSHOT, from_at=(AwareDatetime, ...), to_at=(AwareDatetime, ...))
TOOL_FIELDS = {
    "parse_protocol": dict(source_id=(ID, ...), version_id=(ID, ...)),
    "locate_clause": dict(
        source_id=(ID, ...),
        query=(str, ...),
        section_ids=(list[ID], ...),
        max_matches=(Annotated[int, Field(ge=1, le=10)], ...),
    ),
    "validate_rule_schema": dict(drafts=(list[CriterionDraftInput], ...)),
    "report_coverage": dict(
        source_id=(ID, ...), drafts=(list[CriterionDraftInput], ...), sections=(list[ID], ...)
    ),
    "retrieve_patient_evidence": dict(
        **SNAPSHOT, criterion_ids=(list[ID], ...), evidence_types=(list[str], ...)
    ),
    "search_notes": dict(
        **SNAPSHOT, search_terms=(list[str], ...), max_hits=(Annotated[int, Field(ge=1, le=10)], ...)
    ),
    "get_lab_history": dict(**BETWEEN, analyte_code=(ID, ...)),
    "get_condition_history": dict(**SNAPSHOT, code=(ID, ...), as_of_date=(IsoDate, ...)),
    "get_medication_timeline": dict(
        **BETWEEN,
        evidence_types=(
            list[
                Literal[
                    "ORDER", "DISPENSE", "ADMINISTRATION", "REPORTED_USE", "DISCONTINUATION", "CANCELLATION"
                ]
            ],
            ...,
        ),
    ),
    "resolve_approved_terminology": dict(medication_code=(ID, ...), map_version=(ID, ...)),
    "get_evidence_link": dict(
        evidence_id=(ID, ...), source_id=(ID, ...), source_version=(Annotated[int, Field(ge=1)], ...)
    ),
    "evaluate_approved_rule": dict(
        **SNAPSHOT, criterion_id=(ID, ...), criterion_set_hash=(str, ...), evaluation_date=(IsoDate, ...)
    ),
    "classify_event_relevance": dict(event_id=(ID, ...)),
    "get_prior_evaluation": dict(**PATIENT, criterion_ids=(list[ID], ...), before_event_id=(ID, ...)),
    "get_case_status": dict(case_id=(ID, ...)),
    "request_verification_task": dict(
        proposal=(VerificationProposal, ...),
        semantic_key=(Annotated[str, Field(min_length=1, max_length=128)], ...),
    ),
    "request_med_reconciliation": dict(
        **PATIENT,
        criterion_id=(ID, ...),
        source_event_ids=(list[ID], ...),
        question=(Annotated[str, Field(min_length=1, max_length=2000)], ...),
        semantic_key=(Annotated[str, Field(min_length=1, max_length=128)], ...),
    ),
}
TOOL_INPUTS = {
    name: create_model(name + "_Input", __base__=ToolScope, **fields) for name, fields in TOOL_FIELDS.items()
}
