from datetime import timedelta

from conftest import approve, headers

from backend.app import models as m
from backend.app.db.base import now


def test_claim_running_and_exhausted_lease_flags_domain(env):
    approve(env)
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
    job_id = response.json()["data"]["job_id"]
    assert env[1].claim() == job_id
    with env[2].begin() as session:
        job = session.get(m.Job, job_id)
        assert session.get(m.ScreeningRun, job.resource_id).status == "RUNNING"
        job.attempts = 3
        job.lease_until = now() - timedelta(seconds=1)
    assert env[1].claim() is None
    job = env[0].get(response.json()["data"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "FAILED" and job["error"]["code"] == "LEASE_EXHAUSTED"
    run = env[0].get("/api/v1/screenings/" + job["resource_id"], headers=headers()).json()["data"]
    assert run["status"] == "FAILED" and run["stale"]
