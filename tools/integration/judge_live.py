"""Independent live-model probes against the isolated judge database."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4
import httpx

root = Path(__file__).resolve().parents[2]
out = root / 'artifacts/integration/judge'
runtime = sorted((root / 'backend/var').glob('judge-http-*/audit.db'), key=lambda p: p.stat().st_mtime)[-1].parent
env = {**os.environ, 'DATABASE_URL': 'sqlite:///' + (runtime / 'audit.db').as_posix(),
       'PROTOCOL_STORAGE_DIR': str(runtime / 'protocols'), 'LLM_ENABLED': 'true',
       'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8'}
log = (out / 'live-server.log').open('w', encoding='utf-8')
process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.app.main:app', '--host',
                            '127.0.0.1', '--port', '8015'], cwd=root, env=env, stdout=log, stderr=log)
c = httpx.Client(base_url='http://127.0.0.1:8015/api/v1', timeout=20)
workflow_only = '--workflow-only' in sys.argv
proof = {'mode': 'INDEPENDENT_LIVE_MODEL_REAL_HTTP_SQLITE', 'executions': []}


def call(method, path, expected=200, actor='ACT-INV-01', **kwargs):
    r = c.request(method, path, headers={'X-Demo-Actor-Id': actor,
                  'Idempotency-Key': uuid4().hex}, **kwargs)
    assert r.status_code == expected, (path, r.status_code, r.text)
    return r.json()['data']


def wait(receipt):
    for _ in range(250):
        job = call('GET', '/jobs/' + receipt['job_id'])
        if job['status'] in ('SUCCEEDED', 'FAILED'):
            return job
        time.sleep(.2)
    raise AssertionError('Polling deadline')


try:
    for _ in range(100):
        try:
            proof['health'] = call('GET', '/health')
            break
        except httpx.HTTPError:
            time.sleep(.2)
    scenarios = [
        ('EVIDENCE_INVESTIGATOR', 'P-124', ['PX-INC-03']),
        ('MEDICATION_SAFETY_INVESTIGATOR', 'P-083', ['PX-EXC-02']),
        ('MEDICATION_SAFETY_INVESTIGATOR', 'P-140', ['PX-EXC-02']),
        ('MONITORING_WORKFLOW', 'P-042', ['PX-MON-01']),
        ('MONITORING_WORKFLOW', 'P-151', []),
        ('PROTOCOL_INTELLIGENCE', None, []),
    ]
    for role, pid, criteria in ([] if workflow_only else scenarios):
        event_id = None
        if role == 'MONITORING_WORKFLOW':
            original = json.loads((out / 'http-probe.json').read_text('utf-8'))
            event_id = original['event']['event_id'] if pid == 'P-042' else original['irrelevant_job']['resource_id']
        receipt = call('POST', '/agent-investigations', 202, json=dict(role=role, trial_id='TR-PX104',
            protocol_version_id='PV-PX104-1.0', patient_id=pid, criterion_ids=criteria, event_id=event_id,
            objective='Independently investigate the scoped synthetic evidence; retain uncertainty and propose sourced human verification where needed.'))
        started = time.monotonic()
        job = wait(receipt)
        execution = call('GET', '/agent-executions/' + receipt['resource_id'])
        proof['executions'].append({'job': job, 'execution': execution,
                                    'elapsed_seconds': round(time.monotonic() - started, 3)})
        print(json.dumps({'role': role, 'patient': pid, 'status': execution['status'],
                          'error': execution['error_code'], 'tools': [t['tool_name'] for t in execution['trace']]}), flush=True)
    proof['patients_after'] = {pid: call('GET', f'/trials/TR-PX104/patients/{pid}')
                               for pid in ('P-124', 'P-083', 'P-140')}
    if workflow_only:
        pdf = (root / 'fixtures/protocols/px104-v1/PX-104-v1.0-fictional.pdf').read_bytes()
        uploaded = call('POST', '/trials/TR-PX104/protocols', 201, actor='ACT-COORD-01',
            files={'file': ('fictional.pdf', pdf, 'application/pdf')},
            data={'version_label': 'JUDGE-LIVE-' + uuid4().hex[:8], 'source_declared_synthetic': 'true'})
        prefix = '/trials/TR-PX104/protocols/' + uploaded['protocol_version_id']
        proof['upload'] = uploaded
        proof['extraction_job'] = wait(call('POST', prefix + '/extract', 202, json={'force_reinspect': True}))
        proof['extracted'] = call('GET', prefix)
        original = json.loads((out / 'http-probe.json').read_text('utf-8'))
        event_id = original['event']['event_id']
        # Read the immutable API-recorded event shape from the independent probe script's receipt context.
        identity = 'JUDGE-AUTO-' + uuid4().hex
        body = dict(trial_id='TR-PX104', event_kind='MEDICATION', source_event_id=identity,
            source_version=1, source_id='SRC-' + identity, source_document_version=1,
            effective_at='2026-11-20T09:30:00+02:00', recorded_at='2026-11-21T11:00:00+02:00',
            time_uncertainty=None, evidence_state='POSITIVE', evidence_quality='HIGH',
            medication=dict(code='SYN-MED-R2', evidence_type='ADMINISTRATION', dose_value=1,
                            dose_unit='synthetic-unit', route='ORAL', interval_end_exclusive_at=None),
            lab=None, condition=None, note=None, observation=None, supersedes_event_id=None)
        receipt = call('POST', '/patients/P-042/events', 202, actor='ACT-COORD-01', json=body)
        core = wait(receipt['job'])
        proof['automatic_event'] = {'receipt': receipt, 'core_job': core}
        case_id = core['result']['case_ids'][0]
        for _ in range(200):
            case = call('GET', '/cases/' + case_id)
            if case['agent_execution_id']:
                execution = call('GET', '/agent-executions/' + case['agent_execution_id'])
                if execution['event_id'] == receipt['event_id'] and execution['status'] not in ('QUEUED', 'RUNNING'):
                    break
            time.sleep(.2)
        proof['automatic_event'].update(case=case, execution=execution)
        print(json.dumps({'automatic_status': execution['status'], 'error': execution['error_code'],
                          'tools': [t['tool_name'] for t in execution['trace']]}), flush=True)
    print('Live probes complete', flush=True)
    # Keep available briefly for independent browser observation if requested.
    if '--serve' in sys.argv:
        print('READY_FOR_BROWSER', flush=True)
        time.sleep(300)
except Exception as exc:
    proof['failure'] = {'type': type(exc).__name__, 'message': str(exc)}
    raise
finally:
    (out / ('live-workflow.json' if workflow_only else 'live-probe.json')).write_text(json.dumps(proof, indent=2), encoding='utf-8')
    process.terminate()
    process.wait(timeout=15)
    log.close()
    c.close()
