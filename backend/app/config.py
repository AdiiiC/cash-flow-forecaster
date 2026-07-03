"""Application settings loaded from environment / .env.

Boundary validation lives here so the rest of the app can trust these values.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ---- LLM provider selection -------------------------------------------
    # Which vendor generates the CFO briefing.
    #   "auto"      -> use the first provider (in AUTO priority order) that has
    #                  an API key configured.
    #   "gemini" | "openai" | "anthropic" -> force that vendor.
    #   "none"      -> skip the LLM entirely and always use the template.
    llm_provider: str = "auto"

    # Per-provider API keys. Only the ones you set are used.
    gemini_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Optional explicit model override per provider. Leave empty to let the app
    # auto-select the best available model from a curated preference list
    # (falling back gracefully if a newer model is not enabled on your account).
    gemini_model: str = ""
    openai_model: str = ""
    anthropic_model: str = ""

    frontend_origin: str = "http://localhost:3000"

    # Forecasting defaults
    horizon_weeks: int = 13
    # Number of walk-forward origins used for backtesting / conformal residuals.
    backtest_origins: int = 8

    @property
    def any_llm_key(self) -> bool:
        return bool(
            self.gemini_api_key.strip()
            or self.openai_api_key.strip()
            or self.anthropic_api_key.strip()
        )

    @property
    def llm_enabled(self) -> bool:
        return self.llm_provider.lower().strip() != "none" and self.any_llm_key


@lru_cache
def get_settings() -> Settings:
    return Settings()
