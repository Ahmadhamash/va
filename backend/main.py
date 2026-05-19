import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings
from routers import admin, auth, bookings, channels, chat, delivery, escalations, items, offers, policies, style, webhooks, workflows
from services.business_templates import list_business_types
from services.ratelimit import limiter

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
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


app.include_router(auth.router)
app.include_router(items.router)
app.include_router(chat.router)
app.include_router(admin.router)
app.include_router(style.router)
app.include_router(channels.router)
app.include_router(delivery.router)
app.include_router(escalations.router)
app.include_router(policies.router)
app.include_router(offers.router)
app.include_router(bookings.router)
app.include_router(workflows.router)
app.include_router(webhooks.router)  # public — routed by unguessable public_id

_upload_dir = Path(settings.UPLOAD_DIR)
_upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_upload_dir)), name="uploads")


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


@app.get("/business-types", tags=["templates"])
async def business_types():
    return list_business_types()
