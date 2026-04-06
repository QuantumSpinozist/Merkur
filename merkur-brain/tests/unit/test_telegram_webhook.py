"""Unit tests for the Telegram webhook handler."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

EMPTY_UPDATE = {"update_id": 1}


def _text_update(text: str) -> dict:
    return {
        "update_id": 1,
        "message": {
            "message_id": 42,
            "from": {"id": 999, "first_name": "Aaron"},
            "chat": {"id": 999, "type": "private"},
            "text": text,
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


class TestCommandHandling:
    def test_start_command_returns_200(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mocker: pytest.fixture,  # type: ignore[type-arg]
    ) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        mocker.patch("app.routers.telegram.tg_service.send_message")
        response = client.post("/webhook/telegram", json=_text_update("/start"))
        assert response.status_code == 200
        assert response.json() == {"ok": True}

    def test_help_command_returns_200(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mocker: pytest.fixture,  # type: ignore[type-arg]
    ) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        mocker.patch("app.routers.telegram.tg_service.send_message")
        response = client.post("/webhook/telegram", json=_text_update("/help"))
        assert response.status_code == 200

    def test_unknown_command_returns_200(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mocker: pytest.fixture,  # type: ignore[type-arg]
    ) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        mocker.patch("app.routers.telegram.tg_service.send_message")
        response = client.post("/webhook/telegram", json=_text_update("/unknowncmd"))
        assert response.status_code == 200

    def test_note_command_without_text_returns_200(
        self,
        monkeypatch: pytest.MonkeyPatch,
        mocker: pytest.fixture,  # type: ignore[type-arg]
    ) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        mocker.patch("app.routers.telegram.tg_service.send_message")
        response = client.post("/webhook/telegram", json=_text_update("/note"))
        assert response.status_code == 200


class TestMessageHandling:
    def test_non_text_update_returns_200(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("TELEGRAM_WEBHOOK_SECRET", raising=False)
        response = client.post(
            "/webhook/telegram",
            json={
                "update_id": 2,
                "message": {
                    "message_id": 43,
                    "from": {"id": 999, "first_name": "Aaron"},
                    "chat": {"id": 999, "type": "private"},
                },
            },
        )
        assert response.status_code == 200
        assert response.json() == {"ok": True}

    def test_empty_update_returns_200(self, monkeypatch: pytest.MonkeyPatch) -> None:
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
