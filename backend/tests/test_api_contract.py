import json
from pathlib import Path

import pytest

from conftest import approve, event_body, headers, participate, post_event, screen, work
from sqlalchemy import func, select

from backend.app import models as m
from backend.app.schemas.dto import Patient360
from backend.app.seed import PATIENT_IDS


def test_exact_route_inventory(env):
    app = env[0].app
    actual = {(method, r.path) for r in app.routes if r.path.startswith("/api/v1") for method in r.methods}
    import re

    text = Path("docs/API_CONTRACTS.md").read_text("utf-8")
    expected = set(re.findall(r"`(GET|POST|PUT|PATCH) (/api/v1/[^`]+)`", text))
    assert len(actual) == 27
    assert actual == expected
    assert app.openapi()["openapi"].startswith("3.1")
    Path("backend/var/openapi.json").write_text(json.dumps(app.openapi(), indent=2), "utf-8")


def test_seed_sources_and_sections(env):
    client, _, factory, _ = env
    with factory() as session:
        assert set(session.scalars(select(m.Patient.patient_id))) == set(PATIENT_IDS)
        assert session.scalar(select(func.count()).select_from(m.CriterionApproval)) == 0
        assert session.scalar(select(func.count()).select_from(m.ScreeningRun)) == 0
        version = session.get(m.ProtocolVersion, "PV-PX104-1.0")
        assert version.state == "DRAFT" and version.approved_at is None
    for pid in PATIENT_IDS:
        response = client.get(f"/api/v1/trials/TR-PX104/patients/{pid}", headers=headers())
        assert response.status_code == 200, response.text
        patient = Patient360.model_validate(response.json()["data"])
        assert patient.clinical_narratives and patient.source_document_index
        assert len(patient.clinical_narratives[0].text.split()) >= 80
        assert patient.participation_status == "NOT_ENROLLED"
        assert patient.open_items
        if pid == "P-204":
            assert patient.medications[0].evidence.time_uncertainty.raw_date == "2026-10"


def test_full_h6_h10_and_review(env):
    client = env[0]
    run = screen(env)
    response = client.get(f"/api/v1/screenings/{run}/assessments", headers=headers())
    assert response.status_code == 200, response.text
    before = response.json()["data"]["items"]
    statuses = {r["patient_id"]: r["candidate_status"] for r in before}
    assert statuses["P-042"] == statuses["P-118"] == "POTENTIAL_MATCH"
    for pid in ("P-175", "P-161", "P-117", "P-201", "P-202", "P-206"):
        assert statuses[pid] == "PROTOCOL_CONFLICT"
    for pid in ("P-124", "P-083", "P-140", "P-203", "P-204", "P-205"):
        assert statuses[pid] == "NEEDS_REVIEW"
    run_data = client.get(f"/api/v1/screenings/{run}", headers=headers()).json()["data"]
    assert run_data["status"] == "COMPLETE"
    assert sum(run_data["counts"].values()) == 15
    participate(env)
    accepted = post_event(env, key="day18")
    assert accepted.status_code == 202, accepted.text
    work(env)
    job = client.get(accepted.json()["data"]["job"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "SUCCEEDED", job
    findings = client.get("/api/v1/trials/TR-PX104/findings", headers=headers()).json()["data"]["items"]
    assert len(findings) == 1
    assert findings[0]["criterion_id"] == "PX-MON-01"
    assert findings[0]["category"] == "CONFIRMED_PROTOCOL_CONFLICT"
    assert findings[0]["before_assessment_id"]
    replay = post_event(env, key="day18")
    assert replay.status_code == 200 and replay.json()["data"]["deduplicated"]
    assert replay.json()["data"]["event_id"] == accepted.json()["data"]["event_id"]
    after = client.get(f"/api/v1/screenings/{run}/assessments", headers=headers()).json()["data"]["items"]
    assert before == after
    case_id = findings[0]["case_id"]
    cited = [findings[0]["evidence_refs"][0]["evidence_id"]]
    initial_revision = client.get(f"/api/v1/cases/{case_id}", headers=headers()).json()["data"]["revision"]
    for rev, status in enumerate(("ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "CLOSED"), initial_revision):
        patch = dict(
            expected_revision=rev,
            next_status=status,
            assigned_actor_id="ACT-INV-01",
            disposition="REVIEWED",
            rationale="Synthetic investigator review",
            cited_evidence_ids=cited,
        )
        result = client.patch(f"/api/v1/cases/{case_id}", headers=headers(revision=rev), json=patch)
        assert result.status_code == 200, result.text
    assert len(result.json()["data"]["decisions"]) == 4
    second = event_body(source="D19-P042")
    second["effective_at"] = "2026-11-20T09:30:00+02:00"
    assert post_event(env, second).status_code == 202
    work(env)
    cases = client.get("/api/v1/trials/TR-PX104/cases", headers=headers()).json()["data"]["items"]
    assert len(cases) == 1 and cases[0]["status"] == "REOPENED"
    assert len(cases[0]["finding_ids"]) == 2
    assert len(cases[0]["decisions"]) == 4


def test_actor_errors_query_filters_and_request_id(env):
    client = env[0]
    for head, code in [({}, 401), ({"X-Demo-Actor-Id": "nobody"}, 401)]:
        response = client.get("/api/v1/trials", headers=head)
        assert response.status_code == code
        assert response.headers["x-request-id"] == response.json()["request_id"]
    assert client.get("/api/v1/trials?limt=1", headers=headers()).status_code == 422
    assert client.get("/api/v1/trials?limit=101", headers=headers()).status_code == 422
    assert client.get("/api/v1/trials?sort=sql", headers=headers()).status_code == 422
    assert client.get("/api/v1/trials?cursor=garbage", headers=headers()).status_code == 422
    assert client.get("/api/v1/trials", headers={**headers(), "X-Request-ID": "bad"}).status_code == 422
    assert (
        client.get("/api/v1/trials/TR-PX104/patients/P-042", headers=headers("ACT-SPONSOR-01")).status_code
        == 403
    )
    assert client.get("/api/v1/missing", headers=headers()).status_code == 404


@pytest.mark.parametrize("actor_id", ["ACT-MON-01", "ACT-AUD-01", "ACT-SPONSOR-01", "ACT-IT-01"])
def test_retired_demo_actor_cannot_be_used_even_in_an_existing_database(env, actor_id):
    with env[2].begin() as session:
        actor = session.get(m.ClinicalActor, actor_id)
        assert actor.active is False
        actor.active = True  # Existing databases may still carry the old active flag.
    response = env[0].get("/api/v1/trials/TR-PX104", headers=headers(actor_id))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ROLE_FORBIDDEN"


def test_agent_off_no_job(env):
    approve(env)
    before = None
    with env[2]() as session:
        before = session.scalar(select(func.count()).select_from(m.Job))
    response = env[0].post(
        "/api/v1/agent-investigations",
        headers=headers(),
        json=dict(
            role="EVIDENCE_INVESTIGATOR",
            trial_id="TR-PX104",
            protocol_version_id="PV-PX104-1.0",
            patient_id="P-083",
            criterion_ids=["PX-EXC-02"],
            event_id=None,
            objective="Investigate missing use evidence",
        ),
    )
    assert response.status_code == 503, response.text
    assert response.json()["error"]["code"] == "AGENT_UNAVAILABLE"
    with env[2]() as session:
        assert session.scalar(select(func.count()).select_from(m.Job)) == before


def test_irrelevant_and_order_events(env):
    screen(env)
    participate(env)
    response = post_event(env, event_body(code="SYN-MED-N1"))
    work(env)
    job = env[0].get(response.json()["data"]["job"]["poll_url"], headers=headers()).json()["data"]
    assert job["result"]["relevance"] == "NO_ACTION"
    assert env[0].get("/api/v1/trials/TR-PX104/cases", headers=headers()).json()["data"]["items"] == []
    response = post_event(env, event_body(kind="ORDER", source="order18"))
    work(env)
    cases = env[0].get("/api/v1/trials/TR-PX104/findings", headers=headers()).json()["data"]["items"]
    assert len(cases) == 1 and cases[0]["category"] == "POTENTIAL_SAFETY_REVIEW"
    assert cases[0]["criterion_id"] == "PX-MON-02"
