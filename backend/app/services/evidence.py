from zoneinfo import ZoneInfo

from sqlalchemy import select

from backend.app import models as m
from backend.app.core.errors import DomainError
from backend.app.db.base import new_id, now
from backend.app.schemas import dto
from backend.app.services.audit import digest

EVIDENCE_MODELS = (
    m.PatientFact,
    m.ConditionRecord,
    m.MedicationExposure,
    m.LabObservation,
    m.ObservationRecord,
    m.StudyProductExposure,
    m.PriorResearchRecord,
    m.ClinicalNote,
)
EVIDENCE_KEYS = {
    m.PatientFact: "fact_id",
    m.ConditionRecord: "condition_id",
    m.MedicationExposure: "exposure_id",
    m.LabObservation: "lab_id",
    m.ObservationRecord: "observation_id",
    m.StudyProductExposure: "study_exposure_id",
    m.PriorResearchRecord: "research_id",
    m.ClinicalNote: "note_id",
    m.PatientEvent: "event_id",
}


def source_ref(source):
    return dto.SourceRef(
        source_id=source.source_id,
        source_version=source.source_version,
        sha256=source.sha256,
        filename=source.filename,
        mime_type=source.mime_type,
        created_at=source.recorded_at,
        synthetic_only=True,
    )


def evidence_ref(session, row):
    source = session.get(m.EvidenceSource, row.source_pk)
    if not source:
        raise DomainError("SOURCE_UNAVAILABLE", "Evidence has no source", 500)
    span = session.get(m.SourceSpan, getattr(row, "span_id", None)) if getattr(row, "span_id", None) else None
    return dto.EvidenceRef(
        evidence_id=getattr(row, EVIDENCE_KEYS[type(row)]),
        source_id=source.source_id,
        source_version=source.source_version,
        evidence_type=getattr(row, "evidence_type", source.kind),
        effective_at=getattr(row, "effective_at", None),
        recorded_at=row.recorded_at,
        page=span.page if span else None,
        span_start=span.start_offset if span else None,
        span_end=span.end_offset if span else None,
    )


def frozen_rows(session, snapshot_id, model, patient_id):
    key = getattr(model, EVIDENCE_KEYS[model])
    members = select(m.SnapshotEvidenceRef.evidence_id).where(
        m.SnapshotEvidenceRef.snapshot_id == snapshot_id,
        m.SnapshotEvidenceRef.evidence_kind == model.__tablename__,
    )
    return list(session.scalars(select(model).where(model.patient_id == patient_id, key.in_(members))))


def snapshot(session, trial_id, patient_ids, cutoff, day, include_event=None):
    rows = []
    superseded_events = set(
        session.scalars(
            select(m.PatientEvent.supersedes_event_id).where(
                m.PatientEvent.patient_id.in_(patient_ids),
                m.PatientEvent.recorded_at < cutoff,
                m.PatientEvent.ingested_at < cutoff,
                m.PatientEvent.supersedes_event_id.is_not(None),
            )
        )
    )
    for model in EVIDENCE_MODELS:
        query = select(model).where(model.patient_id.in_(patient_ids), model.recorded_at < cutoff)
        if hasattr(model, "ingested_at"):
            query = query.where(model.ingested_at < cutoff)
        selected = list(session.scalars(query))
        superseded = {
            getattr(r, name)
            for r in selected
            for name in (
                "supersedes_fact_id",
                "supersedes_condition_id",
                "supersedes_exposure_id",
                "supersedes_lab_id",
            )
            if getattr(r, name, None)
        }
        rows.extend(
            r for r in selected if getattr(r, EVIDENCE_KEYS[model]) not in superseded | superseded_events
        )
    if include_event:
        rows.append(include_event)
    members = [
        (type(row).__tablename__, getattr(row, EVIDENCE_KEYS[type(row)]), row.source_pk) for row in rows
    ]
    record = m.EvidenceSnapshot(
        snapshot_id=new_id("SNAP"),
        trial_id=trial_id,
        watermark_at=cutoff,
        as_of_date=day,
        source_set_hash=digest(sorted(members)),
    )
    session.add(record)
    session.flush()
    for kind, evidence_id, source_pk in members:
        source = session.get(m.EvidenceSource, source_pk)
        session.add(
            m.SnapshotEvidenceRef(
                snapshot_id=record.snapshot_id,
                evidence_kind=kind,
                evidence_id=evidence_id,
                source_version=source.source_version,
                source_pk=source_pk,
            )
        )
    session.flush()
    return record


def fact_dto(session, row, value=None, unit=None):
    if value is None:
        value = getattr(row, "value_json", None)
    uncertain = None
    if getattr(row, "possible_start", None):
        patient = session.get(m.Patient, row.patient_id)
        trial = session.get(m.Trial, patient.trial_id)
        local_start = row.possible_start.astimezone(ZoneInfo(trial.site_timezone))
        precision = row.date_precision
        raw_date = local_start.strftime(
            "%Y" if precision == "YEAR" else "%Y-%m" if precision == "MONTH" else "%Y-%m-%d"
        )
        event = session.get(m.PatientEvent, getattr(row, EVIDENCE_KEYS[type(row)]))
        if event and event.payload_json.get("time_uncertainty"):
            raw_date = event.payload_json["time_uncertainty"]["raw_date"]
        uncertain = dict(
            raw_date=raw_date,
            precision=row.date_precision,
            possible_interval=dict(earliest=row.possible_start, latest_exclusive=row.possible_end_exclusive),
        )
    return dict(
        fact_id=getattr(row, EVIDENCE_KEYS[type(row)]),
        value=value,
        unit=unit or getattr(row, "unit", None),
        effective_at=getattr(row, "effective_at", None),
        onset_date=getattr(row, "onset_date", None),
        recorded_at=row.recorded_at,
        ingested_at=row.ingested_at,
        source=evidence_ref(session, row),
        evidence_quality=row.evidence_quality,
        evidence_state=row.evidence_state,
        time_uncertainty=uncertain,
        verification_status=row.verification_status,
    )


def med_dto(session, row):
    return dto.MedicationEvidence(
        exposure_id=row.exposure_id,
        medication_code=row.medication_code,
        mapped_class=row.mapped_class,
        evidence_type=row.evidence_type,
        asserted_start_at=row.asserted_start_at,
        asserted_end_exclusive_at=row.asserted_end_exclusive_at,
        dose=fact_dto(session, row, row.dose_value, row.dose_unit) if row.dose_value is not None else None,
        route=fact_dto(session, row, row.route) if row.route else None,
        last_changed_at=row.last_changed_at,
        stop_reason=row.stop_reason,
        adverse_reactions=row.adverse_reactions_json,
        evidence=fact_dto(session, row, row.medication_code),
        source=evidence_ref(session, row),
    )


def patient360(session, patient, cutoff=None):
    historical = cutoff is not None
    cutoff = cutoff or now()

    def get(model):
        query = select(model).where(model.patient_id == patient.patient_id)
        if historical:
            query = query.where(model.recorded_at <= cutoff)
        if historical and hasattr(model, "ingested_at"):
            query = query.where(model.ingested_at <= cutoff)
        return list(session.scalars(query))

    facts = get(m.PatientFact)

    def section(name):
        return [fact_dto(session, f) for f in facts if f.domain_section == name]

    def one(key):
        row = next((f for f in facts if f.fact_key == key), None)
        if not row:
            raise DomainError("SOURCE_UNAVAILABLE", f"Required sourced section unavailable: {key}", 503)
        return fact_dto(session, row)

    conditions = get(m.ConditionRecord)
    diagnosis = [c for c in conditions if c.code == "SYN-CONDITION-A"]
    observations = [
        dict(
            kind="LAB",
            analyte_code=lab.analyte_code,
            observation=fact_dto(session, lab, lab.value_num, lab.unit),
            interpretation=None,
        )
        for lab in get(m.LabObservation)
    ]
    observations += [
        dict(
            kind=o.kind,
            analyte_code=o.code,
            observation=fact_dto(
                session, o, o.numeric_value if o.numeric_value is not None else o.text_value, o.unit
            ),
            interpretation=None,
        )
        for o in get(m.ObservationRecord)
    ]
    notes = get(m.ClinicalNote)
    sources = list(
        session.scalars(
            select(m.EvidenceSource).where(
                m.EvidenceSource.patient_id == patient.patient_id,
                m.EvidenceSource.recorded_at <= cutoff if historical else True,
            )
        )
    )
    assessments = list(
        session.scalars(
            select(m.PatientTrialAssessment)
            .where(
                m.PatientTrialAssessment.patient_id == patient.patient_id,
                m.PatientTrialAssessment.evaluated_at <= cutoff,
            )
            .order_by(m.PatientTrialAssessment.evaluated_at.desc())
        )
    )
    participations = list(
        session.scalars(
            select(m.ParticipationRecord)
            .where(
                m.ParticipationRecord.patient_id == patient.patient_id,
                m.ParticipationRecord.decided_at <= cutoff,
            )
            .order_by(m.ParticipationRecord.decided_at.desc())
        )
    )
    return dto.Patient360(
        patient_id=patient.patient_id,
        trial_id=patient.trial_id,
        synthetic_only=True,
        site_id=patient.site_id,
        screening_snapshot_date=patient.screening_snapshot_date,
        demographics=dict(
            birth_date=one("birth_date"),
            sex_at_birth=one("sex_at_birth"),
            location_jurisdiction=one("location_jurisdiction"),
        ),
        index_disease=dict(
            code="SYN-CONDITION-A",
            diagnosis_criteria=[fact_dto(session, c, c.code) for c in diagnosis],
            severity=one("severity"),
            first_onset=one("first_onset"),
            diagnostic_evidence=[evidence_ref(session, c) for c in diagnosis],
        ),
        medical_conditions=[fact_dto(session, c, c.code) for c in conditions],
        surgeries_hospitalizations=section("surgeries_hospitalizations"),
        family_history=section("family_history"),
        genetics=section("genetics"),
        symptom_history=section("symptom_history"),
        observations=observations,
        medications=[med_dto(session, med) for med in get(m.MedicationExposure)],
        study_product_exposure=dict(blinded=True, assignment_masked=one("assignment_masked"), exposures=[]),
        prior_clinical_research=[
            dict(
                research_id=r.research_id,
                kind=r.kind,
                exposure=fact_dto(session, r, r.exposure_text) if r.exposure_text else None,
                last_dose_at=r.last_dose_at,
                half_life_hours=fact_dto(session, r, r.half_life_hours)
                if r.half_life_hours is not None
                else None,
                completion_status=r.completion_state,
                ongoing_restrictions=[],
                source=evidence_ref(session, r),
            )
            for r in get(m.PriorResearchRecord)
        ],
        procedures_and_imaging=section("procedures_and_imaging"),
        allergies=section("allergies"),
        pregnancy_contraception=section("pregnancy_contraception"),
        decision_capacity=one("decision_capacity"),
        study_partner=one("study_partner"),
        administration_ability=one("administration_ability"),
        encounters=[
            dict(
                encounter_id=e.encounter_id,
                occurred_at=e.occurred_at,
                source_ids=e.source_refs_json,
                summary=e.summary,
            )
            for e in get(m.Encounter)
        ],
        source_document_index=[source_ref(s) for s in sources],
        clinical_narratives=[
            dict(
                note_id=n.note_id,
                recorded_at=n.recorded_at,
                source=evidence_ref(session, n),
                text=n.body,
                extraction_status=n.extraction_status,
            )
            for n in notes
        ],
        open_items=[
            dict(
                open_item_id=i.open_item_id,
                reason_code=i.reason_code,
                description=i.description,
                blocking=i.blocking,
                status=i.status,
                conflicting_evidence_ids=i.conflicting_fact_ids_json,
                requested_for_role=i.requested_for_role,
            )
            for i in session.scalars(select(m.OpenItem).where(m.OpenItem.patient_id == patient.patient_id))
        ],
        participation_status=participations[0].to_status if participations else "NOT_ENROLLED",
        current_assessment_id=assessments[0].assessment_id if assessments else None,
        data_watermark=min(patient.data_watermark, cutoff),
    )
