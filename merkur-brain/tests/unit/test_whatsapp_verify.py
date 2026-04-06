"""Unit tests for the WhatsApp webhook verification (GET handler)."""

import hashlib
import hmac

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestGetVerification:
    def test_valid_token_returns_challenge(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "my-secret-token")
        response = client.get(
            "/webhook/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "my-secret-token",
                "hub.challenge": "challenge-abc-123",
            },
        )
        assert response.status_code == 200
        assert response.text == "challenge-abc-123"

    def test_wrong_token_returns_403(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "correct-token")
        response = client.get(
            "/webhook/whatsapp",
            params={
                "hub.mode": "subscribe",
                "hub.verify_token": "wrong-token",
                "hub.challenge": "irrelevant",
            },
        )
        assert response.status_code == 403

    def test_missing_mode_returns_403(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "my-secret-token")
        response = client.get(
            "/webhook/whatsapp",
            params={
                "hub.verify_token": "my-secret-token",
                "hub.challenge": "challenge",
            },
        )
        assert response.status_code == 403


class TestSignatureVerification:
    """Tests for the _verify_signature helper via the POST endpoint."""

    def _make_signature(self, body: bytes, secret: str) -> str:
        return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    def test_valid_signature_passes(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("WHATSAPP_APP_SECRET", "test-secret")
        body = b'{"object":"whatsapp_business_account","entry":[]}'
        sig = self._make_signature(body, "test-secret")
        response = client.post(
            "/webhook/whatsapp",
            content=body,
            headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig},
        )
        # Payload is valid JSON but has no messages — should return 200 ok
        assert response.status_code == 200

    def test_invalid_signature_returns_403(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("WHATSAPP_APP_SECRET", "test-secret")
        body = b'{"object":"whatsapp_business_account","entry":[]}'
        response = client.post(
            "/webhook/whatsapp",
            content=body,
            headers={
                "Content-Type": "application/json",
                "X-Hub-Signature-256": "sha256=invalidsignature",
            },
        )
        assert response.status_code == 403

    def test_no_secret_env_skips_check(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
        body = b'{"object":"whatsapp_business_account","entry":[]}'
        response = client.post(
            "/webhook/whatsapp",
            content=body,
            headers={"Content-Type": "application/json"},
        )
        # No secret configured → signature check skipped → proceeds normally
        assert response.status_code == 200
