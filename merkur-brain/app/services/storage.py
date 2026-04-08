"""Supabase Storage helpers — image upload from Telegram-received files."""

import logging
import os
import uuid

from supabase import Client, create_client

logger = logging.getLogger(__name__)

BUCKET = "note-images"


def get_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


async def upload_image(data: bytes, ext: str = "jpg") -> str:
    """Upload raw image bytes to Supabase Storage and return the public URL.

    Args:
        data: Raw image bytes.
        ext: File extension without the leading dot (e.g. "jpg", "png").

    Returns:
        Public URL of the uploaded image.
    """
    client = get_client()
    filename = f"{uuid.uuid4()}.{ext}"
    path = f"telegram/{filename}"
    content_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"

    client.storage.from_(BUCKET).upload(
        path,
        data,
        {"content-type": content_type},
    )

    url: str = client.storage.from_(BUCKET).get_public_url(path)
    logger.info("Uploaded image to Storage: %s", path)
    return url
