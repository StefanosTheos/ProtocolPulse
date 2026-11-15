"""Append the shared fifteen-patient extension to an existing synthetic study.

Run from the repository root: python -m tools.add_demo_patients [--trial TRIAL_ID]
Without --trial the patients are added to PX-104 as P-301 through P-315. For any other
study the same synthetic profiles get study-specific IDs, because patient IDs are global.
"""

import argparse
import hashlib

from sqlalchemy import func, select

from backend.app import models as m
from backend.app.core.config import get_settings
from backend.app.db.session import make_engine, session_factory
from backend.app.seed import PATIENT_IDS, SITE, TRIAL_ID, seed_patient

ADDITIONAL_PATIENT_IDS = tuple(f"P-{number}" for number in range(301, 316))


def additional_patient_ids(trial_id=TRIAL_ID):
    if trial_id == TRIAL_ID:
        return ADDITIONAL_PATIENT_IDS
    tag = hashlib.sha256(trial_id.encode()).hexdigest()[:6]
    return tuple(f"P-{tag}-{number}" for number in range(301, 316))


def add_patients(factory, trial_id=TRIAL_ID):
    added = []
    with factory.begin() as session:
        trial = session.get(m.Trial, trial_id)
        if trial_id == TRIAL_ID:
            if not trial or not trial.synthetic_only or trial.site_id != SITE:
                raise ValueError("Run migrations and the px104-15 synthetic seed first")
        elif not trial or not trial.synthetic_only:
            raise ValueError(f"Synthetic study {trial_id} not found")
        existing = {p.patient_id: p for p in session.scalars(select(m.Patient))}
        if trial_id == TRIAL_ID and not set(PATIENT_IDS) <= existing.keys():
            raise ValueError("The original PX-104 patient cohort must exist before importing")
        for index, patient_id in enumerate(additional_patient_ids(trial_id), start=15):
            patient = existing.get(patient_id)
            if patient:
                if patient.trial_id != trial_id or patient.site_id != trial.site_id or not patient.synthetic_only:
                    raise ValueError(f"Patient ID {patient_id} belongs to a different dataset")
                continue
            seed_patient(session, patient_id, index, trial_id=trial_id, site_id=trial.site_id)
            added.append(patient_id)
        session.flush()
        total = session.scalar(select(func.count()).select_from(m.Patient).where(m.Patient.trial_id == trial_id))
    return added, total


def main():
    parser = argparse.ArgumentParser(description="Add fifteen synthetic demo patients to a study.")
    parser.add_argument("--trial", default=TRIAL_ID, help=f"Study ID to add patients to (default {TRIAL_ID})")
    args = parser.parse_args()
    settings = get_settings()
    if not settings.synthetic_data_only:
        raise ValueError("Patient import requires SYNTHETIC_DATA_ONLY=true")
    engine = make_engine(settings.database_url)
    try:
        added, total = add_patients(session_factory(engine), args.trial)
    finally:
        engine.dispose()
    ids = additional_patient_ids(args.trial)
    print(f"Added {len(added)} synthetic patients; {args.trial} now has {total} patients.")
    print(f"Shared cohort: {ids[0]} through {ids[-1]}. Existing patients are preserved on repeat runs.")
    print("Run a new screening to include newly imported patients in results.")


if __name__ == "__main__":
    main()
