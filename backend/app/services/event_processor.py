from datetime import datetime, timedelta

from sqlalchemy import select

from backend.app import models as m
from backend.app.db.base import new_id, now
from backend.app.schemas.dto import EventCreate
from backend.app.services.approval import criteria_for
from backend.app.services.audit import append_audit, digest
from backend.app.services.evaluator import UNIT_FACTORS, Result, unknown
from backend.app.services.evidence import evidence_ref, snapshot
from backend.app.services.screening import save_result


def approved_mapping(session, code):
    return session.scalar(
        select(m.TerminologyMapVersion.mapped_class).where(
            m.TerminologyMapVersion.map_version == "px104-terminology-v1",
            m.TerminologyMapVersion.code == code,
        )
    )


def participation_bounds(session, patient):
    records = list(
        session.scalars(
            select(m.ParticipationRecord)
            .where(m.ParticipationRecord.patient_id == patient.patient_id)
            .order_by(m.ParticipationRecord.decided_at)
        )
    )
    start, end = None, None
    for row in records:
        source = session.get(m.EvidenceSource, row.source_pk)
        if row.to_status == "PARTICIPATING":
            value = source.pages.get("participation_start_at")
            if value:
                start = datetime.fromisoformat(value.replace("Z", "+00:00"))
        elif row.to_status == "ENDED":
            value = source.pages.get("participation_end_at")
            if value:
                end = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return start, end


def relevance(session, event):
    payload = EventCreate.model_validate(event.payload_json)
    patient = session.get(m.Patient, event.patient_id)
    trial = session.get(m.Trial, event.trial_id)
    if not trial.active_protocol_version_id:
        return [], None, "No active protocol"
    start, end = participation_bounds(session, patient)
    if start is None:
        return [], None, "No recorded participation"
    instant = payload.effective_at
    if instant is not None and (instant < start or (end is not None and instant >= end)):
        return [], None, "Outside recorded participation interval"
    rules = criteria_for(session, trial.active_protocol_version_id)
    if payload.medication:
        klass = approved_mapping(session, payload.medication.code)
        if klass == "SYN-CLASS-N":
            return [], None, "Nonrestricted approved medication class"
        if payload.medication.evidence_type in ("DISCONTINUATION", "CANCELLATION"):
            if payload.supersedes_event_id:
                return (
                    [r for r in rules if r.operator == "EVENT_RESTRICTED_USE"],
                    unknown("CONFLICTING_SOURCES", [event]),
                    "Correction to prior use requires source reconciliation",
                )
            return [], None, "Historical use is retained; discontinuation alone is not new use"
        op = (
            "EVENT_ORDER_ONLY"
            if payload.medication.evidence_type in ("ORDER", "DISPENSE")
            else "EVENT_RESTRICTED_USE"
        )
        affected = [r for r in rules if r.operator == op]
        if klass is None:
            return affected, unknown("UNMAPPED_CODE", [event]), "Unknown approved class mapping"
        if instant is None:
            possible = payload.time_uncertainty.possible_interval
            if possible.latest_exclusive <= start or (end and possible.earliest >= end):
                return [], None, "Possible interval outside participation"
            return affected, unknown("DATE_AMBIGUOUS", [event]), "Uncertain use date"
        if payload.evidence_state == "UNCERTAIN":
            return affected, unknown("CONFLICTING_SOURCES", [event]), "Conflicting medication evidence"
        if payload.evidence_quality not in ("HIGH", "MODERATE") or payload.evidence_state != "POSITIVE":
            return affected, unknown("SOURCE_UNAVAILABLE", [event]), "Unverified exposure evidence"
        if op == "EVENT_ORDER_ONLY":
            # Confirmed use of the same mapped class supersedes order-only uncertainty for this interval.
            confirmed = session.scalar(
                select(m.MedicationExposure.exposure_id).where(
                    m.MedicationExposure.patient_id == patient.patient_id,
                    m.MedicationExposure.mapped_class == klass,
                    m.MedicationExposure.evidence_type.in_(["ADMINISTRATION", "REPORTED_USE"]),
                    m.MedicationExposure.evidence_state == "POSITIVE",
                    m.MedicationExposure.effective_at >= start,
                    m.MedicationExposure.medication_code == payload.medication.code,
                    m.MedicationExposure.effective_at == instant,
                )
            )
            if confirmed:
                return [], None, "Corroborating use is already monitored under confirmed-use rule"
            return affected, unknown("ORDER_ONLY", [event]), "Order or dispense is not confirmed ingestion"
        return (
            affected,
            Result("FAIL", evidence=[event], explanation="Confirmed restricted use during participation"),
            "Confirmed protocol restriction",
        )
    if payload.lab and payload.lab.analyte_code == "egfr":
        affected = [r for r in rules if r.operator == "EVENT_LAB_LT"]
        if payload.lab.unit not in UNIT_FACTORS:
            return affected, unknown("UNIT_UNSUPPORTED", [event]), "Unsupported lab unit"
        if instant is None:
            return affected, unknown("DATE_AMBIGUOUS", [event]), "Uncertain specimen time"
        if payload.evidence_quality not in ("HIGH", "MODERATE") or payload.evidence_state != "POSITIVE":
            return affected, unknown("SOURCE_UNAVAILABLE", [event]), "Unverified lab"
        if payload.lab.value * UNIT_FACTORS[payload.lab.unit] < 60:
            return (
                affected,
                Result("FAIL", evidence=[event], explanation="New eGFR below approved monitoring threshold"),
                "Low monitoring lab",
            )
    return [], None, "No affected monitoring criterion"


def persist_event_fact(session, event, payload):
    """Corrections append new evidence and link the superseded record; history stays intact."""
    if payload.medication:
        med = payload.medication
        uncertain = payload.time_uncertainty
        session.add(
            m.MedicationExposure(
                exposure_id=event.event_id,
                patient_id=event.patient_id,
                source_pk=event.source_pk,
                medication_code=med.code,
                mapped_class=approved_mapping(session, med.code),
                map_version="px104-terminology-v1",
                evidence_type=med.evidence_type,
                asserted_start_at=payload.effective_at,
                asserted_end_exclusive_at=med.interval_end_exclusive_at,
                effective_at=payload.effective_at,
                recorded_at=payload.recorded_at,
                ingested_at=event.ingested_at,
                dose_value=med.dose_value,
                dose_unit=med.dose_unit,
                route=med.route,
                last_changed_at=payload.recorded_at,
                stop_reason=None,
                adverse_reactions_json=[],
                evidence_state=payload.evidence_state,
                evidence_quality=payload.evidence_quality,
                verification_status="VERIFIED"
                if payload.evidence_quality in ("HIGH", "MODERATE")
                else "UNVERIFIED",
                date_precision=uncertain.precision if uncertain else "INSTANT",
                possible_start=uncertain.possible_interval.earliest if uncertain else None,
                possible_end_exclusive=uncertain.possible_interval.latest_exclusive if uncertain else None,
                supersedes_exposure_id=event.supersedes_event_id,
            )
        )
    elif payload.lab:
        trial = session.get(m.Trial, event.trial_id)
        from zoneinfo import ZoneInfo

        session.add(
            m.LabObservation(
                lab_id=event.event_id,
                patient_id=event.patient_id,
                source_pk=event.source_pk,
                analyte_code=payload.lab.analyte_code,
                value_num=payload.lab.value,
                unit=payload.lab.unit,
                specimen_at=payload.effective_at,
                specimen_date=payload.effective_at.astimezone(ZoneInfo(trial.site_timezone)).date()
                if payload.effective_at
                else None,
                issued_at=payload.recorded_at,
                effective_at=payload.effective_at,
                recorded_at=payload.recorded_at,
                ingested_at=event.ingested_at,
                evidence_state=payload.evidence_state,
                evidence_quality=payload.evidence_quality,
                verification_status="VERIFIED",
                date_precision=payload.time_uncertainty.precision if payload.time_uncertainty else "INSTANT",
                supersedes_lab_id=event.supersedes_event_id
                if event.supersedes_event_id and session.get(m.LabObservation, event.supersedes_event_id)
                else None,
            )
        )
    elif payload.condition:
        from zoneinfo import ZoneInfo

        trial = session.get(m.Trial, event.trial_id)
        session.add(
            m.ConditionRecord(
                condition_id=event.event_id,
                patient_id=event.patient_id,
                source_pk=event.source_pk,
                code=payload.condition.code,
                display="Synthetic condition event",
                clinical_status=payload.condition.clinical_status,
                effective_at=payload.effective_at,
                onset_date=payload.effective_at.astimezone(ZoneInfo(trial.site_timezone)).date()
                if payload.effective_at
                else None,
                recorded_at=payload.recorded_at,
                ingested_at=event.ingested_at,
                evidence_state=payload.evidence_state,
                evidence_quality=payload.evidence_quality,
                verification_status="VERIFIED"
                if payload.evidence_quality in ("HIGH", "MODERATE")
                else "UNVERIFIED",
                date_precision=payload.time_uncertainty.precision if payload.time_uncertainty else "INSTANT",
                supersedes_condition_id=event.supersedes_event_id
                if event.supersedes_event_id and session.get(m.ConditionRecord, event.supersedes_event_id)
                else None,
            )
        )
    elif payload.observation:
        value = payload.observation.value
        session.add(
            m.ObservationRecord(
                observation_id=event.event_id,
                patient_id=event.patient_id,
                source_pk=event.source_pk,
                kind=payload.observation.kind,
                code="SYN-OBSERVATION",
                numeric_value=value if isinstance(value, (int, float)) else None,
                text_value=value if isinstance(value, str) else None,
                unit=payload.observation.unit,
                interpretation=None,
                observed_at=payload.effective_at,
                effective_at=payload.effective_at,
                recorded_at=payload.recorded_at,
                ingested_at=event.ingested_at,
                evidence_state=payload.evidence_state,
                evidence_quality=payload.evidence_quality,
                verification_status="VERIFIED"
                if payload.evidence_quality in ("HIGH", "MODERATE")
                else "UNVERIFIED",
                date_precision=payload.time_uncertainty.precision if payload.time_uncertainty else "INSTANT",
            )
        )
    elif payload.note:
        from backend.app.services.pdf_extractor import sha256

        session.add(
            m.ClinicalNote(
                note_id=event.event_id,
                patient_id=event.patient_id,
                source_pk=event.source_pk,
                recorded_at=payload.recorded_at,
                body=payload.note.text,
                extraction_status="NOT_ASSESSED",
                narrative_section="event",
                sha256=sha256(payload.note.text.encode()),
            )
        )


def process_event(session, job, settings):
    event = session.get(m.PatientEvent, job.resource_id)
    existing = session.scalar(
        select(m.PatientTrialAssessment).where(m.PatientTrialAssessment.caused_by_event_id == event.event_id)
    )
    if existing:
        return dict(assessment_ids=[existing.assessment_id])
    payload = EventCreate.model_validate(event.payload_json)
    actor = session.get(m.ClinicalActor, job.actor_id)
    affected, result, reason = relevance(session, event)
    persist_event_fact(session, event, payload)
    session.flush()
    if not affected:
        append_audit(
            session,
            actor,
            event.trial_id,
            "EVENT_RELEVANCE",
            "PatientEvent",
            event.event_id,
            job.correlation_id,
            result="NO_ACTION",
            reason=reason,
        )
        return dict(relevance="NO_ACTION", assessment_ids=[], finding_ids=[], case_ids=[])
    version = session.get(m.ProtocolVersion, affected[0].protocol_version_id)
    patient = session.get(m.Patient, event.patient_id)
    stamp = now()
    before = session.scalar(
        select(m.PatientTrialAssessment)
        .where(
            m.PatientTrialAssessment.patient_id == event.patient_id,
            m.PatientTrialAssessment.protocol_version_id == version.protocol_version_id,
            m.PatientTrialAssessment.evaluation_state == "COMPLETE",
        )
        .order_by(m.PatientTrialAssessment.evaluated_at.desc())
    )
    day = (
        payload.effective_at.date()
        if payload.effective_at
        else payload.time_uncertainty.possible_interval.earliest.date()
    )
    snap = snapshot(
        session,
        event.trial_id,
        [event.patient_id],
        max(stamp, payload.recorded_at) + timedelta(microseconds=1),
        day,
        event,
    )
    assessment = m.PatientTrialAssessment(
        assessment_id=new_id("ASM"),
        patient_id=event.patient_id,
        trial_id=event.trial_id,
        protocol_version_id=version.protocol_version_id,
        snapshot_id=snap.snapshot_id,
        screening_run_id=None,
        assessment_type="MONITORING",
        screening_date=None,
        evaluated_at=stamp,
        engine_version=settings.engine_version,
        evaluation_state="COMPLETE",
        candidate_status=None,
        before_assessment_id=before.assessment_id if before else None,
        caused_by_event_id=event.event_id,
        participation_status_at_evaluation=patient.participation_status,
    )
    session.add(assessment)
    session.flush()
    findings, cases = [], []
    for rule in affected:
        save_result(session, assessment, rule, result, stamp)
        if result.status == "UNKNOWN":
            category = (
                "POTENTIAL_SAFETY_REVIEW" if result.reasons == ["ORDER_ONLY"] else "DATA_QUALITY_DISCREPANCY"
            )
        elif rule.operator == "EVENT_LAB_LT":
            category = "POTENTIAL_SAFETY_REVIEW"
        else:
            category = "CONFIRMED_PROTOCOL_CONFLICT"
        priority = "HIGH" if category == "CONFIRMED_PROTOCOL_CONFLICT" else "MEDIUM"
        issue_key = rule.subject + ":" + str(rule.threshold_json)
        case = session.scalar(
            select(m.ReviewCase).where(
                m.ReviewCase.trial_id == event.trial_id,
                m.ReviewCase.patient_id == event.patient_id,
                m.ReviewCase.criterion_row_id == rule.criterion_row_id,
                m.ReviewCase.issue_key == issue_key,
            )
        )
        if not case:
            case = m.ReviewCase(
                case_id=new_id("CASE"),
                trial_id=event.trial_id,
                patient_id=event.patient_id,
                criterion_row_id=rule.criterion_row_id,
                issue_key=issue_key,
                status="OPEN",
                priority=priority,
                revision=1,
                current_summary=result.explanation,
                summary_origin="SYSTEM_DETERMINISTIC",
                opened_at=stamp,
                updated_at=stamp,
            )
            session.add(case)
            session.flush()
        else:
            prior = case.status
            if case.status in ("CLOSED", "RESOLVED"):
                case.status = "REOPENED"
                append_audit(
                    session,
                    actor,
                    event.trial_id,
                    "CASE_REOPENED_NEW_EVIDENCE",
                    "ReviewCase",
                    case.case_id,
                    job.correlation_id,
                    prior=prior,
                    next_state="REOPENED",
                    reason="Material new source event",
                )
            case.revision += 1
            case.updated_at = stamp
        finding = m.MonitoringFinding(
            finding_id=new_id("FIND"),
            trial_id=event.trial_id,
            patient_id=event.patient_id,
            criterion_row_id=rule.criterion_row_id,
            trigger_event_id=event.event_id,
            before_assessment_id=assessment.before_assessment_id,
            after_assessment_id=assessment.assessment_id,
            category=category,
            priority=priority,
            issue_key=issue_key,
            case_id=case.case_id,
            evidence_refs_json=[evidence_ref(session, event).model_dump(mode="json")],
            created_at=stamp,
            fingerprint=digest(
                [
                    event.trial_id,
                    event.patient_id,
                    rule.criterion_row_id,
                    event.source_event_id,
                    event.source_version,
                    category,
                ]
            ),
        )
        session.add(finding)
        findings.append(finding.finding_id)
        cases.append(case.case_id)
        if result.status == "UNKNOWN":
            semantic = digest([event.patient_id, rule.criterion_id, result.reasons])
            task = session.scalar(
                select(m.VerificationTask).where(
                    m.VerificationTask.patient_id == event.patient_id,
                    m.VerificationTask.semantic_key == semantic,
                )
            )
            if not task:
                session.add(
                    m.VerificationTask(
                        task_id=new_id("TASK"),
                        patient_id=event.patient_id,
                        criterion_row_id=rule.criterion_row_id,
                        case_id=case.case_id,
                        reason_code=result.reasons[0],
                        question="Verify unresolved event evidence against the approved protocol",
                        semantic_key=semantic,
                        requested_for_role="INVESTIGATOR",
                        status="OPEN",
                        created_at=stamp,
                    )
                )
    append_audit(
        session,
        actor,
        event.trial_id,
        "MONITORING_EVALUATED",
        "PatientEvent",
        event.event_id,
        job.correlation_id,
        output_ids=[assessment.assessment_id, *findings, *cases],
        reason=reason,
    )
    return dict(
        relevance="RELEVANT", assessment_ids=[assessment.assessment_id], finding_ids=findings, case_ids=cases
    )
