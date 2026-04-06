"""Integration tests for the full WhatsApp webhook flow.

These tests hit real Supabase + Anthropic — CI only, never run in pre-commit.
Skipped automatically when SUPABASE_URL is not set.
"""

import os

import pytest

# Skip entire module if env vars are not configured
pytestmark = pytest.mark.skipif(
    not os.environ.get("SUPABASE_URL"),
    reason="SUPABASE_URL not set — integration tests require live Supabase",
)
