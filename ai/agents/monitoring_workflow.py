"""Monitor enrichment follows the independently persisted backend result."""


def no_action(data):
    return data.get("category") == "NO_ACTION" and data.get("affected_criterion_ids") == []
