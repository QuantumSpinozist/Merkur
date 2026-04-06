"""Unit tests for the intake agent (all Anthropic API calls are mocked)."""

import json

import pytest

from app.agents.intake_agent import run_intake_agent
from app.models import IntakeInput, IntakeOutput


def _make_mock_response(content: dict) -> object:
    """Build a minimal object that mimics an Anthropic Message response."""

    class FakeUsage:
        input_tokens = 10
        output_tokens = 20

    class FakeContent:
        text = json.dumps(content)

    class FakeResponse:
        usage = FakeUsage()
        content = [FakeContent()]

    return FakeResponse()


FOLDERS = [
    {"id": "folder-work", "name": "Work"},
    {"id": "folder-shopping", "name": "Shopping"},
]


@pytest.mark.asyncio
async def test_returns_intake_output(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    mock_create = mocker.patch("app.agents.intake_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.return_value = _make_mock_response(
        {
            "title": "Buy milk",
            "content": "buy milk today",
            "folder_id": "folder-shopping",
        }
    )

    result = await run_intake_agent(
        IntakeInput(raw_message="buy milk today", available_folders=FOLDERS)
    )

    assert isinstance(result, IntakeOutput)
    assert result.title == "Buy milk"
    assert result.folder_id == "folder-shopping"


@pytest.mark.asyncio
async def test_inbox_when_no_folder(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    mock_create = mocker.patch("app.agents.intake_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.return_value = _make_mock_response(
        {"title": "Random thought", "content": "just a thought", "folder_id": None}
    )

    result = await run_intake_agent(
        IntakeInput(raw_message="just a thought", available_folders=FOLDERS)
    )

    assert result.folder_id is None


@pytest.mark.asyncio
async def test_fallback_on_api_error(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    mock_create = mocker.patch("app.agents.intake_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.side_effect = Exception("API down")

    raw = "fallback message content"
    result = await run_intake_agent(
        IntakeInput(raw_message=raw, available_folders=FOLDERS)
    )

    # Falls back gracefully — title truncated from message, folder = None
    assert isinstance(result, IntakeOutput)
    assert result.folder_id is None
    assert result.content == raw


@pytest.mark.asyncio
async def test_fallback_on_invalid_json(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    class BadResponse:
        class usage:
            input_tokens = 0
            output_tokens = 0

        content = [type("C", (), {"text": "not valid json at all"})()]

    mock_create = mocker.patch("app.agents.intake_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.return_value = BadResponse()

    result = await run_intake_agent(
        IntakeInput(raw_message="test", available_folders=FOLDERS)
    )

    assert isinstance(result, IntakeOutput)


@pytest.mark.asyncio
async def test_title_truncated_in_fallback(mocker: pytest.fixture) -> None:  # type: ignore[type-arg]
    mock_create = mocker.patch("app.agents.intake_agent.anthropic.Anthropic")
    mock_create.return_value.messages.create.side_effect = Exception("error")

    long_message = "a" * 100
    result = await run_intake_agent(
        IntakeInput(raw_message=long_message, available_folders=[])
    )

    assert len(result.title) <= 60
