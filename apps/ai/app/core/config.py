from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service settings, read from environment variables (shared root .env)."""

    model_config = SettingsConfigDict(env_prefix="AI_", extra="ignore", case_sensitive=False)

    service_token: SecretStr = Field(
        default=SecretStr(""),
        description="Shared secret expected in the X-Service-Token header.",
    )
    log_level: str = "info"
    docs_enabled: bool = Field(
        default=False,
        description="Expose /docs and /openapi.json without token (development only).",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
