from datetime import date, datetime

from sqlalchemy import JSON, Boolean, CheckConstraint, Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.base import Base, UTCDateTime, now


class Patient(Base):
    __tablename__ = "patient"
    __table_args__ = (CheckConstraint("synthetic_only = 1"),)
    patient_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"), index=True)
    site_id: Mapped[str] = mapped_column(String(64))
    synthetic_only: Mapped[bool] = mapped_column(Boolean, default=True)
    birth_date: Mapped[date | None] = mapped_column(Date)
    sex_at_birth: Mapped[str | None] = mapped_column(String(40))
    screening_snapshot_date: Mapped[date] = mapped_column(Date)
    participation_status: Mapped[str] = mapped_column(String(32), default="NOT_ENROLLED")
    data_watermark: Mapped[datetime] = mapped_column(UTCDateTime)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)


class ClinicalEvidence:
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"), index=True)
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    span_id: Mapped[str | None] = mapped_column(ForeignKey("source_span.span_id"))
    effective_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime)
    ingested_at: Mapped[datetime] = mapped_column(UTCDateTime)
    evidence_state: Mapped[str] = mapped_column(String(32))
    evidence_quality: Mapped[str] = mapped_column(String(20))
    verification_status: Mapped[str] = mapped_column(String(20), default="VERIFIED")
    date_precision: Mapped[str] = mapped_column(String(20), default="INSTANT")
    possible_start: Mapped[datetime | None] = mapped_column(UTCDateTime)
    possible_end_exclusive: Mapped[datetime | None] = mapped_column(UTCDateTime)


class PatientFact(ClinicalEvidence, Base):
    __tablename__ = "patient_fact"
    fact_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    domain_section: Mapped[str] = mapped_column(String(64), index=True)
    fact_key: Mapped[str] = mapped_column(String(64))
    value_json: Mapped[object | None] = mapped_column(JSON)
    unit: Mapped[str | None] = mapped_column(String(64))
    onset_date: Mapped[date | None] = mapped_column(Date)
    supersedes_fact_id: Mapped[str | None] = mapped_column(ForeignKey("patient_fact.fact_id"))


class ConditionRecord(ClinicalEvidence, Base):
    __tablename__ = "condition_record"
    condition_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(64), index=True)
    display: Mapped[str] = mapped_column(Text)
    clinical_status: Mapped[str] = mapped_column(String(20))
    onset_date: Mapped[date | None] = mapped_column(Date)
    abatement_date: Mapped[date | None] = mapped_column(Date)
    supersedes_condition_id: Mapped[str | None] = mapped_column(ForeignKey("condition_record.condition_id"))


class MedicationExposure(ClinicalEvidence, Base):
    __tablename__ = "medication_exposure"
    __table_args__ = (
        CheckConstraint(
            "asserted_end_exclusive_at IS NULL OR asserted_start_at IS NULL OR asserted_end_exclusive_at > asserted_start_at"
        ),
    )
    exposure_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    medication_code: Mapped[str] = mapped_column(String(64), index=True)
    mapped_class: Mapped[str | None] = mapped_column(String(64), index=True)
    map_version: Mapped[str] = mapped_column(String(64))
    evidence_type: Mapped[str] = mapped_column(String(32))
    asserted_start_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    asserted_end_exclusive_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    dose_value: Mapped[float | None]
    dose_unit: Mapped[str | None] = mapped_column(String(64))
    route: Mapped[str | None] = mapped_column(String(40))
    last_changed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    stop_reason: Mapped[str | None] = mapped_column(Text)
    adverse_reactions_json: Mapped[list] = mapped_column(JSON, default=list)
    supersedes_exposure_id: Mapped[str | None] = mapped_column(ForeignKey("medication_exposure.exposure_id"))


class StudyProductExposure(ClinicalEvidence, Base):
    __tablename__ = "study_product_exposure"
    __table_args__ = (CheckConstraint("blinded = 1"),)
    study_exposure_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    trial_id: Mapped[str] = mapped_column(ForeignKey("trial.trial_id"))
    masked_label: Mapped[str] = mapped_column(String(64))
    blinded: Mapped[bool] = mapped_column(Boolean, default=True)
    administration_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    dose_value: Mapped[float | None]
    dose_unit: Mapped[str | None] = mapped_column(String(64))


class LabObservation(ClinicalEvidence, Base):
    __tablename__ = "lab_observation"
    __table_args__ = (CheckConstraint("value_num IS NULL OR (unit IS NOT NULL AND length(unit)>0)"),)
    lab_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    analyte_code: Mapped[str] = mapped_column(String(64), index=True)
    value_num: Mapped[float | None]
    unit: Mapped[str | None] = mapped_column(String(64))
    specimen_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    specimen_date: Mapped[date | None] = mapped_column(Date)
    issued_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    supersedes_lab_id: Mapped[str | None] = mapped_column(ForeignKey("lab_observation.lab_id"))


class ObservationRecord(ClinicalEvidence, Base):
    __tablename__ = "observation_record"
    observation_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))
    code: Mapped[str] = mapped_column(String(64))
    numeric_value: Mapped[float | None]
    text_value: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str | None] = mapped_column(String(64))
    interpretation: Mapped[str | None] = mapped_column(Text)
    observed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class ClinicalNote(Base):
    __tablename__ = "clinical_note"
    note_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"), index=True)
    source_pk: Mapped[str] = mapped_column(ForeignKey("evidence_source.source_pk"))
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime)
    body: Mapped[str] = mapped_column(Text)
    extraction_status: Mapped[str] = mapped_column(String(32))
    narrative_section: Mapped[str] = mapped_column(String(64))
    sha256: Mapped[str] = mapped_column(String(64))


class PriorResearchRecord(ClinicalEvidence, Base):
    __tablename__ = "prior_research"
    research_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32))
    exposure_text: Mapped[str | None] = mapped_column(Text)
    last_dose_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    half_life_hours: Mapped[float | None]
    completion_state: Mapped[str] = mapped_column(String(32))
    restrictions_json: Mapped[list] = mapped_column(JSON, default=list)


class Encounter(Base):
    __tablename__ = "encounter"
    encounter_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"))
    occurred_at: Mapped[datetime] = mapped_column(UTCDateTime)
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime)
    ingested_at: Mapped[datetime] = mapped_column(UTCDateTime)
    summary: Mapped[str] = mapped_column(Text)
    source_refs_json: Mapped[list] = mapped_column(JSON)
    evidence_state: Mapped[str] = mapped_column(String(32))
    evidence_quality: Mapped[str] = mapped_column(String(20))


class OpenItem(Base):
    __tablename__ = "open_item"
    open_item_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patient.patient_id"), index=True)
    criterion_row_id: Mapped[str | None] = mapped_column(ForeignKey("criterion.criterion_row_id"))
    reason_code: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(Text)
    blocking: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    conflicting_fact_ids_json: Mapped[list] = mapped_column(JSON, default=list)
    requested_for_role: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=now)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    resolution_source_pk: Mapped[str | None] = mapped_column(ForeignKey("evidence_source.source_pk"))
