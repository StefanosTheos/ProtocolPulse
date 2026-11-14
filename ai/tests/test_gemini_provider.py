import asyncio
import base64
import json
from types import SimpleNamespace

import pytest

from ai.config import Settings
from ai.evals.fixtures import proposal, request
from ai.providers.gemini import GeminiProvider, ProviderFailure, ToolCall
from ai.tools.selection import allowed_tools
from ai.tools.schemas import wire


def investigation_text():
    return json.dumps(proposal(summary=None, incomplete=True).model_dump(
        exclude={'proposed_criteria', 'coverage', 'evidence_refs', 'conflict_refs'}) |
        {'evidence_keys': [], 'conflict_keys': []})


def test_sdk_types_manual_tool_loop_and_thought_signature_replay(monkeypatch):
    genai = pytest.importorskip("google.genai")
    from google.genai import types
    received = []
    signature = b"opaque-signature-must-not-become-a-trace"
    args = {"patient_id": "P-124", "analyte_code": "EGFR", "from_at": "2026-09-01T00:00:00Z",
            "to_at": "2026-10-31T22:00:00Z", "snapshot_id": "SNAP-BASELINE"}
    content = types.Content(role="model", parts=[types.Part(
        function_call=types.FunctionCall(id="call-1", name="get_lab_history", args=args),
        thought_signature=signature)])
    responses = [types.GenerateContentResponse(candidates=[types.Candidate(content=content)]),
        types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(role="model", parts=[
            types.Part(text=investigation_text())]))])]
    class FakeAsyncClient:
        models = None
        closed = False
        def __init__(self):
            self.models = self
        async def generate_content(self, **kwargs):
            received.append(kwargs)
            return responses.pop(0)
        async def aclose(self):
            self.closed = True
    client = FakeAsyncClient()
    construction = {}
    def construct(**kwargs):
        construction.update(kwargs)
        return SimpleNamespace(aio=client)
    monkeypatch.setattr(genai, "Client", construct)
    async def scenario():
        provider = GeminiProvider(Settings(enabled=True, api_key="SDK-TEST-KEY"))
        raw = request("EVIDENCE_INVESTIGATOR", "P-124", "PX-INC-03")
        tools = allowed_tools(raw["role"])
        action = await provider.next(raw, tools)
        assert action.name == "get_lab_history" and action.call_id == "call-1"
        await provider.observe(action, {"tool_name": action.name, "data": {"facts": []}})
        final = await provider.next(raw, tools)
        await provider.close()
        assert final.incomplete
        assert provider.contents[1].parts[0].thought_signature == signature
        assert provider.contents[2].parts[0].function_response.id == "call-1"
        assert provider.contents[2].parts[0].function_response.name == "get_lab_history"
    asyncio.run(scenario())
    assert client.closed and construction["api_key"] == "SDK-TEST-KEY"
    assert construction["http_options"].retry_options.attempts == 1
    config = received[0]["config"]
    assert config.automatic_function_calling.disable is True
    assert config.response_mime_type == "application/json"
    assert config.response_json_schema["additionalProperties"] is False
    assert 'proposed_criteria' not in config.response_json_schema['properties']
    assert 'coverage' not in config.response_json_schema['properties']
    assert received[0]["model"] == "gemini-3.8-flash"
    assert "SDK-TEST-KEY" not in config.model_dump_json() and "SDK-TEST-KEY" not in str(received)


def test_sdk_provider_errors_are_sanitized(monkeypatch):
    genai = pytest.importorskip("google.genai")
    class Broken:
        async def generate_content(self, **kwargs):
            raise RuntimeError("SERVER-SECRET-NEVER-EXPOSE")
        async def aclose(self):
            pass
    client = Broken()
    client.models = client
    monkeypatch.setattr(genai, "Client", lambda **kwargs: SimpleNamespace(aio=client))
    async def scenario():
        provider = GeminiProvider(Settings(api_key="SYNTHETIC"))
        try:
            await provider.next(request(), allowed_tools("MEDICATION_SAFETY_INVESTIGATOR"))
        finally:
            await provider.close()
    with pytest.raises(ProviderFailure, match="^PROVIDER_ERROR$"):
        asyncio.run(scenario())


def test_sdk_http_failure_category_never_exposes_provider_message(monkeypatch):
    genai = pytest.importorskip('google.genai')
    class QuotaFailure(Exception):
        code = 429
    class Client:
        async def generate_content(self, **kwargs):
            raise QuotaFailure('private key and request details must not be logged')
        async def aclose(self):
            pass
    client = Client()
    client.models = client
    monkeypatch.setattr(genai, 'Client', lambda **kwargs: SimpleNamespace(aio=client))
    async def scenario():
        provider = GeminiProvider(Settings(api_key='SYNTHETIC'))
        try:
            await provider.next(request(), allowed_tools('MEDICATION_SAFETY_INVESTIGATOR'))
        finally:
            await provider.close()
    with pytest.raises(ProviderFailure, match='^PROVIDER_HTTP_429$'):
        asyncio.run(scenario())


def test_real_sdk_serializes_manual_calls_using_mock_http_transport(monkeypatch):
    """Exercise the installed SDK converter/async HTTP path without network or a real key."""
    genai = pytest.importorskip("google.genai")
    httpx = pytest.importorskip("httpx2")
    original_client = genai.Client
    bodies = []
    args = {"patient_id": "P-124", "analyte_code": "EGFR", "from_at": "2026-09-01T00:00:00Z",
            "to_at": "2026-10-31T22:00:00Z", "snapshot_id": "SNAP-BASELINE"}
    def handler(http_request):
        bodies.append(json.loads(http_request.content))
        part = {"functionCall": {"name": "get_lab_history", "args": args, "id": "native-call-1"},
                "thoughtSignature": base64.b64encode(b"test-native-signature").decode()} if len(bodies) == 1 else {
                "text": investigation_text()}
        return httpx.Response(200, json={"candidates": [{"content": {"role": "model", "parts": [part]},
                                                        "finishReason": "STOP"}]}, request=http_request)
    def construct(**kwargs):
        transport_client = httpx.AsyncClient(transport=httpx.MockTransport(handler), trust_env=False)
        kwargs["http_options"] = kwargs["http_options"].model_copy(update={"httpx_async_client": transport_client})
        return original_client(**kwargs)
    monkeypatch.setattr(genai, "Client", construct)
    async def scenario():
        provider = GeminiProvider(Settings(enabled=True, api_key="SYNTHETIC-SDK-TRANSPORT-TEST"))
        try:
            raw = request("EVIDENCE_INVESTIGATOR", "P-124", "PX-INC-03")
            action = await provider.next(raw, allowed_tools(raw["role"]))
            assert action.call_id == "native-call-1"
            await provider.observe(action, {"tool_name": action.name, "data": {"facts": []}})
            assert (await provider.next(raw, allowed_tools(raw["role"]))).incomplete
        finally:
            await provider.close()
    asyncio.run(scenario())
    assert len(bodies) == 2
    assert bodies[0]["generationConfig"]["responseMimeType"] == "application/json"
    assert bodies[1]["contents"][1]["parts"][0]["thoughtSignature"] == base64.b64encode(b"test-native-signature").decode()
    assert bodies[1]["contents"][2]["parts"][0]["functionResponse"]["id"] == "native-call-1"
    assert "SYNTHETIC-SDK-TRANSPORT-TEST" not in json.dumps(bodies)
