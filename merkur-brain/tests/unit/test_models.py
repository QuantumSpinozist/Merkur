"""Unit tests for Pydantic models in app/models.py."""

import pytest
from pydantic import ValidationError

from app.models import (
    CleanupInput,
    CleanupOutput,
    FolderRecord,
    IntakeInput,
    IntakeOutput,
    NoteRecord,
    TelegramMessage,
    TelegramUpdate,
)


class TestIntakeInput:
    def test_valid(self) -> None:
        obj = IntakeInput(
            raw_message="buy milk",
            available_folders=[{"id": "abc", "name": "Shopping"}],
        )
        assert obj.raw_message == "buy milk"
        assert obj.available_folders[0]["name"] == "Shopping"

    def test_empty_folders(self) -> None:
        obj = IntakeInput(raw_message="test", available_folders=[])
        assert obj.available_folders == []

    def test_missing_raw_message(self) -> None:
        with pytest.raises(ValidationError):
            IntakeInput(available_folders=[])  # type: ignore[call-arg]


class TestIntakeOutput:
    def test_valid_with_folder(self) -> None:
        obj = IntakeOutput(title="Buy milk", content="buy milk", folder_id="folder-1")
        assert obj.folder_id == "folder-1"

    def test_valid_inbox(self) -> None:
        obj = IntakeOutput(title="Quick note", content="something", folder_id=None)
        assert obj.folder_id is None

    def test_missing_title(self) -> None:
        with pytest.raises(ValidationError):
            IntakeOutput(content="x", folder_id=None)  # type: ignore[call-arg]


class TestCleanupInput:
    def test_valid(self) -> None:
        obj = CleanupInput(raw_content="raw stuff", title="My Note")
        assert obj.title == "My Note"

    def test_missing_fields(self) -> None:
        with pytest.raises(ValidationError):
            CleanupInput(raw_content="only content")  # type: ignore[call-arg]


class TestCleanupOutput:
    def test_valid(self) -> None:
        obj = CleanupOutput(cleaned_content="# Heading\n\nBody text.")
        assert obj.cleaned_content.startswith("# Heading")


class TestTelegramMessage:
    def test_from_payload_text(self) -> None:
        data = {
            "message_id": 42,
            "from": {"id": 999, "first_name": "Aaron", "username": "aaron"},
            "chat": {"id": 999, "type": "private"},
            "text": "Hello world",
        }
        msg = TelegramMessage.from_payload(data)
        assert msg.text == "Hello world"
        assert msg.from_ is not None
        assert msg.from_.id == 999
        assert msg.chat.id == 999

    def test_from_payload_no_text(self) -> None:
        data = {
            "message_id": 43,
            "from": {"id": 999, "first_name": "Aaron"},
            "chat": {"id": 999, "type": "private"},
        }
        msg = TelegramMessage.from_payload(data)
        assert msg.text is None

    def test_from_payload_no_from(self) -> None:
        data = {
            "message_id": 44,
            "chat": {"id": -100123, "type": "channel"},
            "text": "channel post",
        }
        msg = TelegramMessage.from_payload(data)
        assert msg.from_ is None
        assert msg.text == "channel post"


class TestTelegramUpdate:
    def test_valid_with_message(self) -> None:
        update = TelegramUpdate(
            update_id=1,
            message={"message_id": 1, "chat": {"id": 1, "type": "private"}},
        )
        assert update.update_id == 1
        assert update.message is not None

    def test_valid_no_message(self) -> None:
        update = TelegramUpdate(update_id=1)
        assert update.message is None

    def test_missing_update_id(self) -> None:
        with pytest.raises(ValidationError):
            TelegramUpdate()  # type: ignore[call-arg]


class TestServiceRecords:
    def test_note_record(self) -> None:
        note = NoteRecord(
            id="n1",
            title="Test",
            content=None,
            folder_id=None,
            source="telegram",
            is_cleaned=False,
        )
        assert note.source == "telegram"
        assert note.is_cleaned is False

    def test_folder_record(self) -> None:
        folder = FolderRecord(id="f1", name="Work", parent_id=None)
        assert folder.parent_id is None
