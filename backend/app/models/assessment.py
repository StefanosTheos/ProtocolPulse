from datetime import date, datetime

from sqlalchemy import JSON, CheckConstraint, Date, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, UTCDateTime, now


class EvidenceSnapshot(Base):
    __tablename__ = "evidence_snapshot"
    snapshot_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    watermark_at: Mapped[datetime] = mapped_column(UTCDateTime)
    as_of_date: Mapped[date] = mapped_column(Date)
    source_set_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class SnapshotEvidenceRef(Base):
    __tablename__ = "snapshot_evidence"
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("evidence_snapshot.snapshot_id"), primary_key=True)
    evidence_kind: Mapped[str] = mapped_column(String(64), primary_key=True)
    evidence_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_version: Mapped[int] = mapped_column(primary_key=True)
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))


class ScreeningRun(Base):
    __tablename__ = "screening_run"
    run_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    protocol_version_id: Mapped[str] = mapped_column(ForeignKey("protocol_version.protocol_version_id"))
    approved_set_hash: Mapped[str] = mapped_column(String(80))
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("evidence_snapshot.snapshot_id"))
    screening_date: Mapped[date] = mapped_column(Date)
    evidence_cutoff_at: Mapped[datetime] = mapped_column(UTCDateTime)
    engine_version: Mapped[str] = mapped_column(String(64))
    terminology_map_version: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20))
    job_id: Mapped[str] = mapped_column(ForeignKey("job.job_id"))
    patient_count: Mapped[int]
    counts_json: Mapped[dict] = mapped_column(JSON)
    error_code: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class PatientTrialAssessment(Base):
    __tablename__ = "patient_trial_assessment"
    __table_args__ = (
        CheckConstraint("evaluation_state != 'EVALUATION_ERROR' OR candidate_status IS NULL"),
        UniqueConstraint("screening_run_id", "patient_id"),
        UniqueConstraint("caused_by_event_id"),
    )
    assessment_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"), index=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    protocol_version_id: Mapped[str] = mapped_column(ForeignKey("protocol_version.protocol_version_id"))
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("evidence_snapshot.snapshot_id"))
    screening_run_id: Mapped[str | None] = mapped_column(ForeignKey("screening_run.run_id"))
    assessment_type: Mapped[str] = mapped_column(String(20))
    screening_date: Mapped[date | None] = mapped_column(Date)
    evaluated_at: Mapped[datetime] = mapped_column(UTCDateTime)
    engine_version: Mapped[str] = mapped_column(String(64))
    evaluation_state: Mapped[str] = mapped_column(String(32))
    candidate_status: Mapped[str | None] = mapped_column(String(32))
    before_assessment_id: Mapped[str | None] = mapped_column(
        ForeignKey("patient_trial_assessment.assessment_id")
    )
    caused_by_event_id: Mapped[str | None] = mapped_column(ForeignKey("patient_event.event_id"))
    participation_status_at_evaluation: Mapped[str] = mapped_column(String(32))


class CriterionResult(Base):
    __tablename__ = "criterion_result"
    __table_args__ = (
        UniqueConstraint("assessment_id", "criterion_row_id"),
        CheckConstraint("status IN ('PASS','FAIL','UNKNOWN')"),
    )
    criterion_result_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    assessment_id: Mapped[str] = mapped_column(ForeignKey("patient_trial_assessment.assessment_id"))
    criterion_row_id: Mapped[str] = mapped_column(ForeignKey("criterion.criterion_row_id"))
    status: Mapped[str] = mapped_column(String(16))
    reason_codes_json: Mapped[list] = mapped_column(JSON)
    evidence_refs_json: Mapped[list] = mapped_column(JSON)
    considered_start_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    considered_end_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    explanation: Mapped[str] = mapped_column(Text)
    evaluated_at: Mapped[datetime] = mapped_column(UTCDateTime)
