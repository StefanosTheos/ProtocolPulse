import json

from conftest import headers, participate, post_event, screen, work
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.services.pdf_extractor import FIXTURE


def test_real_lifespan_health_and_cors(env):
    app = create_app(env[3], env[2])
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
        assert response.status_code == 200, response.text
        assert response.json()["data"]["worker"] == "running"
        response = client.options(
            "/api/v1/trials",
            headers={"Origin": env[3].frontend_origin, "Access-Control-Request-Method": "GET"},
        )
        assert response.headers["access-control-allow-origin"] == env[3].frontend_origin
        response = client.options(
            "/api/v1/trials",
            headers={"Origin": "https://untrusted.example", "Access-Control-Request-Method": "GET"},
        )
        assert "access-control-allow-origin" not in response.headers
    assert not app.state.runner.running


def test_trial_creation_idempotency_pagination_and_date_validation(env):
    client = env[0]
    body = dict(
        title="Synthetic second trial",
        fictional_product_code="SYN-TRIAL",
        site_id="SITE-SYN-01",
        site_timezone="Europe/Athens",
        planned_start_date="2026-11-01",
        planned_end_date="2027-01-24",
        synthetic_only=True,
    )
    invalid = dict(body, site_timezone="Not/AZone")
    assert (
        client.post("/api/v1/trials", headers=headers(), json=body).status_code == 403
    )  # investigator cannot create
    assert client.post("/api/v1/trials", headers=headers("ACT-COORD-01"), json=invalid).status_code == 422
    head = headers("ACT-COORD-01", key="second-trial")
    response = client.post("/api/v1/trials", headers=head, json=body)
    assert response.status_code == 201, response.text
    assert client.post("/api/v1/trials", headers=head, json=body).json()["data"] == response.json()["data"]
    first = client.get("/api/v1/trials?limit=1&sort=title", headers=headers()).json()["data"]
    assert first["page"]["next_cursor"]
    second = client.get(
        "/api/v1/trials",
        params=dict(limit=1, sort="title", cursor=first["page"]["next_cursor"]),
        headers=headers(),
    ).json()["data"]
    assert first["items"][0]["trial_id"] != second["items"][0]["trial_id"]
    assert client.get("/api/v1/trials/TR-PX104", headers=headers()).json()["data"]["patient_count"] == 15


def test_reviewer_replaces_and_extracts_curated_proposal(env):
    prefix = "/api/v1/trials/TR-PX104/protocols/PV-PX104-1.0"
    payload = json.loads((FIXTURE / "expected_extraction.json").read_text("utf-8"))
    replaced = env[0].put(prefix + "/criteria", headers=headers(revision=1), json=payload)
    assert replaced.status_code == 200, replaced.text
    assert replaced.json()["data"]["revision"] == 2
    assert env[0].put(prefix + "/criteria", headers=headers(revision=1), json=payload).status_code == 409
    queued = env[0].post(prefix + "/extract", headers=headers(), json={"force_reinspect": True})
    assert queued.status_code == 202
    work(env)
    job = env[0].get(queued.json()["data"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "SUCCEEDED", job
    assert job["result"]["proposal_origin"] == "CURATED_FIXTURE"
    detail = env[0].get(prefix, headers=headers()).json()["data"]
    assert detail["state"] == "EXTRACTION_REVIEW" and detail["coverage_signed_by"] is None
    rows = (
        env[0]
        .get("/api/v1/trials/TR-PX104/protocols?sort=-created_at", headers=headers())
        .json()["data"]["items"]
    )
    assert len(rows) == 1
    rule = detail["criteria"][2]
    response = env[0].get(
        "/api/v1/trials/TR-PX104/evidence/" + rule["source_id"],
        headers=headers(),
        params=dict(
            page=rule["source_page"],
            span_start=rule["source_anchor"]["start"],
            span_end=rule["source_anchor"]["end"],
        ),
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["spans"][0]["text"] == rule["source_quote"]
    assert (
        env[0]
        .get(
            "/api/v1/trials/TR-PX104/evidence/" + rule["source_id"],
            headers=headers(),
            params={"span_start": 1},
        )
        .status_code
        == 422
    )


def test_disposition_participation_and_truthful_off_execution(env):
    run = screen(env)
    assessments = (
        env[0].get(f"/api/v1/screenings/{run}/assessments", headers=headers()).json()["data"]["items"]
    )
    patient = next(a for a in assessments if a["patient_id"] == "P-042")
    cited = [patient["criteria"][0]["evidence_refs"][0]["evidence_id"]]
    body = dict(
        assessment_id=patient["assessment_id"],
        disposition="INVITE_FOR_FORMAL_SCREENING",
        rationale="External formal screening required",
        cited_evidence_ids=cited,
    )
    response = env[0].post(
        "/api/v1/trials/TR-PX104/patients/P-042/dispositions", headers=headers(), json=body
    )
    assert response.status_code == 201, response.text
    assert response.json()["data"]["workflow_status"] == "INVESTIGATOR_DISPOSITIONED"
    assert (
        env[0]
        .get("/api/v1/trials/TR-PX104/patients/P-042", headers=headers())
        .json()["data"]["participation_status"]
        == "NOT_ENROLLED"
    )
    participate(env)
    assert post_event(env).status_code == 202
    work(env)
    case = env[0].get("/api/v1/trials/TR-PX104/cases", headers=headers()).json()["data"]["items"][0]
    execution = (
        env[0].get("/api/v1/agent-executions/" + case["agent_execution_id"], headers=headers()).json()["data"]
    )
    assert execution["status"] == "UNAVAILABLE" and execution["trace"] == [] and execution["model_id"] is None
    audit = env[0].get("/api/v1/trials/TR-PX104/audit?limit=100", headers=headers()).json()["data"]["items"]
    assert any(a["action"] == "EXTERNAL_PARTICIPATION_RECORDED" for a in audit)
    assert any(a["action"] == "AGENT_UNAVAILABLE" for a in audit)


def test_failed_screen_is_operational_error_not_unknown(env, monkeypatch):
    from conftest import approve

    from backend.app.services import jobs

    approve(env)

    def broken(*args):
        raise RuntimeError("Synthetic evaluator failure")

    monkeypatch.setattr(jobs, "process_screen", broken)
    response = env[0].post(
        "/api/v1/trials/TR-PX104/screenings",
        headers=headers("ACT-COORD-01"),
        json=dict(
            protocol_version_id="PV-PX104-1.0",
            screening_date="2026-10-31",
            evidence_cutoff_at="2026-10-31T22:00:00Z",
            patient_ids=["P-042"],
            purpose="BASELINE",
        ),
    )
    assert response.status_code == 202
    for _ in range(3):
        work(env)
    job = env[0].get(response.json()["data"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "FAILED"
    assessments = (
        env[0]
        .get("/api/v1/screenings/" + job["resource_id"] + "/assessments", headers=headers())
        .json()["data"]["items"]
    )
    assert len(assessments) == 1 and assessments[0]["evaluation_state"] == "EVALUATION_ERROR"
    assert assessments[0]["candidate_status"] is None and assessments[0]["criteria"] == []


def test_openapi_all_refs_resolve(env):
    schema = env[0].app.openapi()

    def inspect(value):
        if isinstance(value, dict):
            if "$ref" in value:
                ref = value["$ref"]
                assert ref.startswith("#/components/schemas/")
                assert ref.rsplit("/", 1)[-1] in schema["components"]["schemas"]
            for item in value.values():
                inspect(item)
        elif isinstance(value, list):
            for item in value:
                inspect(item)

    inspect(schema)
    operation = schema["paths"]["/api/v1/trials/{trial_id}/protocols/{version_id}/approve"]["post"]
    assert {p["name"] for p in operation["parameters"] if p.get("required")} >= {
        "Idempotency-Key",
        "If-Match",
        "x-demo-actor-id",
    }
    assert operation["responses"]["422"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/ErrorEnvelope"
    )
