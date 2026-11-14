"""Authorized live Gemini tests through public API jobs, real E2 gateway and persistent SQLite."""
import argparse
import json
from pathlib import Path
import time
from uuid import uuid4

from dotenv import dotenv_values
import httpx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--case', choices=['medication', 'lab', 'conflict', 'protocol', 'monitoring', 'irrelevant', 'all'], default='all')
    args = parser.parse_args()
    client = httpx.Client(base_url='http://127.0.0.1:8000/api/v1', timeout=15,
                         headers={'X-Demo-Actor-Id': 'ACT-INV-01'})
    output = Path('artifacts/integration/live-enabled')
    output.mkdir(parents=True, exist_ok=True)
    trial = client.get('/trials/TR-PX104').json()['data']
    version = trial['active_protocol_version_id']
    health = client.get('/health').json()['data']
    assert health['llm'] == 'enabled', 'Restart the API with enabled server configuration before live tests'
    cases = [
        ('medication', 'MEDICATION_SAFETY_INVESTIGATOR', 'P-083', ['PX-EXC-02'], version,
         'Investigate the recorded medication evidence for the approved criterion. Retain uncertainties and propose a sourced verification question if necessary.'),
        ('lab', 'EVIDENCE_INVESTIGATOR', 'P-124', ['PX-INC-03'], version,
         'Investigate the missing or stale laboratory evidence for the approved criterion and prepare a cited verification question.'),
        ('conflict', 'MEDICATION_SAFETY_INVESTIGATOR', 'P-140', ['PX-EXC-02'], version,
         'Investigate contradictory medication evidence for the approved criterion. Preserve conflicting sources and request human verification.'),
        ('protocol', 'PROTOCOL_INTELLIGENCE', None, [], 'PV-PX104-1.0',
         'Inspect the registered fictional PDF source SRC-PROTOCOL-PX104-V1 version 1. Propose source-linked rules and coverage for human review. No rule is approved by this investigation.'),
    ]
    results = []
    def wait_job(job_id):
        deadline = time.monotonic() + 65
        while time.monotonic() < deadline:
            response = client.get('/jobs/' + job_id)
            assert response.status_code == 200
            job = response.json()['data']
            if job['status'] in ('SUCCEEDED', 'FAILED'):
                return job
            time.sleep(.2)
        raise RuntimeError('Live backend job did not reach a terminal state within its test deadline')

    if args.case in ('all', 'monitoring', 'irrelevant'):
        for name, patient, code in [('monitoring', 'P-042', 'SYN-MED-R1'), ('irrelevant', 'P-151', 'SYN-MED-N1')]:
            if args.case not in ('all', name):
                continue
            started = time.perf_counter()
            source = 'AI-LIVE-' + uuid4().hex
            event = {'trial_id': 'TR-PX104', 'event_kind': 'MEDICATION', 'source_event_id': source,
                'source_version': 1, 'source_id': 'SRC-' + source, 'source_document_version': 1,
                'effective_at': '2026-11-20T09:30:00+02:00', 'recorded_at': '2026-11-21T11:00:00+02:00',
                'time_uncertainty': None, 'evidence_state': 'POSITIVE', 'evidence_quality': 'HIGH',
                'medication': {'code': code, 'evidence_type': 'ADMINISTRATION', 'dose_value': 1,
                    'dose_unit': 'synthetic-unit', 'route': 'ORAL', 'interval_end_exclusive_at': None},
                'lab': None, 'condition': None, 'note': None, 'observation': None, 'supersedes_event_id': None}
            before = client.get(f'/trials/TR-PX104/cases?patient_id={patient}').json()['data']['items']
            accepted = client.post(f'/patients/{patient}/events', json=event,
                headers={'X-Demo-Actor-Id': 'ACT-COORD-01', 'Idempotency-Key': source})
            assert accepted.status_code == 202
            receipt = accepted.json()['data']
            core_job = wait_job(receipt['job']['job_id'])
            assert core_job['status'] == 'SUCCEEDED'
            case = None
            if name == 'monitoring':
                deadline = time.monotonic() + 40
                while time.monotonic() < deadline:
                    case = client.get('/cases/' + core_job['result']['case_ids'][0]).json()['data']
                    execution = client.get('/agent-executions/' + case['agent_execution_id']).json()['data']
                    if execution['event_id'] == receipt['event_id'] and execution['status'] not in ('QUEUED', 'RUNNING'):
                        break
                    time.sleep(.2)
                else:
                    raise RuntimeError('Automatic monitoring enrichment did not finish')
                case = client.get('/cases/' + case['case_id']).json()['data']
                assert len(client.get(f'/trials/TR-PX104/cases?patient_id={patient}').json()['data']['items']) == len(before)
            else:
                assert core_job['result']['relevance'] == 'NO_ACTION'
                assert len(client.get(f'/trials/TR-PX104/cases?patient_id={patient}').json()['data']['items']) == len(before)
                request = {'role': 'MONITORING_WORKFLOW', 'trial_id': 'TR-PX104', 'protocol_version_id': version,
                    'patient_id': patient, 'criterion_ids': [], 'event_id': receipt['event_id'], 'objective': 'Read backend event relevance. Stop immediately if NO_ACTION.'}
                accepted = client.post('/agent-investigations', json=request, headers={'Idempotency-Key': 'live-' + uuid4().hex})
                assert accepted.status_code == 202
                job = wait_job(accepted.json()['data']['job_id'])
                execution = client.get('/agent-executions/' + job['resource_id']).json()['data']
            proof = {'mode': 'LIVE_GEMINI_REAL_HTTP_BACKEND_GATEWAY_SQLITE', 'core_job': core_job,
                'receipt': receipt, 'case': case, 'execution': execution, 'elapsed_seconds': round(time.perf_counter() - started, 3)}
            text = json.dumps(proof, indent=2)
            key = (dotenv_values('.env').get('LLM_API_KEY') or '').strip()
            assert key and key not in text
            (output / f'{name}-{execution["execution_id"]}.json').write_text(text, encoding='utf-8')
            result = {'case': name, 'status': execution['status'], 'error_code': execution['error_code'],
                'model_id': execution['model_id'], 'elapsed_seconds': proof['elapsed_seconds'],
                'tools': [t['tool_name'] for t in execution['trace']]}
            results.append(result)
            print(json.dumps(result), flush=True)
    for name, role, patient, criteria, protocol, objective in cases:
        if args.case not in ('all', name):
            continue
        started = time.perf_counter()
        request = {'role': role, 'trial_id': 'TR-PX104', 'protocol_version_id': protocol,
                   'patient_id': patient, 'criterion_ids': criteria, 'event_id': None, 'objective': objective}
        accepted = client.post('/agent-investigations', json=request, headers={'Idempotency-Key': 'live-' + uuid4().hex})
        assert accepted.status_code == 202, f'Investigation rejected: HTTP {accepted.status_code}'
        receipt = accepted.json()['data']
        job = wait_job(receipt['job_id'])
        execution = client.get('/agent-executions/' + receipt['resource_id']).json()['data']
        proof = {'mode': 'LIVE_GEMINI_REAL_HTTP_BACKEND_GATEWAY_SQLITE', 'request': request,
                 'job': job, 'execution': execution, 'elapsed_seconds': round(time.perf_counter() - started, 3)}
        text = json.dumps(proof, indent=2)
        key = (dotenv_values('.env').get('LLM_API_KEY') or '').strip()
        assert key and key not in text, 'Evidence redaction guard rejected output'
        (output / f'{name}-{receipt["resource_id"]}.json').write_text(text, encoding='utf-8')
        result = {'case': name, 'status': execution['status'], 'error_code': execution['error_code'],
                  'model_id': execution['model_id'], 'elapsed_seconds': proof['elapsed_seconds'],
                  'tools': [t['tool_name'] for t in execution['trace']]}
        results.append(result)
        print(json.dumps(result), flush=True)
    client.close()
    raise SystemExit(0 if all(r['status'] in ('SUCCEEDED', 'PARTIAL') and not r['error_code'] for r in results) else 1)


if __name__ == '__main__':
    main()
