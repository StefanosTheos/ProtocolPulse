import asyncio

from ai.agents.coordinator import Coordinator
from ai.config import Settings
from ai.evals.fixtures import ScenarioModel, gateway, proposal, request
from ai.providers.gemini import ToolCall
from ai.tools.schemas import AgentRequest


class MonitorModel(ScenarioModel):
    finalized = False
    async def next(self, req, tools):
        names = [c.name for c, _ in self.observed]
        if set(names) >= {'classify_event_relevance', 'get_prior_evaluation', 'get_case_status'}:
            return ToolCall('retrieve_patient_evidence', {'patient_id': req['patient_id'],
                'snapshot_id': req['evidence_snapshot_id'], 'criterion_ids': req['criterion_ids'],
                'evidence_types': ['ADMINISTRATION']})
        return await super().next(req, tools)
    async def finalize(self, req):
        self.finalized = True
        refs = [r for _, response in self.observed for r in response['evidence_refs']]
        return proposal(refs=refs, summary='Backend source and prior evaluation require investigator review.')


def execute(gate, model, **settings):
    return asyncio.run(Coordinator(AgentRequest.model_validate(request('MONITORING_WORKFLOW', 'P-042', 'PX-MON-01')),
        gate, Settings(**settings), model).run())


def test_monitoring_finishes_after_sufficient_evidence_without_redundant_reads():
    gate, model = gateway('P-042', order=False), MonitorModel('monitor')
    result = execute(gate, model)
    assert result['status'] == 'SUCCEEDED' and model.finalized
    assert [n for n, _ in gate.calls] == ['classify_event_relevance', 'get_prior_evaluation', 'get_case_status', 'retrieve_patient_evidence']
    assert not result['proposed_criteria'] and not result['coverage']


def test_irrelevant_monitoring_never_needs_final_inference():
    gate, model = gateway('P-151', irrelevant=True), MonitorModel('monitor')
    result = asyncio.run(Coordinator(AgentRequest.model_validate(request('MONITORING_WORKFLOW', 'P-151', 'PX-MON-01')),
        gate, Settings(), model).run())
    assert result['status'] == 'SUCCEEDED' and not model.finalized and len(gate.calls) == 1


def test_budget_ends_with_explicit_incomplete_draft_not_extra_calls():
    gate, model = gateway('P-042', order=False), MonitorModel('monitor')
    result = execute(gate, model, max_steps=2)
    assert result['status'] == 'PARTIAL' and model.finalized and len(gate.calls) == 1
    assert 'INCOMPLETE_INVESTIGATION' in result['unknown_reasons']
