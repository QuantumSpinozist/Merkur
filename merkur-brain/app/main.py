"""FastAPI application entry point for merkur-brain."""

import logging

from dotenv import load_dotenv
from fastapi import FastAPI

from app.routers import telegram

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

app = FastAPI(title="merkur-brain", version="0.1.0")

app.include_router(telegram.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
