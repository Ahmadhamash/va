import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Response, HTTPException
from services.file_service import resolve_path, _AUDIO_MIME_BY_EXT, _IMAGE_MIME_BY_EXT
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pythonjsonlogger import jsonlogger
from asgi_correlation_id import CorrelationIdMiddleware, correlation_id

from config import settings
from routers import admin, auth, automation, billing, bookings, channels, chat, chatwoot, delivery, escalations, handoff, items, offers, policies, style, verification_logs, voice_settings, webhooks, workflows, catalog_import
from services.business_templates import list_business_types
from services.ratelimit import limiter
import sentry_sdk

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
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
api_router.include_router(bookings.router)
api_router.include_router(workflows.router)
api_router.include_router(billing.router)
api_router.include_router(webhooks.router)  # public — routed by unguessable public_id
api_router.include_router(chatwoot.router)
api_router.include_router(handoff.router)
api_router.include_router(verification_logs.router)
api_router.include_router(voice_settings.router)
api_router.include_router(automation.router)


@api_router.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


@api_router.get("/business-types", tags=["templates"])
async def business_types():
    return list_business_types()


app.include_router(api_router)



@app.get("/api/uploads/{path:path}")
async def serve_upload(path: str):
    try:
        data = resolve_path(path).read_bytes()
        ext = Path(path).suffix.lower()
        mime = _IMAGE_MIME_BY_EXT.get(
            ext, _AUDIO_MIME_BY_EXT.get(ext, "application/octet-stream")
        )
        return Response(content=data, media_type=mime)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
