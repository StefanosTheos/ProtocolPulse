from backend.app.core.errors import DomainError
from backend.app.models import ClinicalActor, Trial


def actor_for(session, actor_id):
    if not actor_id:
        raise DomainError("ACTOR_REQUIRED", "X-Demo-Actor-Id is required", 401)
    actor = session.get(ClinicalActor, actor_id)
    if not actor:
        raise DomainError("ACTOR_UNKNOWN", "Unknown fictional actor", 401)
    if actor.role not in ("INVESTIGATOR", "COORDINATOR"):
        raise DomainError("ROLE_FORBIDDEN", "This demo actor has been retired", 403)
    if not actor.active:
        raise DomainError("ACTOR_UNKNOWN", "Unknown fictional actor", 401)
    return actor


def require_role(actor, *roles):
    if actor.role not in roles:
        raise DomainError("ROLE_FORBIDDEN", "Actor role is not authorized for this operation", 403)


def scoped_trial(session, actor, trial_id):
    trial = session.get(Trial, trial_id)
    if not trial:
        raise DomainError("TRIAL_NOT_FOUND", "Trial not found", 404)
    if trial.site_id != actor.site_id:
        raise DomainError("SITE_SCOPE_FORBIDDEN", "Trial is outside actor site scope", 403)
    return trial
