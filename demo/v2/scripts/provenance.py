"""Sanitized source proof from the real capture API; never read or export credentials."""
import json
from pathlib import Path
import httpx

BASE=Path('demo/v2')
journey=json.loads((BASE/'recordings/take02/journey.json').read_text())
with httpx.Client(base_url=journey['api']+'/api/v1',headers={'X-Demo-Actor-Id':'ACT-INV-01'},timeout=15) as client:
 def get(route):
  response=client.get(route);response.raise_for_status();return response.json()['data']
 proof={'mocked':False,'single_take':True,'trial':get('/trials/TR-PX104')}
 active=next(v for v in get('/trials/TR-PX104/protocols')['items'] if v['state']=='ACTIVE')
 proof['protocol']=get('/trials/TR-PX104/protocols/'+active['protocol_version_id'])
 proof['extraction_job']=get('/jobs/'+proof['protocol']['extraction_job_id'])
 proof['extraction_execution']=get('/agent-executions/'+proof['extraction_job']['result']['execution_id'])
 proof['screening']=get('/screenings/'+journey['runId'])
 proof['case']=get('/cases/'+journey['caseId'])
 proof['monitoring_execution']=get('/agent-executions/'+proof['case']['agent_execution_id'])
 assert proof['trial']['patient_count']==30
 assert proof['extraction_execution']['status']=='SUCCEEDED'
 assert proof['monitoring_execution']['status']=='SUCCEEDED'
 assert len(proof['protocol']['criteria'])==8 and all(x['workflow_status']=='APPROVED' for x in proof['protocol']['criteria'])
 assert proof['screening']['status']=='COMPLETE'
 assert proof['case']['status']=='ACKNOWLEDGED' and proof['case']['decisions'][-1]['cited_evidence_ids']
 with httpx.Client(base_url='http://127.0.0.1:8000/api/v1',headers={'X-Demo-Actor-Id':'ACT-INV-01'}) as shared:
  proof['shared_trial']=shared.get('/trials/TR-PX104').json()['data']
  cases=shared.get('/trials/TR-PX104/cases?limit=100').json()['data']['items']
  old=json.loads((BASE/'assets/shared-baseline.json').read_text())['cases']['items']
  assert [(x['case_id'],x['status'],x['revision']) for x in cases]==[(x['case_id'],x['status'],x['revision']) for x in old]
  assert proof['shared_trial']['patient_count']==30
  proof['shared_case_history_unchanged']=True
 (BASE/'assets/provenance.json').write_text(json.dumps(proof,indent=2))
 print('Verified real extraction, screening, monitoring AI, cited human decision and preserved shared history.')
