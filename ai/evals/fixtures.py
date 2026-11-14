"""Synthetic gateways and mocked, response-dependent model choices for reproducible evals.

This module may read expected outputs; the production coordinator/provider cannot.
"""

import copy
import hashlib
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from ai.providers.gemini import ToolCall
from ai.tools.fake_gateway import FakeGateway
from ai.tools.schemas import FinalProposal

PACK = Path(__file__).resolve().parents[2] / "fixtures/protocols/px104-v1"
SOURCE = "SRC-PROTOCOL-PX104-V1"
PROTOCOL = "PV-PX104-1.0"
WATERMARK = "2026-10-31T22:00:00Z"


def request(role="MEDICATION_SAFETY_INVESTIGATOR", patient="P-083", criterion="PX-EXC-02"):
    return {"contract_version": "1.0.0-rc2", "execution_id": f"EX-{patient}-{role}", "role": role,
            "objective": "Investigate the source-linked uncertainty." + (
                " Monitoring case CASE-P042 already exists." if role == "MONITORING_WORKFLOW" and patient == "P-042" else ""),
            "trial_id": "TR-PX104", "protocol_version_id": PROTOCOL,
            "criterion_ids": [] if role == "PROTOCOL_INTELLIGENCE" else [criterion],
            "patient_id": None if role == "PROTOCOL_INTELLIGENCE" else patient,
            "event_id": "EVT-P042-D18-01" if role == "MONITORING_WORKFLOW" else None,
            "evidence_snapshot_id": None if role == "PROTOCOL_INTELLIGENCE" else
                f"SNAP-MONITOR-{patient}" if role == "MONITORING_WORKFLOW" else "SNAP-BASELINE",
            "correlation_id": str(uuid5(NAMESPACE_URL, f"protocolpulse/{patient}/{role}")), "max_steps": 8}


def ref(patient, kind="MED", number=1):
    return {"source_id": f"SRC-{kind}-{patient}-{number}", "source_version": 1,
            "evidence_id": f"EV-{kind}-{patient}-{number}", "page": None,
            "span_start": None, "span_end": None, "effective_at": None}


def fact(reference, kind="ORDER", value="SYN-MED-R1"):
    return {"evidence_id": reference["evidence_id"], "kind": kind, "value": value, "unit": None,
            "effective_at": "2026-10-15T09:00:00+03:00", "recorded_at": "2026-10-15T09:30:00+03:00",
            "source_id": reference["source_id"], "source_version": 1,
            "evidence_quality": "HIGH", "evidence_state": "POSITIVE"}


def success(name, data, refs=None):
    return {"tool_name": name, "data": data, "evidence_refs": refs or [],
            "source_watermark": WATERMARK, "result_code": "OK"}


def proposal(refs=None, **changes):
    value = {"summary": "Source evidence is available for investigator review.", "evidence_refs": refs or [],
             "unknown_reasons": [], "conflict_refs": [], "proposed_criteria": [], "coverage": [],
             "verification_questions": [], "incomplete": False}
    value.update(changes)
    return FinalProposal.model_validate(value)


def gateway(patient="P-083", order=True, conflict=False, missing_lab=False, irrelevant=False, stale_lab=False):
    r = ref(patient, "GAP" if missing_lab else "LAB" if stale_lab else "NOTE" if conflict else "MED")
    r2 = ref(patient, "NOTE", 2)
    f = fact(r, "ORDER" if order else "ADMINISTRATION")
    if patient == "P-042" and not order:
        f.update(effective_at="2026-11-19T09:30:00+02:00", recorded_at="2026-11-20T11:00:00+02:00")
        r["effective_at"] = f["effective_at"]
    lab = fact(r, "LAB", 82)
    lab.update(unit="mL/min/1.73m²", effective_at="2026-09-01T09:00:00+03:00")
    refs = [r, r2] if conflict else [r]
    handlers = {
        "retrieve_patient_evidence": success("retrieve_patient_evidence", {"facts": [f], "open_items": []}, refs),
        "resolve_approved_terminology": success("resolve_approved_terminology", {
            "code": "SYN-MED-R1", "mapped_class": "SYN-CLASS-R", "status": "MAPPED", "mapping_source_id": "SRC-MAP-V1"}),
        "get_medication_timeline": success("get_medication_timeline", {"events": [f], "reconciliations": []}, refs),
        "get_evidence_link": lambda payload: success("get_evidence_link", {
            "reference": next(x for x in refs if x["evidence_id"] == payload["evidence_id"]),
            "quote": "The synthetic source documents an order, not confirmed use." if order else "A synthetic dose was administered."}, refs),
        "request_verification_task": success("request_verification_task", {"task_id": f"TASK-{patient}", "created": True}),
        "request_med_reconciliation": success("request_med_reconciliation", {"task_id": f"TASK-MED-{patient}", "created": True}),
        "get_lab_history": success("get_lab_history", {"facts": [lab] if stale_lab else []}, [r]),
        "search_notes": success("search_notes", {"hits": [
            {"note_id": r["evidence_id"], "quote": "The patient reports continuing use; dates uncertain.",
             "source_id": r["source_id"], "span_start": 0, "span_end": 58, "recorded_at": WATERMARK},
            {"note_id": r2["evidence_id"], "quote": "The patient reports stopping before the window; dates uncertain.",
             "source_id": r2["source_id"], "span_start": 0, "span_end": 63, "recorded_at": WATERMARK}]}, refs),
        "classify_event_relevance": success("classify_event_relevance", {
            "affected_criterion_ids": [] if irrelevant else ["PX-MON-01"],
            "category": "NO_ACTION" if irrelevant else "RELEVANT", "reason": "Approved dependency check"}, [r]),
        "get_prior_evaluation": success("get_prior_evaluation", {"prior": [{"criterion_id": "PX-MON-01",
            "before_result": None, "after_result": "FAIL", "before_assessment_id": "ASSESS-BEFORE",
            "after_assessment_id": "ASSESS-AFTER", "trigger_event_id": "EVT-P042-D18-01"}]}, [r]),
        "get_case_status": success("get_case_status", {"status": "OPEN", "assigned_to": "ACT-INV-01",
            "revision": 1, "linked_finding_ids": ["FIND-P042"]}, [r]),
    }
    if patient == "P-042" and not order:
        for handler in handlers.values():
            if isinstance(handler, dict):
                handler["source_watermark"] = "2026-11-20T09:00:01Z"
        link = handlers["get_evidence_link"]
        handlers["get_evidence_link"] = lambda payload: {**link(payload), "source_watermark": "2026-11-20T09:00:01Z"}
    return FakeGateway(handlers)


def protocol_fixture():
    return json.loads((PACK / "expected_extraction.json").read_text(encoding="utf-8"))


def protocol_gateway(ambiguous=False, unreadable=False):
    page_data = json.loads((PACK / "source_pages.json").read_text(encoding="utf-8"))
    oracle = protocol_fixture()
    pages = [{"source_id": SOURCE, "source_version": 1, "page": p["page"], "text": p["text"],
              "start": 0, "end": len(p["text"]), "sha256": hashlib.sha256(p["text"].encode()).hexdigest(),
              "quality": "OK"} for p in page_data["pages"]]
    if ambiguous:
        draft = oracle["criteria"][0]
        page = pages[draft["source_page"] - 1]
        old = draft["source_quote"]
        new = old.replace("40 to 70", "TBD age?")  # Same length; all following anchors remain valid.
        page["text"] = page["text"].replace(old, new)
        page["sha256"] = hashlib.sha256(page["text"].encode()).hexdigest()
        draft.update(source_quote=new, threshold=None, workflow_status="NEEDS_CLARIFICATION", ambiguity="Age range is TBD.")
        oracle["coverage"][2].update(status="BLOCKING", criterion_ids=[], review_note=None)
    def validated(payload):
        return success("validate_rule_schema", {"valid": payload["drafts"], "errors":
            [{"criterion_id": "PX-INC-01", "code": "NEEDS_CLARIFICATION"}] if ambiguous else []})
    result = FakeGateway({
        "parse_protocol": success("parse_protocol", {"pages": pages, "unreadable_pages": [2] if unreadable else [],
            "file_sha256": hashlib.sha256((PACK / "PX-104-v1.0-fictional.pdf").read_bytes()).hexdigest()}),
        "locate_clause": success("locate_clause", {"spans": [pages[1]]}),
        "validate_rule_schema": validated,
        "report_coverage": success("report_coverage", {"items": oracle["coverage"], "blocking_count": int(ambiguous)}),
    })
    return result, oracle


class ScenarioModel:
    """A mocked model, explicitly restricted to evaluation/tests. Branches on real tool responses."""

    model_id = "MOCK-GEMINI-FOR-EVALUATION"

    def __init__(self, scenario="medication", oracle=None, ambiguous=False):
        self.scenario, self.oracle, self.ambiguous = scenario, oracle, ambiguous
        self.observed = []
        self.closed = False

    async def observe(self, call, response):
        self.observed.append((call, copy.deepcopy(response)))

    async def close(self):
        self.closed = True

    async def next(self, request, tools):
        patient, snapshot = request["patient_id"], request["evidence_snapshot_id"]
        last = self.observed[-1][0].name if self.observed else None
        refs = {json.dumps(r, sort_keys=True): r for _, result in self.observed for r in result["evidence_refs"]}
        refs = list(refs.values())
        def call(name, **args):
            return ToolCall(name, args)
        def task(reason):
            return call("request_verification_task", proposal={"patient_id": patient,
                "criterion_id": request["criterion_ids"][0], "reason_code": reason, "evidence_refs": refs,
                "question": "Please reconcile the unresolved source evidence.", "requested_for_role": "INVESTIGATOR"},
                semantic_key="mock-key-will-be-canonicalized")
        if self.scenario == "protocol":
            if last is None:
                return call("parse_protocol", source_id=SOURCE, version_id=PROTOCOL)
            if last == "parse_protocol" and self.ambiguous:
                return call("locate_clause", source_id=SOURCE, query="age range ambiguity", section_ids=["PX-SECTION-INC-01"], max_matches=2)
            if last in {"parse_protocol", "locate_clause"}:
                return call("validate_rule_schema", drafts=self.oracle["criteria"])
            if last == "validate_rule_schema":
                return call("report_coverage", source_id=SOURCE, drafts=self.oracle["criteria"],
                            sections=[x["section_id"] for x in self.oracle["coverage"]])
            return proposal(summary=None, proposed_criteria=self.oracle["criteria"], coverage=self.oracle["coverage"],
                            incomplete=self.ambiguous, unknown_reasons=["INCOMPLETE_EXTRACTION"] if self.ambiguous else [])
        if self.scenario == "monitor":
            if last is None:
                return call("classify_event_relevance", event_id=request["event_id"], protocol_version_id=PROTOCOL)
            if last == "classify_event_relevance":
                return call("get_prior_evaluation", patient_id=patient, criterion_ids=request["criterion_ids"], before_event_id=request["event_id"])
            if last == "get_prior_evaluation":
                return call("get_case_status", case_id="CASE-P042")
            return proposal(refs, summary="The backend case is OPEN; source-linked investigator review remains required.")
        if self.scenario == "lab":
            if last is None:
                return call("get_lab_history", patient_id=patient, analyte_code="EGFR", from_at="2026-09-01T00:00:00+03:00",
                            to_at=WATERMARK, snapshot_id=snapshot)
            reason = "OUTDATED_LAB" if self.observed[0][1]["data"]["facts"] else "MISSING_LAB"
            if last == "get_lab_history":
                return task(reason)
            return proposal(refs, unknown_reasons=[reason], verification_questions=["Please provide reviewed timely evidence."], incomplete=True)
        if self.scenario == "conflict":
            if last is None:
                return call("search_notes", patient_id=patient, search_terms=["reported use", "stopped"], snapshot_id=snapshot, max_hits=2)
            if last == "search_notes":
                return call("get_medication_timeline", patient_id=patient, from_at="2026-10-01T00:00:00+03:00", to_at="2026-10-31T00:00:00+02:00",
                            snapshot_id=snapshot, evidence_types=["REPORTED_USE", "DISCONTINUATION", "ORDER"])
            if last == "get_medication_timeline":
                return task("CONFLICTING_SOURCES")
            return proposal(refs, unknown_reasons=["CONFLICTING_SOURCES"], conflict_refs=[r["evidence_id"] for r in refs], incomplete=True)
        if last is None:
            return call("retrieve_patient_evidence", patient_id=patient, criterion_ids=request["criterion_ids"], snapshot_id=snapshot, evidence_types=["MEDICATION"])
        if last == "retrieve_patient_evidence":
            return call("resolve_approved_terminology", medication_code=self.observed[-1][1]["data"]["facts"][0]["value"], map_version="px104-terminology-v1")
        if last == "resolve_approved_terminology":
            return call("get_medication_timeline", patient_id=patient, from_at="2026-10-01T00:00:00+03:00", to_at="2026-10-31T00:00:00+02:00",
                        snapshot_id=snapshot, evidence_types=["ORDER", "DISPENSE", "ADMINISTRATION", "REPORTED_USE"])
        if last == "get_medication_timeline":
            return call("get_evidence_link", evidence_id=refs[0]["evidence_id"], source_id=refs[0]["source_id"], source_version=1)
        timeline = next(result["data"] for called, result in self.observed if called.name == "get_medication_timeline")
        order_only = not any(e["kind"] in {"ADMINISTRATION", "REPORTED_USE"} for e in timeline["events"])
        if order_only and last == "get_evidence_link":
            return task("ORDER_ONLY")
        return proposal(refs, summary="Source documents an order; use is unverified." if order_only else
                        "Source documents administration; investigator review remains required.",
                        unknown_reasons=["ORDER_ONLY"] if order_only else [], incomplete=order_only)
