import asyncio
import json
from types import SimpleNamespace

import pytest

from ai.config import Settings
from ai.evals.fixtures import ref, request
from ai.providers.gemini import GeminiProvider, ProviderFailure, ToolCall
from ai.tools.references import ReferenceRegistry, UnverifiedSelection
from ai.tools.schemas import wire


def test_registry_preserves_exact_versions_unicode_spans_and_timestamps():
    registry = ReferenceRegistry()
    original = {**ref('P-042'), 'page': 2, 'span_start': 18, 'span_end': 29,
                'effective_at': '2026-11-19T09:30:00+02:00'}
    registry.observe([original, {**original, 'source_version': 2}])
    keys = [r['key'] for r in registry.selections()]
    assert len(keys) == 2 and wire(registry.resolve([keys[0]])[0]) == original
    original['span_start'] = 99
    assert registry.resolve([keys[0]])[0].span_start == 18
    for unknown in (['invented'], [keys[0], keys[0]]):
        with pytest.raises(UnverifiedSelection):
            registry.resolve(unknown)
    with pytest.raises(UnverifiedSelection):
        ReferenceRegistry().resolve(keys)


@pytest.mark.parametrize('invented', [False, True])
def test_sdk_final_selects_only_observed_references(monkeypatch, invented):
    genai = pytest.importorskip('google.genai')
    from google.genai import types
    captured = []
    class Client:
        async def generate_content(self, **kwargs):
            captured.append(kwargs)
            key = provider.references.selections()[0]['key'] if not invented else 'invented'
            value = dict(summary='Synthetic evidence requires review.', evidence_keys=[key],
                conflict_keys=[], unknown_reasons=['ORDER_ONLY'], verification_questions=[], incomplete=True)
            return types.GenerateContentResponse(candidates=[types.Candidate(content=types.Content(
                role='model', parts=[types.Part(text=json.dumps(value))]))])
        async def aclose(self):
            pass
    client = Client(); client.models = client
    monkeypatch.setattr(genai, 'Client', lambda **kwargs: SimpleNamespace(aio=client))
    provider = GeminiProvider(Settings(api_key='SYNTHETIC'))
    async def scenario():
        await provider.observe(ToolCall('retrieve_patient_evidence', {}, 'call-1'), {
            'tool_name': 'retrieve_patient_evidence', 'evidence_refs': [ref('P-083')], 'data': {}})
        try:
            return await provider.next(request(), {})
        finally:
            await provider.close()
    if invented:
        with pytest.raises(ProviderFailure, match='^UNVERIFIED_EVIDENCE_REF$'):
            asyncio.run(scenario())
    else:
        final = asyncio.run(scenario())
        assert wire(final.evidence_refs[0]) == ref('P-083')
        assert final.proposed_criteria == final.coverage == []
        assert captured[0]['config'].tools is None
        assert captured[0]['config'].tool_config.function_calling_config.mode == 'NONE'
