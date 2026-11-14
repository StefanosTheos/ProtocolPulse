import pytest
from conftest import approve, event_body, headers, post_event, work


@pytest.mark.parametrize("kind", ["CONDITION", "OBSERVATION", "NOTE"])
def test_non_monitoring_events_preserve_source_linked_history(env, kind):
    approve(env)
    patient = env[0].get("/api/v1/trials/TR-PX104/patients/P-042", headers=headers()).json()["data"]
    body = event_body(source="HISTORY-" + kind)
    body["medication"] = None
    body["event_kind"] = kind
    if kind == "CONDITION":
        body["condition"] = dict(code="SYN-CONDITION-B", clinical_status="SUSPECTED")
    elif kind == "OBSERVATION":
        body["observation"] = dict(kind="VITAL", value=72, unit="beats/min")
    else:
        body["note"] = dict(text=patient["clinical_narratives"][0]["text"], span_start=None, span_end=None)
    response = post_event(env, body)
    assert response.status_code == 202, response.text
    event_id = response.json()["data"]["event_id"]
    work(env)
    after = env[0].get("/api/v1/trials/TR-PX104/patients/P-042", headers=headers()).json()["data"]
    if kind == "CONDITION":
        assert any(
            c["fact_id"] == event_id and c["value"] == "SYN-CONDITION-B" for c in after["medical_conditions"]
        )
    elif kind == "OBSERVATION":
        assert any(o["observation"]["fact_id"] == event_id for o in after["observations"])
    else:
        assert any(n["note_id"] == event_id for n in after["clinical_narratives"])
    job = env[0].get(response.json()["data"]["job"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "SUCCEEDED" and job["result"]["relevance"] == "NO_ACTION"
