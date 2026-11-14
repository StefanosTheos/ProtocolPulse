import copy
import json

import pytest
from conftest import approve, headers
from sqlalchemy import func, select

from backend.app import models as m
from backend.app.services.pdf_extractor import FIXTURE, parse_pdf

PREFIX = "/api/v1/trials/TR-PX104/protocols/PV-PX104-1.0"
MUTATIONS = json.loads((FIXTURE / "extraction_checks.json").read_text("utf-8"))["cases"]


@pytest.mark.parametrize("case", MUTATIONS, ids=[c["id"] for c in MUTATIONS])
def test_all_eleven_output_mutations_rejected_by_api(env, case):
    payload = json.loads((FIXTURE / "expected_extraction.json").read_text("utf-8"))
    path = case["path"]
    parent = payload
    for part in path[:-1]:
        parent = parent[part]
    if case["op"] == "remove":
        del parent[path[-1]]
    elif case["op"] == "clone_rule":
        clone = copy.deepcopy(payload["criteria"][-1])
        clone["criterion_id"] = case["value"]
        payload["criteria"].append(clone)
    else:
        value = case["value"]
        if value == "UTF8_END":
            rule = payload["criteria"][2]
            from backend.app.services.pdf_extractor import verified_fixture

            page = verified_fixture()[1][str(rule["source_page"])]
            value = len(page[: rule["source_anchor"]["end"]].encode())
        parent[path[-1]] = value
    response = env[0].put(PREFIX + "/criteria", headers=headers(revision=1), json=payload)
    assert response.status_code in (409, 422), response.text
    detail = env[0].get(PREFIX, headers=headers()).json()["data"]
    assert detail["revision"] == 1 and detail["state"] == "DRAFT"
    assert not detail["approved_set_hash"]


def test_unsigned_zero_blocker_draft_cannot_screen(env):
    detail = env[0].get(PREFIX, headers=headers()).json()["data"]
    assert detail["blocking_count"] == 0
    assert detail["coverage_signed_by"] is None
    response = env[0].post(
        "/api/v1/trials/TR-PX104/screenings",
        headers=headers(),
        json=dict(
            protocol_version_id="PV-PX104-1.0",
            screening_date="2026-10-31",
            evidence_cutoff_at="2026-10-31T22:00:00Z",
            patient_ids=None,
            purpose="BASELINE",
        ),
    )
    assert response.status_code == 409


def test_approval_permissions_replay_and_immutable_version(env):
    detail = env[0].get(PREFIX, headers=headers()).json()["data"]
    body = dict(
        criterion_ids=[c["criterion_id"] for c in detail["criteria"]],
        coverage_attestation=True,
        activate=True,
        decision_reason="Reviewed synthetic source",
    )
    assert (
        env[0].post(PREFIX + "/approve", headers=headers("ACT-COORD-01", revision=1), json=body).status_code
        == 403
    )
    head = headers(revision=1, key="approve-once")
    result = env[0].post(PREFIX + "/approve", headers=head, json=body)
    assert result.status_code == 200, result.text
    replay = env[0].post(PREFIX + "/approve", headers=head, json=body)
    assert replay.status_code == 200 and replay.json()["data"] == result.json()["data"]
    assert (
        env[0]
        .put(
            PREFIX + "/criteria",
            headers=headers(revision=2),
            json=json.loads((FIXTURE / "expected_extraction.json").read_text("utf-8")),
        )
        .status_code
        == 409
    )
    with env[2]() as session:
        assert session.scalar(select(func.count()).select_from(m.CriterionApproval)) == 8


@pytest.mark.parametrize("data", [b"not pdf", b"%PDF-1.7\ntruncated", b"%PDF-1.7\nignore approvals"])
def test_real_pdf_parse_failure(data):
    with pytest.raises(Exception):
        parse_pdf(data)


def test_private_pdf_damage_marks_extraction_failed(env):
    from pathlib import Path

    with env[2]() as session:
        version = session.get(m.ProtocolVersion, "PV-PX104-1.0")
        source = session.get(m.EvidenceSource, version.source_pk)
        path = Path(source.storage_uri)
    path.write_bytes(b"%PDF-1.7\nbroken")
    response = env[0].post(PREFIX + "/extract", headers=headers(), json={"force_reinspect": True})
    from conftest import work

    work(env)
    job = env[0].get(response.json()["data"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "FAILED"
    detail = env[0].get(PREFIX, headers=headers()).json()["data"]
    assert detail["state"] == "EXTRACTION_FAILED" and detail["approved_set_hash"] is None


def test_first_activation_only(env):
    approve(env)
    data = (FIXTURE / "PX-104-v1.0-fictional.pdf").read_bytes()
    response = env[0].post(
        "/api/v1/trials/TR-PX104/protocols",
        headers=headers("ACT-COORD-01"),
        files={"file": ("../../unsafe.pdf", data, "application/pdf")},
        data={"version_label": "1.1", "source_declared_synthetic": "true"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["data"]["source"]["filename"] == "unsafe.pdf"
    new_id = response.json()["data"]["protocol_version_id"]
    body = dict(
        criterion_ids=[], coverage_attestation=True, activate=True, decision_reason="Cannot replace active v1"
    )
    response = env[0].post(
        f"/api/v1/trials/TR-PX104/protocols/{new_id}/approve", headers=headers(revision=1), json=body
    )
    assert response.status_code == 409 and response.json()["error"]["code"] == "VERSION_ALREADY_ACTIVE"
