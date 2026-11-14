"""Server-process configuration only. Root .env loading belongs to E2."""

from dataclasses import dataclass, field
import os


@dataclass(frozen=True)
class Settings:
    enabled: bool = False
    provider: str = "gemini"
    model: str = "gemini-3.8-flash"
    api_key: str = field(default="", repr=False)
    max_steps: int = 8
    tool_timeout: float = 5
    model_timeout: float = 10
    agent_timeout: float = 30
    max_attempts: int = 3

    @classmethod
    def from_environ(cls):
        return cls(
            enabled=os.getenv("LLM_ENABLED", "false").lower() == "true",
            provider=os.getenv("LLM_PROVIDER", "gemini"),
            model=os.getenv("LLM_MODEL", "gemini-3.8-flash"),
            api_key=os.getenv("LLM_API_KEY", ""),
            max_steps=min(8, max(1, int(os.getenv("MAX_AGENT_STEPS", "8")))),
            tool_timeout=min(5, max(0.001, float(os.getenv("TOOL_TIMEOUT_SECONDS", "5")))),
            model_timeout=min(10, max(0.001, float(os.getenv("LLM_CALL_TIMEOUT_SECONDS", "10")))),
            agent_timeout=min(30, max(0.001, float(os.getenv("AGENT_TIMEOUT_SECONDS", "30")))),
            max_attempts=min(3, max(1, int(os.getenv("JOB_MAX_ATTEMPTS", "3")))),
        )

    @property
    def configured(self):
        return (self.enabled and self.provider == "gemini" and self.model == "gemini-3.8-flash"
                and bool(self.api_key.strip()))
