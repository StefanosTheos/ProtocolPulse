import pytest
from pydantic import ValidationError
from ai.tools.schemas import InvestigationProposal, AgentResult
from ai.evals.fixtures import proposal
from ai.tools.references import ReferenceRegistry


def test_patient_output_cannot_propose_rules_or_coverage():
    value = proposal(summary=None, incomplete=True).model_dump(
        exclude={'proposed_criteria', 'coverage', 'evidence_refs', 'conflict_refs'}) | {
            'evidence_keys': [], 'conflict_keys': []}
    internal = InvestigationProposal.model_validate(value)
    assert internal.as_final(ReferenceRegistry()).proposed_criteria == []
    assert internal.as_final(ReferenceRegistry()).coverage == []
    for forbidden in ('proposed_criteria', 'coverage', 'approved_by', 'candidate_status'):
        with pytest.raises(ValidationError):
            InvestigationProposal.model_validate({**value, forbidden: []})
    assert 'trace' in AgentResult.model_fields and 'coverage' in AgentResult.model_fields
