import hashlib
import json

from backend.app.db.base import new_id, now
from backend.app.models import AuditEntry


def digest(value) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str).encode()
    ).hexdigest()


def append_audit(
    session,
    actor,
    trial_id,
    action,
    target_type,
    target_id,
    correlation_id,
    output_ids=(),
    result="OK",
    input_hash=None,
    prior=None,
    next_state=None,
    reason=None,
):
    row = AuditEntry(
        audit_id=new_id("AUD"),
        trial_id=trial_id,
        actor_id=actor.actor_id,
        actor_role=actor.role,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_version=None,
        request_id=correlation_id,
        correlation_id=correlation_id,
        input_hash=input_hash,
        output_ref_ids_json=list(output_ids),
        result_code=result,
        occurred_at=now(),
        prior_state=prior,
        next_state=next_state,
        reason=reason,
    )
    session.add(row)
    session.flush()
    return row
