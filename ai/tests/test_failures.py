import asyncio
import json

import pytest

from ai.agents.coordinator import Coordinator
from ai.config import Settings
from ai.evals.fixtures import ScenarioModel, gateway, proposal, request
from ai.providers.gemini import ProviderFailure, ToolCall
from ai.tools.schemas import AgentRequest
from ai.tools.fake_gateway import FakeGateway


def run(model, gw, **settings):
    return asyncio.run(Coordinator(AgentRequest.model_validate(request()), gw,
        Settings(enabled=True, api_key="synthetic-test-key", **settings), model).run())


def test_timeout_retries_count_against_same_gateway_budget():
    async def timeout(payload):
        await asyncio.sleep(1)
    gw = gateway()
    gw.handlers["retrieve_patient_evidence"] = timeout
    result = run(ScenarioModel(), gw, tool_timeout=0.005, max_attempts=3)
    assert result["status"] == "PARTIAL" and result["error_code"] == "TIMEOUT"
    assert len(gw.calls) == len(result["trace"]) == 3
    assert all(t["error_code"] == "TIMEOUT" for t in result["trace"])


def test_step_budget_never_resets_on_retry():
    gw = gateway()
    gw.handlers["retrieve_patient_evidence"] = {"tool_name": "retrieve_patient_evidence",
        "error_code": "SOURCE_UNAVAILABLE", "retryable": True}
    result = run(ScenarioModel(), gw, max_steps=2, max_attempts=3)
    assert result["status"] == "PARTIAL" and result["error_code"] == "STEP_BUDGET_EXHAUSTED"
    assert len(gw.calls) == 2


def test_transient_gateway_failure_recovers_with_same_request_payload():
    gw = gateway()
    valid = gw.handlers["retrieve_patient_evidence"]
    def flaky(payload):
        if len(gw.calls) == 1:
            return {"tool_name": "retrieve_patient_evidence", "error_code": "SOURCE_UNAVAILABLE", "retryable": True}
        return valid
    gw.handlers["retrieve_patient_evidence"] = flaky
    result = run(ScenarioModel(), gw)
    assert result["status"] == "PARTIAL" and result["error_code"] is None
    assert gw.calls[0] == gw.calls[1]
    assert result["trace"][0]["error_code"] == "SOURCE_UNAVAILABLE"
    assert result["trace"][1]["error_code"] is None


@pytest.mark.parametrize("code", ["UNMAPPED_CODE", "UNAUTHORIZED", "BAD_INPUT"])
def test_nontransient_error_never_retried_even_if_gateway_marks_retryable(code):
    gw = gateway()
    gw.handlers["retrieve_patient_evidence"] = {"tool_name": "retrieve_patient_evidence", "error_code": code, "retryable": True}
    result = run(ScenarioModel(), gw)
    assert result["status"] == "FAILED" and len(gw.calls) == 1


def test_model_timeout_and_overall_deadline_are_both_bounded():
    class Sleeping(ScenarioModel):
        async def next(self, request, tools):
            await asyncio.sleep(1)
    assert run(Sleeping(), gateway(), model_timeout=0.005)["status"] == "PARTIAL"
    assert run(Sleeping(), gateway(), model_timeout=1, agent_timeout=0.005)["error_code"] == "AGENT_TIMEOUT"


def test_deadline_preserves_cancelled_gateway_attempt_in_trace():
    async def delayed(payload):
        await asyncio.sleep(1)
    gw = gateway()
    gw.handlers["retrieve_patient_evidence"] = delayed
    result = run(ScenarioModel(), gw, tool_timeout=1, agent_timeout=0.005)
    assert result["error_code"] == "AGENT_TIMEOUT" and result["status"] == "PARTIAL"
    assert len(gw.calls) == len(result["trace"]) == 1
    assert result["trace"][0]["error_code"] == "CANCELLED"


def test_provider_failure_preserves_observed_trace_without_fake_success():
    class Failing(ScenarioModel):
        async def next(self, request, tools):
            if self.observed:
                raise ProviderFailure("PROVIDER_ERROR")
            return await super().next(request, tools)
    result = run(Failing(), gateway())
    assert result["status"] == "FAILED" and result["error_code"] == "PROVIDER_ERROR"
    assert len(result["trace"]) == 1
    assert result["summary"] is None


def test_unexpected_gateway_exception_does_not_leak_payload_or_exception_text():
    def bad(payload):
        raise RuntimeError("SECRET-AND-CLINICAL-NARRATIVE")
    gw = gateway()
    gw.handlers["retrieve_patient_evidence"] = bad
    result = run(ScenarioModel(), gw)
    assert "SECRET-AND-CLINICAL" not in json.dumps(result)
    assert result["status"] == "PARTIAL" and len(gw.calls) == 1


def test_malformed_success_is_not_retried_or_accepted_as_evidence():
    gw = gateway()
    gw.handlers["retrieve_patient_evidence"] = {"tool_name": "retrieve_patient_evidence", "data": {"success": True}}
    result = run(ScenarioModel(), gw)
    assert result["status"] == "FAILED" and result["error_code"] == "BAD_GATEWAY_OUTPUT"
    assert len(gw.calls) == 1 and result["evidence_refs"] == []
