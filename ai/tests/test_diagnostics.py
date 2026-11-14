import asyncio
import json
import logging
import time
from types import SimpleNamespace

import pytest

from ai.config import Settings
from ai.evals.fixtures import request, gateway, ScenarioModel
from ai.providers.gemini import GeminiProvider


def test_model_call_records_only_real_usage_timing_and_identifiers(monkeypatch, caplog):
    genai = pytest.importorskip('google.genai')
    from google.genai import types
    class Client:
        async def generate_content(self, **kwargs):
            return types.GenerateContentResponse(usage_metadata=types.GenerateContentResponseUsageMetadata(
                prompt_token_count=111, candidates_token_count=22, thoughts_token_count=3))
        async def aclose(self):
            pass
    client = Client(); client.models = client
    monkeypatch.setattr(genai, 'Client', lambda **kwargs: SimpleNamespace(aio=client))
    caplog.set_level(logging.INFO, logger='ai')
    provider = GeminiProvider(Settings(api_key='SECRET-DO-NOT-LOG'))
    asyncio.run(provider.generate(request(), ['SENSITIVE-SOURCE-TEXT'], {}, 'propose_rule'))
    assert 'input_tokens=111 output_tokens=22 thinking_tokens=3' in caplog.text
    assert 'phase=propose_rule attempt=1 result_code=OK elapsed_ms=' in caplog.text
    assert 'SECRET-DO-NOT-LOG' not in caplog.text and 'SENSITIVE-SOURCE-TEXT' not in caplog.text


def test_entrypoint_returns_before_backend_deadline_and_closes_provider(monkeypatch):
    from ai import entrypoints
    class Slow(ScenarioModel):
        def __init__(self, settings):
            super().__init__()
        async def next(self, req, tools):
            await asyncio.sleep(1)
    monkeypatch.setattr(entrypoints, 'GeminiProvider', Slow)
    monkeypatch.setenv('LLM_ENABLED', 'true')
    monkeypatch.setenv('LLM_API_KEY', 'SYNTHETIC')
    monkeypatch.setenv('AGENT_TIMEOUT_SECONDS', '0.1')
    raw = request()
    started = time.monotonic()
    raw['objective'] = json.dumps({'authorized_backend_context': {
        'execution_deadline_monotonic': started + .05}})
    result = asyncio.run(entrypoints.run_agent(raw, gateway()))
    assert result['status'] == 'PARTIAL' and result['error_code'] == 'AGENT_TIMEOUT'
    assert time.monotonic() - started < .1


def test_forbidden_final_fields_and_tool_selection_have_distinct_diagnostics(caplog):
    from ai.agents.coordinator import Coordinator
    from ai.evals.fixtures import proposal
    from ai.providers.gemini import ToolCall
    from ai.tools.schemas import AgentRequest
    from ai.agents.protocol_intelligence import GuardError
    coord = Coordinator(AgentRequest.model_validate(request()), gateway(), Settings(), ScenarioModel())
    with pytest.raises(GuardError):
        coord.arguments(ToolCall('approve', {}))
    assert 'stage=tool_selection' in caplog.text
    coord.refs = {}
    with pytest.raises(GuardError):
        coord.finish(proposal(summary=None, coverage=[{'section_id': 'PX-INFO-IDENTITY',
            'source_id': 'SRC-PROTOCOL-PX104-V1', 'page': 1, 'span_start': 0, 'span_end': 1,
            'status': 'INFORMATIONAL', 'criterion_ids': [], 'review_note': None}]))
    assert 'stage=final_protocol_fields' in caplog.text


@pytest.mark.parametrize('phase', ['protocol', 'monitoring'])
def test_internal_procedure_timeout_is_not_misreported_as_overall_deadline(phase):
    from ai.agents.coordinator import Coordinator
    from ai.tools.schemas import AgentRequest
    from ai.tests.test_compact_protocol import CompactModel, compact_fixture
    from ai.tests.test_monitoring_finalization import MonitorModel
    if phase == 'protocol':
        gate, expected = compact_fixture()
        class Slow(CompactModel):
            async def interpret(self, *args):
                await asyncio.sleep(1)
        model, raw = Slow(expected), request('PROTOCOL_INTELLIGENCE')
    else:
        gate = gateway('P-042', order=False)
        class Slow(MonitorModel):
            async def finalize(self, *args):
                await asyncio.sleep(1)
        model, raw = Slow('monitor'), request('MONITORING_WORKFLOW', 'P-042', 'PX-MON-01')
    result = asyncio.run(Coordinator(AgentRequest.model_validate(raw), gate,
        Settings(model_timeout=.005, agent_timeout=.5, max_steps=2 if phase == 'monitoring' else 8), model).run())
    assert result['status'] == 'PARTIAL' and result['error_code'] == 'LLM_CALL_TIMEOUT'
