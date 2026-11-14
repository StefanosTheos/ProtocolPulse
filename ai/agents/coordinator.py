"""Bounded model-directed tool loop; the gateway is the authorization/persistence boundary."""

import asyncio
from datetime import date, datetime
import hashlib
import json
import re
import time

from pydantic import ValidationError

from ai.agents.evidence_investigator import required_unknowns
from ai.agents.medication_investigator import unmapped
from ai.agents.monitoring_workflow import no_action
from ai.agents.protocol_intelligence import GuardError, validate_coverage, validate_drafts, verify_quote
from ai.providers.gemini import ProviderFailure, ProviderUnavailable, ToolCall
from ai.tools.schemas import (AgentResult, FinalProposal, GatewayError,
                              GatewaySuccess, ToolTrace, VERSION, wire)
from ai.tools.selection import TASK_TOOLS, TOOL_OUTPUTS, allowed_tools, reference_ids


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def ref_key(ref):
    return canonical(wire(ref))


def safe_text(value):
    # A conservative output/task gate supplements (not replaces) source grounding and human review.
    if value and re.search(r"\b(stop (?:the )?medication|stop taking|discontinue|withdraw the patient|"
                           r"patient is (?:safe|eligible)|enroll the patient|change (?:the )?dose)\b", value, re.I):
        raise GuardError("UNSAFE_CLINICAL_OUTPUT")


class Coordinator:
    def __init__(self, request, gateway, settings, provider):
        self.request, self.gateway, self.settings, self.provider = request, gateway, settings, provider
        self.tools = allowed_tools(request.role)
        self.trace, self.observations = [], []
        self.refs, self.pages = {}, {}
        self.ids = {request.execution_id, request.protocol_version_id, request.trial_id}
        self.ids.update(x for x in (request.patient_id, request.event_id, request.evidence_snapshot_id) if x)
        self.certified_drafts = None
        self.certified_coverage = None
        self.submitted_drafts = []
        self.attempts = 0

    def no_secret(self, value):
        if self.settings.api_key and self.settings.api_key in canonical(value):
            raise GuardError("SECRET_IN_PAYLOAD")

    def result(self, status, error=None, final=None, summary=None, reasons=None):
        f = final
        return wire(AgentResult(
            contract_version=VERSION, execution_id=self.request.execution_id, role=self.request.role,
            status=status, summary=f.summary if f else summary,
            evidence_refs=f.evidence_refs if f else list(self.refs.values()),
            unknown_reasons=sorted(set(f.unknown_reasons if f else []) | set(reasons or []) |
                                   required_unknowns(self.observations)),
            conflict_refs=f.conflict_refs if f else [], proposed_criteria=f.proposed_criteria if f else [],
            coverage=f.coverage if f else [], verification_questions=f.verification_questions if f else [],
            trace=self.trace, error_code=error, model_id=self.provider.model_id,
        ))

    def verify_refs(self, refs):
        if any(ref_key(ref) not in self.refs for ref in refs):
            raise GuardError("UNVERIFIED_EVIDENCE_REF")

    def arguments(self, call):
        if call.name not in self.tools:
            raise GuardError("TOOL_FORBIDDEN")
        args = self.tools[call.name].model_validate(call.arguments)
        payload = wire(args)
        self.no_secret(payload)
        request = self.request
        scope = {"patient_id": request.patient_id, "version_id": request.protocol_version_id,
                 "protocol_version_id": request.protocol_version_id, "snapshot_id": request.evidence_snapshot_id,
                 "event_id": request.event_id, "before_event_id": request.event_id}
        for key, expected in scope.items():
            if key in payload and (expected is None or payload[key] != expected):
                raise GuardError("SCOPE_VIOLATION")
        criteria = payload.get("criterion_ids", [payload["criterion_id"]] if "criterion_id" in payload else [])
        if request.criterion_ids and not set(criteria) <= set(request.criterion_ids):
            raise GuardError("SCOPE_VIOLATION")
        if "map_version" in payload and payload["map_version"] != "px104-terminology-v1":
            raise GuardError("SCOPE_VIOLATION")
        if call.name in {"parse_protocol", "locate_clause", "report_coverage"}:
            if payload["source_id"] != "SRC-PROTOCOL-PX104-V1":
                raise GuardError("SCOPE_VIOLATION")
        for limit in ("max_hits", "max_matches"):
            if limit in payload and not 1 <= payload[limit] <= 10:
                raise GuardError("BAD_TOOL_INPUT")
        if "from_at" in payload:
            a, b = [datetime.fromisoformat(payload[k].replace("Z", "+00:00")) for k in ("from_at", "to_at")]
            if a.utcoffset() is None or b.utcoffset() is None or a >= b:
                raise GuardError("BAD_TOOL_INPUT")
        for key in ("as_of_date", "evaluation_date"):
            if key in payload:
                date.fromisoformat(payload[key])
        if "drafts" in payload:
            validate_drafts(args.drafts, request, self.pages)
        if call.name == "get_evidence_link":
            if not any((r.evidence_id, r.source_id, r.source_version) ==
                       (args.evidence_id, args.source_id, args.source_version) for r in self.refs.values()):
                raise GuardError("UNVERIFIED_EVIDENCE_REF")
        if call.name == "request_verification_task":
            p = args.proposal
            if p.patient_id != request.patient_id or (request.criterion_ids and p.criterion_id not in request.criterion_ids):
                raise GuardError("SCOPE_VIOLATION")
            self.verify_refs(p.evidence_refs)
            if not p.evidence_refs:
                raise GuardError("UNVERIFIED_EVIDENCE_REF")
            safe_text(p.question)
        if call.name == "request_med_reconciliation":
            safe_text(args.question)
            if not args.source_event_ids or not set(args.source_event_ids) <= self.ids:
                raise GuardError("UNVERIFIED_EVIDENCE_REF")
        if call.name in TASK_TOOLS:
            if not self.observations or not self.refs:
                raise GuardError("UNVERIFIED_EVIDENCE_REF")
            # Natural-language rephrasing/ref ordering must not create another logical task.
            if call.name == "request_verification_task":
                proposal = payload["proposal"]
                semantic = {k: proposal[k] for k in ("patient_id", "criterion_id", "reason_code")}
                semantic["evidence"] = sorted({canonical(r) for r in proposal["evidence_refs"]})
            else:
                semantic = {k: payload[k] for k in ("patient_id", "criterion_id")}
                semantic["source_event_ids"] = sorted(set(payload["source_event_ids"]))
            payload["semantic_key"] = hashlib.sha256(canonical(semantic).encode()).hexdigest()
        common = {"contract_version": VERSION, "execution_id": request.execution_id,
                  "trial_id": request.trial_id, "protocol_version_id": request.protocol_version_id,
                  "correlation_id": request.correlation_id}
        if request.patient_id is not None:
            common["patient_id"] = request.patient_id
        return {**common, **payload}

    def observe(self, name, response, arguments):
        self.no_secret(wire(response))
        if response.tool_name != name:
            raise GuardError("BAD_GATEWAY_OUTPUT")
        data = TOOL_OUTPUTS[name].model_validate(response.data)
        for ref in response.evidence_refs:
            self.refs[ref_key(ref)] = ref
        self.ids.update(reference_ids(response.data))
        if name in {"parse_protocol", "locate_clause"}:
            spans = data.pages if name == "parse_protocol" else data.spans
            for span in spans:
                if span.source_id != "SRC-PROTOCOL-PX104-V1" or span.source_version != 1:
                    raise GuardError("SCOPE_VIOLATION")
                if span.end - span.start != len(span.text) or hashlib.sha256(span.text.encode()).hexdigest() != span.sha256:
                    raise GuardError("UNVERIFIED_EVIDENCE_REF")
                key = (span.source_id, span.page)
                previous = self.pages.get(key)
                if previous and (previous.source_version != span.source_version or
                                 previous.text[span.start - previous.start:span.end - previous.start] != span.text):
                    raise GuardError("SOURCE_VERSION_CONFLICT")
                if not previous:
                    self.pages[key] = span
        elif name == "validate_rule_schema":
            validate_drafts(data.valid, self.request, self.pages)
            submitted = {d["criterion_id"]: d for d in arguments["drafts"]}
            if any(submitted.get(d.criterion_id) != wire(d) for d in data.valid):
                raise GuardError("BAD_GATEWAY_OUTPUT")
            self.certified_drafts = None if data.errors else [wire(c) for c in data.valid]
        elif name == "report_coverage":
            drafts = self.submitted_drafts
            from ai.tools.schemas import CriterionDraftInput
            validate_coverage(data.items, [CriterionDraftInput.model_validate(d) for d in drafts], self.pages, False)
            if data.blocking_count != sum(item.status == "BLOCKING" for item in data.items):
                raise GuardError("BAD_GATEWAY_OUTPUT")
            self.certified_coverage = [wire(c) for c in data.items]
        elif name == "get_evidence_link":
            self.verify_refs([data.reference])
            if any(getattr(data.reference, k) != arguments[k] for k in ("evidence_id", "source_id", "source_version")):
                raise GuardError("UNVERIFIED_EVIDENCE_REF")
        elif name == "resolve_approved_terminology":
            if (data.status == "UNMAPPED") != (data.mapped_class is None):
                raise GuardError("BAD_GATEWAY_OUTPUT")
        self.observations.append((name, response.data))
        return data

    def finish(self, final):
        self.no_secret(wire(final))
        self.verify_refs(final.evidence_refs)
        if not set(final.conflict_refs) <= self.ids:
            raise GuardError("UNVERIFIED_EVIDENCE_REF")
        for text in [final.summary, *final.verification_questions]:
            safe_text(text)
            if self.settings.api_key and self.settings.api_key in (text or ""):
                raise GuardError("SECRET_IN_OUTPUT")
        if self.request.role == "PROTOCOL_INTELLIGENCE":
            validate_drafts(final.proposed_criteria, self.request, self.pages)
            validate_coverage(final.coverage, final.proposed_criteria, self.pages, not final.incomplete)
            if not final.incomplete and (
                self.certified_drafts != [wire(c) for c in final.proposed_criteria] or
                self.certified_coverage != [wire(c) for c in final.coverage]
            ):
                raise GuardError("UNCERTIFIED_EXTRACTION")
        else:
            if final.proposed_criteria or final.coverage:
                raise GuardError("TOOL_FORBIDDEN")
            if not final.incomplete and (not self.observations or not final.evidence_refs):
                raise GuardError("UNVERIFIED_EVIDENCE_REF")
            if final.summary and not final.evidence_refs:
                raise GuardError("UNVERIFIED_EVIDENCE_REF")
        reasons = required_unknowns(self.observations)
        return self.result("PARTIAL" if final.incomplete or reasons or final.unknown_reasons else "SUCCEEDED",
                           final=final)

    async def invoke(self, call):
        payload = self.arguments(call)
        if call.name == "validate_rule_schema":
            self.submitted_drafts = payload["drafts"]
        for _ in range(self.settings.max_attempts):
            if self.attempts >= min(self.request.max_steps, self.settings.max_steps):
                raise GuardError("STEP_BUDGET_EXHAUSTED")
            self.attempts += 1
            started = time.monotonic()
            try:
                raw = await asyncio.wait_for(self.gateway.invoke(call.name, payload), self.settings.tool_timeout)
                if "error_code" in raw:
                    error = GatewayError.model_validate(raw)
                    if error.tool_name != call.name:
                        raise GuardError("BAD_GATEWAY_OUTPUT")
                    if error.error_code not in {"TIMEOUT", "SOURCE_UNAVAILABLE", "UNMAPPED_CODE", "UNAUTHORIZED", "BAD_INPUT"}:
                        raise GuardError("BAD_GATEWAY_OUTPUT")
                    code, retry = error.error_code, error.retryable and error.error_code in {"TIMEOUT", "SOURCE_UNAVAILABLE"}
                else:
                    response = GatewaySuccess.model_validate(raw)
                    self.observe(call.name, response, payload)
                    self.trace.append(ToolTrace(tool_name=call.name, input_reference_ids=reference_ids(payload),
                        output_reference_ids=reference_ids(wire(response)), result_code=response.result_code,
                        elapsed_ms=int((time.monotonic() - started) * 1000)))
                    return wire(response)
            except TimeoutError:
                code, retry = "TIMEOUT", True
            except asyncio.CancelledError:
                self.trace.append(ToolTrace(tool_name=call.name, input_reference_ids=reference_ids(payload),
                    output_reference_ids=[], result_code="ERROR", elapsed_ms=int((time.monotonic() - started) * 1000),
                    error_code="CANCELLED"))
                raise
            except GuardError as error:
                code, retry = error.code, False
            except (ValidationError, ValueError, TypeError):
                code, retry = "BAD_GATEWAY_OUTPUT", False
            except Exception:
                code, retry = "SOURCE_UNAVAILABLE", False
            self.trace.append(ToolTrace(tool_name=call.name, input_reference_ids=reference_ids(payload),
                output_reference_ids=[], result_code="ERROR", elapsed_ms=int((time.monotonic() - started) * 1000),
                error_code=code))
            if not retry:
                raise GuardError(code)
        raise GuardError(code)

    async def loop(self):
        self.no_secret(wire(self.request))
        for _ in range(min(self.request.max_steps, self.settings.max_steps) + 1):
            action = await asyncio.wait_for(self.provider.next(wire(self.request), self.tools), self.settings.model_timeout)
            if isinstance(action, FinalProposal):
                return self.finish(action)
            if not isinstance(action, ToolCall):
                raise GuardError("INVALID_MODEL_OUTPUT")
            response = await self.invoke(action)
            await self.provider.observe(action, response)
            if action.name == "classify_event_relevance" and no_action(response["data"]):
                # The categorized gateway observation is sufficient. No cited clinical
                # summary is generated for an irrelevant event with no retrieved evidence.
                return self.result("SUCCEEDED")
            if action.name == "resolve_approved_terminology" and unmapped(response["data"]):
                return self.result("PARTIAL", summary="Approved terminology mapping unavailable; human verification required.",
                                   reasons=["UNMAPPED_CODE"])
            if action.name == "parse_protocol" and response["data"]["unreadable_pages"]:
                return self.result("PARTIAL", error="INCOMPLETE_EXTRACTION", reasons=["INCOMPLETE_EXTRACTION"])
        raise GuardError("STEP_BUDGET_EXHAUSTED")

    async def run(self):
        try:
            return await asyncio.wait_for(self.loop(), self.settings.agent_timeout)
        except GuardError as error:
            partial = error.code in {"STEP_BUDGET_EXHAUSTED", "TIMEOUT", "SOURCE_UNAVAILABLE", "INCOMPLETE_EXTRACTION"}
            return self.result("PARTIAL" if partial else "FAILED", error=error.code)
        except TimeoutError:
            return self.result("PARTIAL", error="AGENT_TIMEOUT")
        except ProviderUnavailable:
            return self.result("UNAVAILABLE", error="SDK_UNAVAILABLE")
        except ProviderFailure as error:
            return self.result("FAILED", error=str(error))
        except (ValidationError, ValueError, TypeError):
            return self.result("FAILED", error="INVALID_MODEL_OUTPUT")
        except Exception:
            return self.result("FAILED", error="AGENT_INTERNAL_ERROR")
