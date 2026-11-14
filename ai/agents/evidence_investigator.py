"""Carry forward backend-supplied uncertainties, never calculate clinical status."""


def required_unknowns(observations):
    unknowns = set()
    latest_timeline = None
    for name, data in observations:
        if name == "retrieve_patient_evidence":
            unknowns.update(data["open_items"])
        elif name == "evaluate_approved_rule":
            unknowns.update(data["reason_codes"])
        elif name == "get_lab_history" and not data["facts"]:
            unknowns.add("MISSING_LAB")
        elif name == "get_medication_timeline":
            latest_timeline = data
    if latest_timeline is not None:
        kinds = {event["kind"] for event in latest_timeline["events"]}
        if kinds & {"ORDER", "DISPENSE"} and not kinds & {"ADMINISTRATION", "REPORTED_USE"}:
            unknowns.add("ORDER_ONLY")
    return unknowns
