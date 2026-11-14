from datetime import datetime

from sqlalchemy import JSON, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, UTCDateTime, now


class PatientEvent(Base):
    __tablename__ = "patient_event"
    __table_args__ = (UniqueConstraint("patient_id", "source_event_id", "source_version"),)
    event_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"), index=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    source_event_id: Mapped[str] = mapped_column(String(64))
    source_version: Mapped[int]
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    event_kind: Mapped[str] = mapped_column(String(32))
    effective_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime)
    ingested_at: Mapped[datetime] = mapped_column(UTCDateTime)
    date_precision: Mapped[str] = mapped_column(String(20))
    possible_interval_json: Mapped[dict | None] = mapped_column(JSON)
    payload_json: Mapped[dict] = mapped_column(JSON)
    payload_hash: Mapped[str] = mapped_column(String(64))
    supersedes_event_id: Mapped[str | None] = mapped_column(ForeignKey("patient_event.event_id"))
    job_id: Mapped[str] = mapped_column(ForeignKey("job.job_id"))


class ReviewCase(Base):
    __tablename__ = "review_case"
    __table_args__ = (UniqueConstraint("trial_id", "patient_id", "criterion_row_id", "issue_key"),)
    case_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"), index=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    criterion_row_id: Mapped[str] = mapped_column(ForeignKey("criterion.criterion_row_id"))
    issue_key: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32))
    priority: Mapped[str] = mapped_column(String(16))
    assigned_actor_id: Mapped[str | None] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    revision: Mapped[int] = mapped_column(default=1)
    agent_execution_id: Mapped[str | None] = mapped_column(ForeignKey("agent_execution.execution_id"))
    current_summary: Mapped[str | None] = mapped_column(Text)
    summary_origin: Mapped[str | None] = mapped_column(String(32))
    opened_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class MonitoringFinding(Base):
    __tablename__ = "monitoring_finding"
    finding_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    criterion_row_id: Mapped[str] = mapped_column(ForeignKey("criterion.criterion_row_id"))
    trigger_event_id: Mapped[str] = mapped_column(ForeignKey("patient_event.event_id"))
    before_assessment_id: Mapped[str | None] = mapped_column(
        ForeignKey("patient_trial_assessment.assessment_id")
    )
    after_assessment_id: Mapped[str] = mapped_column(ForeignKey("patient_trial_assessment.assessment_id"))
    category: Mapped[str] = mapped_column(String(40))
    priority: Mapped[str] = mapped_column(String(16))
    issue_key: Mapped[str] = mapped_column(String(100))
    case_id: Mapped[str] = mapped_column(ForeignKey("review_case.case_id"))
    evidence_refs_json: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True)


class ReviewDecision(Base):
    __tablename__ = "review_decision"
    decision_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    case_id: Mapped[str] = mapped_column(ForeignKey("review_case.case_id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    actor_role: Mapped[str] = mapped_column(String(32))
    from_status: Mapped[str | None] = mapped_column(String(32))
    to_status: Mapped[str | None] = mapped_column(String(32))
    disposition: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    cited_evidence_ids_json: Mapped[list] = mapped_column(JSON)
    decided_at: Mapped[datetime] = mapped_column(UTCDateTime)
    correlation_id: Mapped[str] = mapped_column(String(64))


class ScreeningDisposition(Base):
    __tablename__ = "screening_disposition"
    disposition_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    assessment_id: Mapped[str] = mapped_column(ForeignKey("patient_trial_assessment.assessment_id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    disposition: Mapped[str] = mapped_column(String(64))
    rationale: Mapped[str] = mapped_column(Text)
    cited_evidence_ids_json: Mapped[list] = mapped_column(JSON)
    decided_at: Mapped[datetime] = mapped_column(UTCDateTime)


class ParticipationRecord(Base):
    __tablename__ = "participation_record"
    __table_args__ = (UniqueConstraint("trial_id", "external_record_reference"),)
    participation_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    from_status: Mapped[str] = mapped_column(String(32))
    to_status: Mapped[str] = mapped_column(String(32))
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    external_record_reference: Mapped[str] = mapped_column(Text)
    rationale: Mapped[str] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(UTCDateTime)


class VerificationTask(Base):
    __tablename__ = "verification_task"
    __table_args__ = (UniqueConstraint("patient_id", "semantic_key"),)
    task_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    criterion_row_id: Mapped[str | None] = mapped_column(ForeignKey("criterion.criterion_row_id"))
    case_id: Mapped[str | None] = mapped_column(ForeignKey("review_case.case_id"))
    reason_code: Mapped[str] = mapped_column(String(64))
    question: Mapped[str] = mapped_column(Text)
    semantic_key: Mapped[str] = mapped_column(String(128))
    requested_for_role: Mapped[str] = mapped_column(String(32))
    created_by_execution_id: Mapped[str | None] = mapped_column(ForeignKey("agent_execution.execution_id"))
    status: Mapped[str] = mapped_column(String(16), default="OPEN")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class AgentExecution(Base):
    __tablename__ = "agent_execution"
    execution_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    role: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(32))
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    patient_id: Mapped[str | None] = mapped_column(ForeignKey("patient.patient_id"))
    protocol_version_id: Mapped[str] = mapped_column(ForeignKey("protocol_version.protocol_version_id"))
    criterion_ids_json: Mapped[list] = mapped_column(JSON)
    event_id: Mapped[str | None] = mapped_column(ForeignKey("patient_event.event_id"))
    correlation_id: Mapped[str] = mapped_column(String(64))
    model_id: Mapped[str | None] = mapped_column(String(100))
    summary: Mapped[str | None] = mapped_column(Text)
    trace_json: Mapped[list] = mapped_column(JSON, default=list)
    unknown_reasons_json: Mapped[list] = mapped_column(JSON, default=list)
    evidence_refs_json: Mapped[list] = mapped_column(JSON, default=list)
    verification_questions_json: Mapped[list] = mapped_column(JSON, default=list)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class Job(Base):
    __tablename__ = "job"
    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(20), index=True)
    trial_id: Mapped[str | None] = mapped_column(ForeignKey("trial.trial_id"))
    actor_id: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    resource_id: Mapped[str | None] = mapped_column(String(64))
    request_json: Mapped[dict] = mapped_column(JSON)
    result_json: Mapped[dict | None] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(default=0)
    max_attempts: Mapped[int] = mapped_column(default=3)
    lease_until: Mapped[datetime | None] = mapped_column(UTCDateTime, index=True)
    progress_percent: Mapped[float | None]
    correlation_id: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    finished_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class IdempotencyRecord(Base):
    __tablename__ = "idempotency_record"
    __table_args__ = (UniqueConstraint("actor_id", "operation_id", "key"),)
    idem_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    operation_id: Mapped[str] = mapped_column(String(200))
    key: Mapped[str] = mapped_column(String(128))
    request_hash: Mapped[str] = mapped_column(String(64))
    response_status: Mapped[int]
    response_body_json: Mapped[dict] = mapped_column(JSON)
    resource_id: Mapped[str | None] = mapped_column(String(64))
    job_id: Mapped[str | None] = mapped_column(ForeignKey("job.job_id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class AuditEntry(Base):
    __tablename__ = "audit_entry"
    audit_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    actor_role: Mapped[str] = mapped_column(String(32))
    action: Mapped[str] = mapped_column(String(100))
    target_type: Mapped[str] = mapped_column(String(64))
    target_id: Mapped[str] = mapped_column(String(64))
    target_version: Mapped[str | None] = mapped_column(String(64))
    request_id: Mapped[str] = mapped_column(String(64))
    correlation_id: Mapped[str] = mapped_column(String(64), index=True)
    input_hash: Mapped[str | None] = mapped_column(String(64))
    output_ref_ids_json: Mapped[list] = mapped_column(JSON)
    result_code: Mapped[str] = mapped_column(String(64))
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now, index=True)
    prior_state: Mapped[str | None] = mapped_column(String(32))
    next_state: Mapped[str | None] = mapped_column(String(32))
    reason: Mapped[str | None] = mapped_column(Text)
