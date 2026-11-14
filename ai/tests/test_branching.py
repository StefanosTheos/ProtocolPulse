import asyncio
import copy
import json

import pytest

from ai.agents.coordinator import Coordinator
from ai.config import Settings
from ai.evals.fixtures import ScenarioModel, gateway, proposal, protocol_gateway, request, success
from ai.providers.gemini import ToolCall
from ai.tools.schemas import AgentRequest


def run(raw, gw, model, **settings):
    return asyncio.run(Coordinator(AgentRequest.model_validate(raw), gw,
        Settings(enabled=True, api_key="synthetic-test-key", **settings), model).run())


def test_medication_branches_on_actual_returned_evidence():
    unknown_gw = gateway()
    known_gw = gateway("P-117", order=False)
    unknown = run(request(), unknown_gw, ScenarioModel())
    known = run(request(patient="P-117"), known_gw, ScenarioModel())
    assert unknown["status"] == "PARTIAL" and unknown["unknown_reasons"] == ["ORDER_ONLY"]
    assert known["status"] == "SUCCEEDED"
    assert any(name == "request_verification_task" for name, _ in unknown_gw.calls)
    assert not any(name.startswith("request_") for name, _ in known_gw.calls)
    assert len({name for name, _ in known_gw.calls}) >= 2
    assert "candidate_status" not in known
    assert len(unknown["trace"]) == len(unknown_gw.calls)
    assert all(set(t) == {"tool_name", "input_reference_ids", "output_reference_ids", "result_code",
                          "elapsed_ms", "error_code"} for t in unknown["trace"])


def test_medication_fact_id_cannot_be_used_as_a_source_event_id():
    class InvalidEventModel(ScenarioModel):
        async def next(self, raw, tools):
            if not self.observed:
                return ToolCall('retrieve_patient_evidence', {'patient_id': raw['patient_id'],
                    'criterion_ids': raw['criterion_ids'], 'snapshot_id': raw['evidence_snapshot_id'],
                    'evidence_types': ['ORDER']})
            return ToolCall('request_med_reconciliation', {'patient_id': raw['patient_id'],
                'criterion_id': 'PX-EXC-02', 'source_event_ids': ['EV-MED-P-083-1'],
                'question': 'Please verify the recorded medication order.', 'semantic_key': 'untrusted'})
    gw = gateway()
    result = run(request(), gw, InvalidEventModel())
    assert result['status'] == 'FAILED' and result['error_code'] == 'UNVERIFIED_EVIDENCE_REF'
    assert [name for name, _ in gw.calls] == ['retrieve_patient_evidence']


@pytest.mark.parametrize("stale,reason", [(False, "MISSING_LAB"), (True, "OUTDATED_LAB")])
def test_lab_branch_preserves_missing_and_stale_evidence(stale, reason):
    gw = gateway("P-124", stale_lab=stale, missing_lab=not stale)
    result = run(request("EVIDENCE_INVESTIGATOR", "P-124", "PX-INC-03"), gw, ScenarioModel("lab"))
    assert result["status"] == "PARTIAL" and reason in result["unknown_reasons"]
    assert [name for name, _ in gw.calls] == ["get_lab_history", "request_verification_task"]


def test_conflicting_notes_keep_both_references():
    gw = gateway("P-140", conflict=True)
    result = run(request(patient="P-140"), gw, ScenarioModel("conflict"))
    assert result["status"] == "PARTIAL" and "CONFLICTING_SOURCES" in result["unknown_reasons"]
    assert len(result["conflict_refs"]) == 2
    assert result["conflict_refs"] == [r["evidence_id"] for r in result["evidence_refs"]]


def test_no_action_stops_after_backend_relevance_without_note_scans():
    gw = gateway("P-151", irrelevant=True)
    result = run(request("MONITORING_WORKFLOW", "P-151", "PX-MON-01"), gw, ScenarioModel("monitor"))
    assert result["status"] == "SUCCEEDED"
    assert [name for name, _ in gw.calls] == ["classify_event_relevance"]


def test_complete_protocol_does_not_repeat_large_validated_json_through_model():
    gw, oracle = protocol_gateway()
    class NoRedundantCall(ScenarioModel):
        async def next(self, raw, tools):
            assert len(self.observed) < 3, 'Validated extraction must not need a fourth inference call'
            return await super().next(raw, tools)
    result = run(request('PROTOCOL_INTELLIGENCE'), gw, NoRedundantCall('protocol', oracle))
    assert result['status'] == 'SUCCEEDED'
    assert len(result['proposed_criteria']) == 8 and len(result['coverage']) == 12
    assert all(c['workflow_status'] == 'PROPOSED' for c in result['proposed_criteria'])


def test_monitor_reads_existing_case_and_never_writes_it():
    gw = gateway("P-042", order=False)
    result = run(request("MONITORING_WORKFLOW", "P-042", "PX-MON-01"), gw, ScenarioModel("monitor"))
    assert result["status"] == "SUCCEEDED"
    assert [name for name, _ in gw.calls] == ["classify_event_relevance", "get_prior_evaluation", "get_case_status"]
    assert "CASE-P042" in gw.calls[-1][1].values()


def test_task_semantic_key_and_scope_are_stable_across_retry_handoffs():
    gw1, gw2 = gateway(), gateway()
    run(request(), gw1, ScenarioModel())
    run(request(), gw2, ScenarioModel())
    p1, p2 = [gw.calls[-1][1] for gw in (gw1, gw2)]
    assert p1 == p2 and len(p1["semantic_key"]) == 64
    assert p1["semantic_key"] != "mock-key-will-be-canonicalized"
    assert p1["execution_id"] == request()["execution_id"]
    assert p1["trial_id"] == "TR-PX104" and p1["contract_version"] == "1.0.0-rc2"
    # Actual cross-call/durable deduplication is a backend unique-constraint obligation.


def test_task_identity_survives_model_rephrasing_and_reference_reordering():
    class Rephrased(ScenarioModel):
        async def next(self, request, tools):
            action = await super().next(request, tools)
            if isinstance(action, ToolCall) and action.name == "request_verification_task":
                action.arguments["proposal"]["question"] = "Please inspect the same unresolved medication sources."
                action.arguments["proposal"]["evidence_refs"].reverse()
            return action
    first, second = gateway("P-140", conflict=True), gateway("P-140", conflict=True)
    run(request(patient="P-140"), first, ScenarioModel("conflict"))
    run(request(patient="P-140"), second, Rephrased("conflict"))
    one, two = first.calls[-1][1], second.calls[-1][1]
    assert one["proposal"]["question"] != two["proposal"]["question"]
    assert one["semantic_key"] == two["semantic_key"]


def test_protocol_positive_and_ambiguous_source_have_distinct_outcomes():
    good_gw, good_oracle = protocol_gateway()
    bad_gw, bad_oracle = protocol_gateway(ambiguous=True)
    good = run(request("PROTOCOL_INTELLIGENCE"), good_gw, ScenarioModel("protocol", good_oracle))
    bad = run(request("PROTOCOL_INTELLIGENCE"), bad_gw, ScenarioModel("protocol", bad_oracle, True))
    assert good["status"] == "SUCCEEDED" and len(good["proposed_criteria"]) == 8
    assert len(good["coverage"]) == 12 and sum(c["status"] == "INFORMATIONAL" for c in good["coverage"]) == 4
    assert all(c["workflow_status"] == "PROPOSED" and "approved_by" not in c for c in good["proposed_criteria"])
    assert bad["status"] == "PARTIAL" and any(c["status"] == "BLOCKING" for c in bad["coverage"])
    assert [name for name, _ in bad_gw.calls] == ["parse_protocol", "locate_clause", "validate_rule_schema", "report_coverage"]


def test_unreadable_source_cannot_be_substituted_with_curated_answers():
    gw, oracle = protocol_gateway(unreadable=True)
    result = run(request("PROTOCOL_INTELLIGENCE"), gw, ScenarioModel("protocol", oracle))
    assert result["status"] == "PARTIAL" and result["error_code"] == "INCOMPLETE_EXTRACTION"
    assert result["proposed_criteria"] == [] and len(gw.calls) == 1


def test_unmapped_terminology_remains_unresolved():
    gw = gateway()
    gw.handlers["resolve_approved_terminology"] = success("resolve_approved_terminology", {
        "code": "SYN-UNMAPPED", "mapped_class": None, "status": "UNMAPPED", "mapping_source_id": None})
    result = run(request(), gw, ScenarioModel())
    assert result["status"] == "PARTIAL" and result["unknown_reasons"] == ["UNMAPPED_CODE"]
    assert len(gw.calls) == 2
