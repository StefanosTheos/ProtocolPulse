import asyncio
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient

from backend.app.core.config import Settings, get_settings
from backend.app.db.session import make_engine, session_factory
from backend.app.main import create_app
from backend.app.seed import seed_database


@pytest.fixture
def env(tmp_path, monkeypatch):
    url = "sqlite:///" + (tmp_path / "test.sqlite").as_posix()
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    command.upgrade(Config("backend/alembic.ini"), "head")
    settings = Settings(
        _env_file=None,
        database_url=url,
        protocol_storage_dir=tmp_path / "protocols",
        llm_enabled=False,
        job_retry_backoff_seconds=0,
    )
    engine = make_engine(url)
    factory = session_factory(engine)
    seed_database(factory, settings.protocol_storage_dir)
    app = create_app(settings, factory, start_worker=False)
    with TestClient(app) as client:
        yield client, app.state.runner, factory, settings
    engine.dispose()
    get_settings.cache_clear()


def headers(actor="ACT-INV-01", revision=None, key=None):
    value = {"X-Demo-Actor-Id": actor, "Idempotency-Key": key or uuid4().hex}
    if revision is not None:
        value["If-Match"] = f'"{revision}"'
    return value


def approve(env):
    client = env[0]
    prefix = "/api/v1/trials/TR-PX104/protocols/PV-PX104-1.0"
    detail = client.get(prefix, headers=headers()).json()["data"]
    body = dict(
        criterion_ids=[c["criterion_id"] for c in detail["criteria"]],
        coverage_attestation=True,
        activate=True,
        decision_reason="Synthetic investigator reviewed all clauses and complete coverage",
    )
    response = client.post(prefix + "/approve", json=body, headers=headers(revision=detail["revision"]))
    assert response.status_code == 200, response.text
    return response.json()["data"]


def work(env):
    assert asyncio.run(env[1].run_once())


def screen(env):
    approve(env)
    response = env[0].post(
        "/api/v1/trials/TR-PX104/screenings",
        headers=headers("ACT-COORD-01"),
        json=dict(
            protocol_version_id="PV-PX104-1.0",
            screening_date="2026-10-31",
            evidence_cutoff_at="2026-10-31T22:00:00Z",
            patient_ids=None,
            purpose="BASELINE",
        ),
    )
    assert response.status_code == 202, response.text
    work(env)
    job = env[0].get(response.json()["data"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "SUCCEEDED", job
    return job["result"]["run_id"]


def participate(env, pid="P-042"):
    response = env[0].post(
        f"/api/v1/trials/TR-PX104/patients/{pid}/participation",
        headers=headers(),
        json=dict(
            next_status="PARTICIPATING",
            external_record_source_id=f"SRC-{pid}-external",
            external_record_reference=f"EXT-{pid}",
            rationale="Recorded synthetic external participation",
        ),
    )
    assert response.status_code == 201, response.text


def event_body(kind="ADMINISTRATION", code="SYN-MED-R1", source="D18-P042"):
    return dict(
        trial_id="TR-PX104",
        event_kind="MEDICATION",
        source_event_id=source,
        source_version=1,
        source_id="SRC-" + source,
        source_document_version=1,
        effective_at="2026-11-19T09:30:00+02:00",
        recorded_at="2026-11-20T11:00:00+02:00",
        time_uncertainty=None,
        evidence_state="POSITIVE",
        evidence_quality="HIGH",
        medication=dict(
            code=code,
            evidence_type=kind,
            dose_value=1,
            dose_unit="synthetic-unit",
            route="ORAL",
            interval_end_exclusive_at=None,
        ),
        lab=None,
        condition=None,
        note=None,
        observation=None,
        supersedes_event_id=None,
    )


def post_event(env, body=None, pid="P-042", key=None):
    return env[0].post(
        f"/api/v1/patients/{pid}/events", headers=headers("ACT-COORD-01", key=key), json=body or event_body()
    )
