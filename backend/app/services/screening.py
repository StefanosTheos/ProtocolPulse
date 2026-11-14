from sqlalchemy import select

from backend.app import models as m
from backend.app.core.errors import DomainError
from backend.app.db.base import new_id, now
from backend.app.services.approval import criteria_for
from backend.app.services.audit import append_audit
from backend.app.services.evaluator import aggregate, evaluate
from backend.app.services.evidence import evidence_ref, frozen_rows
from backend.app.services.serializers import protocol_dto


def process_screen(session, job, settings):
    run = session.get(m.ScreeningRun, job.resource_id)
    if run.status == "COMPLETE":
        return dict(run_id=run.run_id)
    version = session.get(m.ProtocolVersion, run.protocol_version_id)
    if version.state != "ACTIVE" or version.approved_set_hash != run.approved_set_hash:
        raise DomainError("PROTOCOL_NOT_ACTIVE", "Screening requires the frozen approved version")
    rules = [c for c in protocol_dto(session, version).criteria if c.type != "MONITORING"]
    physical_rules = {c.criterion_id: c for c in criteria_for(session, version.protocol_version_id)}
    counts = {s: 0 for s in ["POTENTIAL_MATCH", "NEEDS_REVIEW", "PROTOCOL_CONFLICT", "EVALUATION_ERROR"]}
    stamp = now()
    for pid in job.request_json["patient_ids"]:
        patient = session.get(m.Patient, pid)
        facts, conditions, labs, meds = [
            frozen_rows(session, run.snapshot_id, model, pid)
            for model in (m.PatientFact, m.ConditionRecord, m.LabObservation, m.MedicationExposure)
        ]
        items = list(session.scalars(select(m.OpenItem).where(m.OpenItem.patient_id == pid)))
        results = [evaluate(rule, run.screening_date, facts, conditions, labs, meds, items) for rule in rules]
        status = aggregate(results)
        assessment = m.PatientTrialAssessment(
            assessment_id=new_id("ASM"),
            patient_id=pid,
            trial_id=run.trial_id,
            protocol_version_id=version.protocol_version_id,
            snapshot_id=run.snapshot_id,
            screening_run_id=run.run_id,
            assessment_type="SCREENING",
            screening_date=run.screening_date,
            evaluated_at=stamp,
            engine_version=settings.engine_version,
            evaluation_state="COMPLETE",
            candidate_status=status,
            participation_status_at_evaluation=patient.participation_status,
        )
        session.add(assessment)
        session.flush()
        for rule, result in zip(rules, results):
            save_result(session, assessment, physical_rules[rule.criterion_id], result, stamp)
        counts[status] += 1
    run.counts_json, run.status, run.completed_at, run.error_code = counts, "COMPLETE", stamp, None
    actor = session.get(m.ClinicalActor, job.actor_id)
    append_audit(
        session,
        actor,
        run.trial_id,
        "SCREENING_COMPLETE",
        "ScreeningRun",
        run.run_id,
        job.correlation_id,
        output_ids=[run.snapshot_id],
    )
    return dict(run_id=run.run_id, counts=counts)


def save_result(session, assessment, rule, result, stamp):
    refs = [evidence_ref(session, row).model_dump(mode="json") for row in result.evidence]
    if result.status != "UNKNOWN" and not refs:
        raise DomainError("SOURCE_UNAVAILABLE", "Decisive result lacks evidence", 500)
    session.add(
        m.CriterionResult(
            criterion_result_id=new_id("RES"),
            assessment_id=assessment.assessment_id,
            criterion_row_id=rule.criterion_row_id,
            status=result.status,
            reason_codes_json=result.reasons,
            evidence_refs_json=refs,
            considered_start_at=result.interval[0] if result.interval else None,
            considered_end_at=result.interval[1] if result.interval else None,
            explanation=result.explanation,
            evaluated_at=stamp,
        )
    )
