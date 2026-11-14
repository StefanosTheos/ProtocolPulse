from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./backend/var/protocolpulse.db"
    protocol_storage_dir: Path = Path("backend/var/protocols")
    frontend_origin: str = "http://localhost:3000"
    api_host: str = "127.0.0.1"
    api_port: int = Field(8000, ge=1, le=65535)
    api_log_level: str = "INFO"
    llm_enabled: bool = False
    llm_provider: str = "gemini"
    llm_model: str = "gemini-3.8-flash"
    llm_api_key: SecretStr = SecretStr("")
    max_agent_steps: int = Field(8, ge=1, le=8)
    tool_timeout_seconds: float = Field(5, gt=0, le=5)
    llm_call_timeout_seconds: float = Field(10, gt=0, le=10)
    agent_timeout_seconds: float = Field(30, gt=0, le=30)
    synthetic_data_only: bool = True
    seed: int = 10415
    demo_seed_version: str = "px104-15-v1"
    default_site_timezone: str = "Europe/Athens"
    engine_version: str = "px104-eval-v1"
    max_pdf_mb: int = 12
    job_poll_interval_ms: int = Field(500, ge=10, le=10000)
    job_lease_seconds: int = Field(60, ge=35)
    job_max_attempts: int = Field(3, ge=1, le=3)
    job_retry_backoff_seconds: int = Field(2, ge=0, le=60)
    job_batch_size: int = Field(1, ge=1, le=1)


@lru_cache
def get_settings() -> Settings:
    # E3's sole public entrypoint reads process configuration, never backend internals.
    # Load once server-side, preserving environment overrides and keeping keys off DTOs.
    load_dotenv(".env", override=False)
    return Settings()
