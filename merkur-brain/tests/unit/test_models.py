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
    WhatsAppMessage,
    WhatsAppWebhookPayload,
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


class TestWhatsAppMessage:
    def test_from_payload_text(self) -> None:
        data = {
            "id": "msg-1",
            "from": "+491234567890",
            "type": "text",
            "text": {"body": "Hello world"},
        }
        msg = WhatsAppMessage.from_payload(data)
        assert msg.from_ == "+491234567890"
        assert msg.text is not None
        assert msg.text.body == "Hello world"

    def test_from_payload_no_text(self) -> None:
        data = {"id": "msg-2", "from": "+491234567890", "type": "image"}
        msg = WhatsAppMessage.from_payload(data)
        assert msg.type == "image"
        assert msg.text is None


class TestWhatsAppWebhookPayload:
    def test_valid(self) -> None:
        payload = WhatsAppWebhookPayload(object="whatsapp_business_account", entry=[])
        assert payload.object == "whatsapp_business_account"

    def test_invalid_missing_object(self) -> None:
        with pytest.raises(ValidationError):
            WhatsAppWebhookPayload(entry=[])  # type: ignore[call-arg]


class TestServiceRecords:
    def test_note_record(self) -> None:
        note = NoteRecord(
            id="n1",
            title="Test",
            content=None,
            folder_id=None,
            source="whatsapp",
            is_cleaned=False,
        )
        assert note.source == "whatsapp"
        assert note.is_cleaned is False

    def test_folder_record(self) -> None:
        folder = FolderRecord(id="f1", name="Work", parent_id=None)
        assert folder.parent_id is None
