"""FastAPI application entry point for merkur-brain."""

import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

from app.routers import cleanup, telegram
from app.services import scheduler as scheduler_service
from app.services.telegram import set_commands

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    try:
        await set_commands()
    except Exception as exc:
        logger.warning("Could not register bot commands on startup: %s", exc)
    try:
        await scheduler_service.start()
    except Exception as exc:
        logger.warning("Could not start scheduler: %s", exc)
    yield
    await scheduler_service.stop()


app = FastAPI(title="merkur-brain", version="0.1.0", lifespan=lifespan)

app.include_router(telegram.router)
app.include_router(cleanup.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
