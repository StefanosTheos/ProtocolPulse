"""Database guards for immutable evidence and clinical history."""

from alembic import op

revision = "0002_fixture_constraints"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

IMMUTABLE = [
    "source_span",
    "criterion_approval",
    "terminology_map",
    "patient_fact",
    "condition_record",
    "medication_exposure",
    "study_product_exposure",
    "lab_observation",
    "observation_record",
    "clinical_note",
    "prior_research",
    "encounter",
    "evidence_snapshot",
    "snapshot_evidence",
    "patient_trial_assessment",
    "criterion_result",
    "patient_event",
    "monitoring_finding",
    "review_decision",
    "screening_disposition",
    "participation_record",
    "audit_entry",
]


def upgrade():
    for table in IMMUTABLE:
        for action in ("UPDATE", "DELETE"):
            op.execute(
                f"CREATE TRIGGER immutable_{table}_{action.lower()} BEFORE {action} ON {table} "
                f"BEGIN SELECT RAISE(ABORT, 'immutable clinical history'); END"
            )
    for action in ("UPDATE", "DELETE"):
        op.execute(
            f"CREATE TRIGGER approved_criterion_{action.lower()} BEFORE {action} ON criterion "
            "WHEN OLD.approved_by IS NOT NULL BEGIN SELECT RAISE(ABORT, 'approved criterion immutable'); END"
        )
    op.execute(
        "CREATE TRIGGER immutable_protocol_source BEFORE UPDATE ON protocol_version "
        "WHEN OLD.source_pk != NEW.source_pk OR OLD.file_sha256 != NEW.file_sha256 "
        "BEGIN SELECT RAISE(ABORT, 'immutable protocol source'); END"
    )
    op.execute(
        "CREATE TRIGGER immutable_source BEFORE UPDATE ON evidence_source "
        "WHEN OLD.source_id != NEW.source_id OR OLD.source_version != NEW.source_version "
        "OR OLD.sha256 != NEW.sha256 OR OLD.trial_id != NEW.trial_id "
        "OR OLD.patient_id IS NOT NEW.patient_id "
        "OR (OLD.pages != '{}' AND OLD.pages != NEW.pages) "
        "BEGIN SELECT RAISE(ABORT, 'immutable evidence source'); END"
    )
    op.execute(
        "CREATE TRIGGER completed_run_immutable BEFORE UPDATE ON screening_run "
        "WHEN OLD.status = 'COMPLETE' BEGIN SELECT RAISE(ABORT, 'completed run immutable'); END"
    )
    indexes = {
        "condition_record": ["patient_id, code, clinical_status"],
        "medication_exposure": ["patient_id, mapped_class, asserted_start_at"],
        "patient_fact": ["patient_id, domain_section, fact_key, effective_at"],
        "lab_observation": ["patient_id, analyte_code, specimen_date DESC"],
        "patient_trial_assessment": ["trial_id, patient_id, evaluated_at DESC"],
        "review_case": ["trial_id, status, updated_at DESC"],
        "patient_event": ["trial_id, patient_id, effective_at"],
        "monitoring_finding": ["trial_id, category, created_at"],
        "job": ["status, lease_until, created_at"],
        "source_span": ["source_pk, page, start_offset"],
    }
    for table, keys in indexes.items():
        for index, columns in enumerate(keys):
            op.execute(f"CREATE INDEX ix_{table}_domain_{index} ON {table} ({columns})")


def downgrade():
    raise RuntimeError("Immutable clinical history cannot be downgraded")
