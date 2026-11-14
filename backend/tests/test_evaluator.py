from datetime import date, datetime
from types import SimpleNamespace

import pytest
from conftest import approve, event_body
from sqlalchemy import select

from backend.app import models as m
from backend.app.schemas.dto import EventCreate
from backend.app.services.evaluator import Result, aggregate, evaluate
from backend.app.services.serializers import protocol_dto
from backend.app.services.temporal import age_on, calendar_window, local_midnight


def context(env, pid="P-042"):
    approve(env)
    with env[2]() as session:
        protocol = protocol_dto(session, session.get(m.ProtocolVersion, "PV-PX104-1.0"))
        rows = [
            list(session.scalars(select(model).where(model.patient_id == pid)))
            for model in (m.PatientFact, m.ConditionRecord, m.LabObservation, m.MedicationExposure)
        ]
        return {c.criterion_id: c for c in protocol.criteria}, rows


@pytest.mark.parametrize(
    "birthday,expected", [("1986-10-31", 40), ("1986-11-01", 39), ("1956-10-31", 70), ("1955-10-31", 71)]
)
def test_age_boundaries(birthday, expected):
    assert age_on(date.fromisoformat(birthday), date(2026, 10, 31)) == expected


def test_calendar_dst_and_distinct_windows(env):
    rules, _ = context(env)
    a, b = calendar_window(date(2026, 10, 31), rules["PX-EXC-02"].window)
    assert a.isoformat() == "2026-09-30T21:00:00+00:00"
    assert b.isoformat() == "2026-10-30T22:00:00+00:00"
    assert (b - a).total_seconds() == 30 * 86400 + 3600
    lab_a, lab_b = calendar_window(date(2026, 10, 31), rules["PX-INC-03"].window)
    assert lab_a == a and lab_b == local_midnight(date(2026, 11, 1))
    assert lab_b != b


@pytest.mark.parametrize(
    "when,status",
    [
        ("2026-09-30T23:59:59+03:00", "PASS"),
        ("2026-10-01T00:00:00+03:00", "FAIL"),
        ("2026-10-30T23:59:59+02:00", "FAIL"),
        ("2026-10-31T00:00:00+02:00", "PASS"),
    ],
)
def test_washout_boundaries(env, when, status):
    rules, rows = context(env)
    source = rows[0][0].source_pk
    med = SimpleNamespace(
        source_pk=source,
        effective_at=datetime.fromisoformat(when),
        asserted_end_exclusive_at=None,
        possible_start=None,
        evidence_type="ADMINISTRATION",
        mapped_class="SYN-CLASS-R",
        verification_status="VERIFIED",
        evidence_quality="HIGH",
        evidence_state="POSITIVE",
    )
    rows[3] = [med]
    assert evaluate(rules["PX-EXC-02"], date(2026, 10, 31), *rows).status == status


def test_without_reconciliation_outside_use_is_unknown(env):
    rules, rows = context(env, "P-118")
    rows[0] = [r for r in rows[0] if r.domain_section != "medication_reconciliation"]
    result = evaluate(rules["PX-EXC-02"], date(2026, 10, 31), *rows)
    assert result.status == "UNKNOWN" and result.reasons == ["INSUFFICIENT_ABSENCE_EVIDENCE"]


@pytest.mark.parametrize(
    "change,reason",
    [
        ("stale", "OUTDATED_LAB"),
        ("unit", "UNIT_UNSUPPORTED"),
        ("missing", "MISSING_LAB"),
        ("contradiction", "CONFLICTING_SOURCES"),
    ],
)
def test_lab_uncertainty(env, change, reason):
    rules, rows = context(env)
    lab = rows[2][0]
    if change == "stale":
        lab.specimen_date = date(2026, 9, 30)
    elif change == "unit":
        lab.unit = "mg/dL"
    elif change == "missing":
        rows[2] = []
    else:
        import copy

        extra = copy.copy(lab)
        extra.value_num = 12
        rows[2].append(extra)
    result = evaluate(rules["PX-INC-03"], date(2026, 10, 31), *rows)
    assert result.status == "UNKNOWN" and reason in result.reasons


@pytest.mark.parametrize(
    "day,status", [("2026-10-01", "PASS"), ("2026-10-31", "PASS"), ("2026-09-30", "UNKNOWN")]
)
def test_lab_specimen_inclusive_not_record_date(env, day, status):
    rules, rows = context(env)
    rows[2][0].specimen_date = date.fromisoformat(day)
    assert evaluate(rules["PX-INC-03"], date(2026, 10, 31), *rows).status == status


def test_unapproved_rule_rejected(env):
    with env[2]() as session:
        rule = protocol_dto(session, session.get(m.ProtocolVersion, "PV-PX104-1.0")).criteria[0]
    with pytest.raises(Exception):
        evaluate(rule, date(2026, 10, 31), [], [], [], [])


def test_failure_precedence():
    assert aggregate([Result("FAIL"), Result("UNKNOWN")]) == "PROTOCOL_CONFLICT"
    assert aggregate([Result("PASS"), Result("UNKNOWN")]) == "NEEDS_REVIEW"
    assert aggregate([Result("PASS")]) == "POTENTIAL_MATCH"


def test_offset_aware_event_and_uncertain_interval_validation():
    body = event_body()
    body["effective_at"] = "2026-11-19T09:30:00"
    with pytest.raises(ValueError):
        EventCreate.model_validate(body)
    body = event_body()
    body["effective_at"] = None
    body["time_uncertainty"] = dict(
        raw_date="2026-10",
        precision="MONTH",
        possible_interval=dict(
            earliest="2026-11-01T00:00:00+02:00", latest_exclusive="2026-10-01T00:00:00+03:00"
        ),
    )
    with pytest.raises(ValueError):
        EventCreate.model_validate(body)
