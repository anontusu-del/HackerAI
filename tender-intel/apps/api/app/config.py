"""Application configuration via environment variables."""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Tender Intelligence Platform"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api"
    SECRET_KEY: str = "change-me-in-production-please-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    DATABASE_URL: str = "postgresql+psycopg://postgres@127.0.0.1:5432/tenderintel"
    REDIS_URL: str = "redis://127.0.0.1:6379/0"

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Optional LLM provider for AI summaries (leave empty for built-in rule-based engine)
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = "gpt-4o-mini"

    SEED_DEMO: bool = True
    DEMO_ADMIN_EMAIL: str = "admin@tenderintel.pk"
    DEMO_ADMIN_PASSWORD: str = "Admin@12345"


@lru_cache
def get_settings() -> Settings:
    return Settings()

