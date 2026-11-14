from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, UTCDateTime, now


class ClinicalActor(Base):
    __tablename__ = "clinical_actor"
    actor_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    role: Mapped[str] = mapped_column(String(32))
    site_id: Mapped[str] = mapped_column(String(64))
    display_label: Mapped[str] = mapped_column(String(100))
    synthetic_only: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Trial(Base):
    __tablename__ = "trial"
    __table_args__ = (
        CheckConstraint("synthetic_only = 1"),
        CheckConstraint("planned_start_date <= planned_end_date"),
    )
    trial_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(Text)
    fictional_product_code: Mapped[str] = mapped_column(String(64))
    site_id: Mapped[str] = mapped_column(String(64), index=True)
    site_timezone: Mapped[str] = mapped_column(String(64))
    planned_start_date: Mapped[date] = mapped_column(Date)
    planned_end_date: Mapped[date] = mapped_column(Date)
    synthetic_only: Mapped[bool] = mapped_column(Boolean, default=True)
    active_protocol_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("protocol_version.protocol_version_id", use_alter=True)
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    revision: Mapped[int] = mapped_column(default=1)


class EvidenceSource(Base):
    __tablename__ = "evidence_source"
    __table_args__ = (UniqueConstraint("source_id", "source_version"), CheckConstraint("synthetic_only = 1"))
    source_pk: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(64))
    source_version: Mapped[int] = mapped_column(Integer)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    patient_id: Mapped[str | None] = mapped_column(ForeignKey("patient.patient_id"))
    kind: Mapped[str] = mapped_column(String(32))
    filename: Mapped[str] = mapped_column(Text)
    mime_type: Mapped[str] = mapped_column(String(64))
    sha256: Mapped[str] = mapped_column(String(64))
    storage_uri: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime)
    ingested_at: Mapped[datetime] = mapped_column(UTCDateTime)
    synthetic_only: Mapped[bool] = mapped_column(Boolean, default=True)
    # Extracted text is version-bound evidence, not a regenerated fixture substitute.
    pages: Mapped[dict] = mapped_column(JSON, default=dict)


class SourceSpan(Base):
    __tablename__ = "source_span"
    __table_args__ = (CheckConstraint("start_offset >= 0 AND end_offset > start_offset"),)
    span_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"), index=True)
    page: Mapped[int | None]
    start_offset: Mapped[int]
    end_offset: Mapped[int]
    quote: Mapped[str] = mapped_column(Text)
    quote_sha256: Mapped[str] = mapped_column(String(64))


class ProtocolVersion(Base):
    __tablename__ = "protocol_version"
    __table_args__ = (
        UniqueConstraint("trial_id", "label"),
        Index("uq_active_protocol", "trial_id", unique=True, sqlite_where=text("state = 'ACTIVE'")),
        CheckConstraint(
            "state IN ('DRAFT','EXTRACTING','EXTRACTION_REVIEW','EXTRACTION_FAILED','APPROVED','ACTIVE','SUPERSEDED')"
        ),
    )
    protocol_version_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"), index=True)
    label: Mapped[str] = mapped_column(String(100))
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    file_sha256: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(32), default="DRAFT")
    revision: Mapped[int] = mapped_column(default=1)
    approved_set_hash: Mapped[str | None] = mapped_column(String(80))
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    coverage_signed_by: Mapped[str | None] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    coverage_signed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    extraction_job_id: Mapped[str | None] = mapped_column(ForeignKey("job.job_id"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class Criterion(Base):
    __tablename__ = "criterion"
    __table_args__ = (
        UniqueConstraint("protocol_version_id", "criterion_id"),
        CheckConstraint("source_span_start >= 0 AND source_span_end > source_span_start"),
        CheckConstraint(
            "operator IN ('AGE_RANGE_INCLUSIVE','CODE_CONFIRMED','LAB_GTE','ABSENCE_CONFIRMED_ACTIVE','NO_RESTRICTED_USE','EVENT_RESTRICTED_USE','EVENT_ORDER_ONLY','EVENT_LAB_LT')"
        ),
    )
    criterion_row_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    protocol_version_id: Mapped[str] = mapped_column(
        ForeignKey("protocol_version.protocol_version_id"), index=True
    )
    criterion_id: Mapped[str] = mapped_column(String(64))
    type: Mapped[str] = mapped_column(String(20))
    subject: Mapped[str] = mapped_column(String(64))
    operator: Mapped[str] = mapped_column(String(40))
    threshold_json: Mapped[object | None] = mapped_column(JSON)
    unit: Mapped[str | None] = mapped_column(String(64))
    window_json: Mapped[dict | None] = mapped_column(JSON)
    evidence_requirement: Mapped[str] = mapped_column(Text)
    missing_data_policy: Mapped[str] = mapped_column(String(40))
    terminology_map_version: Mapped[str] = mapped_column(String(64))
    logical_group_id: Mapped[str] = mapped_column(String(64))
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    source_page: Mapped[int]
    source_quote: Mapped[str] = mapped_column(Text)
    source_span_start: Mapped[int]
    source_span_end: Mapped[int]
    applicable_site_ids: Mapped[list] = mapped_column(JSON)
    workflow_status: Mapped[str] = mapped_column(String(32))
    ambiguity: Mapped[str | None] = mapped_column(Text)
    revision: Mapped[int] = mapped_column(default=1)
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    approved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class ExtractionCoverage(Base):
    __tablename__ = "coverage_item"
    __table_args__ = (
        UniqueConstraint("protocol_version_id", "section_id", "source_pk", "span_start", "span_end"),
        CheckConstraint("span_start >= 0 AND span_end > span_start"),
    )
    coverage_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    protocol_version_id: Mapped[str] = mapped_column(ForeignKey("protocol_version.protocol_version_id"))
    section_id: Mapped[str] = mapped_column(String(64))
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    page: Mapped[int]
    span_start: Mapped[int]
    span_end: Mapped[int]
    status: Mapped[str] = mapped_column(String(20))
    criterion_ids_json: Mapped[list] = mapped_column(JSON)
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("clinical_actor.actor_id"))


class CriterionApproval(Base):
    __tablename__ = "criterion_approval"
    __table_args__ = (UniqueConstraint("protocol_version_id", "criterion_row_id", "criterion_hash"),)
    approval_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    protocol_version_id: Mapped[str] = mapped_column(ForeignKey("protocol_version.protocol_version_id"))
    criterion_row_id: Mapped[str] = mapped_column(ForeignKey("criterion.criterion_row_id"))
    approver_actor_id: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    criterion_hash: Mapped[str] = mapped_column(String(64))
    coverage_hash: Mapped[str] = mapped_column(String(64))
    approved_at: Mapped[datetime] = mapped_column(UTCDateTime)
    reason: Mapped[str] = mapped_column(Text)


class TerminologyMapVersion(Base):
    __tablename__ = "terminology_map"
    __table_args__ = (UniqueConstraint("map_version", "code"),)
    map_entry_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    map_version: Mapped[str] = mapped_column(String(64))
    code: Mapped[str] = mapped_column(String(64))
    mapped_class: Mapped[str] = mapped_column(String(64))
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    approved_by: Mapped[str] = mapped_column(ForeignKey("clinical_actor.actor_id"))
    approved_at: Mapped[datetime] = mapped_column(UTCDateTime)
