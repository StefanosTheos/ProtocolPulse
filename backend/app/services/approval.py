from pathlib import Path

from sqlalchemy import delete, select, update

from backend.app.core.errors import DomainError
from backend.app.db.base import new_id, now
from backend.app.models import (
    Criterion,
    CriterionApproval,
    EvidenceSource,
    ExtractionCoverage,
    ProtocolVersion,
    SourceSpan,
    Trial,
)
from backend.app.schemas import dto
from backend.app.services.audit import append_audit, digest
from backend.app.services.pdf_extractor import sha256, validate_proposal


def criteria_for(session, version_id):
    return list(
        session.scalars(
            select(Criterion)
            .where(Criterion.protocol_version_id == version_id)
            .order_by(Criterion.criterion_id)
        )
    )


def draft_dict(session, c):
    return dict(
        criterion_id=c.criterion_id,
        protocol_version_id=c.protocol_version_id,
        type=c.type,
        clinical_subject=c.subject,
        operator=c.operator,
        threshold=c.threshold_json,
        unit=c.unit,
        window=c.window_json,
        evidence_requirement=c.evidence_requirement,
        missing_data_policy=c.missing_data_policy,
        source_quote=c.source_quote,
        source_id=session.get(EvidenceSource, c.source_pk).source_id,
        source_page=c.source_page,
        source_anchor=dict(start=c.source_span_start, end=c.source_span_end),
        applicable_site_ids=c.applicable_site_ids,
        terminology_map_version=c.terminology_map_version,
        logical_group_id=c.logical_group_id,
        workflow_status="PROPOSED",
        ambiguity=c.ambiguity,
    )


def coverage_for(session, version_id):
    return list(
        session.scalars(
            select(ExtractionCoverage).where(ExtractionCoverage.protocol_version_id == version_id)
        )
    )


def coverage_dict(session, c):
    return dict(
        section_id=c.section_id,
        source_id=session.get(EvidenceSource, c.source_pk).source_id,
        page=c.page,
        span_start=c.span_start,
        span_end=c.span_end,
        status=c.status,
        criterion_ids=c.criterion_ids_json,
        review_note=c.review_note,
    )


def replace_proposal(session, version, proposal, actor, correlation, *, reset=False):
    if version.approved_set_hash or version.state == "ACTIVE":
        raise DomainError("VERSION_ALREADY_ACTIVE", "Approved rules are immutable")
    source = session.get(EvidenceSource, version.source_pk)
    validate_proposal(proposal, source.pages, version.protocol_version_id, source.source_id)
    session.execute(
        delete(ExtractionCoverage).where(
            ExtractionCoverage.protocol_version_id == version.protocol_version_id
        )
    )
    session.execute(delete(Criterion).where(Criterion.protocol_version_id == version.protocol_version_id))
    for c in proposal.criteria:
        session.add(
            Criterion(
                criterion_row_id=new_id("CR"),
                protocol_version_id=version.protocol_version_id,
                criterion_id=c.criterion_id,
                type=c.type,
                subject=c.clinical_subject,
                operator=c.operator,
                threshold_json=c.threshold,
                unit=c.unit,
                window_json=c.window.model_dump(),
                evidence_requirement=c.evidence_requirement,
                missing_data_policy=c.missing_data_policy,
                terminology_map_version=c.terminology_map_version,
                logical_group_id=c.logical_group_id,
                source_pk=source.source_pk,
                source_page=c.source_page,
                source_quote=c.source_quote,
                source_span_start=c.source_anchor.start,
                source_span_end=c.source_anchor.end,
                applicable_site_ids=c.applicable_site_ids,
                workflow_status=c.workflow_status,
                ambiguity=c.ambiguity,
            )
        )
        session.add(
            SourceSpan(
                span_id=new_id("SPAN"),
                source_pk=source.source_pk,
                page=c.source_page,
                start_offset=c.source_anchor.start,
                end_offset=c.source_anchor.end,
                quote=c.source_quote,
                quote_sha256=sha256(c.source_quote.encode()),
            )
        )
    for c in proposal.coverage:
        session.add(
            ExtractionCoverage(
                coverage_id=new_id("COV"),
                protocol_version_id=version.protocol_version_id,
                section_id=c.section_id,
                source_pk=source.source_pk,
                page=c.page,
                span_start=c.span_start,
                span_end=c.span_end,
                status=c.status,
                criterion_ids_json=c.criterion_ids,
                review_note=(
                    "Curated fixture proposal; not AI-generated; investigator review required."
                    if reset
                    else c.review_note
                ),
            )
        )
    version.state = "DRAFT" if reset else "EXTRACTION_REVIEW"
    if not reset:
        version.revision += 1
    append_audit(
        session,
        actor,
        version.trial_id,
        "CURATED_PROPOSAL" if reset else "PROPOSAL_REPLACED",
        "ProtocolVersion",
        version.protocol_version_id,
        correlation,
        reason=proposal.change_reason,
    )


def approve(session, version, request, actor, correlation, expected_revision):
    if actor.role != "INVESTIGATOR":
        raise DomainError("ROLE_FORBIDDEN", "Investigator approval required", 403)
    trial = session.get(Trial, version.trial_id)
    if version.state not in ("DRAFT", "EXTRACTION_REVIEW"):
        raise DomainError("APPROVAL_BLOCKED", "Protocol extraction is failed, pending or immutable")
    if trial.active_protocol_version_id:
        raise DomainError("VERSION_ALREADY_ACTIVE", "First-version activation only")
    if version.revision != expected_revision:
        raise DomainError("REVISION_CONFLICT", "Protocol revision changed")
    rules = criteria_for(session, version.protocol_version_id)
    coverage = coverage_for(session, version.protocol_version_id)
    if (
        len(request.criterion_ids) != 8
        or set(request.criterion_ids) != {c.criterion_id for c in rules}
        or any(c.workflow_status != "PROPOSED" or c.ambiguity for c in rules)
    ):
        raise DomainError("APPROVAL_BLOCKED", "Every executable rule requires explicit review")
    proposal = dto.CriteriaReplaceRequest(
        criteria=[draft_dict(session, c) for c in rules],
        coverage=[coverage_dict(session, c) for c in coverage],
        change_reason=request.decision_reason,
    )
    source = session.get(EvidenceSource, version.source_pk)
    if not source.storage_uri or sha256(Path(source.storage_uri).read_bytes()) != version.file_sha256:
        raise DomainError("APPROVAL_BLOCKED", "Immutable PDF checksum verification failed")
    validate_proposal(proposal, source.pages, version.protocol_version_id, source.source_id)
    approved_at = now()
    set_hash = digest(proposal.model_dump(mode="json"))
    changed = session.execute(
        update(ProtocolVersion)
        .where(
            ProtocolVersion.protocol_version_id == version.protocol_version_id,
            ProtocolVersion.revision == expected_revision,
            ProtocolVersion.approved_set_hash.is_(None),
        )
        .values(
            state="ACTIVE",
            revision=expected_revision + 1,
            approved_set_hash=set_hash,
            approved_at=approved_at,
            coverage_signed_by=actor.actor_id,
            coverage_signed_at=approved_at,
        )
    )
    if changed.rowcount != 1:
        raise DomainError("REVISION_CONFLICT", "Protocol revision changed")
    trial.active_protocol_version_id = version.protocol_version_id
    trial.revision += 1
    for c in rules:
        session.add(
            CriterionApproval(
                approval_id=new_id("APP"),
                protocol_version_id=version.protocol_version_id,
                criterion_row_id=c.criterion_row_id,
                approver_actor_id=actor.actor_id,
                criterion_hash=digest(draft_dict(session, c)),
                coverage_hash=digest(proposal.model_dump(mode="json")["coverage"]),
                approved_at=approved_at,
                reason=request.decision_reason,
            )
        )
        c.workflow_status, c.approved_by, c.approved_at = "APPROVED", actor.actor_id, approved_at
    for c in coverage:
        c.reviewed_by = actor.actor_id
    append_audit(
        session,
        actor,
        trial.trial_id,
        "PROTOCOL_APPROVED",
        "ProtocolVersion",
        version.protocol_version_id,
        correlation,
        output_ids=request.criterion_ids,
        prior="DRAFT",
        next_state="ACTIVE",
        reason=request.decision_reason,
    )
    return dto.ApprovalReceipt(
        protocol_version_id=version.protocol_version_id,
        approved_set_hash=set_hash,
        signed_criterion_ids=sorted(request.criterion_ids),
        approved_by=actor.actor_id,
        approved_at=approved_at,
        state="ACTIVE",
        superseded_version_id=None,
    )
