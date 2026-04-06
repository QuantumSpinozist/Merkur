"""Unit tests for the Telegram webhook handler."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

EMPTY_UPDATE = {"update_id": 1}
TEXT_UPDATE = {
    "update_id": 1,
    "message": {
        "message_id": 42,
        "from": {"id": 999, "first_name": "Aaron"},
        "chat": {"id": 999, "type": "private"},
        "text": "buy milk",
    },
}
NON_TEXT_UPDATE = {
    "update_id": 2,
    "message": {
        "message_id": 43,
        "from": {"id": 999, "first_name": "Aaron"},
        "chat": {"id": 999, "type": "private"},
        # no "text" key — e.g. a photo
    },
}


class TestSecretTokenVerification:
    def test_no_secret_configured_always_passes(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        response = client.post("/webhook/telegram", json=EMPTY_UPDATE)
        assert response.status_code == 200

    def test_correct_secret_passes(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "my-secret")
        response = client.post(
            "/webhook/telegram",
            json=EMPTY_UPDATE,
            headers={"X-Telegram-Bot-Api-Secret-Token": "my-secret"},
        )
        assert response.status_code == 200

    def test_wrong_secret_returns_403(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("TELEGRAM_WEBHOOK_SECRET", "correct-secret")
        response = client.post(
            "/webhook/telegram",
            json=EMPTY_UPDATE,
            headers={"X-Telegram-Bot-Api-Secret-Token": "wrong-secret"},
        )
        assert response.status_code == 403


class TestMessageHandling:
    def test_non_text_update_returns_200(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        response = client.post("/webhook/telegram", json=NON_TEXT_UPDATE)
        assert response.status_code == 200
        assert response.json() == {"ok": True}

    def test_empty_update_no_message_returns_200(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        response = client.post("/webhook/telegram", json=EMPTY_UPDATE)
        assert response.status_code == 200

    def test_invalid_json_returns_200(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        response = client.post(
            "/webhook/telegram",
            content=b"not json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 200
