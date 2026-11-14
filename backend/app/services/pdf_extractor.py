import hashlib
import json
import os
import re
import tempfile
from pathlib import Path

import pymupdf

from backend.app.core.errors import DomainError
from backend.app.schemas.dto import CriteriaReplaceRequest

FIXTURE = Path(__file__).resolve().parents[3] / "fixtures/protocols/px104-v1"
RULE_IDS = {
    "PX-INC-01",
    "PX-INC-02",
    "PX-INC-03",
    "PX-EXC-01",
    "PX-EXC-02",
    "PX-MON-01",
    "PX-MON-02",
    "PX-MON-03",
}


SECTION_IDS = [
    "PX-INFO-IDENTITY",
    "PX-INFO-CALENDAR",
    "PX-SECTION-INC-01",
    "PX-SECTION-INC-02",
    "PX-SECTION-INC-03",
    "PX-SECTION-EXC-01",
    "PX-SECTION-EXC-02",
    "PX-SECTION-MON-01",
    "PX-SECTION-MON-02",
    "PX-SECTION-MON-03",
    "PX-INFO-EVIDENCE",
    "PX-INFO-REVIEW",
]


def section_spans(pages):
    sections = {}
    for page, text in pages.items():
        matches = list(re.finditer(r"(?m)^(\d{1,2})\. [^\n]+\n", text))
        footer = text.find("Synthetic PX-104 v1.0 | source version")
        for index, match in enumerate(matches):
            number = int(match.group(1))
            if not 1 <= number <= 12:
                raise DomainError("APPROVAL_BLOCKED", "COVERAGE_MISMATCH")
            end = matches[index + 1].start() if index + 1 < len(matches) else footer
            # The reference profile ends each section with one LF; preserve it exactly.
            sections[SECTION_IDS[number - 1]] = (int(page), match.start(), end)
    return sections


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def store_pdf(storage: Path, data: bytes):
    storage.mkdir(parents=True, exist_ok=True)
    target = storage / (sha256(data) + ".pdf")
    if target.exists():
        if target.read_bytes() != data:
            raise DomainError("SOURCE_UNAVAILABLE", "Private source checksum mismatch", 500)
        return target, False
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=storage, prefix=".upload-", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(target)
        return target, True
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def parse_pdf(data: bytes) -> dict[str, str]:
    if not data.startswith(b"%PDF-"):
        raise DomainError("UNSUPPORTED_MEDIA_TYPE", "A PDF signature is required", 415)
    try:
        with pymupdf.open(stream=data, filetype="pdf") as doc:
            if doc.is_encrypted or not 1 <= len(doc) <= 100:
                raise ValueError("Encrypted or excessive pages")
            pages = {str(i + 1): page.get_text("text", sort=False) for i, page in enumerate(doc)}
            if any(not text.strip() for text in pages.values()):
                raise ValueError("Unreadable page")
            return pages
    except Exception as exc:
        raise DomainError("EXTRACTION_FAILED", "PDF could not be safely parsed", 422) from exc


def verified_fixture():
    manifest = json.loads((FIXTURE / "manifest.json").read_text("utf-8"))
    for name, expected in manifest["sha256"].items():
        if sha256((FIXTURE / name).read_bytes()) != expected:
            raise DomainError("SOURCE_UNAVAILABLE", f"Fixture checksum mismatch: {name}", 503)
    data = (FIXTURE / "PX-104-v1.0-fictional.pdf").read_bytes()
    pages = parse_pdf(data)
    proposal = CriteriaReplaceRequest.model_validate_json(
        (FIXTURE / "expected_extraction.json").read_text("utf-8")
    )
    validate_proposal(proposal, pages, manifest["protocol_version_id"], manifest["source_id"])
    return data, pages, proposal


def validate_proposal(proposal, pages, version_id, source_id):
    """Frozen PX-104 semantics are checked independently of the oracle at runtime."""
    if len(proposal.criteria) != 8 or {c.criterion_id for c in proposal.criteria} != RULE_IDS:
        raise DomainError("APPROVAL_BLOCKED", "RULESET_MISMATCH")
    expected = {
        "PX-INC-01": ("INCLUSION", "age", "AGE_RANGE_INCLUSIVE", (40, 70), "years", 0, True),
        "PX-INC-02": ("INCLUSION", "diagnosis", "CODE_CONFIRMED", "SYN-CONDITION-A", None, 0, True),
        "PX-INC-03": ("INCLUSION", "egfr", "LAB_GTE", 60, "mL/min/1.73m²", -30, True),
        "PX-EXC-01": (
            "EXCLUSION",
            "condition",
            "ABSENCE_CONFIRMED_ACTIVE",
            "SYN-EXCLUDED-CONDITION",
            None,
            0,
            True,
        ),
        "PX-EXC-02": ("EXCLUSION", "medication", "NO_RESTRICTED_USE", "SYN-CLASS-R", None, -30, False),
        "PX-MON-01": ("MONITORING", "medication", "EVENT_RESTRICTED_USE", "SYN-CLASS-R", None, None, False),
        "PX-MON-02": ("MONITORING", "medication", "EVENT_ORDER_ONLY", "SYN-CLASS-R", None, None, False),
        "PX-MON-03": ("MONITORING", "egfr", "EVENT_LAB_LT", 60, "mL/min/1.73m²", None, False),
    }
    # Subjects are frozen bindings, not inferred from arbitrary text.
    for c in proposal.criteria:
        values = expected[c.criterion_id]
        actual = (
            c.type,
            c.clinical_subject,
            c.operator,
            c.threshold,
            c.unit,
            c.window.start_offset_days if c.window else None,
            c.window.end_inclusive if c.window else None,
        )
        if actual != values or not c.window:
            raise DomainError("APPROVAL_BLOCKED", "FROZEN_SEMANTICS_MISMATCH")
        monitoring = c.type == "MONITORING"
        w = c.window
        if (
            c.protocol_version_id != version_id
            or c.source_id != source_id
            or c.terminology_map_version != "px104-terminology-v1"
            or c.applicable_site_ids != ["SITE-SYN-01"]
            or c.logical_group_id
            != ("PX104-MONITORING-INDEPENDENT" if monitoring else "PX104-ELIGIBILITY-ALL")
            or w.anchor != ("PARTICIPATION" if monitoring else "SCREENING_DATE")
            or w.anchor_granularity != ("INSTANT" if monitoring else "LOCAL_DATE")
            or w.time_zone != "Europe/Athens"
            or not w.start_inclusive
            or w.end_offset_days != (None if monitoring else 0)
        ):
            raise DomainError("APPROVAL_BLOCKED", "FROZEN_SEMANTICS_MISMATCH")
        text = pages.get(str(c.source_page), "")
        if text[c.source_anchor.start : c.source_anchor.end] != c.source_quote:
            raise DomainError("APPROVAL_BLOCKED", "SOURCE_QUOTE_MISMATCH")
    expected_sections = {"PX-INFO-IDENTITY", "PX-INFO-CALENDAR", "PX-INFO-EVIDENCE", "PX-INFO-REVIEW"}
    expected_sections |= {"PX-SECTION-" + rule.removeprefix("PX-") for rule in RULE_IDS}
    if len(proposal.coverage) != 12 or {c.section_id for c in proposal.coverage} != expected_sections:
        raise DomainError("APPROVAL_BLOCKED", "COVERAGE_MISMATCH")
    for c in proposal.coverage:
        text = pages.get(str(c.page), "")
        bound = section_spans(pages).get(c.section_id)
        if bound != (c.page, c.span_start, c.span_end):
            raise DomainError("APPROVAL_BLOCKED", "COVERAGE_MISMATCH")
        if c.source_id != source_id or not 0 <= c.span_start < c.span_end <= len(text):
            raise DomainError("APPROVAL_BLOCKED", "COVERAGE_MISMATCH")
        if c.section_id.startswith("PX-INFO-"):
            if c.status != "INFORMATIONAL" or c.criterion_ids:
                raise DomainError("APPROVAL_BLOCKED", "COVERAGE_MISMATCH")
        else:
            rule_id = c.section_id.replace("PX-SECTION-", "PX-")
            rule = next(r for r in proposal.criteria if r.criterion_id == rule_id)
            if (
                c.status != "MAPPED"
                or c.criterion_ids != [rule_id]
                or c.page != rule.source_page
                or c.span_start > rule.source_anchor.start
                or c.span_end < rule.source_anchor.end
            ):
                raise DomainError("APPROVAL_BLOCKED", "COVERAGE_MISMATCH")
