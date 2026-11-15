"""Append the shared fifteen-patient extension to an existing synthetic PX-104 database.

Run from the repository root: python -m tools.add_demo_patients
"""

from sqlalchemy import func, select

from backend.app import models as m
from backend.app.core.config import get_settings
from backend.app.db.session import make_engine, session_factory
from backend.app.seed import PATIENT_IDS, SITE, TRIAL_ID, seed_patient

ADDITIONAL_PATIENT_IDS = tuple(f"P-{number}" for number in range(301, 316))


def add_patients(factory):
    added = []
    with factory.begin() as session:
        trial = session.get(m.Trial, TRIAL_ID)
        if not trial or not trial.synthetic_only or trial.site_id != SITE:
            raise ValueError("Run migrations and the px104-15 synthetic seed first")
        existing = {p.patient_id: p for p in session.scalars(select(m.Patient))}
        if not set(PATIENT_IDS) <= existing.keys():
            raise ValueError("The original PX-104 patient cohort must exist before importing")
        for index, patient_id in enumerate(ADDITIONAL_PATIENT_IDS, start=15):
            patient = existing.get(patient_id)
            if patient:
                if patient.trial_id != TRIAL_ID or patient.site_id != SITE or not patient.synthetic_only:
                    raise ValueError(f"Patient ID {patient_id} belongs to a different dataset")
                continue
            seed_patient(session, patient_id, index)
            added.append(patient_id)
        session.flush()
        total = session.scalar(select(func.count()).select_from(m.Patient).where(m.Patient.trial_id == TRIAL_ID))
    return added, total


def main():
    settings = get_settings()
    if not settings.synthetic_data_only:
        raise ValueError("Patient import requires SYNTHETIC_DATA_ONLY=true")
    engine = make_engine(settings.database_url)
    try:
        added, total = add_patients(session_factory(engine))
    finally:
        engine.dispose()
    print(f"Added {len(added)} synthetic patients; PX-104 now has {total} patients.")
    print("Shared cohort: P-301 through P-315. Existing patients are preserved on repeat runs.")
    print("Run a new screening to include newly imported patients in results.")


if __name__ == "__main__":
    main()
