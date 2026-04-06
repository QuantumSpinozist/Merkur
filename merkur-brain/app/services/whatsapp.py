"""Outbound WhatsApp message sender (thin wrapper around Meta Cloud API)."""

import logging
import os

import httpx

logger = logging.getLogger(__name__)

WHATSAPP_API_URL = "https://graph.facebook.com/v19.0"


async def send_message(to: str, text: str) -> None:
    """Send a text message to a WhatsApp number via the Cloud API."""
    phone_number_id = os.environ["WHATSAPP_PHONE_NUMBER_ID"]
    access_token = os.environ["WHATSAPP_ACCESS_TOKEN"]

    url = f"{WHATSAPP_API_URL}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text},
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        if response.status_code != 200:
            logger.error(
                "WhatsApp send failed: %s %s", response.status_code, response.text
            )
        else:
            logger.info("WhatsApp message sent to %s.", to)
