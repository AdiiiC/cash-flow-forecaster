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
    # Optional regex for matching preview/deploy origins (e.g. Vercel previews).
    # Example: https://cash-flow-forecaster.*\.vercel\.app
    frontend_origin_regex: str = ""

    # Run-history persistence. When set (e.g. a Supabase/Neon Postgres URL) runs
    # survive restarts; when empty we fall back to a local SQLite file so dev and
    # tests need zero setup.
    database_url: str = ""

    # ---- Auth (JWT + bcrypt) ----------------------------------------------
    # Secret used to sign access tokens. MUST be set to a strong random value in
    # production; when empty a dev-only default is used (and auth is insecure).
    jwt_secret: str = ""
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    @property
    def effective_jwt_secret(self) -> str:
        return self.jwt_secret.strip() or "dev-insecure-secret-change-me"

    # ---- Notifications -----------------------------------------------------
    # Slack Incoming Webhook URL. When set, threshold alerts (critical/warning)
    # are posted to the configured channel. Empty disables Slack notifications.
    slack_webhook_url: str = ""

    # ---- Data protection ---------------------------------------------------
    # Fernet key (urlsafe base64, 32 bytes) used to encrypt sensitive text
    # fields at rest (e.g. invoice customer / bill vendor names). When empty,
    # values are stored as-is (dev only). Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    data_encryption_key: str = ""

    # ---- Email (Resend) ---------------------------------------------------
    # Transactional email for OTP codes, weekly digest, and invite emails.
    # Sign up free at https://resend.com and add your API key here.
    resend_api_key: str = ""
    email_from: str = "ClearCash <noreply@clearcash.app>"

    # ---- TOTP / MFA -------------------------------------------------------
    totp_issuer: str = "ClearCash"

    # Persistence. When set (e.g. a Supabase/Neon Postgres URL) run history is
    # stored there and survives redeploys. When empty, we fall back to a local
    # SQLite file so local dev and tests need no external database.
    database_url: str = ""

    # Forecasting defaults
    horizon_weeks: int = 13
    # Number of walk-forward origins used for backtesting / conformal residuals.
    # More origins => more residual samples per horizon step, which stabilises
    # the empirical coverage estimate and shrinks the finite-sample conformal
    # inflation (both push measured coverage closer to the nominal target).
    backtest_origins: int = 40  # 40 origins → ~20 cal + 20 eval per step → stable 85%+ coverage

    @property
    def frontend_origins(self) -> list[str]:
        """Allow a comma-separated list of exact origins in FRONTEND_ORIGIN."""
        return [o.strip() for o in self.frontend_origin.split(",") if o.strip()]

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
