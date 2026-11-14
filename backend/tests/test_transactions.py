import asyncio
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from conftest import approve, event_body, headers, participate, post_event, screen, work
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from backend.app import models as m
from backend.app.db.base import now


def count(factory, model):
    with factory() as session:
        return session.scalar(select(func.count()).select_from(model))


def test_concurrent_replay_and_changed_body_collision(env):
    screen(env)
    participate(env)

    def post(_):
        return post_event(env, key="concurrent")

    with ThreadPoolExecutor(max_workers=4) as pool:
        replies = list(pool.map(post, range(4)))
    assert sorted(r.status_code for r in replies) == [200, 200, 200, 202]
    assert len({r.json()["data"]["event_id"] for r in replies}) == 1
    changed = event_body()
    changed["medication"]["dose_value"] = 2
    response = post_event(env, changed, key="concurrent")
    assert response.status_code == 409
    response = post_event(env, changed, key="another-key")
    assert response.status_code == 409 and response.json()["error"]["code"] == "EVENT_VERSION_CONFLICT"
    work(env)
    assert (
        count(env[2], m.PatientEvent)
        == count(env[2], m.MonitoringFinding)
        == count(env[2], m.ReviewCase)
        == 1
    )


def test_audit_failure_rolls_back_t2_preserves_t1_and_retries(env, monkeypatch):
    screen(env)
    participate(env)
    response = post_event(env)
    assert response.status_code == 202
    from backend.app.services import event_processor

    original = event_processor.append_audit

    def broken(*args, **kwargs):
        raise RuntimeError("Synthetic audit write failure")

    monkeypatch.setattr(event_processor, "append_audit", broken)
    work(env)
    assert count(env[2], m.PatientEvent) == 1
    assert count(env[2], m.MonitoringFinding) == count(env[2], m.ReviewCase) == 0
    assert count(env[2], m.MedicationExposure) == 6  # Original seed medication records only.
    job = env[0].get(response.json()["data"]["job"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "QUEUED" and job["attempts"] == 1
    monkeypatch.setattr(event_processor, "append_audit", original)
    work(env)
    job = env[0].get(response.json()["data"]["job"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "SUCCEEDED" and job["attempts"] == 2
    assert count(env[2], m.MonitoringFinding) == count(env[2], m.ReviewCase) == 1


def test_expired_lease_recovered_once(env):
    approve(env)
    participate(env)
    response = post_event(env)
    job_id = response.json()["data"]["job"]["job_id"]
    with env[2].begin() as session:
        job = session.get(m.Job, job_id)
        job.status, job.attempts, job.lease_until = "RUNNING", 1, now() - timedelta(seconds=1)
    work(env)
    assert not asyncio.run(env[1].run_once())
    job = env[0].get(response.json()["data"]["job"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "SUCCEEDED" and job["attempts"] == 2


def test_failed_event_stale_not_unknown(env, monkeypatch):
    run = screen(env)
    participate(env)
    accepted = post_event(env)
    from backend.app.services import jobs

    def fail(*args):
        raise RuntimeError("Deterministic evaluator failure")

    monkeypatch.setattr(jobs, "process_event", fail)
    for _ in range(3):
        work(env)
    job = env[0].get(accepted.json()["data"]["job"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "FAILED" and job["attempts"] == 3
    assert count(env[2], m.PatientEvent) == 1
    assert count(env[2], m.MonitoringFinding) == 0
    assessments = (
        env[0].get(f"/api/v1/screenings/{run}/assessments", headers=headers()).json()["data"]["items"]
    )
    row = next(a for a in assessments if a["patient_id"] == "P-042")
    assert row["candidate_status"] == "POTENTIAL_MATCH" and row["stale"]


def test_investigator_only_closure_and_audit_rollback(env, monkeypatch):
    screen(env)
    participate(env)
    response = post_event(env)
    assert response.status_code == 202
    work(env)
    case = env[0].get("/api/v1/trials/TR-PX104/cases", headers=headers()).json()["data"]["items"][0]
    evidence = (
        env[0]
        .get("/api/v1/trials/TR-PX104/findings", headers=headers())
        .json()["data"]["items"][0]["evidence_refs"][0]["evidence_id"]
    )
    body = dict(
        expected_revision=case["revision"],
        next_status="RESOLVED",
        assigned_actor_id="ACT-MON-01",
        disposition="REVIEWED",
        rationale="Monitor cannot resolve",
        cited_evidence_ids=[evidence],
    )
    assert (
        env[0]
        .patch(
            f"/api/v1/cases/{case['case_id']}",
            headers=headers("ACT-MON-01", revision=case["revision"]),
            json=body,
        )
        .status_code
        == 403
    )
    body["next_status"] = "ACKNOWLEDGED"
    from backend.app.api import routes

    def broken(*args, **kwargs):
        raise RuntimeError("Synthetic audit failure")

    monkeypatch.setattr(routes, "append_audit", broken)
    assert (
        env[0]
        .patch(f"/api/v1/cases/{case['case_id']}", headers=headers(revision=case["revision"]), json=body)
        .status_code
        == 500
    )
    current = env[0].get(f"/api/v1/cases/{case['case_id']}", headers=headers()).json()["data"]
    assert (
        current["revision"] == case["revision"] and current["status"] == "OPEN" and current["decisions"] == []
    )


def test_missing_source_and_reversed_record_effective_order(env):
    approve(env)
    participate(env)
    body = event_body()
    body["recorded_at"] = "2026-11-18T10:00:00+02:00"
    response = post_event(env, body)
    assert response.status_code == 202
    work(env)
    findings = env[0].get("/api/v1/trials/TR-PX104/findings", headers=headers()).json()["data"]["items"]
    assert findings[0]["category"] == "CONFIRMED_PROTOCOL_CONFLICT"
    assert env[0].get("/api/v1/trials/TR-PX104/evidence/absent", headers=headers()).status_code == 404


def test_database_immutable_history(env):
    screen(env)
    with env[2]() as session:
        assessment = session.scalar(select(m.PatientTrialAssessment))
        key = assessment.assessment_id
    with pytest.raises(IntegrityError):
        with env[2].begin() as session:
            session.execute(
                text(
                    "UPDATE patient_trial_assessment SET candidate_status='NEEDS_REVIEW' WHERE assessment_id=:id"
                ),
                {"id": key},
            )
    with pytest.raises(IntegrityError):
        with env[2].begin() as session:
            session.execute(text("DELETE FROM criterion_approval"))
