"""Canonical tool schemas and per-role allowlists; no database access."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import create_model

from ai.tools.schemas import (CoverageItem, CriterionDraftInput, EvidenceReference, MedicationType,
                              PageSpan, StrictModel, VerificationTaskProposal)

P = "PROTOCOL_INTELLIGENCE"
E = "EVIDENCE_INVESTIGATOR"
M = "MEDICATION_SAFETY_INVESTIGATOR"
W = "MONITORING_WORKFLOW"


def model(name, **fields):
    return create_model(name, __base__=StrictModel, **{k: (v, ...) for k, v in fields.items()})


TOOL_INPUTS = {
    "parse_protocol": model("ParseProtocol", source_id=str, version_id=str),
    "locate_clause": model("LocateClause", source_id=str, query=str, section_ids=list[str], max_matches=int),
    "validate_rule_schema": model("ValidateRuleSchema", drafts=list[CriterionDraftInput]),
    "report_coverage": model("ReportCoverage", source_id=str, drafts=list[CriterionDraftInput], sections=list[str]),
    "retrieve_patient_evidence": model("RetrievePatientEvidence", patient_id=str, criterion_ids=list[str],
                                       snapshot_id=str, evidence_types=list[str]),
    "search_notes": model("SearchNotes", patient_id=str, search_terms=list[str], snapshot_id=str, max_hits=int),
    "get_lab_history": model("GetLabHistory", patient_id=str, analyte_code=str, from_at=str, to_at=str, snapshot_id=str),
    "get_condition_history": model("GetConditionHistory", patient_id=str, code=str, as_of_date=str, snapshot_id=str),
    "get_medication_timeline": model("GetMedicationTimeline", patient_id=str, from_at=str, to_at=str,
                                      snapshot_id=str, evidence_types=list[MedicationType]),
    "resolve_approved_terminology": model("ResolveApprovedTerminology", medication_code=str, map_version=str),
    "get_evidence_link": model("GetEvidenceLink", evidence_id=str, source_id=str, source_version=int),
    "evaluate_approved_rule": model("EvaluateApprovedRule", patient_id=str, criterion_id=str,
                                    criterion_set_hash=str, snapshot_id=str, evaluation_date=str),
    "classify_event_relevance": model("ClassifyEventRelevance", event_id=str, protocol_version_id=str),
    "get_prior_evaluation": model("GetPriorEvaluation", patient_id=str, criterion_ids=list[str], before_event_id=str),
    "get_case_status": model("GetCaseStatus", case_id=str),
    "request_verification_task": model("RequestVerificationTask", proposal=VerificationTaskProposal, semantic_key=str),
    "request_med_reconciliation": model("RequestMedReconciliation", patient_id=str, criterion_id=str,
                                         source_event_ids=list[str], question=str, semantic_key=str),
}

TOOL_ROLES = {
    "parse_protocol": {P}, "locate_clause": {P}, "validate_rule_schema": {P}, "report_coverage": {P},
    "retrieve_patient_evidence": {E, M, W}, "search_notes": {E, M}, "get_lab_history": {E, W},
    "get_condition_history": {E}, "get_medication_timeline": {E, M},
    "resolve_approved_terminology": {M, W}, "get_evidence_link": {E, M, W},
    "evaluate_approved_rule": {M, W}, "classify_event_relevance": {W}, "get_prior_evaluation": {W},
    "get_case_status": {W}, "request_verification_task": {E, M, W}, "request_med_reconciliation": {M},
}
TASK_TOOLS = {"request_verification_task", "request_med_reconciliation"}
FORBIDDEN_TOOLS = {"reevaluate_affected", "create_or_update_finding", "append_audit"}

FactRef = model("FactRef", evidence_id=str, kind=str, value=Any, unit=str | None, effective_at=str | None,
                recorded_at=str, source_id=str, source_version=int,
                evidence_quality=Literal["HIGH", "MODERATE", "LOW", "UNVERIFIED"],
                evidence_state=Literal["NOT_RECORDED", "EXPLICITLY_NEGATIVE", "NOT_ASSESSED",
                                       "NOT_APPLICABLE", "UNCERTAIN", "POSITIVE"])
NoteHit = model("NoteHit", note_id=str, quote=str, source_id=str, span_start=int, span_end=int, recorded_at=str)
RuleError = model("RuleError", criterion_id=str, code=str)
Delta = model("EvaluationDelta", criterion_id=str, before_result=Literal["PASS", "FAIL", "UNKNOWN"] | None,
              after_result=Literal["PASS", "FAIL", "UNKNOWN"], before_assessment_id=str | None,
              after_assessment_id=str, trigger_event_id=str)
TaskReceipt = model("TaskReceipt", task_id=str, created=bool)

TOOL_OUTPUTS = {
    "parse_protocol": model("ParsedProtocol", pages=list[PageSpan], unreadable_pages=list[int], file_sha256=str),
    "locate_clause": model("LocatedClauses", spans=list[PageSpan]),
    "validate_rule_schema": model("ValidatedRules", valid=list[CriterionDraftInput], errors=list[RuleError]),
    "report_coverage": model("CoverageReport", items=list[CoverageItem], blocking_count=int),
    "retrieve_patient_evidence": model("RetrievedEvidence", facts=list[FactRef], open_items=list[str]),
    "search_notes": model("SearchedNotes", hits=list[NoteHit]),
    "get_lab_history": model("LabHistory", facts=list[FactRef]),
    "get_condition_history": model("ConditionHistory", facts=list[FactRef], completeness_ref=EvidenceReference | None),
    "get_medication_timeline": model("MedicationTimeline", events=list[FactRef], reconciliations=list[FactRef]),
    "resolve_approved_terminology": model("ResolvedTerminology", code=str, mapped_class=str | None,
                                          status=Literal["MAPPED", "UNMAPPED"], mapping_source_id=str | None),
    "get_evidence_link": model("EvidenceLink", reference=EvidenceReference, quote=str | None),
    "evaluate_approved_rule": model("ApprovedRuleResult", result=Literal["PASS", "FAIL", "UNKNOWN"],
                                    reason_codes=list[str], evidence_refs=list[EvidenceReference]),
    "classify_event_relevance": model("EventRelevance", affected_criterion_ids=list[str],
                                      category=Literal["RELEVANT", "NO_ACTION"], reason=str),
    "get_prior_evaluation": model("PriorEvaluation", prior=list[Delta]),
    "get_case_status": model("CaseStatus", status=Literal["OPEN", "ACKNOWLEDGED", "INVESTIGATING",
                                                         "RESOLVED", "CLOSED", "REOPENED"],
                             assigned_to=str | None, revision=int, linked_finding_ids=list[str]),
    "request_verification_task": TaskReceipt,
    "request_med_reconciliation": TaskReceipt,
}


def allowed_tools(role: str) -> dict:
    return {name: schema for name, schema in TOOL_INPUTS.items() if role in TOOL_ROLES[name]}


def reference_ids(value: Any) -> list[str]:
    """Collect identifiers only; never log tool payload text or clinical values."""
    found = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"value", "body", "text", "quote", "summary", "question"}:
                continue  # A clinical JSON value is not an infrastructure ID registry.
            if key.endswith("_id") and isinstance(item, str):
                found.add(item)
            elif key.endswith("_ids") and isinstance(item, list):
                found.update(x for x in item if isinstance(x, str))
            if isinstance(item, (dict, list)):
                found.update(reference_ids(item))
    elif isinstance(value, list):
        for item in value:
            found.update(reference_ids(item))
    return sorted(found)
