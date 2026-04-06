"""Shared fixtures for unit tests."""

import pytest


@pytest.fixture(autouse=True)
def set_required_env_vars(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set dummy env vars so agents don't KeyError before mocks take effect."""
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456:test-token")
