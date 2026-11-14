from dataclasses import dataclass, field
from datetime import date, datetime
from zoneinfo import ZoneInfo

from backend.app.core.errors import DomainError
from backend.app.schemas.dto import Criterion
from backend.app.services.temporal import age_on, calendar_window, overlaps

EGFR_UNIT = "mL/min/1.73m²"
# Explicit aliases preserve the same quantity; no dimensional conversion is guessed.
UNIT_FACTORS = {EGFR_UNIT: 1.0, "mL/min/1.73m2": 1.0}


@dataclass
class Result:
    status: str
    reasons: list[str] = field(default_factory=list)
    evidence: list = field(default_factory=list)
    interval: tuple | None = None
    explanation: str = ""


def unknown(reason, evidence=(), interval=None):
    return Result("UNKNOWN", [reason], list(evidence), interval, reason)


def aggregate(results):
    statuses = [r.status for r in results]
    if not statuses:
        raise DomainError("INTERNAL_ERROR", "No eligibility rules evaluated", 500)
    return (
        "PROTOCOL_CONFLICT"
        if "FAIL" in statuses
        else "NEEDS_REVIEW"
        if "UNKNOWN" in statuses
        else "POTENTIAL_MATCH"
    )


def reliable(row):
    return (
        row.verification_status == "VERIFIED"
        and row.evidence_quality in ("HIGH", "MODERATE")
        and row.evidence_state in ("POSITIVE", "EXPLICITLY_NEGATIVE")
        and bool(row.source_pk)
    )


def evaluate(rule: Criterion, day: date, facts, conditions, labs, medications, open_items=()):
    if rule.workflow_status != "APPROVED" or not rule.approved_by or not rule.approved_at:
        raise DomainError("PROTOCOL_NOT_ACTIVE", "Unapproved rule cannot execute")
    op = rule.operator
    if (
        any(i.status == "OPEN" and i.reason_code == "CONFLICTING_SOURCES" for i in open_items)
        and op == "NO_RESTRICTED_USE"
    ):
        return unknown("CONFLICTING_SOURCES", medications)
    if op == "AGE_RANGE_INCLUSIVE":
        rows = [f for f in facts if f.fact_key == "birth_date"]
        if not rows or not reliable(rows[-1]) or rows[-1].date_precision not in ("DAY", "INSTANT"):
            return unknown("DATE_AMBIGUOUS", rows)
        birth = date.fromisoformat(rows[-1].value_json)
        age = age_on(birth, day)
        return Result(
            "PASS" if rule.threshold[0] <= age <= rule.threshold[1] else "FAIL",
            evidence=rows,
            explanation=f"Age {age} within inclusive {rule.threshold}",
        )
    if op in ("CODE_CONFIRMED", "ABSENCE_CONFIRMED_ACTIVE"):
        rows = [
            c
            for c in conditions
            if c.code == rule.threshold
            and (c.onset_date is None or c.onset_date <= day)
            and (c.abatement_date is None or c.abatement_date > day)
            and (
                c.effective_at is None
                or c.effective_at.astimezone(ZoneInfo(rule.window.time_zone)).date() <= day
            )
        ]
        if any(c.verification_status == "CONFLICTED" for c in rows):
            return unknown("CONFLICTING_SOURCES", rows)
        confirmed = [
            c
            for c in rows
            if reliable(c) and c.clinical_status == "ACTIVE" and c.evidence_state == "POSITIVE"
        ]
        if confirmed:
            return Result(
                "PASS" if op == "CODE_CONFIRMED" else "FAIL",
                evidence=confirmed,
                explanation="Verified active condition at screening",
            )
        completeness = [
            f
            for f in facts
            if f.fact_key == "excluded_condition_absence"
            and reliable(f)
            and f.evidence_state == "EXPLICITLY_NEGATIVE"
            and f.value_json
            and f.value_json.get("as_of_date") == day.isoformat()
            and f.value_json.get("reviewer_actor_id")
        ]
        if op == "ABSENCE_CONFIRMED_ACTIVE" and completeness and not rows:
            return Result("PASS", evidence=completeness, explanation="Reviewed explicit condition absence")
        return unknown("INSUFFICIENT_ABSENCE_EVIDENCE", rows + completeness)
    if op == "LAB_GTE":
        start, end = calendar_window(day, rule.window)
        rows = [
            lab
            for lab in labs
            if lab.analyte_code == "egfr" and lab.specimen_date and lab.specimen_date <= day
        ]
        if not rows:
            reason = (
                "DATE_AMBIGUOUS"
                if any(lab.analyte_code == "egfr" and lab.specimen_date is None for lab in labs)
                else "MISSING_LAB"
            )
            return unknown(reason, labs, (start, end))
        latest_date = max(lab.specimen_date for lab in rows)
        latest = [lab for lab in rows if lab.specimen_date == latest_date]
        if latest_date < day.fromordinal(day.toordinal() + rule.window.start_offset_days):
            return unknown("OUTDATED_LAB", latest, (start, end))
        if any(lab.unit not in UNIT_FACTORS for lab in latest):
            return unknown("UNIT_UNSUPPORTED", latest, (start, end))
        if any(not reliable(lab) or lab.value_num is None for lab in latest):
            return unknown("SOURCE_UNAVAILABLE", latest, (start, end))
        values = {lab.value_num * UNIT_FACTORS[lab.unit] for lab in latest}
        if len(values) != 1:
            return unknown("CONFLICTING_SOURCES", latest, (start, end))
        value = values.pop()
        return Result(
            "PASS" if value >= rule.threshold else "FAIL",
            evidence=latest,
            interval=(start, end),
            explanation=f"Latest specimen {latest_date}: {value} {rule.unit}; minimum {rule.threshold}",
        )
    if op == "NO_RESTRICTED_USE":
        start, end = calendar_window(day, rule.window)
        relevant = []
        reasons = []
        confirmed = []
        for med in medications:
            instant = med.effective_at
            if med.possible_start is not None:
                if not overlaps(med.possible_start, med.possible_end_exclusive, start, end):
                    continue
                relevant.append(med)
                reasons.append("DATE_AMBIGUOUS")
                continue
            if instant is None:
                relevant.append(med)
                reasons.append("DATE_AMBIGUOUS")
                continue
            if med.asserted_end_exclusive_at:
                inside = overlaps(instant, med.asserted_end_exclusive_at, start, end)
            else:
                inside = start <= instant < end
                if med.evidence_type == "REPORTED_USE" and instant < start:
                    relevant.append(med)
                    reasons.append("DATE_AMBIGUOUS")
                    continue
            if not inside:
                continue
            if med.mapped_class is None:
                relevant.append(med)
                reasons.append("UNMAPPED_CODE")
            elif med.mapped_class == rule.threshold:
                relevant.append(med)
                if med.verification_status == "CONFLICTED" or med.evidence_state == "UNCERTAIN":
                    reasons.append("CONFLICTING_SOURCES")
                elif not reliable(med):
                    reasons.append("SOURCE_UNAVAILABLE")
                elif med.evidence_type in ("ORDER", "DISPENSE"):
                    reasons.append("ORDER_ONLY")
                elif (
                    med.evidence_type in ("ADMINISTRATION", "REPORTED_USE")
                    and med.evidence_state == "POSITIVE"
                ):
                    confirmed.append(med)
        if "CONFLICTING_SOURCES" in reasons:
            return unknown("CONFLICTING_SOURCES", relevant, (start, end))
        if confirmed:
            return Result(
                "FAIL",
                evidence=confirmed,
                interval=(start, end),
                explanation="Confirmed restricted use inside approved window",
            )
        if reasons:
            return Result(
                "UNKNOWN", sorted(set(reasons)), relevant, (start, end), "Medication evidence unresolved"
            )
        reconciled = []
        for f in facts:
            if (
                f.domain_section != "medication_reconciliation"
                or not reliable(f)
                or f.evidence_state != "EXPLICITLY_NEGATIVE"
            ):
                continue
            value = f.value_json
            if (
                not isinstance(value, dict)
                or not value.get("reviewer_actor_id")
                or not value.get("reviewed_at")
            ):
                continue
            a, b = (
                datetime.fromisoformat(value["coverage_start_at"]),
                datetime.fromisoformat(value["coverage_end_exclusive_at"]),
            )
            if a <= start and b >= end:
                reconciled.append(f)
        if reconciled:
            return Result(
                "PASS",
                evidence=reconciled,
                interval=(start, end),
                explanation="Reviewed no-use reconciliation covers complete window",
            )
        return unknown("INSUFFICIENT_ABSENCE_EVIDENCE", relevant, (start, end))
    raise DomainError("UNSUPPORTED_OPERATION", f"Unsupported baseline operator {op}", 422)
