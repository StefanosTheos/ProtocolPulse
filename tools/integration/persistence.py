"""Capture/compare durable API data across an actual API process restart."""
import hashlib
import json
from pathlib import Path
import sqlite3
import sys

import httpx

folder = Path('artifacts/integration')
browser = json.loads((folder / 'browser-evidence.json').read_text(encoding='utf-8'))
paths = ['/trials/TR-PX104', '/trials/TR-PX104/protocols/' + browser['protocol_version_id'],
         '/screenings/' + browser['run']['run_id'], '/screenings/' + browser['run']['run_id'] + '/assessments?limit=100',
         '/trials/TR-PX104/patients/P-042', '/cases/' + browser['review_case']['case_id'],
         '/trials/TR-PX104/findings?limit=100', '/trials/TR-PX104/audit?limit=100']
snapshot = {}
with httpx.Client(base_url='http://127.0.0.1:8000/api/v1', headers={'X-Demo-Actor-Id': 'ACT-INV-01'}) as client:
    health = client.get('/health')
    assert health.status_code == 200
    for path in paths:
        res = client.get(path)
        assert res.status_code == 200, res.text
        snapshot[path] = res.json()['data']
with sqlite3.connect('file:backend/var/protocolpulse.db?mode=ro', uri=True) as db:
    snapshot['sqlite_counts'] = {table: db.execute(f'SELECT count(*) FROM {table}').fetchone()[0]
        for table in ('patient', 'protocol_version', 'criterion_approval', 'patient_event', 'review_case',
                      'review_decision', 'audit_entry', 'screening_run', 'patient_trial_assessment')}
    assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
digest = hashlib.sha256(json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
if sys.argv[1] == 'before':
    (folder / 'durable-snapshot-before.json').write_text(json.dumps(snapshot, indent=2), encoding='utf-8')
    print('Saved durable API/SQLite snapshot:', digest)
else:
    before = json.loads((folder / 'durable-snapshot-before.json').read_text(encoding='utf-8'))
    (folder / 'durable-snapshot-after.json').write_text(json.dumps(snapshot, indent=2), encoding='utf-8')
    assert before == snapshot, 'Durable API/SQLite data changed across restart'
    (folder / 'persistence-result.json').write_text(json.dumps({'equal': True, 'sha256': digest,
        'counts': snapshot['sqlite_counts'], 'api_paths_compared': paths, 'health_after_restart': health.json()['data']}, indent=2), encoding='utf-8')
    print('PASS: restart preserves all selected durable API data and SQLite counts:', digest)
