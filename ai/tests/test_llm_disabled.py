import asyncio
import json

import pytest
from pydantic import ValidationError

import ai.entrypoints as entry
from ai.evals.fixtures import ScenarioModel, gateway, request
from ai.providers.gemini import ProviderUnavailable
from ai.tools.schemas import AgentResult


def configured(monkeypatch):
    monkeypatch.setenv("LLM_ENABLED", "true")
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", "gemini-3.8-flash")
    monkeypatch.setenv("LLM_API_KEY", "synthetic-test-key")


@pytest.mark.parametrize("role", ["PROTOCOL_INTELLIGENCE", "EVIDENCE_INVESTIGATOR",
                                  "MEDICATION_SAFETY_INVESTIGATOR", "MONITORING_WORKFLOW"])
def test_off_is_honest_and_makes_no_model_or_gateway_calls(monkeypatch, role):
    monkeypatch.setenv("LLM_ENABLED", "false")
    def forbidden(*args):
        pytest.fail("OFF must not even construct the SDK client")
    monkeypatch.setattr(entry, "GeminiProvider", forbidden)
    gw = gateway()
    result = asyncio.run(entry.run_agent(request(role), gw))
    assert AgentResult.model_validate(result).model_dump(mode="json") == result
    assert result["status"] == "UNAVAILABLE"
    assert result["model_id"] is None and result["trace"] == [] and gw.calls == []
    assert result["summary"] is None and result["proposed_criteria"] == []


@pytest.mark.parametrize("key,value", [("LLM_API_KEY", ""), ("LLM_MODEL", "gemini-other"),
                                      ("LLM_PROVIDER", "another-provider")])
def test_unconfigured_does_not_substitute_a_model(monkeypatch, key, value):
    configured(monkeypatch)
    monkeypatch.setenv(key, value)
    monkeypatch.setattr(entry, "GeminiProvider", lambda _: pytest.fail("No SDK client expected"))
    assert asyncio.run(entry.run_agent(request(), gateway()))["status"] == "UNAVAILABLE"


def test_missing_sdk_and_invalid_config_are_explicit(monkeypatch):
    configured(monkeypatch)
    def unavailable(_):
        raise ProviderUnavailable("no SDK")
    monkeypatch.setattr(entry, "GeminiProvider", unavailable)
    assert asyncio.run(entry.run_agent(request(), gateway()))["error_code"] == "SDK_UNAVAILABLE"
    monkeypatch.setenv("MAX_AGENT_STEPS", "not-a-number")
    assert asyncio.run(entry.run_agent(request(), gateway()))["error_code"] == "INVALID_PROVIDER_CONFIGURATION"


def test_wire_entrypoint_roundtrip_with_explicit_mock_model(monkeypatch):
    configured(monkeypatch)
    model = ScenarioModel()
    monkeypatch.setattr(entry, "GeminiProvider", lambda _: model)
    result = asyncio.run(entry.run_agent(json.loads(json.dumps(request())), gateway()))
    assert result["status"] == "PARTIAL" and "ORDER_ONLY" in result["unknown_reasons"]
    assert model.closed
    assert result["model_id"] == "MOCK-GEMINI-FOR-EVALUATION"
    assert AgentResult.model_validate_json(json.dumps(result)).execution_id == request()["execution_id"]


def test_invalid_wire_input_is_rejected_before_provider(monkeypatch):
    raw = request()
    raw["api_key"] = "not-a-permitted-wire-field"
    with pytest.raises(ValidationError):
        asyncio.run(entry.run_agent(raw, gateway()))
