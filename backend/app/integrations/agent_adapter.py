import asyncio
import importlib
import json
import logging
import time
from datetime import timedelta
from typing import Literal

from backend.app import models as m
from backend.app.db.base import now
from backend.app.schemas.common import ID, AgentRole, AgentStatus, ContractBase, Field
from backend.app.schemas.dto import CoverageItem, CriterionDraftInput, ToolTrace
from backend.app.services.audit import append_audit
from backend.app.services.evidence import snapshot
from sqlalchemy import select


class AgentRequest(ContractBase):
    contract_version: Literal["1.0.0-rc2"]
    execution_id: ID
    role: AgentRole
    objective: str
    trial_id: ID
    protocol_version_id: ID
    criterion_ids: list[ID] = Field(default_factory=list)
    patient_id: ID | None = None
    event_id: ID | None = None
    evidence_snapshot_id: ID | None = None
    correlation_id: str
    max_steps: int = Field(ge=1, le=8)


class EvidenceReference(ContractBase):
    source_id: ID
    source_version: int
    evidence_id: ID
    page: int | None = None
    span_start: int | None = None
    span_end: int | None = None
    effective_at: str | None = None


class AgentResult(ContractBase):
    contract_version: Literal["1.0.0-rc2"]
    execution_id: ID
    status: AgentStatus
    role: AgentRole
    summary: str | None = None
    evidence_refs: list[EvidenceReference]
    unknown_reasons: list[str]
    conflict_refs: list[str]
    proposed_criteria: list[CriterionDraftInput]
    coverage: list[CoverageItem]
    verification_questions: list[str]
    trace: list[ToolTrace]
    error_code: str | None = None
    model_id: str | None = None


class FakeAgentAdapter:
    """Typed testing adapter. It never represents a mock as successful live AI."""

    async def run(self, request, gateway):
        req = AgentRequest.model_validate(request)
        return AgentResult(
            contract_version=req.contract_version,
            execution_id=req.execution_id,
            role=req.role,
            status="UNAVAILABLE",
            summary=None,
            evidence_refs=[],
            unknown_reasons=[],
            conflict_refs=[],
            proposed_criteria=[],
            coverage=[],
            verification_questions=[],
            trace=[],
            error_code="TEST_ADAPTER",
            model_id=None,
        ).model_dump(mode="json")


async def execute_job(factory, job_id, settings, *, persist_proposal=False):
    from backend.app.integrations.evidence_gateway import EvidenceGateway

    with factory.begin() as session:
        job = session.get(m.Job, job_id)
        execution = session.get(m.AgentExecution, job.resource_id)
        if execution.status != "QUEUED":
            # A recovered lease cannot restart an interrupted model execution with fresh budgets.
            if execution.status == "RUNNING":
                execution.status, execution.error_code, execution.finished_at = (
                    "FAILED",
                    "EXECUTION_INTERRUPTED",
                    now(),
                )
            job.status = (
                "SUCCEEDED" if execution.status in ("SUCCEEDED", "PARTIAL", "UNAVAILABLE") else "FAILED"
            )
            job.result_json = dict(execution_id=execution.execution_id, agent_status=execution.status)
            job.finished_at, job.lease_until = now(), None
            job.error_code = execution.error_code if job.status == "FAILED" else None
            return
        snap = None
        if execution.patient_id:
            stamp = now()
            assessment = (
                session.scalar(
                    select(m.PatientTrialAssessment).where(
                        m.PatientTrialAssessment.caused_by_event_id == execution.event_id
                    )
                )
                if execution.event_id
                else None
            )
            if assessment:
                snap = session.get(m.EvidenceSnapshot, assessment.snapshot_id)
            else:
                event = session.get(m.PatientEvent, execution.event_id) if execution.event_id else None
                cutoff = max(stamp, event.recorded_at) + timedelta(microseconds=1) if event else stamp
                snap = snapshot(
                    session, execution.trial_id, [execution.patient_id], cutoff, stamp.date(), event
                )
        version = session.get(m.ProtocolVersion, execution.protocol_version_id)
        source = session.get(m.EvidenceSource, version.source_pk)
        context = dict(source_id=source.source_id, source_version=source.source_version,
                       protocol_version_id=version.protocol_version_id)
        if execution.role != "PROTOCOL_INTELLIGENCE":
            from backend.app.services.serializers import protocol_dto

            # Only signed, scoped interpretations may reach a patient investigator.
            context["approved_set_hash"] = version.approved_set_hash
            context["approved_criteria"] = [c.model_dump(mode="json") for c in protocol_dto(session, version).criteria
                if c.criterion_id in execution.criterion_ids_json and c.workflow_status == "APPROVED"]
            baseline = session.scalar(select(m.ScreeningRun).where(
                m.ScreeningRun.trial_id == execution.trial_id,
                m.ScreeningRun.protocol_version_id == version.protocol_version_id,
                m.ScreeningRun.status == "COMPLETE").order_by(m.ScreeningRun.created_at.desc()))
            context["screening_date"] = baseline.screening_date.isoformat() if baseline else None
            context["case_ids"] = list(session.scalars(select(m.ReviewCase.case_id).where(
                m.ReviewCase.agent_execution_id == execution.execution_id)))
        objective = json.dumps({"task": job.request_json["objective"],
                                "authorized_backend_context": context}, ensure_ascii=False)
        req = AgentRequest(
            contract_version="1.0.0-rc2",
            execution_id=execution.execution_id,
            role=execution.role,
            objective=objective,
            trial_id=execution.trial_id,
            protocol_version_id=execution.protocol_version_id,
            criterion_ids=execution.criterion_ids_json,
            patient_id=execution.patient_id,
            event_id=execution.event_id,
            evidence_snapshot_id=snap.snapshot_id if snap else None,
            correlation_id=execution.correlation_id,
            max_steps=settings.max_agent_steps,
        )
        actor_id = job.actor_id
        execution.status = "RUNNING"
    gateway = EvidenceGateway(factory, req, actor_id, settings)
    context['execution_deadline_monotonic'] = gateway.deadline
    req.objective = json.dumps({'task': job.request_json['objective'], 'authorized_backend_context': context}, ensure_ascii=False)
    result = None
    proposal = None
    error = None
    stage = "entrypoint"
    try:
        if not settings.llm_enabled or not settings.llm_api_key.get_secret_value():
            raw = await FakeAgentAdapter().run(req.model_dump(mode="json"), gateway)
        else:
            entrypoint = importlib.import_module("ai.entrypoints")
            raw = await asyncio.wait_for(
                entrypoint.run_agent(req.model_dump(mode="json"), gateway),
                timeout=max(.001, gateway.deadline - time.monotonic()),
            )
        stage = "result_schema"
        result = AgentResult.model_validate(raw)
        stage = "scope"
        if result.execution_id != req.execution_id or result.role != req.role:
            raise ValueError("Mismatched execution scope")
        if result.summary and not result.evidence_refs:
            raise ValueError("Summary lacks verified evidence references")
        # Two layers measure different intervals. Compare observed actions/references,
        # not equal millisecond clocks; persist the gateway's authoritative timings.
        def observed(trace):
            return [(t.tool_name, sorted(t.input_reference_ids), sorted(t.output_reference_ids),
                     t.error_code or t.result_code) for t in trace]

        stage = "trace"
        if observed(result.trace) != observed(gateway.trace):
            raise ValueError("Trace does not match observed gateway activity")
        with factory() as session:
            stage = "evidence"
            for ref in result.evidence_refs:
                gateway.validate_reference(session, ref.model_dump())
            if result.proposed_criteria or result.coverage:
                stage = "protocol_proposal"
                if req.role != "PROTOCOL_INTELLIGENCE":
                    raise ValueError("Role cannot propose protocol changes")
                from backend.app.schemas.dto import CriteriaReplaceRequest
                from backend.app.services.pdf_extractor import validate_proposal

                version = session.get(m.ProtocolVersion, req.protocol_version_id)
                src = session.get(m.EvidenceSource, version.source_pk)
                proposal = CriteriaReplaceRequest(
                        criteria=result.proposed_criteria,
                        coverage=result.coverage,
                        change_reason="AI proposal for human review",
                    )
                validate_proposal(
                    proposal,
                    src.pages,
                    req.protocol_version_id,
                    src.source_id,
                )
    except ModuleNotFoundError:
        error = "AGENT_UNAVAILABLE"
    except TimeoutError:
        error = "AGENT_TIMEOUT"
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "agent_result_rejected execution_id=%s stage=%s exception_type=%s",
            req.execution_id, stage, type(exc).__name__,
        )
        error = "UNVERIFIED_EVIDENCE_REF"
    with factory.begin() as session:
        job = session.get(m.Job, job_id)
        execution = session.get(m.AgentExecution, req.execution_id)
        execution.status = (
            ("UNAVAILABLE" if error == "AGENT_UNAVAILABLE" else "FAILED") if error else result.status
        )
        execution.summary = result.summary if result and not error else None
        execution.trace_json = [t.model_dump() for t in gateway.trace]
        execution.error_code = error or result.error_code
        execution.model_id = result.model_id if result and not error else None
        if result and not error:
            execution.evidence_refs_json = [
                gateway.api_reference(session, r.model_dump()).model_dump(mode="json")
                for r in result.evidence_refs
            ]
            execution.unknown_reasons_json = result.unknown_reasons
            execution.verification_questions_json = result.verification_questions
            if persist_proposal and proposal and result.status == 'SUCCEEDED':
                from backend.app.services.approval import replace_proposal

                version = session.get(m.ProtocolVersion, req.protocol_version_id)
                if version.revision != job.request_json['expected_protocol_revision'] or version.approved_set_hash:
                    execution.status, execution.error_code = 'FAILED', 'REVISION_CONFLICT'
                else:
                    replace_proposal(session, version, proposal, session.get(m.ClinicalActor, actor_id), req.correlation_id)
                    append_audit(session, session.get(m.ClinicalActor, actor_id), req.trial_id,
                        'MODEL_PROPOSAL_LOADED', 'ProtocolVersion', version.protocol_version_id,
                        req.correlation_id, output_ids=[req.execution_id], result='UNAPPROVED')
            if result.summary and result.status in ("SUCCEEDED", "PARTIAL"):
                cases = session.scalars(
                    select(m.ReviewCase).where(m.ReviewCase.agent_execution_id == req.execution_id)
                )
                for case in cases:
                    case.current_summary, case.summary_origin = result.summary, "AI_DRAFT"
                    case.revision += 1
                    case.updated_at = now()
        execution.finished_at = now()
        job.status = "SUCCEEDED" if execution.status in ("SUCCEEDED", "PARTIAL", "UNAVAILABLE") else "FAILED"
        job.result_json = dict(execution_id=req.execution_id, agent_status=execution.status)
        job.error_code = execution.error_code if job.status == "FAILED" else None
        job.finished_at, job.lease_until, job.progress_percent = now(), None, 100
        actor = session.get(m.ClinicalActor, actor_id)
        append_audit(
            session,
            actor,
            req.trial_id,
            "AGENT_FINISHED",
            "AgentExecution",
            req.execution_id,
            req.correlation_id,
            result=execution.status,
        )
