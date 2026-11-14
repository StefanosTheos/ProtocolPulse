import asyncio
from datetime import timedelta
from pathlib import Path

from backend.app import models as m
from backend.app.core.errors import DomainError
from backend.app.db.base import new_id, now
from backend.app.services.approval import replace_proposal
from backend.app.services.audit import append_audit
from backend.app.services.event_processor import process_event
from backend.app.services.pdf_extractor import parse_pdf, sha256, verified_fixture
from backend.app.services.screening import process_screen
from sqlalchemy import or_, select, update


def enqueue(session, kind, trial_id, resource_id, request, actor, correlation, settings):
    job = m.Job(
        job_id=new_id("JOB"),
        kind=kind,
        status="QUEUED",
        trial_id=trial_id,
        actor_id=actor.actor_id,
        resource_id=resource_id,
        request_json=request,
        attempts=0,
        max_attempts=settings.job_max_attempts,
        correlation_id=correlation,
        created_at=now(),
    )
    session.add(job)
    session.flush()
    return job


def process_extract(session, job):
    version = session.get(m.ProtocolVersion, job.resource_id)
    if version.approved_set_hash:
        raise DomainError("VERSION_ALREADY_ACTIVE", "Approved source is immutable")
    source = session.get(m.EvidenceSource, version.source_pk)
    data = Path(source.storage_uri).read_bytes()
    if sha256(data) != source.sha256:
        raise DomainError("SOURCE_UNAVAILABLE", "Private source checksum mismatch")
    pages = parse_pdf(data)
    source.pages = pages
    fixture_bytes, _, proposal = verified_fixture()
    if sha256(data) != sha256(fixture_bytes):
        raise DomainError(
            "EXTRACTION_FAILED",
            "No reviewed curated proposal exists for this source; manual source review required",
            422,
        )
    # This is always labeled curated, including when the optional model is enabled.
    # Live source discovery is a separate agent investigation, not fabricated here.
    proposal = proposal.model_copy(deep=True)
    for c in proposal.criteria:
        c.protocol_version_id = version.protocol_version_id
        c.source_id = source.source_id
    for c in proposal.coverage:
        c.source_id = source.source_id
        c.review_note = "Curated fixture proposal; not AI-generated; investigator review required."
    actor = session.get(m.ClinicalActor, job.actor_id)
    replace_proposal(session, version, proposal, actor, job.correlation_id)
    append_audit(
        session,
        actor,
        job.trial_id,
        "CURATED_PROPOSAL_LOADED",
        "ProtocolVersion",
        version.protocol_version_id,
        job.correlation_id,
        reason="Non-AI curated proposal; actual source hash and text validated; investigator review required",
    )
    return dict(
        protocol_version_id=version.protocol_version_id,
        proposal_origin="CURATED_FIXTURE",
        agent_status="UNAVAILABLE",
    )


class JobRunner:
    def __init__(self, factory, settings):
        self.factory, self.settings = factory, settings
        self.running = False
        self.task = None

    def claim(self):
        stamp = now()
        with self.factory.begin() as session:
            exhausted = list(
                session.scalars(
                    select(m.Job).where(
                        m.Job.status == "RUNNING",
                        m.Job.lease_until <= stamp,
                        m.Job.attempts >= m.Job.max_attempts,
                    )
                )
            )
            for failed in exhausted:
                if failed.kind == "SCREEN_COHORT":
                    run = session.get(m.ScreeningRun, failed.resource_id)
                    if run and run.status != "COMPLETE":
                        run.status, run.error_code = "FAILED", "LEASE_EXHAUSTED"
                if failed.kind == "PROTOCOL_EXTRACT":
                    version = session.get(m.ProtocolVersion, failed.resource_id)
                    if version and version.state == "EXTRACTING":
                        version.state = "EXTRACTION_FAILED"
            session.execute(
                update(m.Job)
                .where(
                    m.Job.status == "RUNNING", m.Job.lease_until <= stamp, m.Job.attempts >= m.Job.max_attempts
                )
                .values(status="FAILED", error_code="LEASE_EXHAUSTED", finished_at=stamp)
            )
            job_id = session.scalar(
                select(m.Job.job_id)
                .where(
                    or_(m.Job.status == "QUEUED", (m.Job.status == "RUNNING") & (m.Job.lease_until <= stamp)),
                    m.Job.attempts < m.Job.max_attempts,
                    or_(m.Job.lease_until.is_(None), m.Job.lease_until <= stamp),
                )
                .order_by(m.Job.created_at, m.Job.job_id)
                .limit(1)
            )
            if not job_id:
                return None
            result = session.execute(
                update(m.Job)
                .where(
                    m.Job.job_id == job_id,
                    or_(m.Job.status == "QUEUED", (m.Job.status == "RUNNING") & (m.Job.lease_until <= stamp)),
                )
                .values(
                    status="RUNNING",
                    attempts=m.Job.attempts + 1,
                    lease_until=stamp + timedelta(seconds=self.settings.job_lease_seconds),
                    started_at=stamp,
                    progress_percent=0,
                )
            )
            if result.rowcount == 1:
                claimed = session.get(m.Job, job_id)
                if claimed.kind == "SCREEN_COHORT":
                    run = session.get(m.ScreeningRun, claimed.resource_id)
                    if run.status != "COMPLETE":
                        run.status = "RUNNING"
                return job_id
            return None

    async def run_once(self):
        job_id = self.claim()
        if not job_id:
            return False
        try:
            with self.factory() as session:
                kind = session.get(m.Job, job_id).kind
            if kind == "AGENT_INVESTIGATION":
                from backend.app.integrations.agent_adapter import execute_job

                await execute_job(self.factory, job_id, self.settings)
            elif kind == 'PROTOCOL_EXTRACT' and self.settings.llm_enabled:
                from backend.app.services.protocol_extraction import process_model_extract

                result = await process_model_extract(self.factory, job_id, self.settings)
                with self.factory.begin() as session:
                    job = session.get(m.Job, job_id)
                    job.result_json, job.status, job.finished_at = result, 'SUCCEEDED', now()
                    job.progress_percent, job.lease_until, job.error_code = 100, None, None
            else:
                # T2 domain writes, audit and successful job completion share one transaction.
                with self.factory.begin() as session:
                    job = session.get(m.Job, job_id)
                    if job.kind == "SCREEN_COHORT":
                        result = process_screen(session, job, self.settings)
                    elif job.kind == "INGEST_EVENT":
                        result = process_event(session, job, self.settings)
                    else:
                        result = process_extract(session, job)
                    job.result_json, job.status, job.finished_at, job.progress_percent = (
                        result,
                        "SUCCEEDED",
                        now(),
                        100,
                    )
                    job.lease_until, job.error_code = None, None
                if kind == "INGEST_EVENT" and result.get("case_ids"):
                    # Optional enrichment is committed after T2; it cannot invalidate its successful assessment.
                    try:
                        self.enrich_cases(job_id, result["case_ids"])
                    except Exception:
                        # Core job remains successful. Case retains deterministic summary and source references.
                        pass
        except Exception as exc:
            code = exc.code if isinstance(exc, DomainError) else "PERSISTENCE_FAILED"
            retryable = not isinstance(exc, DomainError) or exc.retryable
            with self.factory.begin() as session:
                job = session.get(m.Job, job_id)
                retry = retryable and job.attempts < job.max_attempts
                job.status, job.error_code = ("QUEUED" if retry else "FAILED"), code
                job.lease_until = (
                    now() + timedelta(seconds=self.settings.job_retry_backoff_seconds) if retry else None
                )
                job.finished_at = None if retry else now()
                if job.kind == "PROTOCOL_EXTRACT":
                    version = session.get(m.ProtocolVersion, job.resource_id)
                    if not version.approved_set_hash:
                        version.state = "EXTRACTING" if retry else "EXTRACTION_FAILED"
                if job.kind == "SCREEN_COHORT":
                    run = session.get(m.ScreeningRun, job.resource_id)
                    run.error_code = code
                    run.status = "QUEUED" if retry else "FAILED"
                    if not retry:
                        # Operational failure is a distinct immutable assessment, never clinical UNKNOWN.
                        failed_ids = job.request_json["patient_ids"]
                        for patient_id in failed_ids:
                            previous = session.scalar(
                                select(m.PatientTrialAssessment)
                                .where(
                                    m.PatientTrialAssessment.patient_id == patient_id,
                                    m.PatientTrialAssessment.evaluation_state == "COMPLETE",
                                )
                                .order_by(m.PatientTrialAssessment.evaluated_at.desc())
                            )
                            session.add(
                                m.PatientTrialAssessment(
                                    assessment_id=new_id("ASM"),
                                    patient_id=patient_id,
                                    trial_id=run.trial_id,
                                    protocol_version_id=run.protocol_version_id,
                                    snapshot_id=run.snapshot_id,
                                    screening_run_id=run.run_id,
                                    assessment_type="SCREENING",
                                    screening_date=run.screening_date,
                                    evaluated_at=now(),
                                    engine_version=self.settings.engine_version,
                                    evaluation_state="EVALUATION_ERROR",
                                    candidate_status=None,
                                    before_assessment_id=previous.assessment_id if previous else None,
                                    participation_status_at_evaluation=session.get(
                                        m.Patient, patient_id
                                    ).participation_status,
                                )
                            )
                        run.counts_json = {
                            s: len(failed_ids) if s == "EVALUATION_ERROR" else 0
                            for s in (
                                "POTENTIAL_MATCH",
                                "NEEDS_REVIEW",
                                "PROTOCOL_CONFLICT",
                                "EVALUATION_ERROR",
                            )
                        }
                # The accepted T1 event is untouched; API derives stale state from this failed/pending job.
                actor = session.get(m.ClinicalActor, job.actor_id)
                append_audit(
                    session,
                    actor,
                    job.trial_id,
                    "JOB_RETRY" if retry else "JOB_FAILED",
                    "Job",
                    job_id,
                    job.correlation_id,
                    result=code,
                )
        return True

    def enrich_cases(self, job_id, case_ids):
        with self.factory.begin() as session:
            job = session.get(m.Job, job_id)
            event = session.get(m.PatientEvent, job.resource_id)
            actor = session.get(m.ClinicalActor, job.actor_id)
            enabled = self.settings.llm_enabled and bool(self.settings.llm_api_key.get_secret_value())
            for case_id in case_ids:
                case = session.get(m.ReviewCase, case_id)
                rule = session.get(m.Criterion, case.criterion_row_id)
                execution = m.AgentExecution(
                    execution_id=new_id("EXEC"),
                    role="MONITORING_WORKFLOW",
                    status="QUEUED" if enabled else "UNAVAILABLE",
                    trial_id=case.trial_id,
                    patient_id=case.patient_id,
                    protocol_version_id=rule.protocol_version_id,
                    criterion_ids_json=[rule.criterion_id],
                    event_id=event.event_id,
                    correlation_id=job.correlation_id,
                    trace_json=[],
                    unknown_reasons_json=[],
                    evidence_refs_json=[],
                    verification_questions_json=[],
                    error_code=None if enabled else "AGENT_UNAVAILABLE",
                    created_at=now(),
                    finished_at=None if enabled else now(),
                )
                session.add(execution)
                session.flush()
                case.agent_execution_id = execution.execution_id
                case.revision += 1
                if enabled:
                    enqueue(
                        session,
                        "AGENT_INVESTIGATION",
                        case.trial_id,
                        execution.execution_id,
                        dict(
                            objective="Draft a source-linked review summary of this already determined case"
                        ),
                        actor,
                        job.correlation_id,
                        self.settings,
                    )
                append_audit(
                    session,
                    actor,
                    case.trial_id,
                    "AGENT_QUEUED" if enabled else "AGENT_UNAVAILABLE",
                    "AgentExecution",
                    execution.execution_id,
                    job.correlation_id,
                    output_ids=[case_id],
                    result="QUEUED" if enabled else "UNAVAILABLE",
                )

    async def loop(self):
        self.running = True
        try:
            while self.running:
                try:
                    await self.run_once()
                except Exception:
                    # A transient DB failure must not kill the durable poller or emit narratives to telemetry.
                    await asyncio.sleep(self.settings.job_retry_backoff_seconds)
                await asyncio.sleep(self.settings.job_poll_interval_ms / 1000)
        finally:
            self.running = False

    def start(self):
        self.task = asyncio.create_task(self.loop())

    async def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
