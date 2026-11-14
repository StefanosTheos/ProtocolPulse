"""Execution-local citation selections; never accept model-authored citation metadata."""

import hashlib
import json

from ai.tools.schemas import EvidenceReference, wire


class UnverifiedSelection(ValueError):
    pass


class ReferenceRegistry:
    def __init__(self):
        self.items = {}

    def observe(self, refs):
        for value in refs:
            ref = EvidenceReference.model_validate(value)
            payload = json.dumps(wire(ref), sort_keys=True, separators=(",", ":"))
            key = "REF-" + hashlib.sha256(payload.encode()).hexdigest()
            self.items[key] = ref

    def selections(self):
        return [{"key": key, "reference": wire(ref)} for key, ref in self.items.items()]

    def resolve(self, keys):
        if len(keys) != len(set(keys)) or any(key not in self.items for key in keys):
            raise UnverifiedSelection("UNVERIFIED_EVIDENCE_REF")
        return [self.items[key].model_copy(deep=True) for key in keys]
