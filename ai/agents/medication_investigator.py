"""Medication investigation policies; no pharmacology or temporal evaluator."""


def unmapped(data):
    return data.get("status") == "UNMAPPED" and data.get("mapped_class") is None
