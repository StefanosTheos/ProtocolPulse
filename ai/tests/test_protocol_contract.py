import ast
import copy
import json
from pathlib import Path
import re

import pytest
from pydantic import ValidationError

from ai.agents.protocol_intelligence import GuardError, validate_coverage, validate_drafts
from ai.evals.fixtures import PACK, protocol_fixture, protocol_gateway, request
from ai.tools.schemas import (AgentRequest, AgentResult, CoverageItem, CriterionDraftInput,
                              EvidenceReference, PageSpan, ToolTrace)


def material():
    gw, oracle = protocol_gateway()
    pages = {(p["source_id"], p["page"]): PageSpan.model_validate(p)
             for p in gw.handlers["parse_protocol"]["data"]["pages"]}
    return oracle, pages, AgentRequest.model_validate(request("PROTOCOL_INTELLIGENCE"))


def validate_body(body, pages, raw):
    drafts = [CriterionDraftInput.model_validate(c) for c in body["criteria"]]
    coverage = [CoverageItem.model_validate(c) for c in body["coverage"]]
    validate_drafts(drafts, raw, pages)
    validate_coverage(coverage, drafts, pages, True)


def test_wire_dto_field_names_match_documented_python_contract():
    text = Path("docs/AGENT_DESIGN.md").read_text(encoding="utf-8")
    code = re.search(r"```python\n(.*?)```", text, re.S).group(1)
    definitions = {n.name: {a.target.id for a in n.body if isinstance(a, ast.AnnAssign)}
                   for n in ast.parse(code).body if isinstance(n, ast.ClassDef)}
    for cls in (AgentRequest, AgentResult, EvidenceReference, ToolTrace):
        assert set(cls.model_fields) == definitions[cls.__name__]


def test_every_golden_quote_matches_actual_text_pdf_and_unicode_spans():
    fitz = pytest.importorskip("fitz")
    body, pages, raw = material()
    with fitz.open(PACK / "PX-104-v1.0-fictional.pdf") as doc:
        for source in pages.values():
            assert doc[source.page - 1].get_text("text", sort=False) == source.text
    validate_body(body, pages, raw)
    quote = body["criteria"][2]["source_quote"]
    assert "²" in quote and len(quote.encode("utf-8")) > len(quote)
    assert sum(c["status"] == "INFORMATIONAL" for c in body["coverage"]) == 4


CASES = json.loads((PACK / "extraction_checks.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["id"] for c in CASES])
def test_all_eleven_shared_invalid_output_fixtures_fail_closed(case):
    body, pages, raw = material()
    mutated = copy.deepcopy(body)
    target = mutated
    for key in case["path"][:-1]:
        target = target[key]
    key = case["path"][-1]
    if case["op"] == "remove":
        del target[key]
    elif case["op"] == "clone_rule":
        extra = copy.deepcopy(mutated["criteria"][0])
        extra["criterion_id"] = case["value"]
        target[key].append(extra)
    else:
        value = case["value"]
        if value == "UTF8_END":
            draft = mutated["criteria"][2]
            text = pages[(draft["source_id"], draft["source_page"])].text
            value = len(text[:draft["source_anchor"]["end"]].encode("utf-8"))
        target[key] = value
    with pytest.raises((ValidationError, GuardError)):
        validate_body(mutated, pages, raw)


def test_valid_looking_but_wrong_subject_or_coverage_source_is_rejected():
    body, pages, raw = material()
    body["criteria"][0]["clinical_subject"] = "medication"
    with pytest.raises(GuardError):
        validate_body(body, pages, raw)
    body = protocol_fixture()
    body["coverage"][2]["page"] = 1
    body["coverage"][2]["span_start"] = 0
    body["coverage"][2]["span_end"] = 20
    with pytest.raises(GuardError):
        validate_body(body, pages, raw)


def test_runtime_cannot_import_answer_oracle_or_backend_storage():
    root = Path("ai")
    runtime = [*root.glob("*.py"), *root.glob("agents/*.py"), *root.glob("providers/*.py"),
               *root.glob("prompts/*.py"), root / "tools/schemas.py", root / "tools/selection.py"]
    for path in runtime:
        source = path.read_text(encoding="utf-8")
        assert "expected_extraction.json" not in source and "source_document.json" not in source
        for node in ast.walk(ast.parse(source)):
            if isinstance(node, ast.ImportFrom):
                assert not (node.module or "").startswith(("backend", "ai.evals", "ai.tests", "sqlite3")), path
            elif isinstance(node, ast.Import):
                assert not any(alias.name.startswith(("backend", "sqlite3", "ai.evals", "ai.tests")) for alias in node.names), path
