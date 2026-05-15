import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from routers import admin, auth, channels, chat, items, style, webhooks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info("Starting AI Business Assistant API (env=%s)", settings.APP_ENV)
    yield


app = FastAPI(
    title="AI Business Assistant API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Never leak internals to the client
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )


app.include_router(auth.router)
app.include_router(items.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(style.router)
app.include_router(channels.router)
app.include_router(webhooks.router)  # public — routed by unguessable public_id

# Serve uploaded media (read-only). Stored outside any web root and mounted here.
_upload_dir = Path(settings.UPLOAD_DIR)
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
