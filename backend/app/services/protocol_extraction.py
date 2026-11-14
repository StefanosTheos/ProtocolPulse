"""Enabled extraction uses the same bounded AI boundary, with backend-only proposal persistence."""

from datetime import timedelta
from pathlib import Path
from sqlalchemy import select

from backend.app import models as m
from backend.app.core.errors import DomainError
from backend.app.db.base import new_id, now
from backend.app.integrations.agent_adapter import execute_job
from backend.app.services.pdf_extractor import parse_pdf, sha256


async def process_model_extract(factory, parent_id, settings):
    # Commit preparation before inference. No SQLite transaction spans the external call.
    with factory.begin() as session:
        parent = session.get(m.Job, parent_id)
        version = session.get(m.ProtocolVersion, parent.resource_id)
        if version.approved_set_hash:
            raise DomainError('VERSION_ALREADY_ACTIVE', 'Approved source is immutable')
        child_id = (parent.result_json or {}).get('agent_job_id')
        if not child_id:
            source = session.get(m.EvidenceSource, version.source_pk)
            data = Path(source.storage_uri).read_bytes()
            if sha256(data) != source.sha256:
                raise DomainError('SOURCE_UNAVAILABLE', 'Private source checksum mismatch')
            source.pages = parse_pdf(data)
            for page, text in source.pages.items():
                span = session.scalar(select(m.SourceSpan).where(
                    m.SourceSpan.source_pk == source.source_pk, m.SourceSpan.page == int(page),
                    m.SourceSpan.start_offset == 0, m.SourceSpan.end_offset == len(text)))
                if not span:
                    session.add(m.SourceSpan(span_id=new_id('SPAN'), source_pk=source.source_pk,
                        page=int(page), start_offset=0, end_offset=len(text), quote=text,
                        quote_sha256=sha256(text.encode())))
            execution = m.AgentExecution(execution_id=new_id('EXEC'), role='PROTOCOL_INTELLIGENCE',
                status='QUEUED', trial_id=version.trial_id, protocol_version_id=version.protocol_version_id,
                criterion_ids_json=[], patient_id=None, event_id=None, correlation_id=parent.correlation_id,
                trace_json=[], unknown_reasons_json=[], evidence_refs_json=[], verification_questions_json=[])
            session.add(execution)
            session.flush()
            from backend.app.services.jobs import enqueue

            child = enqueue(session, 'AGENT_INVESTIGATION', version.trial_id, execution.execution_id,
                {'objective': 'Interpret the supplied fictional PDF and propose cited, unapproved criteria and complete coverage for investigator review.',
                 'expected_protocol_revision': version.revision},
                session.get(m.ClinicalActor, parent.actor_id), parent.correlation_id, settings)
            child.status, child.attempts, child.started_at = 'RUNNING', 1, now()
            child.lease_until = now() + timedelta(seconds=settings.job_lease_seconds)
            child_id = child.job_id
            parent.result_json = {'execution_id': execution.execution_id, 'agent_job_id': child_id}
    # A recovered execution cannot get fresh model budgets; execute_job enforces this.
    with factory() as session:
        child = session.get(m.Job, child_id)
        terminal = child.status in ('SUCCEEDED', 'FAILED')
    if not terminal:
        await execute_job(factory, child_id, settings, persist_proposal=True)
    with factory() as session:
        child = session.get(m.Job, child_id)
        execution = session.get(m.AgentExecution, child.resource_id)
        version = session.get(m.ProtocolVersion, execution.protocol_version_id)
        if child.status != 'SUCCEEDED' or execution.status != 'SUCCEEDED' or version.state != 'EXTRACTION_REVIEW':
            raise DomainError(execution.error_code or 'EXTRACTION_FAILED',
                'Model extraction incomplete; source review required', 422)
        return dict(protocol_version_id=version.protocol_version_id, execution_id=execution.execution_id,
            agent_job_id=child_id, proposal_origin='MODEL', agent_status=execution.status)
