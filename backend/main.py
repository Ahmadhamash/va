import logging
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Response, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from services.file_service import (
    resolve_path,
    owner_id_from_path,
    verify_media_access_token,
    _AUDIO_MIME_BY_EXT,
    _IMAGE_MIME_BY_EXT,
)
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pythonjsonlogger import jsonlogger
from asgi_correlation_id import CorrelationIdMiddleware, correlation_id

from config import settings
from database import get_db
from models import User
from routers import admin, auth, automation, billing, bookings, channels, chat, delivery, escalations, handoff, items, offers, onboarding, openwa, policies, style, verification_logs, voice_settings, vapi_voice, webhooks, workflows, catalog_import
from services.business_templates import list_business_types
from services.auth_service import decode_access_token
from services.ratelimit import limiter
import sentry_sdk

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
    )

logHandler = logging.StreamHandler()
class CustomJsonFormatter(jsonlogger.JsonFormatter):
    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record['correlation_id'] = correlation_id.get()

formatter = CustomJsonFormatter('%(asctime)s %(levelname)s %(name)s %(correlation_id)s %(message)s')
logHandler.setFormatter(formatter)
logging.basicConfig(level=logging.INFO, handlers=[logHandler])
logger = logging.getLogger("app")

MAX_BODY_BYTES = (settings.MAX_FILE_SIZE_MB + 5) * 1024 * 1024


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    logger.info("Starting AI Business Assistant API (env=%s)", settings.APP_ENV)
    yield


app = FastAPI(title="AI Business Assistant API", version="2.0.0", lifespan=lifespan)

# Rate limiting (Redis-backed, shared across instances)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Reject oversized bodies early (protects memory under load)
        cl = request.headers.get("content-length")
        if cl and cl.isdigit() and int(cl) > MAX_BODY_BYTES:
            return JSONResponse(
                status_code=413, content={"detail": "Request body too large"}
            )
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CorrelationIdMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Please try again."},
    )


# ─── All API routes under /api prefix ────────────────────────────────────────
api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router)
api_router.include_router(items.router)
api_router.include_router(catalog_import.router)
api_router.include_router(chat.router)
api_router.include_router(admin.router)
api_router.include_router(style.router)
api_router.include_router(channels.router)
api_router.include_router(delivery.router)
api_router.include_router(escalations.router)
api_router.include_router(policies.router)
api_router.include_router(offers.router)
api_router.include_router(onboarding.router)
api_router.include_router(openwa.router)
api_router.include_router(bookings.router)
api_router.include_router(workflows.router)
api_router.include_router(billing.router)
api_router.include_router(webhooks.router)  # public — routed by unguessable public_id
api_router.include_router(handoff.router)
api_router.include_router(verification_logs.router)
api_router.include_router(voice_settings.router)
api_router.include_router(vapi_voice.router)
api_router.include_router(automation.router)


@api_router.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


@api_router.get("/business-types", tags=["templates"])
async def business_types():
    return list_business_types()


app.include_router(api_router)


async def _upload_access_allowed(
    request: Request,
    path: str,
    db: AsyncSession,
) -> bool:
    media_token = request.query_params.get("media_token")
    if verify_media_access_token(media_token, path):
        return True

    token = request.query_params.get("access_token")
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return False

    payload = decode_access_token(token)
    if not payload:
        return False
    try:
        user_id = payload.get("sub")
        user_uuid = owner_id_from_path(path)
        current_user_id = uuid.UUID(user_id) if user_id else None
    except (TypeError, ValueError):
        return False

    result = await db.execute(select(User).where(User.id == current_user_id))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        return False
    if payload.get("v") != user.token_version:
        return False
    if user.role in ("admin", "support_agent"):
        return True
    return user_uuid is not None and user_uuid == user.id


@app.get("/api/uploads/{path:path}")
async def serve_upload(
    path: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if not await _upload_access_allowed(request, path, db):
        raise HTTPException(status_code=403, detail="Not authorized")
    try:
        data = resolve_path(path).read_bytes()
        ext = Path(path).suffix.lower()
        mime = _IMAGE_MIME_BY_EXT.get(
            ext, _AUDIO_MIME_BY_EXT.get(ext, "application/octet-stream")
        )
        return Response(content=data, media_type=mime)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
