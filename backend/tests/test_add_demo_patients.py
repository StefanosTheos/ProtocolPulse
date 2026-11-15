from backend.app import models as m
from conftest import headers, screen, work
from sqlalchemy import func, select
from tools.add_demo_patients import ADDITIONAL_PATIENT_IDS, add_patients


def test_shared_patient_import_preserves_originals_and_is_repeatable(env):
    client, _, factory, _ = env
    run = screen(env)
    before = client.get(f"/api/v1/screenings/{run}/assessments", headers=headers()).json()["data"]
    original = client.get("/api/v1/trials/TR-PX104/patients/P-042", headers=headers()).json()["data"]

    added, total = add_patients(factory)
    assert added == list(ADDITIONAL_PATIENT_IDS) and total == 30
    with factory() as session:
        sources = session.scalar(select(func.count()).select_from(m.EvidenceSource))
    assert add_patients(factory) == ([], 30)
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(m.EvidenceSource)) == sources
    assert client.get("/api/v1/trials/TR-PX104/patients/P-042", headers=headers()).json()["data"] == original
    assert client.get(f"/api/v1/screenings/{run}/assessments", headers=headers()).json()["data"] == before
    assert client.get("/api/v1/trials/TR-PX104", headers=headers()).json()["data"]["patient_count"] == 30
    for patient_id in ADDITIONAL_PATIENT_IDS:
        response = client.get(f"/api/v1/trials/TR-PX104/patients/{patient_id}", headers=headers())
        assert response.status_code == 200
        patient = response.json()["data"]
        assert patient["participation_status"] == "NOT_ENROLLED"
        assert patient["clinical_narratives"] and patient["source_document_index"]

    # A new screening discovers the appended cohort; the original run remains immutable.
    response = client.post("/api/v1/trials/TR-PX104/screenings", headers=headers("ACT-COORD-01"), json=dict(
        protocol_version_id="PV-PX104-1.0", screening_date="2026-10-31",
        evidence_cutoff_at="2026-10-31T22:00:00Z", patient_ids=None, purpose="BASELINE"))
    assert response.status_code == 202
    work(env)
    job = client.get(response.json()["data"]["poll_url"], headers=headers()).json()["data"]
    assert job["status"] == "SUCCEEDED"
    assessments = client.get(f"/api/v1/screenings/{job['result']['run_id']}/assessments?limit=100",
                             headers=headers()).json()["data"]["items"]
    assert len(assessments) == 30
    assert set(ADDITIONAL_PATIENT_IDS) <= {a["patient_id"] for a in assessments}
    assert all(a["evaluation_state"] == "COMPLETE" and len(a["criteria"]) == 5 for a in assessments)
