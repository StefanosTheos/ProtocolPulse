"""The sole public backend integration entrypoint."""

import asyncio
import time
from ai.agents.coordinator import Coordinator
from ai.config import Settings
from ai.providers.gemini import GeminiProvider, ProviderUnavailable
from ai.tools.schemas import AgentRequest, AgentResult, AsyncToolGateway, wire

__all__ = ["run_agent"]


async def run_agent(request: dict, gateway: AsyncToolGateway) -> dict:
    parsed = AgentRequest.model_validate(request)

    def unavailable(code):
        return wire(AgentResult(contract_version=parsed.contract_version, execution_id=parsed.execution_id,
            role=parsed.role, status="UNAVAILABLE", summary=None, evidence_refs=[], unknown_reasons=[],
            conflict_refs=[], proposed_criteria=[], coverage=[], verification_questions=[], trace=[],
            error_code=code, model_id=None))

    try:
        settings = Settings.from_environ()
    except (ValueError, TypeError):
        return unavailable("INVALID_PROVIDER_CONFIGURATION")
    if not settings.configured:
        return unavailable("AGENT_UNAVAILABLE")
    try:
        provider = GeminiProvider(settings)
    except ProviderUnavailable:
        return unavailable("SDK_UNAVAILABLE")
    except Exception:
        return unavailable("INVALID_PROVIDER_CONFIGURATION")
    started = time.monotonic()
    try:
        return await Coordinator(parsed, gateway, settings, provider).run()
    finally:
        try:
            remaining = max(0.001, settings.agent_timeout - (time.monotonic() - started))
            await asyncio.wait_for(provider.close(), timeout=min(1, remaining))
        except Exception:
            pass  # Cleanup errors cannot replace the sanitized, validated execution result.
