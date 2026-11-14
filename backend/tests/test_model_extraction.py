"""Actual upload/job/gateway/persistence, explicitly mocked model interpretations."""

import asyncio
import json

import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from ai.providers.gemini import ProviderFailure
from ai.tests.test_compact_protocol import CompactModel
from backend.app import models as m
from backend.app.services.pdf_extractor import FIXTURE
from conftest import headers, work


def upload(env):
    response = env[0].post('/api/v1/trials/TR-PX104/protocols', headers=headers('ACT-COORD-01'),
        files={'file': ('fictional.pdf', (FIXTURE / 'PX-104-v1.0-fictional.pdf').read_bytes(), 'application/pdf')},
        data={'version_label': 'MODEL-EXTRACTION-TEST', 'source_declared_synthetic': 'true'})
    assert response.status_code == 201, response.text
    detail = response.json()['data']
    assert detail['criteria'] == []
    return '/api/v1/trials/TR-PX104/protocols/' + detail['protocol_version_id'], detail


def enable(env, monkeypatch, *, fail=False, before_return=None):
    env[3].llm_enabled, env[3].llm_api_key = True, SecretStr('synthetic-model-extraction-test-key')
    monkeypatch.setenv('LLM_ENABLED', 'true')
    monkeypatch.setenv('LLM_API_KEY', 'synthetic-model-extraction-test-key')
    class Model(CompactModel):
        calls_observed = 0
        def __init__(self, settings):
            super().__init__(json.loads((FIXTURE / 'expected_extraction.json').read_text()))
        async def interpret(self, req, pages, clauses):
            Model.calls_observed += 1
            context = json.loads(req['objective'])['authorized_backend_context']
            assert context['source_id'] != 'SRC-PROTOCOL-PX104-V1'
            assert 'approved_criteria' not in context
            assert all(c['source_id'] == context['source_id'] for c in clauses.values())
            if fail:
                raise ProviderFailure('PROVIDER_HTTP_429')
            result = await super().interpret(req, pages, clauses)
            if before_return:
                before_return(req, context)
            return result
        async def close(self):
            pass
    from ai import entrypoints
    monkeypatch.setattr(entrypoints, 'GeminiProvider', Model)
    return Model


def queue(env, prefix, key='extract-once'):
    response = env[0].post(prefix + '/extract', headers=headers(key=key), json={'force_reinspect': True})
    assert response.status_code == 202, response.text
    return response.json()['data']


def test_uploaded_model_proposals_persist_unsigned_then_human_approves_and_screens(env, monkeypatch):
    prefix, initial = upload(env)
    model = enable(env, monkeypatch)
    receipt = queue(env, prefix)
    replay = queue(env, prefix)
    assert replay == receipt
    work(env)
    job = env[0].get(receipt['poll_url'], headers=headers()).json()['data']
    assert job['status'] == 'SUCCEEDED', job
    assert job['result']['proposal_origin'] == 'MODEL' and model.calls_observed == 1
    execution = env[0].get('/api/v1/agent-executions/' + job['result']['execution_id'], headers=headers()).json()['data']
    assert execution['status'] == 'SUCCEEDED' and len(execution['trace']) == 4
    assert len(execution['evidence_refs']) == 5
    detail = env[0].get(prefix, headers=headers()).json()['data']
    assert detail['state'] == 'EXTRACTION_REVIEW' and len(detail['criteria']) == 8
    assert len(detail['coverage']) == 12 and detail['blocking_count'] == 0
    assert detail['coverage_signed_by'] is None and detail['approved_set_hash'] is None
    assert all(c['workflow_status'] == 'PROPOSED' and c['approved_by'] is None for c in detail['criteria'])
    assert all(c['source_id'] == initial['source']['source_id'] for c in detail['criteria'])
    body = dict(protocol_version_id=detail['protocol_version_id'], screening_date='2026-10-31',
                evidence_cutoff_at='2026-10-31T22:00:00Z', patient_ids=None, purpose='BASELINE')
    assert env[0].post('/api/v1/trials/TR-PX104/screenings', headers=headers(), json=body).status_code == 409
    # Recovery/replay reads the terminal child, without giving it a second budget.
    from backend.app.services.protocol_extraction import process_model_extract
    asyncio.run(process_model_extract(env[2], receipt['job_id'], env[3]))
    assert model.calls_observed == 1
    approved = env[0].post(prefix + '/approve', headers=headers(revision=detail['revision']), json=dict(
        criterion_ids=[c['criterion_id'] for c in detail['criteria']], coverage_attestation=True,
        activate=True, decision_reason='Synthetic investigator independently reviewed all source clauses'))
    assert approved.status_code == 200, approved.text
    response = env[0].post('/api/v1/trials/TR-PX104/screenings', headers=headers(), json=body)
    assert response.status_code == 202
    work(env)
    assert env[0].get(response.json()['data']['poll_url'], headers=headers()).json()['data']['status'] == 'SUCCEEDED'
    assert env[0].post(prefix + '/extract', headers=headers(), json={'force_reinspect': True}).status_code == 409
    with env[2]() as session:
        assert session.scalar(select(func.count()).select_from(m.CriterionApproval)) == 8
        assert session.scalar(select(func.count()).select_from(m.AgentExecution)) == 1


@pytest.mark.parametrize('missing_key', [False, True])
def test_enabled_extraction_failure_never_loads_curated_answers(env, monkeypatch, missing_key):
    prefix, _ = upload(env)
    model = enable(env, monkeypatch, fail=True)
    if missing_key:
        env[3].llm_api_key = SecretStr('')
        monkeypatch.setenv('LLM_API_KEY', '')
    receipt = queue(env, prefix)
    work(env)
    job = env[0].get(receipt['poll_url'], headers=headers()).json()['data']
    assert job['status'] == 'FAILED'
    detail = env[0].get(prefix, headers=headers()).json()['data']
    assert detail['state'] == 'EXTRACTION_FAILED' and detail['criteria'] == []
    assert detail['approved_set_hash'] is None
    with env[2]() as session:
        execution = session.scalar(select(m.AgentExecution))
        assert execution.status == ('UNAVAILABLE' if missing_key else 'FAILED')
    assert model.calls_observed == (0 if missing_key else 1)


def test_disabled_upload_still_labels_curated_proposal_honestly(env):
    prefix, _ = upload(env)
    receipt = queue(env, prefix)
    work(env)
    job = env[0].get(receipt['poll_url'], headers=headers()).json()['data']
    assert job['status'] == 'SUCCEEDED' and job['result']['proposal_origin'] == 'CURATED_FIXTURE'
    assert job['result']['agent_status'] == 'UNAVAILABLE'


def test_inflight_model_cannot_overwrite_a_newer_human_approval(env, monkeypatch):
    prefix, initial = upload(env)
    def approve_during_inference(req, context):
        proposal = json.loads((FIXTURE / 'expected_extraction.json').read_text())
        for c in proposal['criteria']:
            c['protocol_version_id'], c['source_id'] = req['protocol_version_id'], context['source_id']
        for c in proposal['coverage']:
            c['source_id'] = context['source_id']
        response = env[0].put(prefix + '/criteria', headers=headers(revision=1), json=proposal)
        assert response.status_code == 200, response.text
        response = env[0].post(prefix + '/approve', headers=headers(revision=response.json()['data']['revision']),
            json=dict(criterion_ids=[c['criterion_id'] for c in proposal['criteria']],
                coverage_attestation=True, activate=True, decision_reason='Synthetic concurrent investigator review'))
        assert response.status_code == 200, response.text
    model = enable(env, monkeypatch, before_return=approve_during_inference)
    receipt = queue(env, prefix)
    work(env)
    job = env[0].get(receipt['poll_url'], headers=headers()).json()['data']
    assert job['status'] == 'FAILED' and job['error']['code'] == 'REVISION_CONFLICT'
    detail = env[0].get(prefix, headers=headers()).json()['data']
    assert detail['state'] == 'ACTIVE' and detail['approved_set_hash']
    assert all(c['workflow_status'] == 'APPROVED' for c in detail['criteria'])
    assert model.calls_observed == 1
