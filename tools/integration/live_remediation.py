"""Real Gemini/API/SQLite checks on a separately seeded synthetic demo. No model mocks."""

import argparse
import json
from pathlib import Path
import time
from uuid import uuid4

from dotenv import dotenv_values
import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:8001/api/v1')
    parser.add_argument('--check-persistence', action='store_true')
    parser.add_argument('--resume', action='store_true')
    args = parser.parse_args()
    output = Path('artifacts/integration/six-step-live.json')
    client = httpx.Client(base_url=args.base_url, timeout=15, headers={'X-Demo-Actor-Id': 'ACT-INV-01'})
    proof = {'mode': 'LIVE_GEMINI_REAL_API_GATEWAY_SQLITE', 'base_url': args.base_url, 'steps': {}}

    def headers(actor='ACT-INV-01', key=None, revision=None):
        result = {'X-Demo-Actor-Id': actor, 'Idempotency-Key': key or uuid4().hex}
        if revision is not None:
            result['If-Match'] = f'"{revision}"'
        return result

    def get(path):
        response = client.get(path)
        assert response.status_code == 200, f'GET {path}: {response.status_code}'
        return response.json()['data']

    def wait_job(receipt):
        deadline = time.monotonic() + 65
        while time.monotonic() < deadline:
            job = get('/jobs/' + receipt['job_id'])
            if job['status'] in ('SUCCEEDED', 'FAILED'):
                return job
            time.sleep(.2)
        raise AssertionError('Job deadline exceeded')

    def record(name, data):
        proof['steps'][name] = data
        print(json.dumps({'step': name, 'status': data.get('status', 'VERIFIED')}), flush=True)

    def investigate(role, patient, criteria, event=None):
        response = client.post('/agent-investigations', headers=headers(), json=dict(role=role,
            trial_id='TR-PX104', protocol_version_id=version, patient_id=patient,
            criterion_ids=criteria, event_id=event,
            objective='Investigate only the approved criterion and relevant synthetic evidence; retain uncertainty for investigator review.'))
        assert response.status_code == 202
        receipt = response.json()['data']; job = wait_job(receipt)
        execution = get('/agent-executions/' + receipt['resource_id'])
        record(patient + '-' + role, execution)
        assert execution['status'] in ('SUCCEEDED', 'PARTIAL') and execution['error_code'] is None, execution['error_code']
        return execution

    def participate(patient):
        if args.resume and get(f'/trials/TR-PX104/patients/{patient}')['participation_status'] == 'PARTICIPATING':
            return
        response = client.post(f'/trials/TR-PX104/patients/{patient}/participation', headers=headers(),
            json=dict(next_status='PARTICIPATING', external_record_source_id=f'SRC-{patient}-external',
                external_record_reference='EXT-' + patient, rationale='Synthetic QA external participation record'))
        assert response.status_code == 201

    def event(patient, code):
        identity = 'QA-SIX-' + uuid4().hex
        body = dict(trial_id='TR-PX104', event_kind='MEDICATION', source_event_id=identity,
            source_version=1, source_id='SRC-' + identity, source_document_version=1,
            effective_at='2026-11-19T09:30:00+02:00', recorded_at='2026-11-20T11:00:00+02:00',
            time_uncertainty=None, evidence_state='POSITIVE', evidence_quality='HIGH',
            medication=dict(code=code, evidence_type='ADMINISTRATION', dose_value=1,
                dose_unit='synthetic-unit', route='ORAL', interval_end_exclusive_at=None),
            lab=None, condition=None, note=None, observation=None, supersedes_event_id=None)
        path = f'/patients/{patient}/events'; auth = headers('ACT-COORD-01', key=identity)
        response = client.post(path, headers=auth, json=body)
        assert response.status_code == 202
        receipt = response.json()['data']; job = wait_job(receipt['job'])
        assert job['status'] == 'SUCCEEDED'
        replay = client.post(path, headers=auth, json=body)
        assert replay.status_code == 200 and replay.json()['data']['event_id'] == receipt['event_id']
        return receipt, job

    if args.check_persistence:
        before = json.loads(output.read_text())['durable_snapshot']
        after = {path: get(path) for path in before}
        assert before == after, 'Durable API data changed across process restart'
        output.with_name('six-step-persistence.json').write_text(json.dumps({'equal': True,
            'paths_compared': list(before), 'health': get('/health')}, indent=2))
        print('PASS: uploaded model proposals, approvals, screening, cases, executions and audit survive API restart')
        return

    try:
        assert get('/health')['llm'] == 'enabled'
        if args.resume:
            proof = json.loads(output.read_text())
            proof.pop('failure_type', None)
            assert proof['base_url'] == args.base_url
            version = proof['steps']['unsigned_protocol']['protocol_version_id']
            prefix = '/trials/TR-PX104/protocols/' + version
            run_id = proof['steps']['assessments']['items'][0]['run_id']
        else:
            trial = get('/trials/TR-PX104')
            assert trial['active_protocol_version_id'] is None and trial['patient_count'] == 15
            pdf = Path('fixtures/protocols/px104-v1/PX-104-v1.0-fictional.pdf').read_bytes()
            response = client.post('/trials/TR-PX104/protocols', headers=headers('ACT-COORD-01'),
                files={'file': ('PX-104-fictional.pdf', pdf, 'application/pdf')},
                data={'version_label': 'LIVE-SIX-' + uuid4().hex[:8], 'source_declared_synthetic': 'true'})
            assert response.status_code == 201
            version = response.json()['data']['protocol_version_id']; prefix = '/trials/TR-PX104/protocols/' + version
            response = client.post(prefix + '/extract', headers=headers(), json={'force_reinspect': True})
            assert response.status_code == 202
            extraction = wait_job(response.json()['data']); record('extraction_job', extraction)
            assert extraction['status'] == 'SUCCEEDED', extraction['error']
            assert extraction['result']['proposal_origin'] == 'MODEL'
            detail = get(prefix); record('unsigned_protocol', detail)
            assert len(detail['criteria']) == 8 and len(detail['coverage']) == 12 and detail['blocking_count'] == 0
            assert detail['approved_set_hash'] is None and detail['coverage_signed_by'] is None
            assert all(c['approved_by'] is None and c['workflow_status'] == 'PROPOSED' for c in detail['criteria'])
            source = get('/trials/TR-PX104/evidence/' + detail['source']['source_id'])
            for c in detail['criteria']:
                page = next(s['text'] for s in source['spans'] if s['page'] == c['source_page'] and s['start'] == 0)
                assert page[c['source_anchor']['start']:c['source_anchor']['end']] == c['source_quote']
            body = dict(protocol_version_id=version, screening_date='2026-10-31',
                evidence_cutoff_at='2026-10-31T22:00:00Z', patient_ids=None, purpose='BASELINE')
            assert client.post('/trials/TR-PX104/screenings', headers=headers(), json=body).status_code == 409
            # Explicit synthetic QA reviewer action; never model-generated signoff.
            response = client.post(prefix + '/approve', headers=headers(revision=detail['revision']), json=dict(
                criterion_ids=[c['criterion_id'] for c in detail['criteria']], coverage_attestation=True, activate=True,
                decision_reason='Synthetic QA investigator reviewed all frozen clauses, exact source citations and coverage; not clinical certification'))
            assert response.status_code == 200; record('synthetic_investigator_approval', response.json()['data'])
            response = client.post('/trials/TR-PX104/screenings', headers=headers('ACT-COORD-01'), json=body)
            assert response.status_code == 202
            screened = wait_job(response.json()['data']); assert screened['status'] == 'SUCCEEDED'
            run_id = screened['result']['run_id']
            assessments = get('/screenings/' + run_id + '/assessments?limit=100')
            assert len(assessments['items']) == 15; record('assessments', assessments)
        for patient in ('P-042', 'P-151'):
            participate(patient)
        receipt, core = event('P-042', 'SYN-MED-R1'); record('monitoring_core', core)
        case_id = core['result']['case_ids'][0]
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            case = get('/cases/' + case_id)
            execution = get('/agent-executions/' + case['agent_execution_id'])
            if execution['status'] not in ('QUEUED', 'RUNNING'):
                break
            time.sleep(.2)
        record('monitoring_agent', execution); record('review_case', get('/cases/' + case_id))
        assert execution['status'] in ('SUCCEEDED', 'PARTIAL') and execution['error_code'] is None
        assert get('/cases/' + case_id)['summary_origin'] == 'AI_DRAFT'
        assert len(get('/trials/TR-PX104/cases')['items']) == 1
        irrelevant, no_action = event('P-151', 'SYN-MED-N1')
        assert no_action['result']['relevance'] == 'NO_ACTION'
        inactive = investigate('MONITORING_WORKFLOW', 'P-151', [], irrelevant['event_id'])
        assert len(inactive['trace']) == 1 and len(get('/trials/TR-PX104/cases')['items']) == 1
        investigate('MEDICATION_SAFETY_INVESTIGATOR', 'P-083', ['PX-EXC-02'])
        investigate('EVIDENCE_INVESTIGATOR', 'P-124', ['PX-INC-03'])
        investigate('MEDICATION_SAFETY_INVESTIGATOR', 'P-140', ['PX-EXC-02'])
        paths = [prefix, '/screenings/' + run_id, '/screenings/' + run_id + '/assessments?limit=100',
            '/cases/' + case_id, '/agent-executions/' + execution['execution_id'], '/trials/TR-PX104/audit?limit=100']
        proof['durable_snapshot'] = {path: get(path) for path in paths}
        proof['status'] = 'PASSED'
    except Exception as exc:
        proof['status'], proof['failure_type'] = 'FAILED', type(exc).__name__
        raise
    finally:
        text = json.dumps(proof, indent=2)
        key = (dotenv_values('.env').get('LLM_API_KEY') or '').strip()
        assert key and key not in text
        output.write_text(text, encoding='utf-8')
        client.close()


if __name__ == '__main__':
    main()
