"""Unit tests for the cleanup agent (all Anthropic API calls are mocked)."""

import pytest

from app.agents.cleanup_agent import run_cleanup_agent
from app.models import CleanupInput, CleanupOutput


def _make_mock_response(text: str) -> object:
    class FakeUsage:
        input_tokens = 15
        output_tokens = 30

    class FakeContent:
        pass

    content_obj = FakeContent()
    content_obj.text = text  # type: ignore[attr-defined]

    class FakeResponse:
        usage = FakeUsage()
        content = [content_obj]

    return FakeResponse()


@pytest.mark.asyncio
async def test_returns_cleaned_content(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    mock_create = mocker.patch("app.agents.cleanup_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.return_value = _make_mock_response(
        "# Meeting Notes\n\n- Point one\n- Point two"
    )

    result = await run_cleanup_agent(
        CleanupInput(
            raw_content="meeting notes point one point two", title="Meeting Notes"
        )
    )

    assert isinstance(result, CleanupOutput)
    assert result.cleaned_content.startswith("# Meeting Notes")


@pytest.mark.asyncio
async def test_strips_leading_trailing_whitespace(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    mock_create = mocker.patch("app.agents.cleanup_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.return_value = _make_mock_response(
        "  \n# Title\n\nBody.\n  "
    )

    result = await run_cleanup_agent(
        CleanupInput(raw_content="Title Body.", title="Title")
    )

    assert not result.cleaned_content.startswith(" ")
    assert not result.cleaned_content.endswith(" ")


@pytest.mark.asyncio
async def test_fallback_on_api_error(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    mock_create = mocker.patch("app.agents.cleanup_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.side_effect = Exception("network error")

    raw = "this is the raw content"
    result = await run_cleanup_agent(CleanupInput(raw_content=raw, title="Test"))

    # Fallback: return raw content unchanged
    assert result.cleaned_content == raw


@pytest.mark.asyncio
async def test_logs_token_usage(
    mocker: pytest.fixture,
    caplog: pytest.LogCaptureFixture,  # type: ignore[type-arg]
) -> None:
    mock_create = mocker.patch("app.agents.cleanup_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.return_value = _make_mock_response(
        "# Clean"
    )

    import logging

    with caplog.at_level(logging.INFO, logger="app.agents.cleanup_agent"):
        await run_cleanup_agent(CleanupInput(raw_content="raw", title="T"))

    assert any("token usage" in record.message for record in caplog.records)
