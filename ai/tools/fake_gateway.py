"""Explicit test double. Production entrypoints never construct it."""

import copy
import inspect


class FakeGateway:
    def __init__(self, handlers):
        self.handlers = handlers
        self.calls = []

    async def invoke(self, name: str, payload: dict) -> dict:
        self.calls.append((name, copy.deepcopy(payload)))
        handler = self.handlers.get(name)
        if handler is None:
            return {"tool_name": name, "error_code": "BAD_INPUT", "retryable": False}
        result = handler(payload) if callable(handler) else handler
        if inspect.isawaitable(result):
            result = await result
        return copy.deepcopy(result)
