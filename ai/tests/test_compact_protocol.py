import asyncio
import hashlib

import pytest

from ai.agents.coordinator import Coordinator
from ai.agents.protocol_preparation import assemble
from ai.agents.protocol_intelligence import GuardError
from ai.config import Settings
from ai.evals.fixtures import protocol_gateway, request, success
from ai.tools.schemas import AgentRequest, ProtocolInterpretation, wire


def compact_fixture(ambiguous=False, unreadable=False):
    gate, expected = protocol_gateway(ambiguous=ambiguous, unreadable=unreadable)
    pages = gate.handlers['parse_protocol']['data']['pages']
    spans = []
    for item in expected['coverage']:
        if not item['section_id'].startswith('PX-SECTION-'):
            continue
        page = next(p for p in pages if p['page'] == item['page'])
        text = page['text'][item['span_start']:item['span_end']]
        spans.append({**page, 'text': text, 'start': item['span_start'], 'end': item['span_end'],
                      'sha256': hashlib.sha256(text.encode()).hexdigest()})
    gate.handlers['locate_clause'] = success('locate_clause', {'spans': spans})
    return gate, expected


class CompactModel:
    model_id = 'MOCK-COMPACT-INTERPRETER'
    def __init__(self, expected):
        self.expected = expected
        self.calls = 0
        self.input = None
    async def interpret(self, req, pages, clauses):
        self.calls += 1
        self.input = {'pages': pages, 'clauses': clauses}
        assert all('operator' not in clause and 'threshold' not in clause for clause in clauses.values())
        rules = []
        for draft in self.expected['criteria']:
            key = next(key for key, c in clauses.items() if c['criterion_id'] == draft['criterion_id'])
            rule = {k: draft[k] for k in ('type', 'clinical_subject', 'operator', 'threshold', 'unit',
                                          'window', 'evidence_requirement', 'ambiguity')}
            window = draft['window']
            rule['window'] = dict(anchor=window['anchor'],
                days_before=-window['start_offset_days'] if window['start_offset_days'] is not None else None,
                include_anchor=window['end_inclusive'])
            rules.append({'clause_key': key, **rule})
        return ProtocolInterpretation.model_validate({'rules': rules})


@pytest.mark.parametrize('ambiguous', [False, True])
def test_one_interpretation_four_real_gateway_invocations(ambiguous):
    gate, expected = compact_fixture(ambiguous=ambiguous)
    model = CompactModel(expected)
    result = asyncio.run(Coordinator(AgentRequest.model_validate(request('PROTOCOL_INTELLIGENCE')),
        gate, Settings(), model).run())
    assert result['status'] == ('PARTIAL' if ambiguous else 'SUCCEEDED'), result
    assert model.calls == 1 and len(result['proposed_criteria']) == 8 and len(result['coverage']) == 12
    assert [name for name, _ in gate.calls] == ['parse_protocol', 'locate_clause', 'validate_rule_schema', 'report_coverage']
    for draft in result['proposed_criteria']:
        clause = next(c for c in model.input['clauses'].values() if c['criterion_id'] == draft['criterion_id'])
        assert draft['source_quote'] == clause['text']
        assert draft['source_anchor'] == {'start': clause['start'], 'end': clause['end']}
        assert draft['workflow_status'] != 'APPROVED'


def test_unreadable_protocol_never_invokes_interpreter():
    gate, expected = compact_fixture(unreadable=True)
    model = CompactModel(expected)
    result = asyncio.run(Coordinator(AgentRequest.model_validate(request('PROTOCOL_INTELLIGENCE')),
        gate, Settings(), model).run())
    assert result['status'] == 'PARTIAL' and model.calls == 0 and len(gate.calls) == 1


def test_compact_output_cannot_forge_anchors_or_approvals():
    from pydantic import ValidationError
    gate, expected = compact_fixture()
    model = CompactModel(expected)
    raw = AgentRequest.model_validate(request('PROTOCOL_INTELLIGENCE'))
    coordinator = Coordinator(raw, gate, Settings(), model)
    asyncio.run(coordinator.extract_protocol())
    clauses = model.input['clauses']
    interpretation = asyncio.run(model.interpret(wire(raw), model.input['pages'], clauses))
    for field in ('source_anchor', 'source_quote', 'approved_by', 'workflow_status'):
        value = wire(interpretation)
        value['rules'][0][field] = 'invented'
        with pytest.raises(ValidationError):
            ProtocolInterpretation.model_validate(value)
    interpretation.rules[0].clause_key = 'invented'
    with pytest.raises(GuardError, match='UNVERIFIED_EVIDENCE_REF'):
        assemble(interpretation, clauses, raw)
