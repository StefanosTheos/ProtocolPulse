from conftest import approve, event_body, headers, participate


def summary(client, actor="ACT-COORD-01", trial_id="TR-PX104"):
    return client.get(f"/api/v1/trials/{trial_id}/participation-summary", headers=headers(actor))


def test_participation_summary_returns_counts_only(env):
    client = env[0]
    response = summary(client)
    assert response.status_code == 200, response.text
    assert response.json()["data"] == dict(trial_id="TR-PX104", cohort_count=15, participating_count=0, ended_count=0)

    approve(env)
    participate(env, "P-042")
    participate(env, "P-118")
    data = summary(client).json()["data"]
    assert data == dict(trial_id="TR-PX104", cohort_count=15, participating_count=2, ended_count=0)
    assert summary(client, "ACT-INV-01").json()["data"] == data
    assert summary(client, trial_id="TR-MISSING").status_code == 404


def test_clinical_lead_can_post_simulated_records(env):
    approve(env)
    participate(env)
    response = env[0].post("/api/v1/patients/P-042/events", headers=headers("ACT-INV-01"), json=event_body())
    assert response.status_code == 202, response.text
