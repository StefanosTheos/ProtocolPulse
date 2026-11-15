"""Independent synthetic HTTP audit; uses a new database and preserves the demo."""
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/integration/judge'
OUT.mkdir(parents=True, exist_ok=True)
RUNTIME = ROOT / ('backend/var/judge-http-' + uuid4().hex[:8])
RUNTIME.mkdir(parents=True, exist_ok=True)
ENV = {**os.environ, 'DATABASE_URL': 'sqlite:///' + (RUNTIME / 'audit.db').as_posix(),
       'PROTOCOL_STORAGE_DIR': str(RUNTIME / 'protocols'), 'LLM_ENABLED': 'false',
       'PYTHONUTF8': '1', 'PYTHONIOENCODING': 'utf-8'}
proof = {'mode': 'INDEPENDENT_REAL_HTTP_SQLITE', 'checks': {}}
client = httpx.Client(base_url='http://127.0.0.1:8015/api/v1', timeout=40)
process = None
log = (OUT / 'server.log').open('a', encoding='utf-8')


def call(method, path, expected=200, actor='ACT-INV-01', revision=None, key=None, **kwargs):
    headers = {'X-Demo-Actor-Id': actor, 'Idempotency-Key': key or uuid4().hex}
    if revision is not None:
        headers['If-Match'] = f'"{revision}"'
    response = client.request(method, path, headers=headers, **kwargs)
    assert response.status_code == expected, (path, response.status_code, response.text)
    return response.json().get('data', response.json())


def get(path):
    return call('GET', path)


def wait(receipt):
    for _ in range(350):
        job = get('/jobs/' + receipt['job_id'])
        if job['status'] in ('SUCCEEDED', 'FAILED'):
            return job
        time.sleep(.2)
    raise AssertionError('Job polling deadline')


def start():
    global process
    process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'backend.app.main:app',
                                '--host', '127.0.0.1', '--port', '8015'], env=ENV,
                               cwd=ROOT, stdout=log, stderr=log)
    for _ in range(100):
        try:
            if get('/health')['worker'] == 'running':
                return
        except (httpx.HTTPError, AssertionError):
            pass
        time.sleep(.2)
    raise AssertionError('API did not become ready')


def event(code='SYN-MED-R1'):
    identity = 'JUDGE-' + uuid4().hex
    return dict(trial_id='TR-PX104', event_kind='MEDICATION', source_event_id=identity,
                source_version=1, source_id='SRC-' + identity, source_document_version=1,
                effective_at='2026-11-19T09:30:00+02:00', recorded_at='2026-11-20T11:00:00+02:00',
                time_uncertainty=None, evidence_state='POSITIVE', evidence_quality='HIGH',
                medication=dict(code=code, evidence_type='ADMINISTRATION', dose_value=1,
                                dose_unit='synthetic-unit', route='ORAL', interval_end_exclusive_at=None),
                lab=None, condition=None, note=None, observation=None, supersedes_event_id=None)


def participate(pid):
    return call('POST', f'/trials/TR-PX104/patients/{pid}/participation', 201, json=dict(
        next_status='PARTICIPATING', external_record_source_id=f'SRC-{pid}-external',
        external_record_reference=f'EXT-{pid}', rationale='Independent synthetic QA participation'))


try:
    assert not (RUNTIME / 'audit.db').exists(), 'Use a fresh audit path; do not reset existing evidence'
    for args in [ ['-m', 'alembic', '-c', 'backend/alembic.ini', 'upgrade', 'head'],
                  ['-m', 'backend.app.seed', '--dataset', 'px104-15'] ]:
        subprocess.run([sys.executable, *args], env=ENV, cwd=ROOT, check=True, stdout=log, stderr=log)
    start()
    proof['health'] = get('/health')
    prefix = '/trials/TR-PX104/protocols/PV-PX104-1.0'
    screen_body = dict(protocol_version_id='PV-PX104-1.0', screening_date='2026-10-31',
                       evidence_cutoff_at='2026-10-31T22:00:00Z', patient_ids=None, purpose='BASELINE')
    proof['checks']['preapproval'] = call('POST', '/trials/TR-PX104/screenings', 409, json=screen_body)
    receipt = call('POST', prefix + '/extract', 202, json={'force_reinspect': True})
    proof['extraction'] = wait(receipt)
    detail = get(prefix)
    proof['unsigned'] = detail
    proof['approval'] = call('POST', prefix + '/approve', revision=detail['revision'], json=dict(
        criterion_ids=[c['criterion_id'] for c in detail['criteria']], coverage_attestation=True,
        activate=True, decision_reason='Independent synthetic QA source and coverage review'))
    receipt = call('POST', '/trials/TR-PX104/screenings', 202, actor='ACT-COORD-01', json=screen_body)
    job = wait(receipt)
    assert job['status'] == 'SUCCEEDED', job
    run = job['result']['run_id']
    proof['screening'] = get('/screenings/' + run)
    assessments = get(f'/screenings/{run}/assessments?limit=100')
    proof['assessments'] = assessments
    participate('P-042')
    body = event()
    accepted = call('POST', '/patients/P-042/events', 202, actor='ACT-COORD-01', json=body)
    proof['event'] = accepted
    proof['monitoring_job'] = wait(accepted['job'])
    proof['duplicate_new_key'] = call('POST', '/patients/P-042/events', actor='ACT-COORD-01', json=body)
    changed = {**body, 'medication': {**body['medication'], 'code': 'SYN-MED-N1'}}
    proof['checks']['changed_same_version'] = call('POST', '/patients/P-042/events', 409,
                                                 actor='ACT-COORD-01', json=changed)
    cases = get('/trials/TR-PX104/cases?patient_id=P-042')['items']
    assert len(cases) == 1
    case = get('/cases/' + cases[0]['case_id'])
    proof['case_before_review'] = case
    cited = get('/trials/TR-PX104/findings?patient_id=P-042')['items'][0]['evidence_refs'][0]['evidence_id']
    patch = dict(expected_revision=case['revision'], next_status='RESOLVED', assigned_actor_id='ACT-INV-01',
                 disposition='REVIEWED', rationale='Independent synthetic QA', cited_evidence_ids=[cited])
    proof['checks']['unauthorized_review'] = call('PATCH', '/cases/' + case['case_id'], 403,
        actor='ACT-COORD-01', revision=case['revision'], json=patch)
    for status in ('ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'CLOSED'):
        patch.update(expected_revision=case['revision'], next_status=status)
        case = call('PATCH', '/cases/' + case['case_id'], revision=case['revision'], json=patch)
    proof['case_after_review'] = case
    assert len(case['decisions']) == 4
    participate('P-151')
    irrelevant = call('POST', '/patients/P-151/events', 202, actor='ACT-COORD-01', json=event('SYN-MED-N1'))
    proof['irrelevant_job'] = wait(irrelevant['job'])
    assert proof['irrelevant_job']['result']['relevance'] == 'NO_ACTION'
    assert get('/trials/TR-PX104/cases?patient_id=P-151')['items'] == []
    proof['checks']['immutable_baseline'] = assessments == get(f'/screenings/{run}/assessments?limit=100')
    proof['checks']['unavailable_agent'] = call('POST', '/agent-investigations', 503, json=dict(
        role='EVIDENCE_INVESTIGATOR', trial_id='TR-PX104', protocol_version_id='PV-PX104-1.0',
        patient_id='P-124', criterion_ids=['PX-INC-03'], event_id=None, objective='Review stale lab'))
    bad = b'%PDF-broken-fictional'
    proof['checks']['malformed_pdf'] = call('POST', '/trials/TR-PX104/protocols', 403,
        actor='ACT-COORD-01', files={'file': ('broken.pdf', bad, 'application/pdf')},
        data={'version_label': 'JUDGE-BAD', 'source_declared_synthetic': 'true'})
    paths = [prefix, '/screenings/' + run, f'/screenings/{run}/assessments?limit=100',
             '/cases/' + case['case_id'], '/trials/TR-PX104/audit?limit=100']
    before = {path: get(path) for path in paths}
    process.terminate()
    process.wait(timeout=15)
    start()
    proof['checks']['actual_process_restart_equal'] = before == {path: get(path) for path in paths}
    assert proof['checks']['actual_process_restart_equal']
    proof['result'] = 'PASS'
except Exception as exc:
    proof['failure'] = {'type': type(exc).__name__, 'message': str(exc)}
    raise
finally:
    (OUT / 'http-probe.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
    if process and process.poll() is None:
        process.terminate()
        process.wait(timeout=15)
    log.close()
    client.close()
    print(json.dumps({'result': proof.get('result'), 'failure': proof.get('failure'),
                      'checks': list(proof['checks'])}))
