"""Build/check the owned PX-104 source PDF and curated extraction oracles.

This is fixture tooling, not an extractor, evaluator, API, or AI integration.
Run from the repository root: python tools/protocol_fixture.py --check
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import tempfile
from typing import Literal

import fitz
from pydantic import BaseModel, ConfigDict, Field, ValidationError


ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "fixtures/protocols/px104-v1"
PDF = PACK / "PX-104-v1.0-fictional.pdf"
STAMP = "2026-10-30T10:00:00Z"  # Synthetic source date, not a build timestamp.
RULE_IDS = ["PX-INC-01", "PX-INC-02", "PX-INC-03", "PX-EXC-01", "PX-EXC-02",
            "PX-MON-01", "PX-MON-02", "PX-MON-03"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class WindowSpec(StrictModel):
    anchor: Literal["SCREENING_DATE", "EVENT_EFFECTIVE_AT", "PARTICIPATION"]
    start_offset_days: int | None
    end_offset_days: int | None
    start_inclusive: bool
    end_inclusive: bool
    time_zone: str
    anchor_granularity: Literal["LOCAL_DATE", "INSTANT"]


class Anchor(StrictModel):
    start: int = Field(ge=0)
    end: int = Field(gt=0)


class CriterionDraftInput(StrictModel):
    criterion_id: str
    protocol_version_id: str
    type: Literal["INCLUSION", "EXCLUSION", "MONITORING"]
    clinical_subject: str
    operator: Literal["AGE_RANGE_INCLUSIVE", "CODE_CONFIRMED", "LAB_GTE",
                      "ABSENCE_CONFIRMED_ACTIVE", "NO_RESTRICTED_USE",
                      "EVENT_RESTRICTED_USE", "EVENT_ORDER_ONLY", "EVENT_LAB_LT"]
    threshold: float | str | tuple[float, float] | None
    unit: str | None
    window: WindowSpec | None
    evidence_requirement: str
    missing_data_policy: Literal["UNKNOWN_UNLESS_RECONCILED"]
    source_quote: str
    source_id: str
    source_page: int = Field(ge=1)
    source_anchor: Anchor
    applicable_site_ids: list[str]
    terminology_map_version: str
    logical_group_id: str
    workflow_status: Literal["PROPOSED", "NEEDS_CLARIFICATION"]
    ambiguity: str | None


class CoverageItem(StrictModel):
    section_id: str
    source_id: str
    page: int = Field(ge=1)
    span_start: int = Field(ge=0)
    span_end: int = Field(gt=0)
    status: Literal["MAPPED", "INFORMATIONAL", "BLOCKING"]
    criterion_ids: list[str]
    review_note: str | None


class CriteriaReplaceRequest(StrictModel):
    criteria: list[CriterionDraftInput]
    coverage: list[CoverageItem]
    change_reason: str


def load(name: str):
    return json.loads((PACK / name).read_text(encoding="utf-8"))


def dump(name: str, data):
    (PACK / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8", newline="\n")


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sections(source):
    return [(number, section) for number, page in enumerate(source["pages"], 1)
            for section in page["sections"]]


def wrapped(text: str) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if fitz.get_text_length(candidate, fontname="helv", fontsize=10.5) > 499:
            lines.append(line)
            line = word
        else:
            line = candidate
    return [*lines, line]


def make_pdf(source) -> bytes:
    doc = fitz.open()
    doc.set_metadata({"title": "PX-104 v1.0 - Fictional demonstration protocol",
                      "author": "ProtocolPulse synthetic fixture maintainers",
                      "subject": "Eight frozen fictional rules; no clinical use",
                      "creator": "ProtocolPulse fixture tooling",
                      "creationDate": "D:20261030100000Z",
                      "modDate": "D:20261030100000Z"})
    for number, content in enumerate(source["pages"], 1):
        page = doc.new_page(width=595, height=842)
        page.draw_rect(fitz.Rect(0, 0, 595, 127), color=None, fill=(0.94, 0.97, 0.98))
        page.insert_text((48, 43), "ProtocolPulse | PX-104 v1.0", fontsize=16,
                         fontname="hebo", color=(0.08, 0.22, 0.29))
        page.insert_text((48, 66), "FICTIONAL / SYNTHETIC ONLY - NOT FOR CLINICAL USE",
                         fontsize=9, color=(0.55, 0.13, 0.12))
        page.insert_text((48, 105), content["title"], fontsize=17,
                         fontname="hebo", color=(0.08, 0.22, 0.29))
        y = 156
        for section in content["sections"]:
            page.insert_text((48, y), section["heading"], fontsize=11.8,
                             fontname="hebo", color=(0.08, 0.22, 0.29))
            y += 22
            lines = wrapped(section["text"])
            page.insert_text((48, y), "\n".join(lines), fontsize=10.5,
                             fontname="helv", lineheight=1.35, color=(0.12, 0.15, 0.18))
            y += len(lines) * 10.5 * 1.35 + 32
            if y > 770:
                raise ValueError(f"Page {number} overflows; review source/layout")
        page.draw_line((48, 790), (547, 790), color=(0.75, 0.8, 0.82))
        page.insert_text((48, 809), f"Synthetic PX-104 v1.0 | source version 1 | Page {number} of 5",
                         fontsize=8, color=(0.35, 0.4, 0.43))
    result = doc.tobytes(garbage=4, deflate=True, no_new_id=True)
    doc.close()
    return result


def extracted_pages():
    with fitz.open(PDF) as doc:
        return [{"page": n, "text": page.get_text("text", sort=False)}
                for n, page in enumerate(doc, 1)]


def expected(source, pages):
    criteria, coverage, spans = [], [], []
    for number, section in sections(source):
        text = pages[number - 1]["text"]
        quote = "\n".join(wrapped(section["text"])) + "\n"
        start = text.index(quote)
        end = start + len(quote)
        coverage_start = text.index(section["heading"] + "\n")
        spans.append({"section_id": section["section_id"], "page": number,
                      "start": coverage_start, "end": end,
                      "text_sha256": sha(text[coverage_start:end].encode("utf-8"))})
        rule = section["rule"]
        coverage.append({"section_id": section["section_id"], "source_id": source["source_id"],
                         "page": number, "span_start": coverage_start, "span_end": end,
                         "status": "MAPPED" if rule else "INFORMATIONAL",
                         "criterion_ids": [rule["criterion_id"]] if rule else [],
                         "review_note": None})
        if rule:
            criteria.append({**rule, "protocol_version_id": source["protocol_version_id"],
                             "missing_data_policy": "UNKNOWN_UNLESS_RECONCILED",
                             "source_quote": quote, "source_id": source["source_id"],
                             "source_page": number, "source_anchor": {"start": start, "end": end},
                             "applicable_site_ids": [source["site_id"]],
                             "terminology_map_version": source["terminology_map_version"],
                             "workflow_status": "PROPOSED", "ambiguity": None})
    body = {"criteria": criteria, "coverage": coverage,
            "change_reason": "Curated PX-104 fixture proposal; not an AI execution or human approval."}
    source_ref = {"source_id": source["source_id"], "source_version": source["source_version"],
                  "sha256": sha(PDF.read_bytes()), "filename": PDF.name,
                  "mime_type": "application/pdf", "created_at": STAMP, "synthetic_only": True}
    detail = {"protocol_version_id": source["protocol_version_id"], "trial_id": source["trial_id"],
              "label": source["version_label"], "state": "EXTRACTION_REVIEW", "revision": 1,
              "source": source_ref, "file_sha256": source_ref["sha256"],
              "criteria": [{**c, "revision": 1, "approved_by": None, "approved_at": None}
                           for c in criteria], "coverage": coverage,
              "coverage_signed_by": None, "coverage_signed_at": None, "approved_set_hash": None,
              "approved_at": None, "extraction_job_id": None, "blocking_count": 0}
    return body, detail, spans


def validate_proposal(body, source, pages) -> set[str]:
    """Check this fixture's schema, frozen semantics, provenance and full coverage."""
    try:
        CriteriaReplaceRequest.model_validate_json(json.dumps(body))
    except ValidationError:
        return {"SCHEMA_ERROR"}
    oracle, _, _ = expected(source, pages)
    errors = set()
    by_id = {c["criterion_id"]: c for c in body["criteria"]}
    if len(by_id) != 8 or len(body["criteria"]) != 8 or set(by_id) != set(RULE_IDS):
        errors.add("RULESET_MISMATCH")
    for fixed in oracle["criteria"]:
        actual = by_id.get(fixed["criterion_id"])
        if not actual:
            continue
        semantics = set(fixed) - {"source_quote", "source_page", "source_anchor"}
        if any(actual[key] != fixed[key] for key in semantics):
            errors.add("FROZEN_SEMANTICS_MISMATCH")
        page_number = actual["source_page"]
        anchor = actual["source_anchor"]
        if not 1 <= page_number <= len(pages):
            errors.add("SOURCE_QUOTE_MISMATCH")
            continue
        text = pages[page_number - 1]["text"]
        if not 0 <= anchor["start"] < anchor["end"] <= len(text):
            errors.add("SOURCE_QUOTE_MISMATCH")
        elif text[anchor["start"]:anchor["end"]] != actual["source_quote"]:
            errors.add("SOURCE_QUOTE_MISMATCH")
        elif page_number != fixed["source_page"] or actual["source_quote"] != fixed["source_quote"]:
            errors.add("SOURCE_SECTION_MISMATCH")
    # This fixture's oracle covers each entire source section exactly once.
    if sorted(body["coverage"], key=lambda x: x["section_id"]) != sorted(
            oracle["coverage"], key=lambda x: x["section_id"]):
        errors.add("COVERAGE_MISMATCH")
    return errors


def negative_cases():
    return {"fixture_version": "px104-protocol-v1", "base": "expected_extraction.json",
            "note": "Mutations of the oracle, not source amendments or API error enums.", "cases": [
                {"id": "missing-rule", "op": "remove", "path": ["criteria", 7], "expected": "RULESET_MISMATCH"},
                {"id": "invented-ninth-rule", "op": "clone_rule", "path": ["criteria"],
                 "value": "PX-EXC-99", "expected": "RULESET_MISMATCH"},
                {"id": "changed-threshold", "op": "replace", "path": ["criteria", 2, "threshold"],
                 "value": 65, "expected": "FROZEN_SEMANTICS_MISMATCH"},
                {"id": "wrong-washout-end", "op": "replace", "path": ["criteria", 4, "window", "end_inclusive"],
                 "value": True, "expected": "FROZEN_SEMANTICS_MISMATCH"},
                {"id": "invented-restriction-class", "op": "replace", "path": ["criteria", 5, "threshold"],
                 "value": "REAL-DRUG-CLASS", "expected": "FROZEN_SEMANTICS_MISMATCH"},
                {"id": "made-up-quote", "op": "replace", "path": ["criteria", 0, "source_quote"],
                 "value": "Everyone is eligible.", "expected": "SOURCE_QUOTE_MISMATCH"},
                {"id": "invalid-page", "op": "replace", "path": ["criteria", 0, "source_page"],
                 "value": 99, "expected": "SOURCE_QUOTE_MISMATCH"},
                {"id": "byte-offset-instead-of-codepoints", "op": "replace",
                 "path": ["criteria", 2, "source_anchor", "end"], "value": "UTF8_END",
                 "expected": "SOURCE_QUOTE_MISMATCH"},
                {"id": "omitted-information-section", "op": "remove", "path": ["coverage", 0],
                 "expected": "COVERAGE_MISMATCH"},
                {"id": "fake-approval", "op": "replace", "path": ["criteria", 0, "workflow_status"],
                 "value": "APPROVED", "expected": "SCHEMA_ERROR"},
                {"id": "injected-approval-field", "op": "replace", "path": ["criteria", 0, "approved_by"],
                 "value": "ACT-INV-01", "expected": "SCHEMA_ERROR"}
            ]}


def mutate(body, case, pages):
    result = copy.deepcopy(body)
    target = result
    for part in case["path"][:-1]:
        target = target[part]
    key = case["path"][-1]
    if case["op"] == "remove":
        del target[key]
    elif case["op"] == "clone_rule":
        extra = copy.deepcopy(result["criteria"][0])
        extra["criterion_id"] = case["value"]
        target[key].append(extra)
    else:
        value = case["value"]
        if value == "UTF8_END":
            c = result["criteria"][2]
            value = len(pages[c["source_page"] - 1]["text"][:c["source_anchor"]["end"]].encode("utf-8"))
        target[key] = value
    return result


def build(source):
    PDF.write_bytes(make_pdf(source))
    pages = extracted_pages()
    body, detail, spans = expected(source, pages)
    dump("source_pages.json", {"source_id": source["source_id"], "source_version": 1,
                               "extractor": f"PyMuPDF {fitz.VersionBind}; get_text(text, sort=False)",
                               "offsets": "zero-based end-exclusive Unicode code points; page-local",
                               "pages": pages, "sections": spans})
    dump("expected_extraction.json", body)
    dump("expected_protocol_detail.json", detail)
    dump("extraction_checks.json", negative_cases())
    dump("expected_extraction.schema.json", CriteriaReplaceRequest.model_json_schema())
    names = ["source_document.json", PDF.name, "source_pages.json", "expected_extraction.json",
             "expected_protocol_detail.json", "extraction_checks.json", "expected_extraction.schema.json"]
    dump("manifest.json", {"fixture_version": source["fixture_version"], "contract_version": source["contract_version"],
                           "protocol_version_id": source["protocol_version_id"], "source_id": source["source_id"],
                           "synthetic_only": True, "curated_expected_output": True, "human_approved": False,
                           "page_count": 5, "criterion_count": 8, "coverage_count": 12,
                           "sha256": {name: sha((PACK / name).read_bytes()) for name in names}})


def check(source):
    def require(condition, message):
        if not condition:
            raise ValueError(message)

    manifest = load("manifest.json")
    for name, digest in manifest["sha256"].items():
        require(sha((PACK / name).read_bytes()) == digest, f"Hash mismatch: {name}")
    require(PDF.read_bytes() == make_pdf(source), "PDF differs from reproducible source build")
    pages = extracted_pages()
    require(pages == load("source_pages.json")["pages"], "Persisted text differs from real PDF extraction")
    require(len(pages) == 5 and all(p["text"].strip() for p in pages), "Unreadable/missing PDF page")
    with fitz.open(PDF) as doc:
        require(not doc.is_encrypted and all(not p.get_images() for p in doc), "Expected an unencrypted text PDF")
        require(all(not p.get_links() for p in doc), "Unexpected PDF link")
    for number, section in sections(source):
        require(" ".join(section["text"].split()) in " ".join(pages[number - 1]["text"].split()),
                f"Missing or damaged source text: {section['section_id']}")
    body, detail, spans = expected(source, pages)
    require(body == load("expected_extraction.json"), "Extraction oracle drift")
    require(detail == load("expected_protocol_detail.json"), "ProtocolDetail oracle drift")
    require(spans == load("source_pages.json")["sections"], "Coverage span drift")
    require(not validate_proposal(body, source, pages), "Positive proposal did not validate")
    require(load("expected_extraction.schema.json") == CriteriaReplaceRequest.model_json_schema(), "Schema drift")
    require(load("extraction_checks.json") == negative_cases(), "Negative-case drift")
    for case in negative_cases()["cases"]:
        actual = validate_proposal(mutate(body, case, pages), source, pages)
        require(case["expected"] in actual, f"Negative case not rejected correctly: {case['id']} -> {actual}")
    # Verify normative API field presence against the source documentation, not only our mirror.
    api = (ROOT / "docs/API_CONTRACTS.md").read_text(encoding="utf-8")
    for name, instance in [("CriterionDraftInput", body["criteria"][0]), ("CoverageItem", body["coverage"][0]),
                           ("CriteriaReplaceRequest", body), ("ProtocolDetail", detail), ("SourceRef", detail["source"])]:
        fragment = api.split(f"export interface {name} {{", 1)[1]
        # Stop at the matching brace, including compact one-line interfaces.
        depth, current = 1, ""
        for character in fragment:
            if character == "{":
                depth += 1
            elif character == "}":
                depth -= 1
                if depth == 0:
                    break
            elif depth == 1:
                current += character
        keys = set(re.findall(r"(?:^|[;\s])([a-z_][a-z0-9_]*):", current))
        require(keys == set(instance), f"API field shape drift: {name}: {keys ^ set(instance)}")
    require(set(re.findall(r"`(PX-(?:INC|EXC|MON)-\d+)` \|", (ROOT / "PRODUCT_SPECIFICATION.md").read_text(encoding="utf-8"))) == set(RULE_IDS),
            "Product rule inventory drift")
    print("PASS: 5 text-readable PDF pages; 8 proposed rules; 12 covered sections; exact source spans and file hashes;")
    print("      API field shapes; reproducible PDF; 11 negative mutations; no forged approvals or AI execution.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build", action="store_true", help="Regenerate the owned fixture artifacts")
    parser.add_argument("--check", action="store_true", help="Verify artifacts without modifying them")
    parser.add_argument("--preview", action="store_true", help="Render PNG previews to a new temporary directory")
    args = parser.parse_args()
    source = load("source_document.json")
    if args.build:
        build(source)
    check(source)
    if args.preview:
        folder = Path(tempfile.mkdtemp(prefix="protocolpulse-px104-"))
        with fitz.open(PDF) as doc:
            for n, page in enumerate(doc, 1):
                page.get_pixmap(matrix=fitz.Matrix(1.3, 1.3)).save(folder / f"page-{n}.png")
        print(f"PDF previews: {folder}")


if __name__ == "__main__":
    main()
