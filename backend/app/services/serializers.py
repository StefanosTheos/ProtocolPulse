from sqlalchemy import select

from backend.app import models as m
from backend.app.schemas import dto
from backend.app.services.approval import coverage_dict, coverage_for, criteria_for, draft_dict
from backend.app.services.evidence import source_ref


def trial_dto(row):
    return dto.Trial(**{key: getattr(row, key) for key in dto.Trial.model_fields})


def protocol_dto(session, row):
    criteria = []
    for c in criteria_for(session, row.protocol_version_id):
        item = draft_dict(session, c)
        item.update(
            workflow_status=c.workflow_status,
            revision=c.revision,
            approved_by=c.approved_by,
            approved_at=c.approved_at,
        )
        criteria.append(dto.Criterion(**item))
    coverage = [coverage_dict(session, c) for c in coverage_for(session, row.protocol_version_id)]
    return dto.ProtocolDetail(
        protocol_version_id=row.protocol_version_id,
        trial_id=row.trial_id,
        label=row.label,
        state=row.state,
        revision=row.revision,
        source=source_ref(session.get(m.EvidenceSource, row.source_pk)),
        file_sha256=row.file_sha256,
        criteria=criteria,
        coverage=coverage,
        coverage_signed_by=row.coverage_signed_by,
        coverage_signed_at=row.coverage_signed_at,
        approved_set_hash=row.approved_set_hash,
        approved_at=row.approved_at,
        extraction_job_id=row.extraction_job_id,
        blocking_count=sum(c["status"] == "BLOCKING" for c in coverage),
    )


def job_receipt(row):
    return dto.JobReceipt(
        job_id=row.job_id,
        kind=row.kind,
        status=row.status,
        resource_id=row.resource_id,
        correlation_id=row.correlation_id,
        poll_url=f"/api/v1/jobs/{row.job_id}",
        created_at=row.created_at,
    )


def job_detail(row):
    return dto.JobDetail(
        **job_receipt(row).model_dump(),
        attempts=row.attempts,
        max_attempts=row.max_attempts,
        started_at=row.started_at,
        finished_at=row.finished_at,
        progress_percent=row.progress_percent,
        result=row.result_json,
        error=dict(
            code=row.error_code, message="Background work failed", retryable=row.attempts < row.max_attempts
        )
        if row.error_code
        else None,
    )


def run_dto(row):
    data = {
        key: getattr(row, key)
        for key in dto.ScreeningRun.model_fields
        if key not in ("evidence_snapshot_id", "counts", "stale")
    }
    return dto.ScreeningRun(
        **data, evidence_snapshot_id=row.snapshot_id, counts=row.counts_json, stale=row.status == "FAILED"
    )


def assessment_dto(session, row):
    version = session.get(m.ProtocolVersion, row.protocol_version_id)
    results = []
    for result in session.scalars(
        select(m.CriterionResult).where(m.CriterionResult.assessment_id == row.assessment_id)
    ):
        c = session.get(m.Criterion, result.criterion_row_id)
        interval = (
            dict(start=result.considered_start_at, end=result.considered_end_at)
            if result.considered_start_at
            else None
        )
        results.append(
            dto.CriterionResult(
                criterion_result_id=result.criterion_result_id,
                criterion_id=c.criterion_id,
                protocol_version_id=c.protocol_version_id,
                status=result.status,
                reason_codes=result.reason_codes_json,
                evidence_refs=result.evidence_refs_json,
                considered_interval=interval,
                explanation=result.explanation,
                evaluated_at=result.evaluated_at,
            )
        )
    findings = list(
        session.scalars(
            select(m.MonitoringFinding.finding_id).where(
                m.MonitoringFinding.after_assessment_id == row.assessment_id
            )
        )
    )
    pending = session.scalar(
        select(m.Job.job_id).where(
            m.Job.trial_id == row.trial_id,
            m.Job.status.in_(["QUEUED", "RUNNING", "FAILED"]),
            m.Job.kind == "INGEST_EVENT",
            m.Job.resource_id.in_(
                select(m.PatientEvent.event_id).where(m.PatientEvent.patient_id == row.patient_id)
            ),
        )
    )
    failed_run = session.scalar(
        select(m.ScreeningRun.run_id).where(
            m.ScreeningRun.trial_id == row.trial_id,
            m.ScreeningRun.status == "FAILED",
            m.ScreeningRun.created_at > row.evaluated_at,
        )
    )
    return dto.PatientAssessment(
        assessment_id=row.assessment_id,
        run_id=row.screening_run_id,
        trial_id=row.trial_id,
        patient_id=row.patient_id,
        protocol_version_id=row.protocol_version_id,
        approved_set_hash=version.approved_set_hash,
        evidence_snapshot_id=row.snapshot_id,
        assessment_type=row.assessment_type,
        screening_date=row.screening_date,
        evaluation_at=row.evaluated_at,
        evaluation_state=row.evaluation_state,
        candidate_status=row.candidate_status,
        criteria=sorted(results, key=lambda r: r.criterion_id),
        before_assessment_id=row.before_assessment_id,
        caused_by_event_id=row.caused_by_event_id,
        related_finding_ids=findings,
        evidence_completeness_percent=100 * sum(r.status != "UNKNOWN" for r in results) / len(results)
        if results
        else None,
        participation_status=row.participation_status_at_evaluation,
        stale=bool(pending or failed_run or row.evaluation_state == "EVALUATION_ERROR"),
    )


def finding_dto(session, row):
    rule = session.get(m.Criterion, row.criterion_row_id)
    return dto.MonitoringFinding(
        finding_id=row.finding_id,
        trial_id=row.trial_id,
        patient_id=row.patient_id,
        protocol_version_id=rule.protocol_version_id,
        criterion_id=rule.criterion_id,
        triggering_event_id=row.trigger_event_id,
        before_assessment_id=row.before_assessment_id,
        after_assessment_id=row.after_assessment_id,
        category=row.category,
        priority=row.priority,
        case_id=row.case_id,
        evidence_refs=row.evidence_refs_json,
        issue_key=row.issue_key,
        created_at=row.created_at,
    )


def case_dto(session, row):
    rule = session.get(m.Criterion, row.criterion_row_id)
    decisions = [
        dto.ReviewDecision(
            decision_id=d.decision_id,
            actor_id=d.actor_id,
            actor_role=d.actor_role,
            from_status=d.from_status,
            to_status=d.to_status,
            disposition=d.disposition,
            rationale=d.rationale,
            cited_evidence_ids=d.cited_evidence_ids_json,
            decided_at=d.decided_at,
        )
        for d in session.scalars(
            select(m.ReviewDecision)
            .where(m.ReviewDecision.case_id == row.case_id)
            .order_by(m.ReviewDecision.decided_at)
        )
    ]
    return dto.ReviewCase(
        case_id=row.case_id,
        trial_id=row.trial_id,
        patient_id=row.patient_id,
        protocol_version_id=rule.protocol_version_id,
        criterion_id=rule.criterion_id,
        issue_key=row.issue_key,
        status=row.status,
        priority=row.priority,
        assigned_actor_id=row.assigned_actor_id,
        finding_ids=list(
            session.scalars(
                select(m.MonitoringFinding.finding_id).where(m.MonitoringFinding.case_id == row.case_id)
            )
        ),
        current_summary=row.current_summary,
        summary_origin=row.summary_origin,
        agent_execution_id=row.agent_execution_id,
        revision=row.revision,
        opened_at=row.opened_at,
        updated_at=row.updated_at,
        decisions=decisions,
    )


def audit_dto(row):
    data = {key: getattr(row, key) for key in dto.AuditEntry.model_fields if key != "output_ref_ids"}
    return dto.AuditEntry(**data, output_ref_ids=row.output_ref_ids_json)


def execution_dto(row):
    return dto.AgentExecution(
        execution_id=row.execution_id,
        role=row.role,
        status=row.status,
        trial_id=row.trial_id,
        patient_id=row.patient_id,
        protocol_version_id=row.protocol_version_id,
        criterion_ids=row.criterion_ids_json,
        event_id=row.event_id,
        correlation_id=row.correlation_id,
        evidence_refs=row.evidence_refs_json,
        summary=row.summary,
        unknown_reasons=row.unknown_reasons_json,
        verification_questions=row.verification_questions_json,
        trace=row.trace_json,
        error_code=row.error_code,
        model_id=row.model_id,
        created_at=row.created_at,
        finished_at=row.finished_at,
    )
