import base64
import json
from datetime import timedelta
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Header, Query, Request, Response, UploadFile
from pydantic import AwareDatetime
from sqlalchemy import func, select, text, update

from backend.app import models as m
from backend.app.core.actors import actor_for, require_role, scoped_trial
from backend.app.core.errors import DomainError
from backend.app.db.base import new_id, now
from backend.app.db.version import HEAD
from backend.app.schemas import dto as d
from backend.app.schemas.common import Envelope, Page
from backend.app.services import serializers as ser
from backend.app.services.approval import approve, replace_proposal
from backend.app.services.audit import append_audit, digest
from backend.app.services.evidence import EVIDENCE_KEYS, EVIDENCE_MODELS, patient360, snapshot, source_ref
from backend.app.services.jobs import enqueue
from backend.app.services.pdf_extractor import sha256, store_pdf
from backend.app.services.temporal import local_midnight

router = APIRouter(prefix="/api/v1")
CLINICAL = ("COORDINATOR", "INVESTIGATOR", "MONITOR", "AUDITOR")


def session_for(request: Request):
    with request.app.state.factory() as session:
        if request.method in ("POST", "PUT", "PATCH"):
            # SQLite serializes short writes. Reads, idempotency lookup and side effects share the lock.
            session.execute(text("BEGIN IMMEDIATE"))
        try:
            yield session
            session.commit()
        except BaseException:
            session.rollback()
            for path in getattr(request.state, "created_files", []):
                path.unlink(missing_ok=True)
            raise


Session = Annotated[object, Depends(session_for)]


def actor_dep(request: Request, session: Session, x_demo_actor_id: Annotated[str | None, Header()] = None):
    actor = actor_for(session, x_demo_actor_id)
    request.state.actor_id = actor.actor_id
    return actor


Actor = Annotated[object, Depends(actor_dep)]


def envelope(request, data):
    return dict(data=data, request_id=request.state.request_id)


def require_row(session, model, key, code):
    row = session.get(model, key)
    if not row:
        raise DomainError(code, "Resource not found", 404)
    return row


def version_for(session, actor, trial_id, version_id):
    scoped_trial(session, actor, trial_id)
    version = require_row(session, m.ProtocolVersion, version_id, "VERSION_NOT_FOUND")
    if version.trial_id != trial_id:
        raise DomainError("VERSION_NOT_FOUND", "Version is not in trial", 404)
    return version


def patient_for(session, actor, trial_id, patient_id):
    require_role(actor, *CLINICAL, "RESEARCH_IT")
    scoped_trial(session, actor, trial_id)
    patient = require_row(session, m.Patient, patient_id, "PATIENT_NOT_FOUND")
    if patient.trial_id != trial_id or patient.site_id != actor.site_id:
        raise DomainError("PATIENT_NOT_FOUND", "Patient is not in trial/site", 404)
    return patient


def revision(request):
    value = request.headers.get("if-match", "")
    if len(value) < 3 or value[0] != '"' or value[-1] != '"' or not value[1:-1].isdigit():
        raise DomainError("VALIDATION_ERROR", "If-Match must be a quoted integer revision", 422)
    return int(value[1:-1])


def mutation(request, response, session, actor, body, status, callback):
    key = request.headers.get("idempotency-key")
    if key is None or not 1 <= len(key) <= 128:
        raise DomainError("VALIDATION_ERROR", "Idempotency-Key of 1–128 characters is required", 422)
    op = request.method + " " + request.url.path
    request_hash = digest(body)
    record = session.scalar(
        select(m.IdempotencyRecord).where(
            m.IdempotencyRecord.actor_id == actor.actor_id,
            m.IdempotencyRecord.operation_id == op,
            m.IdempotencyRecord.key == key,
        )
    )
    if record:
        if record.request_hash != request_hash:
            raise DomainError("IDEMPOTENCY_CONFLICT", "Same key was used with different content")
        result = record.response_body_json
        response.status_code = record.response_status
        if op.endswith("/events"):
            result = dict(result, deduplicated=True)
            response.status_code = 200
        return envelope(request, result)
    result = callback()
    if isinstance(result, tuple):
        status, result = result
    if hasattr(result, "model_dump"):
        result = result.model_dump(mode="json")
    else:
        result = json.loads(json.dumps(result, default=str))
    session.add(
        m.IdempotencyRecord(
            idem_id=new_id("IDEM"),
            actor_id=actor.actor_id,
            operation_id=op,
            key=key,
            request_hash=request_hash,
            response_status=status,
            response_body_json=result,
            resource_id=None,
            created_at=now(),
        )
    )
    session.flush()
    response.status_code = status
    return envelope(request, result)


def list_page(request, items, sort, allowed, *, limit=25, cursor=None):
    if sort not in allowed:
        raise DomainError("VALIDATION_ERROR", "Invalid sort", 422)
    field = sort.removeprefix("-")

    def identity(item):
        data = item.model_dump() if hasattr(item, "model_dump") else item
        return next((str(v) for k, v in data.items() if k.endswith("_id") and v is not None), "")

    items = sorted(items, key=identity)
    items.sort(
        key=lambda item: (getattr(item, field) is not None, getattr(item, field)),
        reverse=sort.startswith("-"),
    )
    fingerprint = digest({k: v for k, v in request.query_params.items() if k != "cursor"})
    offset = 0
    if cursor:
        try:
            saved = json.loads(base64.urlsafe_b64decode(cursor))
            if saved["filter"] != fingerprint or saved["path"] != request.url.path or saved["offset"] < 0:
                raise ValueError()
            offset = int(saved["offset"])
        except Exception as exc:
            raise DomainError("VALIDATION_ERROR", "Invalid collection cursor", 422) from exc
    next_cursor = None
    if offset + limit < len(items):
        next_cursor = base64.urlsafe_b64encode(
            json.dumps(dict(offset=offset + limit, filter=fingerprint, path=request.url.path)).encode()
        ).decode()
    return envelope(
        request,
        dict(
            items=items[offset : offset + limit],
            page=dict(next_cursor=next_cursor, limit=limit, total_count=len(items)),
        ),
    )


def check_citations(session, patient_id, ids):
    known = set()
    for model in (*EVIDENCE_MODELS, m.PatientEvent):
        known.update(
            session.scalars(
                select(getattr(model, EVIDENCE_KEYS[model])).where(model.patient_id == patient_id)
            )
        )
    if not ids or not set(ids) <= known:
        raise DomainError("VALIDATION_ERROR", "Cited evidence must exist for this patient", 422)


@router.get("/health", response_model=Envelope[d.Health], operation_id="getHealth")
def health(request: Request, response: Response):
    ready = False
    database = False
    try:
        with request.app.state.factory() as session:
            database = session.scalar(text("SELECT 1")) == 1
            ready = session.scalar(text("SELECT version_num FROM alembic_version")) == HEAD
    except Exception:
        pass
    running = request.app.state.runner.running
    ok = ready and running
    response.status_code = 200 if ok else 503
    return envelope(
        request,
        d.Health(
            status="ok" if ok else "degraded",
            database="ok" if database else "unavailable",
            migrations="current" if ready else "pending",
            worker="running" if running else "stopped",
            llm="disabled"
            if not request.app.state.settings.llm_enabled
            else "enabled"
            if request.app.state.settings.llm_api_key.get_secret_value()
            else "unavailable",
            synthetic_only=True,
            api_version="v1",
            contract_version="1.0.0-rc2",
        ),
    )


@router.get("/trials", response_model=Envelope[Page[d.Trial]], operation_id="listTrials")
def trials(
    request: Request,
    session: Session,
    actor: Actor,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    sort: str = "created_at",
):
    rows = [
        ser.trial_dto(t) for t in session.scalars(select(m.Trial).where(m.Trial.site_id == actor.site_id))
    ]
    return list_page(request, rows, sort, ["created_at", "-created_at", "title"], limit=limit, cursor=cursor)


@router.post("/trials", response_model=Envelope[d.Trial], status_code=201, operation_id="createTrial")
def create_trial(request: Request, response: Response, body: d.TrialCreate, session: Session, actor: Actor):
    require_role(actor, "COORDINATOR", "RESEARCH_IT")
    if body.site_id != actor.site_id:
        raise DomainError("SITE_SCOPE_FORBIDDEN", "Cannot create outside actor site", 403)

    def create():
        row = m.Trial(trial_id=new_id("TR"), **body.model_dump(), created_at=now(), revision=1)
        session.add(row)
        session.flush()
        append_audit(
            session, actor, row.trial_id, "TRIAL_CREATED", "Trial", row.trial_id, request.state.request_id
        )
        return ser.trial_dto(row)

    return mutation(request, response, session, actor, body.model_dump(mode="json"), 201, create)


@router.get("/trials/{trial_id}", response_model=Envelope[d.TrialDetail], operation_id="getTrial")
def trial_detail(trial_id: str, request: Request, session: Session, actor: Actor):
    row = scoped_trial(session, actor, trial_id)
    return envelope(
        request,
        d.TrialDetail(
            **ser.trial_dto(row).model_dump(),
            protocol_version_ids=list(
                session.scalars(
                    select(m.ProtocolVersion.protocol_version_id).where(
                        m.ProtocolVersion.trial_id == trial_id
                    )
                )
            ),
            patient_count=session.scalar(
                select(func.count()).select_from(m.Patient).where(m.Patient.trial_id == trial_id)
            ),
            finding_count=session.scalar(
                select(func.count())
                .select_from(m.MonitoringFinding)
                .where(m.MonitoringFinding.trial_id == trial_id)
            ),
            trial_notice="Synthetic demonstration. Screening is not enrollment; pharmacological interactions not assessed.",
        ),
    )


@router.get(
    "/trials/{trial_id}/participation-summary",
    response_model=Envelope[d.ParticipationSummary],
    operation_id="getParticipationSummary",
)
def participation_summary(trial_id: str, request: Request, session: Session, actor: Actor):
    scoped_trial(session, actor, trial_id)
    counts = dict(
        session.execute(
            select(m.Patient.participation_status, func.count())
            .where(m.Patient.trial_id == trial_id)
            .group_by(m.Patient.participation_status)
        ).all()
    )
    return envelope(
        request,
        d.ParticipationSummary(
            trial_id=trial_id,
            cohort_count=sum(counts.values()),
            participating_count=counts.get("PARTICIPATING", 0),
            ended_count=counts.get("ENDED", 0),
        ),
    )


@router.get(
    "/trials/{trial_id}/protocols",
    response_model=Envelope[Page[d.ProtocolDetail]],
    operation_id="listProtocols",
)
def protocols(
    trial_id: str,
    request: Request,
    session: Session,
    actor: Actor,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    sort: str = "label",
):
    scoped_trial(session, actor, trial_id)
    rows = list(session.scalars(select(m.ProtocolVersion).where(m.ProtocolVersion.trial_id == trial_id)))
    if sort == "-created_at":
        # ProtocolDetail has no created_at field; sorting still uses persisted metadata.
        rows.sort(key=lambda v: (v.created_at, v.protocol_version_id), reverse=True)
        return page_presorted(request, [ser.protocol_dto(session, v) for v in rows], limit, cursor)
    return list_page(
        request, [ser.protocol_dto(session, v) for v in rows], sort, ["label"], limit=limit, cursor=cursor
    )


def page_presorted(request, items, limit, cursor):
    # Reuse cursor validation without inventing a response field for database-only sorting.
    class Indexed:
        def __init__(self, index):
            self.index = index

        def model_dump(self):
            return {"row_id": str(self.index)}

    wrapped = [Indexed(i) for i in range(len(items))]
    result = list_page(request, wrapped, "index", ["index"], limit=limit, cursor=cursor)
    result["data"]["items"] = [items[i.index] for i in result["data"]["items"]]
    return result


@router.post(
    "/trials/{trial_id}/protocols",
    response_model=Envelope[d.ProtocolDetail],
    status_code=201,
    operation_id="uploadProtocol",
)
async def upload_protocol(
    trial_id: str,
    request: Request,
    response: Response,
    session: Session,
    actor: Actor,
    file: Annotated[UploadFile, File()],
    version_label: Annotated[str, Form(min_length=1, max_length=100)],
    source_declared_synthetic: Annotated[bool, Form()],
):
    require_role(actor, "COORDINATOR", "RESEARCH_IT")
    scoped_trial(session, actor, trial_id)
    if not source_declared_synthetic:
        raise DomainError("NON_SYNTHETIC_INPUT", "Only declared synthetic source is accepted", 422)
    if file.content_type != "application/pdf":
        raise DomainError("UNSUPPORTED_MEDIA_TYPE", "PDF content type required", 415)
    data = await file.read(request.app.state.settings.max_pdf_mb * 1024 * 1024 + 1)
    if len(data) > request.app.state.settings.max_pdf_mb * 1024 * 1024:
        raise DomainError("PDF_TOO_LARGE", "PDF exceeds configured limit", 413)
    if not data.startswith(b"%PDF-"):
        raise DomainError("UNSUPPORTED_MEDIA_TYPE", "PDF signature required", 415)
    filename = Path((file.filename or "protocol.pdf").replace("\\", "/")).name
    if not filename.endswith(".pdf"):
        raise DomainError("UNSUPPORTED_MEDIA_TYPE", "PDF filename required", 415)

    def create():
        import json as json_module

        from backend.app.services.pdf_extractor import FIXTURE

        expected = json_module.loads((FIXTURE / "manifest.json").read_text("utf-8"))["sha256"][
            "PX-104-v1.0-fictional.pdf"
        ]
        # Frozen demo allowlist: declarations do not establish synthetic provenance by themselves.
        if sha256(data) != expected:
            raise DomainError(
                "SYNTHETIC_ONLY", "This demo accepts only the bundled, verified fictional protocol", 403
            )
        if session.scalar(
            select(m.ProtocolVersion).where(
                m.ProtocolVersion.trial_id == trial_id, m.ProtocolVersion.label == version_label
            )
        ):
            raise DomainError("REVISION_CONFLICT", "Version label already registered")
        storage = request.app.state.settings.protocol_storage_dir
        path, created_file = store_pdf(storage, data)
        if created_file:
            request.state.created_files = [*getattr(request.state, "created_files", []), path]
        try:
            src = m.EvidenceSource(
                source_pk=new_id("SRC"),
                source_id=new_id("SRC-PDF"),
                source_version=1,
                trial_id=trial_id,
                patient_id=None,
                kind="PDF",
                filename=filename,
                mime_type="application/pdf",
                sha256=sha256(data),
                storage_uri=str(path.resolve()),
                recorded_at=now(),
                ingested_at=now(),
                synthetic_only=True,
                pages={},
            )
            session.add(src)
            session.flush()
            version = m.ProtocolVersion(
                protocol_version_id=new_id("PV"),
                trial_id=trial_id,
                label=version_label,
                source_pk=src.source_pk,
                file_sha256=src.sha256,
                state="DRAFT",
                revision=1,
                created_at=now(),
            )
            session.add(version)
            session.flush()
            append_audit(
                session,
                actor,
                trial_id,
                "PROTOCOL_UPLOADED",
                "ProtocolVersion",
                version.protocol_version_id,
                request.state.request_id,
                output_ids=[src.source_id],
            )
            return ser.protocol_dto(session, version)
        except BaseException:
            if created_file:
                path.unlink(missing_ok=True)
            raise

    return mutation(
        request,
        response,
        session,
        actor,
        dict(hash=sha256(data), label=version_label, filename=filename, synthetic=True),
        201,
        create,
    )


@router.get(
    "/trials/{trial_id}/protocols/{version_id}",
    response_model=Envelope[d.ProtocolDetail],
    operation_id="getProtocol",
)
def protocol_detail(trial_id: str, version_id: str, request: Request, session: Session, actor: Actor):
    return envelope(request, ser.protocol_dto(session, version_for(session, actor, trial_id, version_id)))


@router.post(
    "/trials/{trial_id}/protocols/{version_id}/extract",
    response_model=Envelope[d.JobReceipt],
    status_code=202,
    operation_id="extractProtocol",
)
def extract(
    trial_id: str,
    version_id: str,
    body: d.ExtractRequest,
    request: Request,
    response: Response,
    session: Session,
    actor: Actor,
):
    require_role(actor, "COORDINATOR", "INVESTIGATOR")
    version = version_for(session, actor, trial_id, version_id)

    def create():
        if version.approved_set_hash:
            raise DomainError("VERSION_ALREADY_ACTIVE", "Approved rules are immutable")
        if version.state == "EXTRACTING":
            raise DomainError("JOB_ALREADY_RUNNING", "Extraction already in progress")
        job = enqueue(
            session,
            "PROTOCOL_EXTRACT",
            trial_id,
            version_id,
            body.model_dump(),
            actor,
            request.state.request_id,
            request.app.state.settings,
        )
        version.state, version.extraction_job_id = "EXTRACTING", job.job_id
        append_audit(
            session,
            actor,
            trial_id,
            "EXTRACTION_QUEUED",
            "ProtocolVersion",
            version_id,
            request.state.request_id,
            output_ids=[job.job_id],
        )
        return ser.job_receipt(job)

    return mutation(request, response, session, actor, body.model_dump(), 202, create)


@router.put(
    "/trials/{trial_id}/protocols/{version_id}/criteria",
    response_model=Envelope[d.ProtocolDetail],
    operation_id="replaceProposedCriteria",
)
def replace_criteria(
    trial_id: str,
    version_id: str,
    body: d.CriteriaReplaceRequest,
    request: Request,
    session: Session,
    actor: Actor,
):
    require_role(actor, "INVESTIGATOR")
    version = version_for(session, actor, trial_id, version_id)
    if version.revision != revision(request):
        raise DomainError("REVISION_CONFLICT", "Protocol revision changed")
    replace_proposal(session, version, body, actor, request.state.request_id)
    session.flush()
    return envelope(request, ser.protocol_dto(session, version))


@router.post(
    "/trials/{trial_id}/protocols/{version_id}/approve",
    response_model=Envelope[d.ApprovalReceipt],
    operation_id="approveProtocol",
)
def approve_protocol(
    trial_id: str,
    version_id: str,
    body: d.ApprovalRequest,
    request: Request,
    response: Response,
    session: Session,
    actor: Actor,
):
    require_role(actor, "INVESTIGATOR")
    version = version_for(session, actor, trial_id, version_id)
    return mutation(
        request,
        response,
        session,
        actor,
        body.model_dump(mode="json"),
        200,
        lambda: approve(session, version, body, actor, request.state.request_id, revision(request)),
    )


@router.post(
    "/trials/{trial_id}/screenings",
    response_model=Envelope[d.JobReceipt],
    status_code=202,
    operation_id="createScreening",
)
def create_screening(
    trial_id: str,
    body: d.ScreeningCreate,
    request: Request,
    response: Response,
    session: Session,
    actor: Actor,
):
    require_role(actor, "COORDINATOR", "INVESTIGATOR")
    trial = scoped_trial(session, actor, trial_id)

    def create():
        version = version_for(session, actor, trial_id, body.protocol_version_id)
        if (
            trial.active_protocol_version_id != version.protocol_version_id
            or version.state != "ACTIVE"
            or not version.coverage_signed_by
        ):
            raise DomainError("PROTOCOL_NOT_ACTIVE", "Explicit investigator approval is required")
        if body.evidence_cutoff_at < local_midnight(
            body.screening_date + timedelta(days=1), trial.site_timezone
        ):
            raise DomainError(
                "VALIDATION_ERROR", "Evidence cutoff must include the complete screening day", 422
            )
        all_ids = list(session.scalars(select(m.Patient.patient_id).where(m.Patient.trial_id == trial_id)))
        ids = body.patient_ids if body.patient_ids is not None else all_ids
        if not ids or len(ids) != len(set(ids)) or not set(ids) <= set(all_ids):
            raise DomainError("VALIDATION_ERROR", "Patient IDs must be a nonempty unique trial subset", 422)
        snap = snapshot(session, trial_id, ids, body.evidence_cutoff_at, body.screening_date)
        run_id = new_id("RUN")
        job = enqueue(
            session,
            "SCREEN_COHORT",
            trial_id,
            run_id,
            dict(patient_ids=ids),
            actor,
            request.state.request_id,
            request.app.state.settings,
        )
        run = m.ScreeningRun(
            run_id=run_id,
            trial_id=trial_id,
            protocol_version_id=version.protocol_version_id,
            approved_set_hash=version.approved_set_hash,
            snapshot_id=snap.snapshot_id,
            screening_date=body.screening_date,
            evidence_cutoff_at=body.evidence_cutoff_at,
            engine_version=request.app.state.settings.engine_version,
            terminology_map_version="px104-terminology-v1",
            status="QUEUED",
            job_id=job.job_id,
            patient_count=len(ids),
            counts_json={
                s: 0 for s in ["POTENTIAL_MATCH", "NEEDS_REVIEW", "PROTOCOL_CONFLICT", "EVALUATION_ERROR"]
            },
            created_at=now(),
        )
        session.add(run)
        append_audit(
            session,
            actor,
            trial_id,
            "SCREENING_QUEUED",
            "ScreeningRun",
            run_id,
            request.state.request_id,
            output_ids=[job.job_id, snap.snapshot_id],
        )
        return ser.job_receipt(job)

    return mutation(request, response, session, actor, body.model_dump(mode="json"), 202, create)


@router.get("/screenings/{run_id}", response_model=Envelope[d.ScreeningRun], operation_id="getScreeningRun")
def get_screening(run_id: str, request: Request, session: Session, actor: Actor):
    require_role(actor, *CLINICAL)
    run = require_row(session, m.ScreeningRun, run_id, "JOB_NOT_FOUND")
    scoped_trial(session, actor, run.trial_id)
    return envelope(request, ser.run_dto(run))


@router.get(
    "/screenings/{run_id}/assessments",
    response_model=Envelope[Page[d.PatientAssessment]],
    operation_id="listAssessments",
)
def assessments(
    run_id: str,
    request: Request,
    session: Session,
    actor: Actor,
    status: d.CandidateStatus | None = None,
    reason: d.UnknownReason | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    sort: str = "patient_id",
):
    require_role(actor, *CLINICAL)
    run = require_row(session, m.ScreeningRun, run_id, "JOB_NOT_FOUND")
    scoped_trial(session, actor, run.trial_id)
    rows = [
        ser.assessment_dto(session, row)
        for row in session.scalars(
            select(m.PatientTrialAssessment).where(m.PatientTrialAssessment.screening_run_id == run_id)
        )
    ]
    if status:
        rows = [r for r in rows if r.candidate_status == status]
    if reason:
        rows = [r for r in rows if any(reason in c.reason_codes for c in r.criteria)]
    return list_page(
        request, rows, sort, ["patient_id", "-evidence_completeness_percent"], limit=limit, cursor=cursor
    )


@router.get(
    "/trials/{trial_id}/patients/{patient_id}",
    response_model=Envelope[d.Patient360],
    operation_id="getPatient360",
)
def get_patient(
    trial_id: str,
    patient_id: str,
    request: Request,
    session: Session,
    actor: Actor,
    as_of: AwareDatetime | None = None,
):
    require_role(actor, *CLINICAL)
    return envelope(request, patient360(session, patient_for(session, actor, trial_id, patient_id), as_of))


@router.post(
    "/patients/{patient_id}/events",
    response_model=Envelope[d.EventReceipt],
    status_code=202,
    operation_id="createPatientEvent",
)
def create_event(
    patient_id: str, body: d.EventCreate, request: Request, response: Response, session: Session, actor: Actor
):
    require_role(actor, "INVESTIGATOR", "COORDINATOR", "RESEARCH_IT")
    patient = patient_for(session, actor, body.trial_id, patient_id)
    payload = body.model_dump(mode="json")

    def create():
        existing = session.scalar(
            select(m.PatientEvent).where(
                m.PatientEvent.patient_id == patient_id,
                m.PatientEvent.source_event_id == body.source_event_id,
                m.PatientEvent.source_version == body.source_version,
            )
        )
        if existing:
            if existing.payload_hash != digest(payload):
                raise DomainError("EVENT_VERSION_CONFLICT", "Event version has different content")
            return 200, d.EventReceipt(
                event_id=existing.event_id,
                patient_id=patient_id,
                trial_id=body.trial_id,
                ingested_at=existing.ingested_at,
                deduplicated=True,
                job=ser.job_receipt(session.get(m.Job, existing.job_id)),
            )
        if body.lab and body.lab.unit not in ("mL/min/1.73m²", "mL/min/1.73m2"):
            raise DomainError("UNSUPPORTED_UNIT", "Unit is not allowlisted", 422)
        if (
            body.medication
            and body.medication.dose_value is not None
            and body.medication.dose_unit != "synthetic-unit"
        ):
            raise DomainError("UNSUPPORTED_UNIT", "Synthetic medication dose requires synthetic-unit", 422)
        if body.note:
            known = session.scalar(
                select(m.ClinicalNote.note_id).where(
                    m.ClinicalNote.patient_id == patient_id,
                    m.ClinicalNote.sha256 == sha256(body.note.text.encode()),
                )
            )
            if not known:
                raise DomainError(
                    "SYNTHETIC_ONLY", "Note content must match a registered synthetic fixture", 403
                )
        previous = list(
            session.scalars(
                select(m.PatientEvent).where(
                    m.PatientEvent.patient_id == patient_id,
                    m.PatientEvent.source_event_id == body.source_event_id,
                )
            )
        )
        if previous:
            latest = max(previous, key=lambda r: r.source_version)
            if body.source_version <= latest.source_version or body.supersedes_event_id != latest.event_id:
                raise DomainError("EVENT_VERSION_CONFLICT", "Correction must supersede latest source version")
        elif body.supersedes_event_id:
            raise DomainError("EVENT_VERSION_CONFLICT", "Superseded event is outside this source chain")
        source = session.scalar(
            select(m.EvidenceSource).where(
                m.EvidenceSource.source_id == body.source_id,
                m.EvidenceSource.source_version == body.source_document_version,
            )
        )
        if source:
            if (
                source.patient_id != patient_id
                or source.trial_id != body.trial_id
                or source.sha256 != (sha256(body.note.text.encode()) if body.note else digest(payload))
            ):
                raise DomainError("EVENT_VERSION_CONFLICT", "Source version already has different content")
        else:
            source = m.EvidenceSource(
                source_pk=new_id("SRC"),
                source_id=body.source_id,
                source_version=body.source_document_version,
                trial_id=body.trial_id,
                patient_id=patient_id,
                kind=body.event_kind if body.event_kind in ("LAB", "MEDICATION", "NOTE") else "OTHER",
                filename=body.source_id + ".json",
                mime_type="application/json",
                sha256=sha256(body.note.text.encode()) if body.note else digest(payload),
                storage_uri=None,
                recorded_at=body.recorded_at,
                ingested_at=now(),
                synthetic_only=True,
                pages={
                    "1": body.note.text
                    if body.note
                    else json.dumps(payload, ensure_ascii=False, sort_keys=True)
                },
            )
            session.add(source)
            session.flush()
        event_id = new_id("EVT")
        job = enqueue(
            session,
            "INGEST_EVENT",
            body.trial_id,
            event_id,
            dict(patient_id=patient_id),
            actor,
            request.state.request_id,
            request.app.state.settings,
        )
        stamp = now()
        event = m.PatientEvent(
            event_id=event_id,
            patient_id=patient_id,
            trial_id=body.trial_id,
            source_event_id=body.source_event_id,
            source_version=body.source_version,
            source_pk=source.source_pk,
            event_kind=body.event_kind,
            effective_at=body.effective_at,
            recorded_at=body.recorded_at,
            ingested_at=stamp,
            date_precision=body.time_uncertainty.precision if body.time_uncertainty else "INSTANT",
            possible_interval_json=body.time_uncertainty.model_dump(mode="json")
            if body.time_uncertainty
            else None,
            payload_json=payload,
            payload_hash=digest(payload),
            supersedes_event_id=body.supersedes_event_id,
            job_id=job.job_id,
        )
        session.add(event)
        patient.data_watermark = stamp
        append_audit(
            session,
            actor,
            body.trial_id,
            "EVENT_ACCEPTED",
            "PatientEvent",
            event_id,
            request.state.request_id,
            output_ids=[source.source_id, job.job_id],
            input_hash=event.payload_hash,
        )
        return d.EventReceipt(
            event_id=event_id,
            patient_id=patient_id,
            trial_id=body.trial_id,
            ingested_at=stamp,
            deduplicated=False,
            job=ser.job_receipt(job),
        )

    return mutation(request, response, session, actor, payload, 202, create)


@router.get(
    "/trials/{trial_id}/findings",
    response_model=Envelope[Page[d.MonitoringFinding]],
    operation_id="listFindings",
)
def findings(
    trial_id: str,
    request: Request,
    session: Session,
    actor: Actor,
    category: d.FindingCategory | None = None,
    patient_id: str | None = None,
    priority: d.FindingPriority | None = None,
    from_at: AwareDatetime | None = None,
    to_at: AwareDatetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    sort: str = "-created_at",
):
    require_role(actor, *CLINICAL)
    scoped_trial(session, actor, trial_id)
    query = select(m.MonitoringFinding).where(m.MonitoringFinding.trial_id == trial_id)
    for field, value in [("category", category), ("patient_id", patient_id), ("priority", priority)]:
        if value is not None:
            query = query.where(getattr(m.MonitoringFinding, field) == value)
    if from_at:
        query = query.where(m.MonitoringFinding.created_at >= from_at)
    if to_at:
        query = query.where(m.MonitoringFinding.created_at <= to_at)
    return list_page(
        request,
        [ser.finding_dto(session, f) for f in session.scalars(query)],
        sort,
        ["created_at", "-created_at"],
        limit=limit,
        cursor=cursor,
    )


@router.get("/trials/{trial_id}/cases", response_model=Envelope[Page[d.ReviewCase]], operation_id="listCases")
def cases(
    trial_id: str,
    request: Request,
    session: Session,
    actor: Actor,
    status: d.CaseStatus | None = None,
    category: d.FindingCategory | None = None,
    assigned_actor_id: str | None = None,
    patient_id: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    sort: str = "-updated_at",
):
    require_role(actor, *CLINICAL)
    scoped_trial(session, actor, trial_id)
    query = select(m.ReviewCase).where(m.ReviewCase.trial_id == trial_id)
    for field, value in [
        ("status", status),
        ("assigned_actor_id", assigned_actor_id),
        ("patient_id", patient_id),
    ]:
        if value is not None:
            query = query.where(getattr(m.ReviewCase, field) == value)
    if category:
        query = query.where(
            m.ReviewCase.case_id.in_(
                select(m.MonitoringFinding.case_id).where(m.MonitoringFinding.category == category)
            )
        )
    return list_page(
        request,
        [ser.case_dto(session, c) for c in session.scalars(query)],
        sort,
        ["updated_at", "-updated_at"],
        limit=limit,
        cursor=cursor,
    )


@router.get("/cases/{case_id}", response_model=Envelope[d.ReviewCase], operation_id="getCase")
def get_case(case_id: str, request: Request, session: Session, actor: Actor):
    require_role(actor, *CLINICAL)
    case = require_row(session, m.ReviewCase, case_id, "CASE_NOT_FOUND")
    scoped_trial(session, actor, case.trial_id)
    return envelope(request, ser.case_dto(session, case))


@router.patch("/cases/{case_id}", response_model=Envelope[d.ReviewCase], operation_id="transitionCase")
def patch_case(case_id: str, body: d.CasePatch, request: Request, session: Session, actor: Actor):
    require_role(actor, "MONITOR", "INVESTIGATOR")
    row = require_row(session, m.ReviewCase, case_id, "CASE_NOT_FOUND")
    scoped_trial(session, actor, row.trial_id)
    if body.expected_revision != revision(request) or row.revision != body.expected_revision:
        raise DomainError("REVISION_CONFLICT", "Case revision changed")
    if body.next_status in ("RESOLVED", "CLOSED"):
        require_role(actor, "INVESTIGATOR")
    allowed = {
        "OPEN": ["ACKNOWLEDGED"],
        "ACKNOWLEDGED": ["INVESTIGATING"],
        "INVESTIGATING": ["RESOLVED"],
        "RESOLVED": ["CLOSED", "REOPENED"],
        "CLOSED": ["REOPENED"],
        "REOPENED": ["ACKNOWLEDGED", "INVESTIGATING"],
    }
    if body.next_status not in allowed[row.status]:
        raise DomainError("INVALID_TRANSITION", "Unsupported case transition", 400)
    check_citations(session, row.patient_id, body.cited_evidence_ids)
    if body.assigned_actor_id:
        assignee = actor_for(session, body.assigned_actor_id)
        if assignee.site_id != actor.site_id or assignee.role not in ("MONITOR", "INVESTIGATOR"):
            raise DomainError("ROLE_FORBIDDEN", "Invalid clinical reviewer assignment", 403)
    stamp, prior = now(), row.status
    changed = session.execute(
        update(m.ReviewCase)
        .where(m.ReviewCase.case_id == case_id, m.ReviewCase.revision == body.expected_revision)
        .values(
            status=body.next_status,
            assigned_actor_id=body.assigned_actor_id,
            revision=body.expected_revision + 1,
            updated_at=stamp,
        )
    )
    if changed.rowcount != 1:
        raise DomainError("REVISION_CONFLICT", "Case revision changed")
    session.add(
        m.ReviewDecision(
            decision_id=new_id("DEC"),
            case_id=case_id,
            actor_id=actor.actor_id,
            actor_role=actor.role,
            from_status=prior,
            to_status=body.next_status,
            disposition=body.disposition,
            rationale=body.rationale,
            cited_evidence_ids_json=body.cited_evidence_ids,
            decided_at=stamp,
            correlation_id=request.state.request_id,
        )
    )
    append_audit(
        session,
        actor,
        row.trial_id,
        "CASE_REVIEWED",
        "ReviewCase",
        case_id,
        request.state.request_id,
        output_ids=body.cited_evidence_ids,
        prior=prior,
        next_state=body.next_status,
        reason=body.rationale,
    )
    return envelope(request, ser.case_dto(session, row))


@router.get(
    "/agent-executions/{execution_id}",
    response_model=Envelope[d.AgentExecution],
    operation_id="getAgentExecution",
)
def get_execution(execution_id: str, request: Request, session: Session, actor: Actor):
    require_role(actor, *CLINICAL)
    row = require_row(session, m.AgentExecution, execution_id, "SOURCE_NOT_FOUND")
    scoped_trial(session, actor, row.trial_id)
    return envelope(request, ser.execution_dto(row))


@router.get("/trials/{trial_id}/audit", response_model=Envelope[Page[d.AuditEntry]], operation_id="listAudit")
def audit(
    trial_id: str,
    request: Request,
    session: Session,
    actor: Actor,
    action: str | None = None,
    actor_id: str | None = None,
    from_at: AwareDatetime | None = None,
    to_at: AwareDatetime | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: str | None = None,
    sort: str = "-occurred_at",
):
    require_role(actor, "AUDITOR", "INVESTIGATOR", "MONITOR", "SPONSOR_OPS")
    scoped_trial(session, actor, trial_id)
    query = select(m.AuditEntry).where(m.AuditEntry.trial_id == trial_id)
    if action:
        query = query.where(m.AuditEntry.action == action)
    if actor_id:
        query = query.where(m.AuditEntry.actor_id == actor_id)
    if from_at:
        query = query.where(m.AuditEntry.occurred_at >= from_at)
    if to_at:
        query = query.where(m.AuditEntry.occurred_at <= to_at)
    rows = [ser.audit_dto(r) for r in session.scalars(query)]
    if actor.role == "SPONSOR_OPS":
        # The wire DTO has no aggregate audit shape. Restrict to trial-level operations only.
        rows = [r for r in rows if r.target_type in ("Trial", "ProtocolVersion")]
        rows = [r.model_copy(update={"output_ref_ids": []}) for r in rows]
    return list_page(request, rows, sort, ["occurred_at", "-occurred_at"], limit=limit, cursor=cursor)


@router.get("/jobs/{job_id}", response_model=Envelope[d.JobDetail], operation_id="getJob")
def get_job(job_id: str, request: Request, session: Session, actor: Actor):
    job = require_row(session, m.Job, job_id, "JOB_NOT_FOUND")
    scoped_trial(session, actor, job.trial_id)
    if job.actor_id != actor.actor_id:
        require_role(actor, "INVESTIGATOR", "MONITOR")
    return envelope(request, ser.job_detail(job))


@router.get(
    "/trials/{trial_id}/evidence/{source_id}",
    response_model=Envelope[d.EvidenceSourceDetail],
    operation_id="getEvidenceSource",
)
def get_evidence(
    trial_id: str,
    source_id: str,
    request: Request,
    session: Session,
    actor: Actor,
    version: Annotated[int | None, Query(ge=1)] = None,
    page: Annotated[int | None, Query(ge=1)] = None,
    span_start: Annotated[int | None, Query(ge=0)] = None,
    span_end: Annotated[int | None, Query(ge=1)] = None,
):
    require_role(actor, *CLINICAL)
    scoped_trial(session, actor, trial_id)
    query = select(m.EvidenceSource).where(
        m.EvidenceSource.trial_id == trial_id, m.EvidenceSource.source_id == source_id
    )
    if version:
        query = query.where(m.EvidenceSource.source_version == version)
    src = session.scalar(query.order_by(m.EvidenceSource.source_version.desc()))
    if not src:
        raise DomainError("SOURCE_NOT_FOUND", "Source not found", 404)
    if (span_start is None) != (span_end is None) or (
        src.kind == "PDF" and span_start is not None and page is None
    ):
        raise DomainError("VALIDATION_ERROR", "Supply both offsets and a PDF page", 422)
    if page and str(page) not in src.pages:
        raise DomainError("VALIDATION_ERROR", "Source page does not exist", 422)
    spans = []
    for key, value in src.pages.items():
        if not key.isdigit() or (page and int(key) != page):
            continue
        a, b = (span_start, span_end) if span_start is not None else (0, len(value))
        if not 0 <= a < b <= len(value):
            raise DomainError("VALIDATION_ERROR", "Invalid Unicode source span", 422)
        spans.append(dict(page=int(key) if src.kind == "PDF" else None, start=a, end=b, text=value[a:b]))
    return envelope(
        request,
        d.EvidenceSourceDetail(
            **source_ref(src).model_dump(),
            kind=src.kind,
            page_count=sum(k.isdigit() for k in src.pages) if src.kind == "PDF" else None,
            spans=spans,
        ),
    )


@router.post(
    "/trials/{trial_id}/patients/{patient_id}/dispositions",
    response_model=Envelope[d.ScreeningDisposition],
    status_code=201,
    operation_id="recordScreeningDisposition",
)
def disposition(
    trial_id: str,
    patient_id: str,
    body: d.ScreeningDispositionCreate,
    request: Request,
    response: Response,
    session: Session,
    actor: Actor,
):
    require_role(actor, "INVESTIGATOR")
    patient_for(session, actor, trial_id, patient_id)

    def create():
        assessment = require_row(session, m.PatientTrialAssessment, body.assessment_id, "SOURCE_NOT_FOUND")
        if (
            assessment.patient_id != patient_id
            or assessment.trial_id != trial_id
            or assessment.assessment_type != "SCREENING"
            or assessment.evaluation_state != "COMPLETE"
        ):
            raise DomainError(
                "VALIDATION_ERROR", "Disposition requires a completed patient screening assessment", 422
            )
        check_citations(session, patient_id, body.cited_evidence_ids)
        row = m.ScreeningDisposition(
            disposition_id=new_id("DISP"),
            patient_id=patient_id,
            trial_id=trial_id,
            assessment_id=body.assessment_id,
            actor_id=actor.actor_id,
            disposition=body.disposition,
            rationale=body.rationale,
            cited_evidence_ids_json=body.cited_evidence_ids,
            decided_at=now(),
        )
        session.add(row)
        append_audit(
            session,
            actor,
            trial_id,
            "SCREENING_DISPOSITION",
            "ScreeningDisposition",
            row.disposition_id,
            request.state.request_id,
            output_ids=body.cited_evidence_ids,
            reason=body.rationale,
        )
        return d.ScreeningDisposition(
            **body.model_dump(),
            disposition_id=row.disposition_id,
            patient_id=patient_id,
            trial_id=trial_id,
            actor_id=actor.actor_id,
            decided_at=row.decided_at,
            workflow_status="INVESTIGATOR_DISPOSITIONED",
        )

    return mutation(request, response, session, actor, body.model_dump(mode="json"), 201, create)


@router.post(
    "/trials/{trial_id}/patients/{patient_id}/participation",
    response_model=Envelope[d.ParticipationRecord],
    status_code=201,
    operation_id="recordParticipation",
)
def participation(
    trial_id: str,
    patient_id: str,
    body: d.ParticipationCreate,
    request: Request,
    response: Response,
    session: Session,
    actor: Actor,
):
    require_role(actor, "INVESTIGATOR")
    patient = patient_for(session, actor, trial_id, patient_id)

    def create():
        if (patient.participation_status, body.next_status) not in [
            ("NOT_ENROLLED", "PARTICIPATING"),
            ("PARTICIPATING", "ENDED"),
        ]:
            raise DomainError("INVALID_TRANSITION", "Unsupported external participation transition", 400)
        src = session.scalar(
            select(m.EvidenceSource)
            .where(
                m.EvidenceSource.source_id == body.external_record_source_id,
                m.EvidenceSource.patient_id == patient_id,
                m.EvidenceSource.trial_id == trial_id,
            )
            .order_by(m.EvidenceSource.source_version.desc())
        )
        if not src or body.external_record_reference not in src.pages.get("1", ""):
            raise DomainError("SOURCE_NOT_FOUND", "Registered synthetic external reference required", 404)
        boundary = "participation_start_at" if body.next_status == "PARTICIPATING" else "participation_end_at"
        if boundary not in src.pages:
            raise DomainError("VALIDATION_ERROR", "Source must establish dated participation bounds", 422)
        prior = patient.participation_status
        row = m.ParticipationRecord(
            participation_id=new_id("PART"),
            trial_id=trial_id,
            patient_id=patient_id,
            actor_id=actor.actor_id,
            from_status=prior,
            to_status=body.next_status,
            source_pk=src.source_pk,
            external_record_reference=body.external_record_reference,
            rationale=body.rationale,
            decided_at=now(),
        )
        session.add(row)
        patient.participation_status = body.next_status
        append_audit(
            session,
            actor,
            trial_id,
            "EXTERNAL_PARTICIPATION_RECORDED",
            "ParticipationRecord",
            row.participation_id,
            request.state.request_id,
            output_ids=[src.source_id],
            prior=prior,
            next_state=body.next_status,
            reason=body.rationale,
        )
        return d.ParticipationRecord(
            participation_id=row.participation_id,
            trial_id=trial_id,
            patient_id=patient_id,
            from_status=prior,
            to_status=body.next_status,
            source_id=src.source_id,
            external_record_reference=body.external_record_reference,
            actor_id=actor.actor_id,
            decided_at=row.decided_at,
        )

    return mutation(request, response, session, actor, body.model_dump(mode="json"), 201, create)


@router.post(
    "/agent-investigations",
    response_model=Envelope[d.JobReceipt],
    status_code=202,
    operation_id="createAgentInvestigation",
)
def investigate(
    body: d.AgentInvestigationCreate, request: Request, response: Response, session: Session, actor: Actor
):
    require_role(actor, "COORDINATOR", "MONITOR", "INVESTIGATOR")
    version = version_for(session, actor, body.trial_id, body.protocol_version_id)
    if body.patient_id:
        patient_for(session, actor, body.trial_id, body.patient_id)
    if body.role != "PROTOCOL_INTELLIGENCE" and version.state != "ACTIVE":
        raise DomainError("PROTOCOL_NOT_ACTIVE", "Evidence investigation requires active approved rules")
    if not set(body.criterion_ids) <= set(
        c.criterion_id for c in ser.protocol_dto(session, version).criteria
    ):
        raise DomainError("VALIDATION_ERROR", "Unknown scoped criterion", 422)
    if body.event_id:
        event = require_row(session, m.PatientEvent, body.event_id, "SOURCE_NOT_FOUND")
        if event.trial_id != body.trial_id or event.patient_id != body.patient_id:
            raise DomainError("SITE_SCOPE_FORBIDDEN", "Event outside investigation scope", 403)
    settings = request.app.state.settings
    if not settings.llm_enabled or not settings.llm_api_key.get_secret_value():
        raise DomainError("AGENT_UNAVAILABLE", "Optional model integration is disabled or unconfigured", 503)

    def create():
        execution_id = new_id("EXEC")
        row = m.AgentExecution(
            execution_id=execution_id,
            role=body.role,
            status="QUEUED",
            trial_id=body.trial_id,
            patient_id=body.patient_id,
            protocol_version_id=body.protocol_version_id,
            criterion_ids_json=body.criterion_ids,
            event_id=body.event_id,
            correlation_id=request.state.request_id,
            trace_json=[],
            unknown_reasons_json=[],
            evidence_refs_json=[],
            verification_questions_json=[],
            created_at=now(),
        )
        session.add(row)
        session.flush()
        job = enqueue(
            session,
            "AGENT_INVESTIGATION",
            body.trial_id,
            execution_id,
            body.model_dump(mode="json"),
            actor,
            request.state.request_id,
            settings,
        )
        append_audit(
            session,
            actor,
            body.trial_id,
            "INVESTIGATION_QUEUED",
            "AgentExecution",
            execution_id,
            request.state.request_id,
            output_ids=[job.job_id],
        )
        return ser.job_receipt(job)

    return mutation(request, response, session, actor, body.model_dump(mode="json"), 202, create)
