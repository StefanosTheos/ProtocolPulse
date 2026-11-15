from backend.app import models as m
from conftest import headers, screen, work
from sqlalchemy import func, select
from tools.add_demo_patients import ADDITIONAL_PATIENT_IDS, add_patients, additional_patient_ids


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


def test_patient_import_into_another_study_uses_study_specific_ids(env):
    client, _, factory, _ = env
    body = dict(title="Second synthetic study", fictional_product_code="PX-205", site_id="SITE-SYN-01",
                site_timezone="Europe/Athens", planned_start_date="2026-12-01", planned_end_date="2027-03-01",
                synthetic_only=True)
    response = client.post("/api/v1/trials", headers=headers("ACT-COORD-01"), json=body)
    assert response.status_code == 201, response.text
    trial_id = response.json()["data"]["trial_id"]

    ids = additional_patient_ids(trial_id)
    assert len(ids) == 15 and not set(ids) & set(ADDITIONAL_PATIENT_IDS)
    assert add_patients(factory, trial_id) == (list(ids), 15)
    assert add_patients(factory, trial_id) == ([], 15)
    assert client.get(f"/api/v1/trials/{trial_id}", headers=headers()).json()["data"]["patient_count"] == 15
    assert client.get("/api/v1/trials/TR-PX104", headers=headers()).json()["data"]["patient_count"] == 15
    patient = client.get(f"/api/v1/trials/{trial_id}/patients/{ids[0]}", headers=headers()).json()["data"]
    assert patient["participation_status"] == "NOT_ENROLLED"
    assert patient["clinical_narratives"] and patient["source_document_index"]
    with factory() as session:
        sources = session.scalars(select(m.EvidenceSource).where(m.EvidenceSource.patient_id == ids[0])).all()
    assert sources and all(s.trial_id == trial_id for s in sources)
    # The same IDs are never imported into PX-104's dataset.
    assert add_patients(factory) == (list(ADDITIONAL_PATIENT_IDS), 30)
