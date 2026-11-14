"""Mechanical anchors and DTO assembly. Clinical interpretations must come from the model."""

import re

from ai.agents.protocol_intelligence import GuardError, verify_quote
from ai.tools.schemas import CriterionDraftInput, wire


def clause_sections(pages):
    sections = []
    for page in pages.values():
        for match in re.finditer(r"(?m)^\d+\. [^\n]*\b(PX-(?:INC|EXC|MON)-\d{2})\b[^\n]*$", page.text):
            sections.append(match.group(1).replace("PX-", "PX-SECTION-", 1))
    if len(sections) != len(set(sections)):
        raise GuardError("INVALID_COVERAGE")
    return sections


def clause_registry(spans, pages):
    clauses = {}
    for span in spans:
        heading = span.text.splitlines()[0]
        match = re.search(r"\b(PX-(?:INC|EXC|MON)-\d{2})\b", heading)
        if not match:
            raise GuardError("UNVERIFIED_EVIDENCE_REF")
        verify_quote(pages, span.source_id, span.page, span.start, span.end, span.text)
        key = f"CLAUSE-{len(clauses) + 1}"
        clauses[key] = dict(criterion_id=match.group(1), **wire(span))
    return clauses


def assemble(interpretation, clauses, request):
    keys = [rule.clause_key for rule in interpretation.rules]
    if len(keys) != len(set(keys)) or any(key not in clauses for key in keys):
        raise GuardError("UNVERIFIED_EVIDENCE_REF")
    drafts = []
    for rule in interpretation.rules:
        clause = clauses[rule.clause_key]
        drafts.append(CriterionDraftInput(
            criterion_id=clause['criterion_id'], protocol_version_id=request.protocol_version_id,
            type=rule.type, clinical_subject=rule.clinical_subject, operator=rule.operator,
            threshold=rule.threshold, unit=rule.unit, window=dict(
                anchor=rule.window.anchor,
                start_offset_days=-rule.window.days_before if rule.window.days_before is not None else None,
                end_offset_days=0 if rule.window.anchor == 'SCREENING_DATE' else None,
                start_inclusive=True, end_inclusive=rule.window.include_anchor,
                time_zone='Europe/Athens',
                anchor_granularity='LOCAL_DATE' if rule.window.anchor == 'SCREENING_DATE' else 'INSTANT'),
            evidence_requirement=rule.evidence_requirement, missing_data_policy="UNKNOWN_UNLESS_RECONCILED",
            source_quote=clause['text'], source_id=clause['source_id'], source_page=clause['page'],
            source_anchor={'start': clause['start'], 'end': clause['end']},
            applicable_site_ids=['SITE-SYN-01'], terminology_map_version='px104-terminology-v1',
            logical_group_id='PX104-MONITORING-INDEPENDENT' if rule.type == 'MONITORING' else 'PX104-ELIGIBILITY-ALL',
            workflow_status='NEEDS_CLARIFICATION' if rule.ambiguity else 'PROPOSED', ambiguity=rule.ambiguity,
        ))
    return drafts
