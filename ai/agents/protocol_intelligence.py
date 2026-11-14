"""Source-grounded guards for the frozen demo rule set, not an extractor/oracle reader."""

import re
import logging

from ai.tools.schemas import CriterionDraftInput, CoverageItem

RULES = {
    "PX-INC-01": ("INCLUSION", "AGE_RANGE_INCLUSIVE", [40, 70], "years", 0, True),
    "PX-INC-02": ("INCLUSION", "CODE_CONFIRMED", "SYN-CONDITION-A", None, 0, True),
    "PX-INC-03": ("INCLUSION", "LAB_GTE", 60, "mL/min/1.73m²", -30, True),
    "PX-EXC-01": ("EXCLUSION", "ABSENCE_CONFIRMED_ACTIVE", "SYN-EXCLUDED-CONDITION", None, 0, True),
    "PX-EXC-02": ("EXCLUSION", "NO_RESTRICTED_USE", "SYN-CLASS-R", None, -30, False),
    "PX-MON-01": ("MONITORING", "EVENT_RESTRICTED_USE", "SYN-CLASS-R", None, None, False),
    "PX-MON-02": ("MONITORING", "EVENT_ORDER_ONLY", "SYN-CLASS-R", None, None, False),
    "PX-MON-03": ("MONITORING", "EVENT_LAB_LT", 60, "mL/min/1.73m²", None, False),
}
SECTION_RULES = {
    "PX-INFO-IDENTITY": [], "PX-INFO-CALENDAR": [],
    **{"PX-SECTION-" + key[3:]: [key] for key in RULES},
    "PX-INFO-EVIDENCE": [], "PX-INFO-REVIEW": [],
}
INFO_HEADERS = {
    "PX-INFO-IDENTITY": "1. Identity and purpose",
    "PX-INFO-CALENDAR": "2. Study calendar and interpretation",
    "PX-INFO-EVIDENCE": "11. Evidence and approved terminology",
    "PX-INFO-REVIEW": "12. Human approval, outcomes and audit",
}


class GuardError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def verify_quote(pages: dict, source_id: str, page: int, start: int, end: int, quote: str | None = None):
    span = pages.get((source_id, page))
    if span is None or span.quality != "OK" or not span.start <= start < end <= span.end:
        raise GuardError("UNVERIFIED_EVIDENCE_REF")
    actual = span.text[start - span.start:end - span.start]
    if quote is not None and actual != quote:
        raise GuardError("UNVERIFIED_EVIDENCE_REF")


def validate_drafts(drafts: list[CriterionDraftInput], request, pages):
    ids = [d.criterion_id for d in drafts]
    if len(ids) != len(set(ids)) or not set(ids) <= RULES.keys():
        raise GuardError("UNSUPPORTED_CRITERION")
    for draft in drafts:
        if draft.protocol_version_id != request.protocol_version_id:
            raise GuardError("SCOPE_VIOLATION")
        verify_quote(pages, draft.source_id, draft.source_page,
                     draft.source_anchor.start, draft.source_anchor.end, draft.source_quote)
        kind, operator, threshold, unit, offset, end_inclusive = RULES[draft.criterion_id]
        window = draft.window
        expected_group = "PX104-MONITORING-INDEPENDENT" if kind == "MONITORING" else "PX104-ELIGIBILITY-ALL"
        if (draft.type != kind or draft.operator != operator or draft.unit != unit or
                draft.clinical_subject != {"PX-INC-01": "age", "PX-INC-02": "diagnosis",
                    "PX-INC-03": "egfr", "PX-EXC-01": "condition", "PX-EXC-02": "medication",
                    "PX-MON-01": "medication", "PX-MON-02": "medication", "PX-MON-03": "egfr"}[draft.criterion_id] or
                draft.applicable_site_ids != ["SITE-SYN-01"] or
                draft.terminology_map_version != "px104-terminology-v1" or
                draft.logical_group_id != expected_group):
            expected = dict(type=kind, operator=operator, unit=unit, clinical_subject={
                "PX-INC-01": "age", "PX-INC-02": "diagnosis", "PX-INC-03": "egfr",
                "PX-EXC-01": "condition", "PX-EXC-02": "medication", "PX-MON-01": "medication",
                "PX-MON-02": "medication", "PX-MON-03": "egfr"}[draft.criterion_id],
                applicable_site_ids=["SITE-SYN-01"], terminology_map_version="px104-terminology-v1",
                logical_group_id=expected_group)
            logging.getLogger(__name__).warning("frozen_rule_mismatch criterion_id=%s fields=%s",
                draft.criterion_id, [k for k, v in expected.items() if getattr(draft, k) != v])
            raise GuardError("FROZEN_RULE_MISMATCH")
        uncertain = draft.workflow_status == "NEEDS_CLARIFICATION" and bool(draft.ambiguity)
        if draft.threshold != threshold and not (uncertain and draft.threshold is None):
            logging.getLogger(__name__).warning("frozen_rule_mismatch criterion_id=%s fields=threshold", draft.criterion_id)
            raise GuardError("FROZEN_RULE_MISMATCH")
        if window is None or (window.time_zone, window.anchor, window.start_offset_days,
                              window.end_offset_days, window.start_inclusive, window.end_inclusive,
                              window.anchor_granularity) != (
                "Europe/Athens", "PARTICIPATION" if kind == "MONITORING" else "SCREENING_DATE",
                offset, None if kind == "MONITORING" else 0, True, end_inclusive,
                "INSTANT" if kind == "MONITORING" else "LOCAL_DATE"):
            logging.getLogger(__name__).warning("frozen_rule_mismatch criterion_id=%s fields=window", draft.criterion_id)
            raise GuardError("FROZEN_RULE_MISMATCH")
        # Numeric/code thresholds must actually occur in the source, not only in a typed proposal.
        terms = threshold if isinstance(threshold, list) else [threshold]
        if not uncertain and any(not re.search(r"(?<![\w.])" + re.escape(str(term)) + r"(?![\w.])",
                                              draft.source_quote) for term in terms):
            raise GuardError("UNVERIFIED_EVIDENCE_REF")


def validate_coverage(items: list[CoverageItem], drafts, pages, complete: bool):
    ids = [item.section_id for item in items]
    if len(ids) != len(set(ids)) or not set(ids) <= SECTION_RULES.keys():
        raise GuardError("INVALID_COVERAGE")
    draft_ids = {d.criterion_id for d in drafts}
    for item in items:
        verify_quote(pages, item.source_id, item.page, item.span_start, item.span_end)
        if item.span_end <= item.span_start or not set(item.criterion_ids) <= draft_ids:
            raise GuardError("INVALID_COVERAGE")
        expected = SECTION_RULES[item.section_id]
        span = pages[(item.source_id, item.page)]
        heading = span.text[item.span_start - span.start:item.span_end - span.start].splitlines()[0]
        if item.section_id in INFO_HEADERS:
            if heading != INFO_HEADERS[item.section_id]:
                raise GuardError("INVALID_COVERAGE")
        elif not all(rule_id in heading for rule_id in expected):
            raise GuardError("INVALID_COVERAGE")
        if item.status != "BLOCKING" and (item.criterion_ids != expected or
                                          item.status != ("MAPPED" if expected else "INFORMATIONAL")):
            raise GuardError("INVALID_COVERAGE")
        for draft in drafts:
            if draft.criterion_id in item.criterion_ids and (draft.source_id != item.source_id or
                    draft.source_page != item.page or not item.span_start <= draft.source_anchor.start <
                    draft.source_anchor.end <= item.span_end):
                raise GuardError("INVALID_COVERAGE")
    if complete and (set(ids) != SECTION_RULES.keys() or draft_ids != RULES.keys() or
                     any(i.status == "BLOCKING" for i in items) or
                     any(d.workflow_status != "PROPOSED" or d.ambiguity for d in drafts)):
        raise GuardError("INCOMPLETE_EXTRACTION")
