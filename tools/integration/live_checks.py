"""Additional live HTTP/SQLite checks after the browser journey; synthetic inputs only."""
import copy
import json
from pathlib import Path
import sqlite3
import time
from uuid import uuid4

import httpx

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'artifacts/integration'
FIXTURE = ROOT / 'fixtures/protocols/px104-v1'


def main():
    proof = {'mode': 'REAL_HTTP_AND_PERSISTED_SQLITE_LLM_OFF', 'checks': [], 'calls': []}
    browser = json.loads((OUT / 'browser-evidence.json').read_text(encoding='utf-8'))
    client = httpx.Client(base_url='http://127.0.0.1:8000/api/v1', timeout=30)

    def call(method, path, *, actor='ACT-INV-01', expected=200, **kwargs):
        headers = {'X-Demo-Actor-Id': actor, **kwargs.pop('headers', {})}
        if method == 'POST':
            headers.setdefault('Idempotency-Key', uuid4().hex)
        r = client.request(method, path, headers=headers, **kwargs)
        data = r.json()
        proof['calls'].append({'method': method, 'path': path, 'status': r.status_code,
                              'request_id': data.get('request_id'), 'error': data.get('error')})
        assert r.status_code == expected, (path, r.status_code, data)
        assert r.headers['x-request-id'] == data['request_id']
        return data.get('data', data)

    def check(name, detail):
        proof['checks'].append({'name': name, 'observed': detail})

    def drain(receipt):
        job = receipt.get('job', receipt)
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            value = call('GET', '/jobs/' + job['job_id'])
            if value['status'] in ('SUCCEEDED', 'FAILED'):
                assert value['status'] == 'SUCCEEDED', value
                return value
            time.sleep(.1)
        raise AssertionError('Actual job deadline exceeded')

    def participate(pid):
        return call('POST', f'/trials/TR-PX104/patients/{pid}/participation', expected=201, json={
            'next_status': 'PARTICIPATING', 'external_record_source_id': f'SRC-{pid}-external',
            'external_record_reference': f'EXT-{pid}', 'rationale': 'Human records registered synthetic external evidence.'})

    def medication(pid, code, kind):
        source = 'IC-' + uuid4().hex
        return {'trial_id': 'TR-PX104', 'event_kind': 'MEDICATION', 'source_event_id': source,
            'source_version': 1, 'source_id': 'SRC-' + source, 'source_document_version': 1,
            'effective_at': '2026-11-19T09:30:00+02:00', 'recorded_at': '2026-11-20T11:00:00+02:00',
            'time_uncertainty': None, 'evidence_state': 'POSITIVE', 'evidence_quality': 'HIGH',
            'medication': {'code': code, 'evidence_type': kind, 'dose_value': None,
                'dose_unit': None, 'route': None, 'interval_end_exclusive_at': None},
            'lab': None, 'condition': None, 'note': None, 'observation': None, 'supersedes_event_id': None}

    try:
        check('health', call('GET', '/health'))
        allowed = client.get('/health', headers={'Origin': 'http://localhost:3000'})
        denied = client.get('/health', headers={'Origin': 'https://untrusted.invalid'})
        assert allowed.headers['access-control-allow-origin'] == 'http://localhost:3000'
        assert 'access-control-allow-origin' not in denied.headers
        preflight = client.options('/trials', headers={'Origin': 'http://localhost:3000',
            'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'X-Demo-Actor-Id,Idempotency-Key,Content-Type,If-Match'})
        assert preflight.status_code == 200
        check('cors', {'allowed': allowed.status_code, 'disallowed_origin_has_no_grant': True, 'preflight': preflight.status_code})

        run_id = browser['run']['run_id']
        page = call('GET', f'/screenings/{run_id}/assessments?limit=4')
        all_rows = page['items']
        while page['page']['next_cursor']:
            page = call('GET', f'/screenings/{run_id}/assessments?limit=4&cursor=' + page['page']['next_cursor'])
            all_rows.extend(page['items'])
        assert len({r['patient_id'] for r in all_rows}) == 15
        check('pagination', {'assessment_count': len(all_rows), 'page_size': 4})
        for pid in ('P-083', 'P-140', 'P-124', 'P-117', 'P-118'):
            row = next(a for a in all_rows if a['patient_id'] == pid)
            check(pid, {'candidate_status': row['candidate_status'], 'criteria': [
                {k: r[k] for k in ('criterion_id', 'status', 'reason_codes', 'evidence_refs', 'considered_interval')}
                for r in row['criteria'] if r['criterion_id'] in ('PX-EXC-02', 'PX-INC-03')]})
        assert next(a for a in all_rows if a['patient_id'] == 'P-042')['candidate_status'] == 'POTENTIAL_MATCH'

        version = browser['protocol_version_id']
        call('POST', '/agent-investigations', expected=503, json={'role': 'EVIDENCE_INVESTIGATOR',
            'trial_id': 'TR-PX104', 'protocol_version_id': version, 'patient_id': 'P-083',
            'criterion_ids': ['PX-EXC-02'], 'event_id': None, 'objective': 'Investigate missing use evidence.'})
        check('missing-ai-key', '503 AGENT_UNAVAILABLE; no model calls')

        bad = medication('P-083', 'SYN-MED-R1', 'ORDER')
        bad['event_kind'], bad['medication'] = 'LAB', None
        bad['lab'] = {'analyte_code': 'egfr', 'value': 40, 'unit': 'unsupported-unit'}
        call('POST', '/patients/P-083/events', actor='ACT-COORD-01', expected=422, json=bad)
        check('invalid-unit', '422; no clinical assertion created')
        for pid, code, kind, expected_category in [('P-083', 'SYN-MED-R1', 'ORDER', 'POTENTIAL_SAFETY_REVIEW'),
                ('P-203', 'SYN-MED-UNMAPPED', 'ADMINISTRATION', 'DATA_QUALITY_DISCREPANCY'),
                ('P-151', 'SYN-MED-N1', 'ADMINISTRATION', None)]:
            participate(pid)
            receipt = call('POST', f'/patients/{pid}/events', actor='ACT-COORD-01', expected=202,
                json=medication(pid, code, kind))
            job = drain(receipt)
            findings = call('GET', f'/trials/TR-PX104/findings?patient_id={pid}')['items']
            if expected_category:
                assert len(findings) == 1 and findings[0]['category'] == expected_category, findings
            else:
                assert not findings and job['result']['relevance'] == 'NO_ACTION'
            check('event-' + pid, {'job': job, 'findings': findings})

        # An actual HTTP-created trial and uploaded PDF, independently from the seeded trial.
        trial = call('POST', '/trials', actor='ACT-COORD-01', expected=201, json={
            'title': 'Synthetic integration QA trial', 'fictional_product_code': 'PX-104',
            'site_id': 'SITE-SYN-01', 'site_timezone': 'Europe/Athens',
            'planned_start_date': '2026-11-01', 'planned_end_date': '2027-01-24', 'synthetic_only': True})
        prefix = '/trials/' + trial['trial_id'] + '/protocols'
        pdf = (FIXTURE / 'PX-104-v1.0-fictional.pdf').read_bytes()
        upload = call('POST', prefix, actor='ACT-COORD-01', expected=201,
            files={'file': ('fixture.pdf', pdf, 'application/pdf')},
            data={'version_label': 'IC-live-QA', 'source_declared_synthetic': 'true'})
        path = prefix + '/' + upload['protocol_version_id']
        drain(call('POST', path + '/extract', actor='ACT-COORD-01', expected=202, json={'force_reinspect': False}))
        detail = call('GET', path)
        assert detail['state'] == 'EXTRACTION_REVIEW' and detail['approved_set_hash'] is None
        payload = json.loads((FIXTURE / 'expected_extraction.json').read_text(encoding='utf-8'))
        for rule in payload['criteria']:
            rule['protocol_version_id'], rule['source_id'] = detail['protocol_version_id'], detail['source']['source_id']
        for item in payload['coverage']:
            item['source_id'] = detail['source']['source_id']
        mutations = json.loads((FIXTURE / 'extraction_checks.json').read_text(encoding='utf-8'))['cases']
        outcomes = []
        for mutation in mutations:
            body = copy.deepcopy(payload)
            parent = body
            for part in mutation['path'][:-1]:
                parent = parent[part]
            key = mutation['path'][-1]
            if mutation['op'] == 'remove':
                del parent[key]
            elif mutation['op'] == 'clone_rule':
                clone = copy.deepcopy(body['criteria'][-1]); clone['criterion_id'] = mutation['value']; body['criteria'].append(clone)
            else:
                value = mutation['value']
                if value == 'UTF8_END':
                    rule = body['criteria'][2]
                    page = call('GET', f'/trials/{trial["trial_id"]}/evidence/{rule["source_id"]}?page={rule["source_page"]}')['spans'][0]['text']
                    value = len(page[:rule['source_anchor']['end']].encode())
                parent[key] = value
            res = client.put(path + '/criteria', headers={'X-Demo-Actor-Id': 'ACT-INV-01', 'If-Match': f'"{detail["revision"]}"'}, json=body)
            assert res.status_code in (409, 422), (mutation['id'], res.text)
            outcomes.append({'mutation': mutation['id'], 'status': res.status_code, 'error': res.json()['error']['code']})
        assert call('GET', path)['revision'] == detail['revision']
        check('malformed-extraction', outcomes)
        for content, expected in [(b'not PDF', 415), (b'%PDF-1.7\ntruncated', 403), (b'%PDF-' + b'x' * (12 * 1024 * 1024), 413)]:
            call('POST', prefix, actor='ACT-COORD-01', expected=expected,
                files={'file': ('bad.pdf', content, 'application/pdf')},
                data={'version_label': uuid4().hex, 'source_declared_synthetic': 'true'})
        check('upload-failures', '415 signature; 403 non-allowlisted PDF; 413 oversize; no model/parser success claimed')

        case_id = browser['review_case']['case_id']
        case = call('GET', '/cases/' + case_id)
        execution = call('GET', '/agent-executions/' + case['agent_execution_id'])
        assert execution['status'] == 'UNAVAILABLE' and execution['trace'] == []
        check('monitoring-off-trace', execution)
        with sqlite3.connect('file:backend/var/protocolpulse.db?mode=ro', uri=True) as db:
            counts = {table: db.execute(f'SELECT count(*) FROM {table}').fetchone()[0] for table in
                ('patient', 'patient_event', 'review_case', 'monitoring_finding', 'review_decision', 'audit_entry', 'screening_run')}
            assert counts['patient'] == 15
            assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
            assert not db.execute('PRAGMA foreign_key_check').fetchall()
            check('sqlite', {'counts': counts, 'integrity_check': 'ok', 'foreign_key_check': []})
        print(f'PASS: {len(proof["checks"])} additional live checks; synthetic SQLite data persisted.')
    finally:
        (OUT / 'live-api-evidence.json').write_text(json.dumps(proof, indent=2), encoding='utf-8')
        client.close()


if __name__ == '__main__':
    main()
