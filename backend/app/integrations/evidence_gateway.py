import asyncio
import time

from backend.app import models as m
from backend.app.core.actors import scoped_trial
from backend.app.core.errors import DomainError
from backend.app.db.base import new_id, now
from backend.app.schemas import dto as d
from backend.app.services.approval import criteria_for
from backend.app.services.audit import append_audit
from backend.app.services.evidence import EVIDENCE_MODELS, evidence_ref, frozen_rows
from pydantic import TypeAdapter
from sqlalchemy import select

ALLOWLIST = {
    "PROTOCOL_INTELLIGENCE": {"parse_protocol", "locate_clause", "validate_rule_schema", "report_coverage"},
    "EVIDENCE_INVESTIGATOR": {
        "retrieve_patient_evidence",
        "search_notes",
        "get_lab_history",
        "get_condition_history",
        "get_medication_timeline",
        "get_evidence_link",
        "request_verification_task",
    },
    "MEDICATION_SAFETY_INVESTIGATOR": {
        "retrieve_patient_evidence",
        "search_notes",
        "get_medication_timeline",
        "get_evidence_link",
        "resolve_approved_terminology",
        "evaluate_approved_rule",
        "request_verification_task",
        "request_med_reconciliation",
    },
    "MONITORING_WORKFLOW": {
        "retrieve_patient_evidence",
        "get_lab_history",
        "resolve_approved_terminology",
        "get_evidence_link",
        "evaluate_approved_rule",
        "classify_event_relevance",
        "get_prior_evaluation",
        "get_case_status",
        "request_verification_task",
    },
}


def wire_reference(ref):
    return {
        k: v
        for k, v in ref.model_dump(mode="json").items()
        if k
        in ("source_id", "source_version", "evidence_id", "page", "span_start", "span_end", "effective_at")
    }


def reference_ids(value):
    """Reference-only trace projection; clinical text/value is never a trace registry."""
    found = set()
    if isinstance(value, dict):
        for key, item in value.items():
            if key in {"value", "body", "text", "quote", "summary", "question"}:
                continue
            if key.endswith("_id") and isinstance(item, str):
                found.add(item)
            elif key.endswith("_ids") and isinstance(item, list):
                found.update(v for v in item if isinstance(v, str))
            if isinstance(item, (dict, list)):
                found.update(reference_ids(item))
    elif isinstance(value, list):
        for item in value:
            found.update(reference_ids(item))
    return sorted(found)


class EvidenceGateway:
    def __init__(self, factory, request, actor_id, settings):
        self.factory, self.request, self.actor_id, self.settings = factory, request, actor_id, settings
        self.steps = 0
        self.deadline = time.monotonic() + settings.agent_timeout_seconds
        self.trace = []

    def validate_reference(self, session, ref):
        src = session.scalar(
            select(m.EvidenceSource).where(
                m.EvidenceSource.source_id == ref["source_id"],
                m.EvidenceSource.source_version == ref["source_version"],
                m.EvidenceSource.trial_id == self.request.trial_id,
            )
        )
        if not src or (src.patient_id is not None and src.patient_id != self.request.patient_id):
            raise ValueError("Reference outside scope")
        row = None
        for model in (*EVIDENCE_MODELS, m.PatientEvent):
            row = session.get(model, ref["evidence_id"])
            if row:
                if row.source_pk != src.source_pk:
                    raise ValueError("Evidence/source mismatch")
                if not isinstance(row, m.ClinicalNote):
                    persisted = evidence_ref(session, row)
                    for field in ("page", "span_start", "span_end"):
                        if ref.get(field) is not None and ref[field] != getattr(persisted, field):
                            raise ValueError("Citation does not match the fact's persisted source span")
                if self.request.evidence_snapshot_id:
                    member = session.scalar(
                        select(m.SnapshotEvidenceRef).where(
                            m.SnapshotEvidenceRef.snapshot_id == self.request.evidence_snapshot_id,
                            m.SnapshotEvidenceRef.evidence_kind == model.__tablename__,
                            m.SnapshotEvidenceRef.evidence_id == ref["evidence_id"],
                            m.SnapshotEvidenceRef.source_version == ref["source_version"],
                        )
                    )
                    if not member:
                        raise ValueError("Evidence outside fixed snapshot")
                break
        if not row:
            span = session.get(m.SourceSpan, ref["evidence_id"])
            if not span or span.source_pk != src.source_pk:
                raise ValueError("Unknown evidence ID")
            if (
                ref.get("page") not in (None, span.page)
                or ref.get("span_start") not in (None, span.start_offset)
                or ref.get("span_end") not in (None, span.end_offset)
            ):
                raise ValueError("Citation does not match persisted source span")
        a, b = ref.get("span_start"), ref.get("span_end")
        if a is not None or b is not None:
            page = ref.get("page") or 1
            text = src.pages.get(str(page), "")
            if a is None or b is None or not 0 <= a < b <= len(text):
                raise ValueError("Invalid source span")
        return row, src

    def api_reference(self, session, ref):
        row, src = self.validate_reference(session, ref)
        if row:
            result = evidence_ref(session, row)
            supplied_time = ref.get("effective_at")
            if (
                supplied_time
                and TypeAdapter(d.IsoInstant).validate_python(supplied_time) != result.effective_at
            ):
                raise ValueError("Evidence time mismatch")
            return result
        span = session.get(m.SourceSpan, ref["evidence_id"])
        return d.EvidenceRef(
            evidence_id=ref["evidence_id"],
            source_id=src.source_id,
            source_version=src.source_version,
            evidence_type=src.kind,
            recorded_at=src.recorded_at,
            effective_at=ref.get("effective_at"),
            page=span.page,
            span_start=span.start_offset,
            span_end=span.end_offset,
        )

    async def invoke(self, name, payload):
        self.steps += 1
        started = time.monotonic()
        refs = []
        code = "OK"
        error = None
        try:
            if (
                self.steps > min(self.request.max_steps, self.settings.max_agent_steps)
                or started >= self.deadline
            ):
                raise DomainError("TIMEOUT", "Execution budget exhausted", 503)
            if name not in ALLOWLIST[self.request.role]:
                raise DomainError("UNAUTHORIZED", "Tool is not allowed for this role", 403)
            from backend.app.integrations.tool_schemas import TOOL_INPUTS

            validated = TOOL_INPUTS[name].model_validate(payload)
            payload = validated.model_dump(mode="json")
            if payload.get("patient_id") is None:
                payload.pop("patient_id", None)
            req = self.request
            for field in (
                "contract_version",
                "execution_id",
                "trial_id",
                "protocol_version_id",
                "correlation_id",
            ):
                if payload.get(field) != getattr(req, field):
                    raise DomainError("UNAUTHORIZED", "Tool scope mismatch", 403)
            if "patient_id" in payload and payload["patient_id"] != req.patient_id:
                raise DomainError("UNAUTHORIZED", "Patient outside scope", 403)
            if "snapshot_id" in payload and payload["snapshot_id"] != req.evidence_snapshot_id:
                raise DomainError("UNAUTHORIZED", "Snapshot outside scope", 403)
            if "criterion_ids" in payload and not set(payload["criterion_ids"]) <= set(req.criterion_ids):
                raise DomainError("UNAUTHORIZED", "Criterion outside assigned scope", 403)
            data, refs = await asyncio.wait_for(
                asyncio.to_thread(self._invoke, name, payload),
                timeout=min(self.settings.tool_timeout_seconds, max(0.001, self.deadline - started)),
            )
            result = dict(
                tool_name=name,
                data=data,
                evidence_refs=refs,
                source_watermark=now().isoformat().replace("+00:00", "Z"),
                result_code="OK",
            )
        except (DomainError, ValueError, KeyError, TypeError, TimeoutError) as exc:
            error = (
                exc.code
                if isinstance(exc, DomainError)
                else "TIMEOUT"
                if isinstance(exc, TimeoutError)
                else "BAD_INPUT"
            )
            if error not in {"TIMEOUT", "SOURCE_UNAVAILABLE", "UNMAPPED_CODE", "UNAUTHORIZED", "BAD_INPUT"}:
                error = "BAD_INPUT"
            code = error
            result = dict(tool_name=name, error_code=error, retryable=error == "TIMEOUT")
        self.trace.append(
            d.ToolTrace(
                tool_name=name,
                input_reference_ids=reference_ids(payload),
                output_reference_ids=reference_ids(result),
                result_code=code,
                elapsed_ms=int((time.monotonic() - started) * 1000),
                error_code=error,
            )
        )
        with self.factory.begin() as session:
            actor = session.get(m.ClinicalActor, self.actor_id)
            append_audit(
                session,
                actor,
                self.request.trial_id,
                "AGENT_TOOL",
                "AgentExecution",
                self.request.execution_id,
                self.request.correlation_id,
                output_ids=[r["evidence_id"] for r in refs],
                result=code,
            )
        return result

    def _invoke(self, name, p):
        req = self.request
        with self.factory.begin() as session:
            actor = session.get(m.ClinicalActor, self.actor_id)
            scoped_trial(session, actor, req.trial_id)
            version = session.get(m.ProtocolVersion, req.protocol_version_id)
            if version.trial_id != req.trial_id:
                raise ValueError("Wrong protocol")
            source = session.get(m.EvidenceSource, version.source_pk)
            rules = criteria_for(session, version.protocol_version_id)
            if req.role != "PROTOCOL_INTELLIGENCE" and version.state != "ACTIVE":
                raise DomainError("UNAUTHORIZED", "Approved active protocol required", 403)
            if name in ("parse_protocol", "locate_clause"):
                if p.get("source_id") != source.source_id:
                    raise ValueError("Wrong protocol source")
                if name == "parse_protocol" and p["version_id"] != req.protocol_version_id:
                    raise ValueError("Wrong protocol version")
                from pathlib import Path

                from backend.app.services.pdf_extractor import parse_pdf, sha256

                data = Path(source.storage_uri).read_bytes()
                if sha256(data) != source.sha256:
                    raise ValueError("Source checksum changed")
                pages = parse_pdf(data)
                if name == "locate_clause":
                    from backend.app.services.pdf_extractor import section_spans

                    sections = section_spans(pages)
                    if not set(p["section_ids"]) <= set(sections):
                        raise ValueError("Unknown source section")
                    spans = []
                    for section_id, (page, start, end) in sections.items():
                        if p["section_ids"] and section_id not in p["section_ids"]:
                            continue
                        text = pages[str(page)][start:end]
                        if p["query"].casefold() not in text.casefold():
                            continue
                        spans.append(dict(source_id=source.source_id, source_version=source.source_version,
                            page=page, text=text, start=start, end=end, sha256=sha256(text.encode()), quality="OK"))
                    return dict(spans=spans[:p["max_matches"]]), []
                output, refs = [], []
                for page, value in pages.items():
                    if name == "locate_clause" and p.get("query", "").casefold() not in value.casefold():
                        continue
                    output.append(
                        dict(
                            source_id=source.source_id,
                            source_version=source.source_version,
                            page=int(page),
                            text=value,
                            start=0,
                            end=len(value),
                            sha256=sha256(value.encode()),
                            quality="OK",
                        )
                    )
                if name == "parse_protocol":
                    for page, value in pages.items():
                        span = session.scalar(
                            select(m.SourceSpan).where(
                                m.SourceSpan.source_pk == source.source_pk,
                                m.SourceSpan.page == int(page),
                                m.SourceSpan.start_offset == 0,
                                m.SourceSpan.end_offset == len(value),
                            )
                        )
                        if span:
                            refs.append(
                                dict(
                                    source_id=source.source_id,
                                    source_version=source.source_version,
                                    evidence_id=span.span_id,
                                    page=span.page,
                                    span_start=0,
                                    span_end=len(value),
                                    effective_at=None,
                                )
                            )
                    return dict(pages=output, unreadable_pages=[], file_sha256=source.sha256), refs
                return dict(spans=output[: min(p.get("max_matches", 10), 10)]), refs
            if name in ("validate_rule_schema", "report_coverage"):
                # Read only validation uses runtime DTOs/registry and verified source text, never the oracle.
                drafts = [d.CriterionDraftInput.model_validate(v) for v in p["drafts"]]
                for draft in drafts:
                    if (
                        source.pages.get(str(draft.source_page), "")[
                            draft.source_anchor.start : draft.source_anchor.end
                        ]
                        != draft.source_quote
                    ):
                        raise ValueError("Unverified draft quote")
                if name == "validate_rule_schema":
                    valid, errors = [], []
                    for draft in drafts:
                        stored = next((r for r in rules if r.criterion_id == draft.criterion_id), None)
                        if (
                            not stored
                            or stored.operator != draft.operator
                            or stored.type != draft.type
                            or stored.threshold_json != draft.model_dump(mode="json")["threshold"]
                            or stored.unit != draft.unit
                            or stored.window_json != draft.window.model_dump()
                        ):
                            errors.append(dict(criterion_id=draft.criterion_id, code="UNSUPPORTED_OPERATION"))
                        else:
                            valid.append(draft.model_dump(mode="json"))
                    return dict(valid=valid, errors=errors), []
                from backend.app.services.pdf_extractor import section_spans

                if p["source_id"] != source.source_id:
                    raise ValueError("Wrong protocol source")
                sections = section_spans(source.pages)
                if not set(p["sections"]) <= set(sections):
                    raise ValueError("Unknown source section")
                items = []
                for section, (page, start, end) in sections.items():
                    matching = [
                        v.criterion_id
                        for v in drafts
                        if v.source_page == page
                        and start <= v.source_anchor.start < v.source_anchor.end <= end
                    ]
                    informational = section.startswith("PX-INFO-")
                    items.append(
                        dict(
                            section_id=section,
                            source_id=source.source_id,
                            page=page,
                            span_start=start,
                            span_end=end,
                            status="INFORMATIONAL" if informational else "MAPPED" if matching else "BLOCKING",
                            criterion_ids=[] if informational else matching,
                            review_note=None,
                        )
                    )
                return dict(items=items, blocking_count=sum(v["status"] == "BLOCKING" for v in items)), []
            if name == "resolve_approved_terminology":
                if p["map_version"] != "px104-terminology-v1":
                    raise ValueError("Unapproved map")
                entry = session.scalar(
                    select(m.TerminologyMapVersion).where(
                        m.TerminologyMapVersion.code == p["medication_code"],
                        m.TerminologyMapVersion.map_version == p["map_version"],
                    )
                )
                return dict(
                    code=p["medication_code"],
                    mapped_class=entry.mapped_class if entry else None,
                    status="MAPPED" if entry else "UNMAPPED",
                    mapping_source_id=session.get(m.EvidenceSource, entry.source_pk).source_id
                    if entry
                    else None,
                ), []
            if name == "get_evidence_link":
                self.validate_reference(session, p)
                ref = self.api_reference(session, p)
                src = session.scalar(
                    select(m.EvidenceSource).where(
                        m.EvidenceSource.source_id == p["source_id"],
                        m.EvidenceSource.source_version == p["source_version"],
                    )
                )
                quote = src.pages.get(str(ref.page or 1))
                if quote and ref.span_start is not None:
                    quote = quote[ref.span_start : ref.span_end]
                return dict(reference=wire_reference(ref), quote=quote), [wire_reference(ref)]
            if name in ("request_verification_task", "request_med_reconciliation"):
                proposal = p.get("proposal", p)
                if (
                    proposal["patient_id"] != req.patient_id
                    or proposal["criterion_id"] not in req.criterion_ids
                ):
                    raise ValueError("Task outside assigned scope")
                rule = next(r for r in rules if r.criterion_id == proposal["criterion_id"])
                if name == "request_med_reconciliation":
                    if not p["source_event_ids"]:
                        raise ValueError("Reconciliation requires persisted medication events")
                    for event_id in p["source_event_ids"]:
                        event = session.get(m.PatientEvent, event_id)
                        if (not event or event.event_id != req.event_id or event.patient_id != req.patient_id
                                or event.trial_id != req.trial_id or event.event_kind != "MEDICATION"):
                            raise ValueError("Reconciliation event outside assigned scope")
                        self.validate_reference(session, wire_reference(evidence_ref(session, event)))
                if proposal.get("requested_for_role", "INVESTIGATOR") not in ("COORDINATOR", "INVESTIGATOR"):
                    raise ValueError("Invalid task recipient")
                for ref in proposal.get("evidence_refs", []):
                    self.validate_reference(session, ref)
                key = p["semantic_key"]
                task = session.scalar(
                    select(m.VerificationTask).where(
                        m.VerificationTask.patient_id == req.patient_id,
                        m.VerificationTask.semantic_key == key,
                    )
                )
                created = task is None
                if not task:
                    if time.monotonic() >= self.deadline:
                        raise DomainError("TIMEOUT", "Task proposal exceeded execution deadline", 503)
                    unresolved = session.scalar(
                        select(m.OpenItem.open_item_id).where(
                            m.OpenItem.patient_id == req.patient_id, m.OpenItem.status == "OPEN"
                        )
                    )
                    if not unresolved:
                        raise ValueError("Task requires an existing unresolved evidence issue")
                    task = m.VerificationTask(
                        task_id=new_id("TASK"),
                        patient_id=req.patient_id,
                        criterion_row_id=rule.criterion_row_id,
                        reason_code=proposal.get("reason_code", "ORDER_ONLY"),
                        question=proposal["question"],
                        semantic_key=key,
                        requested_for_role=proposal.get("requested_for_role", "INVESTIGATOR"),
                        created_by_execution_id=req.execution_id,
                        status="OPEN",
                        created_at=now(),
                    )
                    session.add(task)
                return dict(task_id=task.task_id, created=created), []
            if name == "classify_event_relevance":
                if p["event_id"] != req.event_id:
                    raise ValueError("Event outside scope")
                from backend.app.services.event_processor import relevance

                affected, _, reason = relevance(session, session.get(m.PatientEvent, req.event_id))
                refs = [wire_reference(evidence_ref(session, session.get(m.PatientEvent, req.event_id)))] if affected else []
                return dict(
                    affected_criterion_ids=[r.criterion_id for r in affected],
                    category="RELEVANT" if affected else "NO_ACTION",
                    reason=reason,
                ), refs
            if name == "get_case_status":
                case = session.get(m.ReviewCase, p["case_id"])
                if not case or case.trial_id != req.trial_id or case.patient_id != req.patient_id:
                    raise ValueError("Case outside scope")
                return dict(
                    status=case.status,
                    assigned_to=case.assigned_actor_id,
                    revision=case.revision,
                    linked_finding_ids=list(
                        session.scalars(
                            select(m.MonitoringFinding.finding_id).where(
                                m.MonitoringFinding.case_id == case.case_id
                            )
                        )
                    ),
                ), []
            if name == "get_prior_evaluation":
                if p["before_event_id"] != req.event_id:
                    raise ValueError("Event outside scope")
                from backend.app.services.serializers import assessment_dto

                assessment = session.scalar(
                    select(m.PatientTrialAssessment).where(
                        m.PatientTrialAssessment.caused_by_event_id == req.event_id
                    )
                )
                if not assessment:
                    return dict(prior=[]), []
                previous = (
                    session.get(m.PatientTrialAssessment, assessment.before_assessment_id)
                    if assessment.before_assessment_id
                    else None
                )
                old = assessment_dto(session, previous) if previous else None
                event_refs = [wire_reference(evidence_ref(session, session.get(m.PatientEvent, req.event_id)))]
                return dict(
                    prior=[
                        dict(
                            criterion_id=r.criterion_id,
                            before_result=next(
                                (v.status for v in old.criteria if v.criterion_id == r.criterion_id), None
                            )
                            if old
                            else None,
                            after_result=r.status,
                            before_assessment_id=assessment.before_assessment_id,
                            after_assessment_id=assessment.assessment_id,
                            trigger_event_id=req.event_id,
                        )
                        for r in assessment_dto(session, assessment).criteria
                    ]
                ), event_refs
            if not req.patient_id or p.get("patient_id") != req.patient_id:
                raise ValueError("Explicit patient scope required")
            models = {
                "search_notes": [m.ClinicalNote],
                "get_medication_timeline": [m.MedicationExposure, m.PatientFact],
                "get_lab_history": [m.LabObservation],
                "get_condition_history": [m.ConditionRecord, m.PatientFact],
            }
            selected = []
            for model in models.get(name, list(EVIDENCE_MODELS)):
                selected.extend(frozen_rows(session, req.evidence_snapshot_id, model, req.patient_id))
            if name == "get_condition_history":
                selected = [
                    row
                    for row in selected
                    if (
                        isinstance(row, m.ConditionRecord)
                        and row.code == p["code"]
                        and (not row.onset_date or row.onset_date.isoformat() <= p["as_of_date"])
                    )
                    or (isinstance(row, m.PatientFact) and row.domain_section == "condition_completeness")
                ]
            if name == "get_medication_timeline":
                selected = [
                    row
                    for row in selected
                    if isinstance(row, m.MedicationExposure)
                    or (isinstance(row, m.PatientFact) and row.domain_section == "medication_reconciliation")
                ]
            if name == "get_lab_history":
                selected = [row for row in selected if row.analyte_code == p["analyte_code"]]
            if "from_at" in p and "to_at" in p:
                low, high = (
                    TypeAdapter(d.IsoInstant).validate_python(p["from_at"]),
                    TypeAdapter(d.IsoInstant).validate_python(p["to_at"]),
                )
                if low > high:
                    raise ValueError("Reversed history interval")
                selected = [
                    row
                    for row in selected
                    if not getattr(row, "effective_at", None)
                    or low <= row.effective_at <= high
                    or (
                        getattr(row, "asserted_end_exclusive_at", None)
                        and row.effective_at <= high
                        and row.asserted_end_exclusive_at > low
                    )
                ]
            if name == "retrieve_patient_evidence" and p["evidence_types"]:
                selected = [
                    row
                    for row in selected
                    if getattr(row, "evidence_type", session.get(m.EvidenceSource, row.source_pk).kind)
                    in p["evidence_types"]
                ]
            if name == "search_notes":
                hits = []
                for note in selected:
                    for term in p["search_terms"]:
                        start = note.body.casefold().find(term.casefold())
                        if start >= 0:
                            hits.append(
                                dict(
                                    note_id=note.note_id,
                                    quote=note.body[start : start + len(term)],
                                    source_id=session.get(m.EvidenceSource, note.source_pk).source_id,
                                    span_start=start,
                                    span_end=start + len(term),
                                    recorded_at=note.recorded_at.isoformat(),
                                )
                            )
                refs = [wire_reference(evidence_ref(session, row)) for row in selected]
                return dict(hits=hits[: min(p["max_hits"], 10)]), refs
            if name == "evaluate_approved_rule":
                if (
                    p["criterion_id"] not in req.criterion_ids
                    or p["criterion_set_hash"] != version.approved_set_hash
                ):
                    raise ValueError("Unapproved rule scope")
                from datetime import date

                from backend.app.services.evaluator import evaluate
                from backend.app.services.serializers import protocol_dto

                rule = next(
                    r for r in protocol_dto(session, version).criteria if r.criterion_id == p["criterion_id"]
                )
                if rule.type == "MONITORING":
                    # The worker has already evaluated this event. Read that exact
                    # snapshot's result; never run a baseline evaluator or write here.
                    assessment = session.scalar(select(m.PatientTrialAssessment).where(
                        m.PatientTrialAssessment.caused_by_event_id == req.event_id,
                        m.PatientTrialAssessment.patient_id == req.patient_id,
                        m.PatientTrialAssessment.protocol_version_id == req.protocol_version_id,
                        m.PatientTrialAssessment.snapshot_id == req.evidence_snapshot_id,
                    )) if req.event_id else None
                    physical = next(r for r in rules if r.criterion_id == rule.criterion_id)
                    stored = session.scalar(select(m.CriterionResult).where(
                        m.CriterionResult.assessment_id == assessment.assessment_id,
                        m.CriterionResult.criterion_row_id == physical.criterion_row_id,
                    )) if assessment else None
                    if not stored:
                        raise ValueError("No independently evaluated event result in this snapshot")
                    refs = [wire_reference(d.EvidenceRef.model_validate(r)) for r in stored.evidence_refs_json]
                    return dict(result=stored.status, reason_codes=stored.reason_codes_json, evidence_refs=refs), refs
                args = [
                    frozen_rows(session, req.evidence_snapshot_id, model, req.patient_id)
                    for model in (m.PatientFact, m.ConditionRecord, m.LabObservation, m.MedicationExposure)
                ]
                open_items = list(session.scalars(select(m.OpenItem).where(
                    m.OpenItem.patient_id == req.patient_id, m.OpenItem.status == "OPEN")))
                result = evaluate(rule, date.fromisoformat(p["evaluation_date"]), *args, open_items=open_items)
                refs = [wire_reference(evidence_ref(session, row)) for row in result.evidence]
                return dict(result=result.status, reason_codes=result.reasons, evidence_refs=refs), refs
            facts = []
            for row in selected:
                if name == "get_lab_history" and row.analyte_code != p["analyte_code"]:
                    continue
                if (
                    name == "get_condition_history"
                    and isinstance(row, m.ConditionRecord)
                    and row.code != p["code"]
                ):
                    continue
                ref = evidence_ref(session, row)
                facts.append(
                    dict(
                        evidence_id=ref.evidence_id,
                        kind=ref.evidence_type,
                        value=getattr(
                            row,
                            "value_json",
                            getattr(
                                row, "value_num", getattr(row, "medication_code", getattr(row, "code", None))
                            ),
                        ),
                        unit=getattr(row, "unit", None),
                        effective_at=ref.model_dump(mode="json")["effective_at"],
                        recorded_at=row.recorded_at.isoformat(),
                        source_id=ref.source_id,
                        source_version=ref.source_version,
                        evidence_quality=getattr(row, "evidence_quality", "UNVERIFIED"),
                        evidence_state=getattr(row, "evidence_state", "NOT_ASSESSED"),
                    )
                )
            refs = [wire_reference(evidence_ref(session, row)) for row in selected]
            if name == "get_medication_timeline":
                return dict(
                    events=[f for f in facts if f["kind"] in p["evidence_types"]],
                    reconciliations=[f for f in facts if f["kind"] == "OTHER"],
                ), refs
            if name == "get_condition_history":
                completeness = next(
                    (
                        wire_reference(evidence_ref(session, row))
                        for row in selected
                        if isinstance(row, m.PatientFact) and row.domain_section == "condition_completeness"
                    ),
                    None,
                )
                return dict(facts=facts, completeness_ref=completeness), refs
            if name == "get_lab_history":
                return dict(facts=facts), refs
            scoped_rules = [r for r in rules if r.criterion_id in req.criterion_ids]
            for rule in scoped_rules:
                span = session.scalar(select(m.SourceSpan).where(
                    m.SourceSpan.source_pk == rule.source_pk, m.SourceSpan.page == rule.source_page,
                    m.SourceSpan.start_offset == rule.source_span_start,
                    m.SourceSpan.end_offset == rule.source_span_end))
                if span:
                    src = session.get(m.EvidenceSource, span.source_pk)
                    refs.append(dict(source_id=src.source_id, source_version=src.source_version,
                        evidence_id=span.span_id, page=span.page, span_start=span.start_offset,
                        span_end=span.end_offset, effective_at=None))
            open_items = list(session.scalars(select(m.OpenItem.reason_code).where(
                m.OpenItem.patient_id == req.patient_id, m.OpenItem.status == "OPEN", m.OpenItem.blocking.is_(True))))
            return dict(facts=facts, open_items=sorted(set(open_items))), refs
