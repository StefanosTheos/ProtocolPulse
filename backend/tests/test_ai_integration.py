"""IC integration regressions: real E2 adapter/gateway/SQLite and E3 entrypoint; model mocked."""
import json
from pathlib import Path

import pytest
from ai.providers.gemini import ToolCall
from ai.tools.schemas import EvidenceReference, FinalProposal
from backend.app import models as m
from conftest import event_body, headers, participate, post_event, screen, work
from pydantic import SecretStr
from sqlalchemy import func, select


class EvidenceDrivenModel:
    model_id = "MOCK-IC-INTEGRATION-NOT-LIVE"

    def __init__(self, settings):
        self.seen = []
        self.refs = []

    async def observe(self, call, response):
        self.seen.append((call.name, response))
        self.refs.extend(response.get('evidence_refs', []))

    async def close(self):
        pass

    async def next(self, req, tools):
        context = json.loads(req['objective'])['authorized_backend_context']
        assert context['approved_set_hash']
        assert {c['criterion_id'] for c in context['approved_criteria']} == set(req['criterion_ids'])
        assert all(c['workflow_status'] == 'APPROVED' and c['source_quote'] for c in context['approved_criteria'])
        assert context['screening_date'] == '2026-10-31'
        patient = req['patient_id']
        scope = {'patient_id': patient, 'snapshot_id': req['evidence_snapshot_id']}
        names = [name for name, _ in self.seen]
        if not names:
            return ToolCall('retrieve_patient_evidence', {**scope, 'criterion_ids': req['criterion_ids'],
                'evidence_types': ['LAB'] if patient == 'P-124' else ['ORDER', 'ADMINISTRATION']})
        facts = self.seen[0][1]['data']['facts']
        if patient == 'P-124':
            if 'get_lab_history' not in names:
                return ToolCall('get_lab_history', {**scope, 'analyte_code': 'egfr',
                    'from_at': '2026-10-01T00:00:00+03:00', 'to_at': '2026-10-31T23:59:59+02:00'})
            reason = 'MISSING_LAB'
        else:
            if 'resolve_approved_terminology' not in names:
                med = next(f for f in facts if f['kind'] in ('ORDER', 'ADMINISTRATION'))
                return ToolCall('resolve_approved_terminology', {'medication_code': med['value'],
                    'map_version': 'px104-terminology-v1'})
            if 'get_medication_timeline' not in names:
                return ToolCall('get_medication_timeline', {**scope,
                    'from_at': '2026-10-01T00:00:00+03:00', 'to_at': '2026-10-31T00:00:00+02:00',
                    'evidence_types': ['ORDER', 'ADMINISTRATION', 'REPORTED_USE']})
            events = self.seen[-1][1]['data'].get('events', [])
            reason = 'ORDER_ONLY' if any(e['kind'] == 'ORDER' for e in events) else None
        unique = {json.dumps(r, sort_keys=True): r for r in self.refs}
        refs = list(unique.values())
        if reason and 'request_verification_task' not in names:
            return ToolCall('request_verification_task', {'proposal': {'patient_id': patient,
                'criterion_id': req['criterion_ids'][0], 'reason_code': reason, 'evidence_refs': refs,
                'question': 'Please verify the unresolved synthetic source evidence.',
                'requested_for_role': 'INVESTIGATOR'}, 'semantic_key': 'ignored-model-key'})
        return FinalProposal(summary='Synthetic source evidence reviewed; unresolved items require human verification.',
            evidence_refs=[EvidenceReference.model_validate(r) for r in refs],
            unknown_reasons=[reason] if reason else [], incomplete=bool(reason), conflict_refs=[],
            proposed_criteria=[], coverage=[], verification_questions=[])


@pytest.mark.parametrize('patient,criterion', [('P-083', 'PX-EXC-02'), ('P-124', 'PX-INC-03')])
def test_real_adapter_gateway_and_ai_entrypoint(env, monkeypatch, patient, criterion):
    screen(env)
    env[3].llm_enabled, env[3].llm_api_key = True, SecretStr('synthetic-ic-test-key')
    monkeypatch.setenv('LLM_ENABLED', 'true')
    monkeypatch.setenv('LLM_API_KEY', 'synthetic-ic-test-key')
    from ai import entrypoints
    monkeypatch.setattr(entrypoints, 'GeminiProvider', EvidenceDrivenModel)
    response = env[0].post('/api/v1/agent-investigations', headers=headers(), json={
        'role': 'EVIDENCE_INVESTIGATOR' if patient == 'P-124' else 'MEDICATION_SAFETY_INVESTIGATOR',
        'trial_id': 'TR-PX104', 'protocol_version_id': 'PV-PX104-1.0', 'patient_id': patient,
        'criterion_ids': [criterion], 'event_id': None, 'objective': 'Investigate actual scoped synthetic evidence.'})
    assert response.status_code == 202, response.text
    work(env)
    execution = env[0].get('/api/v1/agent-executions/' + response.json()['data']['resource_id'], headers=headers()).json()['data']
    assert execution['status'] == 'PARTIAL', json.dumps(execution, indent=2)
    assert execution['model_id'] == 'MOCK-IC-INTEGRATION-NOT-LIVE'
    assert execution['trace'][-1]['tool_name'] == 'request_verification_task'
    assert execution['evidence_refs'] and execution['unknown_reasons']
    with env[2]() as session:
        assert session.scalar(select(func.count()).select_from(m.VerificationTask)) == 1
    folder = Path('artifacts/integration')
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f'actual-gateway-{patient}.json').write_text(json.dumps({
        'mode': 'REAL_BACKEND_GATEWAY_AI_ENTRYPOINT_MOCK_MODEL', 'execution': execution}, indent=2), 'utf-8')


def test_actual_gateway_monitoring_case_already_exists(env, monkeypatch):
    screen(env)
    participate(env)
    env[3].llm_enabled, env[3].llm_api_key = True, SecretStr('synthetic-ic-test-key')
    monkeypatch.setenv('LLM_ENABLED', 'true')
    monkeypatch.setenv('LLM_API_KEY', 'synthetic-ic-test-key')
    assert post_event(env).status_code == 202
    work(env)
    case = env[0].get('/api/v1/trials/TR-PX104/cases', headers=headers()).json()['data']['items'][0]
    assert case['status'] == 'OPEN'

    class MonitoringModel(EvidenceDrivenModel):
        async def next(self, req, tools):
            names = [n for n, _ in self.seen]
            if not names:
                return ToolCall('classify_event_relevance', {'event_id': req['event_id'], 'protocol_version_id': req['protocol_version_id']})
            if 'get_prior_evaluation' not in names:
                assert self.seen[-1][1]['data']['category'] == 'RELEVANT'
                return ToolCall('get_prior_evaluation', {'patient_id': req['patient_id'],
                    'criterion_ids': req['criterion_ids'], 'before_event_id': req['event_id']})
            if 'get_case_status' not in names:
                return ToolCall('get_case_status', {'case_id': case['case_id']})
            if 'retrieve_patient_evidence' not in names:
                return ToolCall('retrieve_patient_evidence', {'patient_id': req['patient_id'],
                    'snapshot_id': req['evidence_snapshot_id'], 'criterion_ids': req['criterion_ids'],
                    'evidence_types': ['ADMINISTRATION']})
            if 'evaluate_approved_rule' not in names:
                context = json.loads(req['objective'])['authorized_backend_context']
                return ToolCall('evaluate_approved_rule', {'patient_id': req['patient_id'],
                    'snapshot_id': req['evidence_snapshot_id'], 'criterion_id': req['criterion_ids'][0],
                    'criterion_set_hash': context['approved_set_hash'], 'evaluation_date': context['screening_date']})
            assert self.seen[-1][1]['data']['result'] == 'FAIL'
            return FinalProposal(summary='Backend case already exists for documented synthetic administration; investigator review remains required.',
                evidence_refs=[EvidenceReference.model_validate(r) for r in self.refs], unknown_reasons=[],
                conflict_refs=[], proposed_criteria=[], coverage=[], verification_questions=[], incomplete=False)

    from ai import entrypoints
    monkeypatch.setattr(entrypoints, 'GeminiProvider', MonitoringModel)
    # Process the actual optional enrichment job independently enqueued after T2.
    assert case['agent_execution_id']
    work(env)
    execution = env[0].get('/api/v1/agent-executions/' + case['agent_execution_id'], headers=headers()).json()['data']
    assert execution['status'] == 'SUCCEEDED', json.dumps(execution, indent=2)
    assert [t['tool_name'] for t in execution['trace']] == ['classify_event_relevance', 'get_prior_evaluation', 'get_case_status', 'retrieve_patient_evidence', 'evaluate_approved_rule']
    assert len(env[0].get('/api/v1/trials/TR-PX104/cases', headers=headers()).json()['data']['items']) == 1
    enriched = env[0].get('/api/v1/cases/' + case['case_id'], headers=headers()).json()['data']
    assert enriched['status'] == 'OPEN' and enriched['summary_origin'] == 'AI_DRAFT'
    Path('artifacts/integration/actual-gateway-P-042.json').write_text(json.dumps({
        'mode': 'REAL_BACKEND_GATEWAY_AI_ENTRYPOINT_MOCK_MODEL', 'case_created_before_ai': case,
        'execution': execution}, indent=2), 'utf-8')


def test_actual_gateway_irrelevant_event_has_no_uncited_summary(env, monkeypatch):
    screen(env)
    participate(env, 'P-151')
    receipt = post_event(env, event_body(code='SYN-MED-N1', source='IC-irrelevant'), pid='P-151').json()['data']
    work(env)
    env[3].llm_enabled, env[3].llm_api_key = True, SecretStr('synthetic-ic-test-key')
    monkeypatch.setenv('LLM_ENABLED', 'true')
    monkeypatch.setenv('LLM_API_KEY', 'synthetic-ic-test-key')

    class NoActionModel(EvidenceDrivenModel):
        async def next(self, req, tools):
            assert not self.seen
            return ToolCall('classify_event_relevance', {'event_id': req['event_id'], 'protocol_version_id': req['protocol_version_id']})

    from ai import entrypoints
    monkeypatch.setattr(entrypoints, 'GeminiProvider', NoActionModel)
    response = env[0].post('/api/v1/agent-investigations', headers=headers(), json={
        'role': 'MONITORING_WORKFLOW', 'trial_id': 'TR-PX104', 'protocol_version_id': 'PV-PX104-1.0',
        'patient_id': 'P-151', 'criterion_ids': [], 'event_id': receipt['event_id'], 'objective': 'Check backend relevance.'})
    work(env)
    execution = env[0].get('/api/v1/agent-executions/' + response.json()['data']['resource_id'], headers=headers()).json()['data']
    assert execution['status'] == 'SUCCEEDED', json.dumps(execution)
    assert execution['summary'] is None and execution['evidence_refs'] == []
    assert [t['tool_name'] for t in execution['trace']] == ['classify_event_relevance']
    assert not env[0].get('/api/v1/trials/TR-PX104/cases?patient_id=P-151', headers=headers()).json()['data']['items']


def test_root_dotenv_provider_settings_reach_ai_without_wire_secrets(tmp_path, monkeypatch):
    from ai.config import Settings as AISettings
    from backend.app.core.config import get_settings
    monkeypatch.chdir(tmp_path)
    for name in ('LLM_ENABLED', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_PROVIDER'):
        monkeypatch.delenv(name, raising=False)
    (tmp_path / '.env').write_text('LLM_ENABLED=true\nLLM_API_KEY=synthetic-local-test-key\nLLM_PROVIDER=gemini\nLLM_MODEL=gemini-3.8-flash\n', encoding='utf-8')
    get_settings.cache_clear()
    try:
        assert get_settings().llm_enabled
        assert AISettings.from_environ().configured
        assert 'synthetic-local-test-key' not in repr(AISettings.from_environ())
    finally:
        get_settings.cache_clear()


def test_zero_backoff_retry_due_at_same_clock_tick(env, monkeypatch):
    from backend.app.db.base import now
    from backend.app.services import jobs
    screen(env)
    participate(env)
    receipt = post_event(env).json()['data']
    stamp = now()
    monkeypatch.setattr(jobs, 'now', lambda: stamp)

    def unavailable(*args):
        raise RuntimeError('Synthetic transient persistence failure')

    monkeypatch.setattr(jobs, 'process_event', unavailable)
    for _ in range(3):
        work(env)
    job = env[0].get(receipt['job']['poll_url'], headers=headers()).json()['data']
    assert job['status'] == 'FAILED' and job['attempts'] == 3
