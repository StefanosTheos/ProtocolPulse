"""Explicit, reproducible synthetic seed. Never called by API startup."""

import argparse
import json
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import select, text

from backend.app import models as m
from backend.app.core.config import get_settings
from backend.app.db.base import new_id
from backend.app.db.session import make_engine, session_factory
from backend.app.services.approval import replace_proposal
from backend.app.services.evidence import patient360
from backend.app.services.pdf_extractor import sha256, store_pdf, verified_fixture
from backend.app.services.temporal import local_midnight

PATIENT_IDS = [
    "P-042",
    "P-175",
    "P-124",
    "P-161",
    "P-117",
    "P-118",
    "P-083",
    "P-140",
    "P-151",
    "P-201",
    "P-202",
    "P-203",
    "P-204",
    "P-205",
    "P-206",
]
TRIAL_ID = "TR-PX104"
VERSION_ID = "PV-PX104-1.0"
MAP = "px104-terminology-v1"
STAMP = datetime(2026, 10, 30, 10, tzinfo=timezone.utc)
SITE = "SITE-SYN-01"


def source(session, source_id, body, patient_id=None, kind="OTHER", pages=None):
    data = body if isinstance(body, bytes) else body.encode()
    row = m.EvidenceSource(
        source_pk=new_id("SRC"),
        source_id=source_id,
        source_version=1,
        trial_id=TRIAL_ID,
        patient_id=patient_id,
        kind=kind,
        filename=source_id + (".pdf" if kind == "PDF" else ".txt"),
        mime_type="application/pdf" if kind == "PDF" else "text/plain",
        sha256=sha256(data),
        recorded_at=STAMP,
        ingested_at=STAMP,
        synthetic_only=True,
        pages=pages or {"1": body.decode() if isinstance(body, bytes) else body},
    )
    session.add(row)
    session.flush()
    for key, value in row.pages.items():
        if key.isdigit() and value:
            span = m.SourceSpan(
                span_id=new_id("SPAN"),
                source_pk=row.source_pk,
                page=int(key) if kind == "PDF" else None,
                start_offset=0,
                end_offset=len(value),
                quote=value,
                quote_sha256=sha256(value.encode()),
            )
            session.add(span)
            if key == "1":
                row._seed_span_id = span.span_id
    session.flush()
    return row


def clinical_fields(src, effective=STAMP, state="POSITIVE", quality="HIGH", verification="VERIFIED"):
    return dict(
        patient_id=src.patient_id,
        source_pk=src.source_pk,
        effective_at=effective,
        recorded_at=STAMP,
        ingested_at=STAMP,
        evidence_state=state,
        evidence_quality=quality,
        verification_status=verification,
        date_precision="INSTANT",
        span_id=getattr(src, "_seed_span_id", None),
    )


def seed_patient(session, pid, index):
    birth = date(1968, 6, 15) if pid == "P-042" else date(1970 + index % 10, 3, 12)
    if pid == "P-201":
        birth = date(1990, 1, 1)
    if pid == "P-202":
        birth = date(1940, 1, 1)
    patient = m.Patient(
        patient_id=pid,
        trial_id=TRIAL_ID,
        site_id=SITE,
        synthetic_only=True,
        birth_date=birth,
        sex_at_birth="NOT_RECORDED",
        screening_snapshot_date=date(2026, 10, 31),
        participation_status="NOT_ENROLLED",
        data_watermark=STAMP,
        created_at=STAMP,
    )
    session.add(patient)
    session.flush()
    facts = {}

    def fact(section, key, value, state="POSITIVE", verification="VERIFIED"):
        body = f"SYNTHETIC {pid}: {key}: " + json.dumps(value, ensure_ascii=False)
        src = source(session, f"SRC-{pid}-{key}", body, pid)
        row = m.PatientFact(
            fact_id=f"FACT-{pid}-{key}",
            domain_section=section,
            fact_key=key,
            value_json=value,
            **clinical_fields(src, state=state, verification=verification),
        )
        session.add(row)
        facts[key] = row
        return row

    f = fact("demographics", "birth_date", birth.isoformat())
    f.date_precision = "DAY"
    fact("demographics", "sex_at_birth", None, "NOT_RECORDED")
    fact("demographics", "location_jurisdiction", "Synthetic Athens site; Greece")
    fact("index_disease", "severity", "Synthetic moderate label; no selection restriction")
    fact("index_disease", "first_onset", "2024-06-01")
    for section, key, value, state in [
        ("surgeries_hospitalizations", "surgery_history", None, "NOT_ASSESSED"),
        ("family_history", "family_history", None, "NOT_RECORDED"),
        ("genetics", "genotype", None, "NOT_ASSESSED"),
        (
            "symptom_history",
            "symptom_course",
            "Synthetic symptoms recorded 2024-06; stable at October encounter",
            "POSITIVE",
        ),
        ("procedures_and_imaging", "procedure_review", None, "NOT_ASSESSED"),
        ("allergies", "allergy_review", None, "NOT_ASSESSED"),
        ("pregnancy_contraception", "pregnancy_review", None, "NOT_ASSESSED"),
        ("decision_capacity", "decision_capacity", None, "NOT_ASSESSED"),
        ("study_partner", "study_partner", None, "NOT_RECORDED"),
        ("administration_ability", "administration_ability", None, "NOT_ASSESSED"),
        ("study_product_exposure", "assignment_masked", None, "NOT_APPLICABLE"),
    ]:
        fact(section, key, value, state)
    fact(
        "condition_completeness",
        "excluded_condition_absence",
        dict(as_of_date="2026-10-31", reviewer_actor_id="ACT-INV-01", reviewed_at=STAMP.isoformat()),
        "UNCERTAIN" if pid == "P-205" else "EXPLICITLY_NEGATIVE",
        "UNVERIFIED" if pid == "P-205" else "VERIFIED",
    )
    if pid not in ("P-117", "P-083", "P-140", "P-203", "P-204"):
        fact(
            "medication_reconciliation",
            "no_restricted_use",
            dict(
                coverage_start_at=local_midnight(date(2026, 10, 1)).isoformat(),
                coverage_end_exclusive_at=local_midnight(date(2026, 10, 31)).isoformat(),
                reviewer_actor_id="ACT-INV-01",
                reviewed_at=STAMP.isoformat(),
            ),
            "EXPLICITLY_NEGATIVE",
        )
    condition_src = source(
        session, f"SRC-{pid}-diagnosis", "Synthetic verified SYN-CONDITION-A, active since 2024-06-01", pid
    )
    session.add(
        m.ConditionRecord(
            condition_id=f"COND-{pid}-A",
            code="SYN-CONDITION-A",
            display="Fictional condition A",
            clinical_status="ACTIVE",
            onset_date=date(2024, 6, 1),
            **clinical_fields(condition_src, effective=local_midnight(date(2024, 6, 1))),
        )
    )
    if pid == "P-175":
        src = source(
            session, f"SRC-{pid}-exclusion", "Synthetic confirmed active SYN-EXCLUDED-CONDITION", pid
        )
        session.add(
            m.ConditionRecord(
                condition_id=f"COND-{pid}-X",
                code="SYN-EXCLUDED-CONDITION",
                display="Fictional exclusion",
                clinical_status="ACTIVE",
                onset_date=date(2026, 9, 1),
                **clinical_fields(src),
            )
        )
    values = [(date(2026, 10, 20), 82 if pid == "P-042" else 78)]
    if pid == "P-124":
        values = [(date(2026, 9, 1), 75)]
    if pid == "P-161":
        values = [(date(2026, 10, 20), 54)]
    if pid == "P-206":
        values = [(date(2026, 10, 1), 82), (date(2026, 10, 20), 62), (date(2026, 10, 29), 58)]
    for count, (day, value) in enumerate(values):
        src = source(
            session,
            f"SRC-{pid}-lab-{count}",
            f"Synthetic eGFR specimen {day}: {value} mL/min/1.73m²",
            pid,
            "LAB",
        )
        session.add(
            m.LabObservation(
                lab_id=f"LAB-{pid}-{count}",
                analyte_code="egfr",
                value_num=value,
                unit="mL/min/1.73m²",
                specimen_at=local_midnight(day),
                specimen_date=day,
                issued_at=local_midnight(day),
                **clinical_fields(src, effective=local_midnight(day)),
            )
        )
    # All other measurement domains remain explicitly unassessed, not normal by omission.
    for kind in ("FUNCTIONAL", "PULMONARY", "ECG", "IMAGING", "VITAL"):
        src = source(session, f"SRC-{pid}-{kind}", f"Synthetic {kind} not assessed", pid)
        session.add(
            m.ObservationRecord(
                observation_id=f"OBS-{pid}-{kind}",
                kind=kind,
                code=f"SYN-{kind}",
                numeric_value=None,
                text_value=None,
                unit=None,
                interpretation=None,
                observed_at=None,
                **clinical_fields(src, state="NOT_ASSESSED"),
            )
        )
    medication = {
        "P-117": ("ADMINISTRATION", "2026-10-15", "SYN-MED-R1"),
        "P-118": ("ADMINISTRATION", "2026-09-20", "SYN-MED-R1"),
        "P-083": ("ORDER", "2026-10-15", "SYN-MED-R1"),
        "P-140": ("REPORTED_USE", "2026-10-15", "SYN-MED-R1"),
        "P-203": ("ADMINISTRATION", "2026-10-15", "SYN-MED-U1"),
        "P-204": ("ADMINISTRATION", None, "SYN-MED-R1"),
    }.get(pid)
    if medication:
        kind, day, code = medication
        src = source(
            session,
            f"SRC-{pid}-med",
            f"Synthetic {kind}: {code} on {day or '2026-10 (month precision)'}",
            pid,
            "MEDICATION",
        )
        med = m.MedicationExposure(
            exposure_id=f"MED-{pid}-1",
            medication_code=code,
            mapped_class=None if pid == "P-203" else "SYN-CLASS-R",
            map_version=MAP,
            evidence_type=kind,
            asserted_start_at=local_midnight(date.fromisoformat(day)) if day else None,
            asserted_end_exclusive_at=None,
            dose_value=1,
            dose_unit="synthetic-unit",
            route="ORAL",
            last_changed_at=STAMP,
            stop_reason=None,
            adverse_reactions_json=[],
            **clinical_fields(
                src,
                effective=local_midnight(date.fromisoformat(day)) if day else None,
                state="UNCERTAIN" if pid == "P-140" else "POSITIVE",
                verification="CONFLICTED" if pid == "P-140" else "VERIFIED",
            ),
        )
        if not day:
            med.date_precision, med.possible_start, med.possible_end_exclusive = (
                "MONTH",
                local_midnight(date(2026, 10, 1)),
                local_midnight(date(2026, 11, 1)),
            )
        session.add(med)
    prior_src = source(
        session,
        f"SRC-{pid}-prior",
        "Prior synthetic research not assessed; last dose and half-life unknown",
        pid,
    )
    session.add(
        m.PriorResearchRecord(
            research_id=f"RES-{pid}",
            kind="OBSERVATIONAL",
            exposure_text=None,
            last_dose_at=None,
            half_life_hours=None,
            completion_state="NOT_ASSESSED",
            restrictions_json=[],
            **clinical_fields(prior_src, state="NOT_ASSESSED"),
        )
    )
    trait = {
        "P-042": "The latest dated eGFR is 82. A reviewed no-use reconciliation covers the complete restricted window.",
        "P-175": "A separate verified active exclusion condition is documented and must remain visible.",
        "P-124": "The only available eGFR specimen is stale; a current result must not be invented.",
        "P-161": "The recent eGFR of 54 is below the fictional protocol threshold.",
        "P-117": "Documented restricted administration occurred inside the October lookback.",
        "P-118": "The last administration is September 20; reviewed reconciliation establishes no later use in the window.",
        "P-083": "An October order exists, but administration and ingestion have not been established.",
        "P-140": "One note claims continuing use; another claims use stopped before October. Dates conflict.",
        "P-203": "The medication code is syntactically valid but has no approved class mapping.",
        "P-204": "The administration date has month precision and crosses the exclusion boundary.",
        "P-205": "Exclusion absence has not been verified; missing confirmation is not a negative result.",
        "P-206": "Serial eGFR values decline from 82 to 62 to 58; the latest specimen governs.",
    }.get(pid, "The sourced birth date and routine screening evidence require normal deterministic review.")
    narrative = (
        f"{pid} is a wholly invented patient at the synthetic Athens site. {trait} "
        "The index condition is represented by a verified fictional code with a separate source. "
        "Family history and genetics remain unassessed or unrecorded rather than presumed negative. "
        "Functional, pulmonary, ECG and imaging sections preserve explicit gaps. "
        "Prior research exposure, capacity, study partner and administration ability require further assessment. "
        "No study product has been assigned or administered in this screening record. "
        "These notes are claims for reviewer inspection; structured source evidence and approved rules determine screening. "
        "No clinical enrollment, treatment change or safety conclusion is implied."
    )
    note_src = source(session, f"SRC-{pid}-narrative", narrative, pid, "NOTE")
    session.add(
        m.ClinicalNote(
            note_id=f"NOTE-{pid}",
            patient_id=pid,
            source_pk=note_src.source_pk,
            recorded_at=STAMP,
            body=narrative,
            extraction_status="CONFLICTED" if pid == "P-140" else "REVIEWED",
            narrative_section="summary",
            sha256=sha256(narrative.encode()),
        )
    )
    if pid == "P-140":
        for number, claim in enumerate(
            (
                "Synthetic claim: continuing SYN-MED-R1 use; timing uncertain.",
                "Synthetic claim: stopped SYN-MED-R1 before October; timing uncertain.",
            )
        ):
            src = source(session, f"SRC-{pid}-conflict-{number}", claim, pid, "NOTE")
            session.add(
                m.ClinicalNote(
                    note_id=f"NOTE-{pid}-{number}",
                    patient_id=pid,
                    source_pk=src.source_pk,
                    recorded_at=STAMP,
                    body=claim,
                    extraction_status="CONFLICTED",
                    narrative_section="medication",
                    sha256=sha256(claim.encode()),
                )
            )
        session.add(
            m.OpenItem(
                open_item_id=f"OPEN-{pid}",
                patient_id=pid,
                reason_code="CONFLICTING_SOURCES",
                description="Conflicting continuing/stopped-use claims need reconciliation",
                blocking=True,
                status="OPEN",
                conflicting_fact_ids_json=["NOTE-P-140-0", "NOTE-P-140-1"],
                requested_for_role="INVESTIGATOR",
                created_at=STAMP,
            )
        )
    else:
        session.add(
            m.OpenItem(
                open_item_id=f"OPEN-{pid}",
                patient_id=pid,
                reason_code="SOURCE_UNAVAILABLE",
                description="Long-tail unassessed sections require review; they are not extra eligibility rules",
                blocking=False,
                status="OPEN",
                conflicting_fact_ids_json=[],
                requested_for_role="COORDINATOR",
                created_at=STAMP,
            )
        )
    session.add(
        m.Encounter(
            encounter_id=f"ENC-{pid}",
            patient_id=pid,
            occurred_at=STAMP,
            recorded_at=STAMP,
            ingested_at=STAMP,
            summary="Synthetic pre-screen source review",
            source_refs_json=[note_src.source_id],
            evidence_state="POSITIVE",
            evidence_quality="HIGH",
        )
    )
    # Explicit synthetic external document to support a later investigator-entered participation record.
    source(
        session,
        f"SRC-{pid}-external",
        f"Synthetic external reference EXT-{pid}; participation starts 2026-11-01; ends 2027-01-24",
        pid,
        pages={
            "1": f"Synthetic external reference EXT-{pid}; participation starts 2026-11-01; ends 2027-01-24",
            "participation_start_at": "2026-11-01T00:00:00+02:00",
            "participation_end_at": "2027-01-24T00:00:00+02:00",
        },
    )
    session.flush()
    patient360(session, patient)


def seed_database(factory, storage):
    data, pages, proposal = verified_fixture()
    with factory.begin() as session:
        if session.scalar(select(m.Trial)):
            raise ValueError("Seed requires an empty migrated synthetic database")
        for short, role in [
            ("INV", "INVESTIGATOR"),
            ("COORD", "COORDINATOR"),
            ("MON", "MONITOR"),
            ("AUD", "AUDITOR"),
            ("SPONSOR", "SPONSOR_OPS"),
            ("IT", "RESEARCH_IT"),
        ]:
            session.add(
                m.ClinicalActor(
                    actor_id=f"ACT-{short}-01",
                    role=role,
                    site_id=SITE,
                    display_label=f"Fictional {role}",
                    synthetic_only=True,
                    active=role in ("INVESTIGATOR", "COORDINATOR"),
                )
            )
        session.add(
            m.Trial(
                trial_id=TRIAL_ID,
                title="Fictional PX-104 synthetic study",
                fictional_product_code="PX-104",
                site_id=SITE,
                site_timezone="Europe/Athens",
                planned_start_date=date(2026, 11, 1),
                planned_end_date=date(2027, 1, 24),
                synthetic_only=True,
                created_at=STAMP,
                revision=1,
            )
        )
        session.flush()
        src = source(session, "SRC-PROTOCOL-PX104-V1", data, kind="PDF", pages=pages)
        path, _ = store_pdf(storage, data)
        src.storage_uri = str(path.resolve())
        version = m.ProtocolVersion(
            protocol_version_id=VERSION_ID,
            trial_id=TRIAL_ID,
            label="1.0",
            source_pk=src.source_pk,
            file_sha256=sha256(data),
            state="DRAFT",
            revision=1,
            created_at=STAMP,
        )
        session.add(version)
        session.flush()
        actor = session.get(m.ClinicalActor, "ACT-INV-01")
        replace_proposal(session, version, proposal, actor, str(UUID(int=10415)), reset=True)
        for code, klass in [
            ("SYN-MED-R1", "SYN-CLASS-R"),
            ("SYN-MED-R2", "SYN-CLASS-R"),
            ("SYN-MED-N1", "SYN-CLASS-N"),
        ]:
            session.add(
                m.TerminologyMapVersion(
                    map_entry_id=f"MAP-{code}",
                    map_version=MAP,
                    code=code,
                    mapped_class=klass,
                    source_pk=src.source_pk,
                    approved_by=actor.actor_id,
                    approved_at=STAMP,
                )
            )
        for index, pid in enumerate(PATIENT_IDS):
            seed_patient(session, pid, index)
    return len(PATIENT_IDS)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", choices=["px104-15"], required=True)
    parser.add_argument(
        "--reset-demo",
        action="store_true",
        help="Explicit confirmation to replace the local synthetic dataset",
    )
    args = parser.parse_args()
    settings = get_settings()
    engine = make_engine(settings.database_url)
    if args.reset_demo:
        if not settings.synthetic_data_only:
            raise ValueError("Reset is restricted to synthetic-only mode")
        # Tables remain migrated; FK checks are restored before any new evidence is inserted.
        with engine.connect() as connection:
            if (
                connection.scalar(text("SELECT count(*) FROM sqlite_master WHERE name='alembic_version'"))
                != 1
            ):
                raise ValueError("Run Alembic upgrade head before seed")
            connection.commit()
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            guards = connection.execute(
                text("SELECT name, sql FROM sqlite_master WHERE type='trigger'")
            ).all()
            for name, _ in guards:
                if not name.replace("_", "").isalnum():
                    raise ValueError("Unexpected trigger identifier")
                connection.exec_driver_sql(f'DROP TRIGGER "{name}"')
            for table in reversed(list(m.Base.metadata.tables.values())):
                connection.execute(table.delete())
            for _, sql in guards:
                connection.exec_driver_sql(sql)
            connection.commit()
            connection.exec_driver_sql("PRAGMA foreign_keys=ON")
    count = seed_database(session_factory(engine), settings.protocol_storage_dir)
    print(
        f"Seeded {count} synthetic patients; protocol DRAFT; 8 unapproved proposals; no screening or enrollment."
    )


if __name__ == "__main__":
    main()
