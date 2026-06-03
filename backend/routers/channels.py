import logging
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from middleware.auth_middleware import get_current_user
from models import ChannelIntegration, User
from schemas.channel import PLATFORMS, ChannelCreate, ChannelOut

router = APIRouter(prefix="/channels", tags=["channels"])
logger = logging.getLogger("channels")

META_GRAPH_VERSION = "v21.0"
META_OAUTH_BASE = f"https://www.facebook.com/{META_GRAPH_VERSION}/dialog/oauth"
META_GRAPH_BASE = f"https://graph.facebook.com/{META_GRAPH_VERSION}"

META_SCOPES = {
    "messenger": [
        "pages_show_list",
        "pages_manage_metadata",
        "pages_messaging",
    ],
    "instagram": [
        "pages_show_list",
        "pages_manage_metadata",
        "pages_messaging",
        "instagram_basic",
        "instagram_manage_messages",
        "business_management",
    ],
}


def _external_base_url() -> str:
    domain = (settings.DOMAIN or "").strip().rstrip("/")
    if not domain:
        return ""
    if domain.startswith(("http://", "https://")):
        return domain
    return f"https://{domain}"


def _meta_redirect_uri() -> str:
    configured = (settings.META_OAUTH_REDIRECT_URI or "").strip()
    if configured:
        return configured
    base = _external_base_url()
    if not base:
        return ""
    return f"{base}/api/channels/meta/oauth/callback"


def _oauth_success_url(platform: str, status_value: str, message: str = "") -> str:
    base = (settings.META_OAUTH_SUCCESS_URL or "").strip()
    if not base:
        base = f"{_external_base_url()}/dashboard" if _external_base_url() else "/dashboard"
    separator = "&" if "?" in base else "?"
    query = urlencode(
        {
            "channel": platform,
            "channel_status": status_value,
            **({"message": message[:180]} if message else {}),
        }
    )
    return f"{base}{separator}{query}"


def _endpoints(platform: str, public_id: str) -> dict:
    if platform in ("messenger", "instagram"):
        return {
            "callback_url": f"/api/webhooks/meta/{public_id}",
            "note": "Use this as the Meta webhook Callback URL (GET verify + "
            "POST events). Set the same verify_token in Meta and here.",
        }
    if platform == "whatsapp":
        return {
            "callback_url": f"/api/webhooks/whatsapp/{public_id}",
            "note": "Use this as the WhatsApp webhook Callback URL. Set the same verify_token in Meta and here.",
        }
    if platform == "webhook":
        return {
            "inbound_url": f"/api/webhooks/generic/{public_id}",
            "note": "POST {\"sender_id\": \"...\", \"message\": \"...\"} -> "
            "{\"reply\": \"...\"}. Send X-Webhook-Secret if you set one.",
        }
    if platform == "widget":
        return {
            "script_url": f"/api/widget/{public_id}.js",
            "message_url": f"/api/webhooks/widget/{public_id}/message",
            "note": "Embed the script tag on any site to add a chat bubble.",
        }
    return {}


def _to_out(ci: ChannelIntegration) -> ChannelOut:
    credentials = ci.credentials or {}
    out = ChannelOut.model_validate(ci)
    out.configured_keys = sorted(
        k for k, v in credentials.items() if v
    )
    out.setup_values = {
        key: credentials[key]
        for key in ("verify_token", "webhook_secret")
        if credentials.get(key)
    }
    out.endpoints = _endpoints(ci.platform, ci.public_id)
    return out


def _client_only(user: User) -> None:
    if user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Channels belong to client accounts",
        )


async def _subscribe_meta_page(
    client: httpx.AsyncClient,
    page_id: str,
    page_access_token: str,
    platform: str,
) -> dict:
    fields = "messages,messaging_postbacks,message_deliveries,message_reads"
    if platform == "instagram":
        fields = "messages,messaging_postbacks"

    response = await client.post(
        f"{META_GRAPH_BASE}/{page_id}/subscribed_apps",
        params={
            "subscribed_fields": fields,
            "access_token": page_access_token,
        },
    )
    try:
        data = response.json()
    except ValueError:
        data = {"raw": response.text}

    return {
        "ok": response.is_success,
        "status_code": response.status_code,
        "fields": fields,
        "response": data,
    }


@router.post("", response_model=ChannelOut, status_code=status.HTTP_201_CREATED)
async def create_channel(
    payload: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _client_only(current_user)
    if payload.platform not in PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"platform must be one of {sorted(PLATFORMS)}",
        )

    credentials = payload.credentials or {}
    if payload.platform in ("messenger", "instagram", "whatsapp"):
        credentials.setdefault("verify_token", secrets.token_urlsafe(24))
    if payload.platform == "webhook":
        credentials.setdefault("webhook_secret", secrets.token_urlsafe(24))

    integration = ChannelIntegration(
        user_id=current_user.id,
        platform=payload.platform,
        public_id=secrets.token_urlsafe(24),
        credentials=credentials,
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return _to_out(integration)


@router.get("", response_model=list[ChannelOut])
async def list_channels(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ChannelIntegration)
        .where(ChannelIntegration.user_id == current_user.id)
        .order_by(ChannelIntegration.created_at.desc())
        .offset(skip).limit(limit)
    )
    return [_to_out(c) for c in rows.scalars().all()]


@router.get("/meta/oauth/start")
async def meta_oauth_start(
    platform: str = Query(..., pattern="^(messenger|instagram)$"),
    current_user: User = Depends(get_current_user),
):
    _client_only(current_user)
    redirect_uri = _meta_redirect_uri()
    if not settings.META_APP_ID or not settings.META_APP_SECRET or not redirect_uri:
        return {
            "configured": False,
            "manual_available": True,
            "platform": platform,
            "reason": "Meta OAuth needs META_APP_ID, META_APP_SECRET, and a public redirect URI.",
        }

    now = datetime.now(timezone.utc)
    state = jwt.encode(
        {
            "type": "meta_oauth",
            "sub": str(current_user.id),
            "platform": platform,
            "iat": now,
            "exp": now + timedelta(minutes=10),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    auth_params = {
        'client_id': settings.META_APP_ID,
        'redirect_uri': redirect_uri,
        'state': state,
        'response_type': 'code',
        'scope': ','.join(META_SCOPES[platform]),
    }
    auth_url = f"{META_OAUTH_BASE}?{urlencode(auth_params)}"
    return {
        "configured": True,
        "manual_available": True,
        "platform": platform,
        "auth_url": auth_url,
        "scopes": META_SCOPES[platform],
        "redirect_uri": redirect_uri,
    }


@router.get("/meta/oauth/callback", include_in_schema=False)
async def meta_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if error:
        platform = "meta"
        return RedirectResponse(
            _oauth_success_url(platform, "failed", error_description or error),
            status_code=status.HTTP_302_FOUND,
        )
    if not code or not state:
        return RedirectResponse(
            _oauth_success_url("meta", "failed", "Missing OAuth code or state."),
            status_code=status.HTTP_302_FOUND,
        )

    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "meta_oauth":
            raise ValueError("invalid state type")
        user_id = uuid.UUID(payload["sub"])
        platform = payload["platform"]
        if platform not in ("messenger", "instagram"):
            raise ValueError("invalid platform")
    except (jwt.PyJWTError, ValueError, KeyError, TypeError):
        return RedirectResponse(
            _oauth_success_url("meta", "failed", "Invalid or expired OAuth state."),
            status_code=status.HTTP_302_FOUND,
        )

    user = await db.get(User, user_id)
    if user is None or user.role != "client" or not user.is_active:
        return RedirectResponse(
            _oauth_success_url(platform, "failed", "Client account is unavailable."),
            status_code=status.HTTP_302_FOUND,
        )

    redirect_uri = _meta_redirect_uri()
    if not redirect_uri:
        return RedirectResponse(
            _oauth_success_url(platform, "failed", "Meta redirect URI is not configured."),
            status_code=status.HTTP_302_FOUND,
        )

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            token_response = await client.get(
                f"{META_GRAPH_BASE}/oauth/access_token",
                params={
                    "client_id": settings.META_APP_ID,
                    "client_secret": settings.META_APP_SECRET,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
            )
            token_response.raise_for_status()
            token_data = token_response.json()
            user_access_token = token_data["access_token"]

            pages_response = await client.get(
                f"{META_GRAPH_BASE}/me/accounts",
                params={
                    "fields": "id,name,access_token,instagram_business_account{id,username}",
                    "access_token": user_access_token,
                },
            )
            pages_response.raise_for_status()
            pages = pages_response.json().get("data", [])

            selected_page = None
            for page in pages:
                if platform == "instagram":
                    if page.get("access_token") and page.get("instagram_business_account"):
                        selected_page = page
                        break
                elif page.get("access_token"):
                    selected_page = page
                    break

            if not selected_page:
                return RedirectResponse(
                    _oauth_success_url(
                        platform,
                        "failed",
                        "No eligible Facebook Page or linked Instagram professional account was found.",
                    ),
                    status_code=status.HTTP_302_FOUND,
                )

            page_id = selected_page["id"]
            page_access_token = selected_page["access_token"]
            subscription_result = await _subscribe_meta_page(
                client, page_id, page_access_token, platform
            )
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.warning("Meta OAuth callback failed: %s", exc)
        return RedirectResponse(
            _oauth_success_url(platform, "failed", "Meta OAuth exchange failed."),
            status_code=status.HTTP_302_FOUND,
        )

    existing = await db.execute(
        select(ChannelIntegration)
        .where(
            ChannelIntegration.user_id == user.id,
            ChannelIntegration.platform == platform,
        )
        .order_by(ChannelIntegration.created_at.desc())
        .limit(1)
    )
    integration = existing.scalar_one_or_none()
    if integration is None:
        integration = ChannelIntegration(
            user_id=user.id,
            platform=platform,
            public_id=secrets.token_urlsafe(24),
        )
        db.add(integration)

    instagram_account = selected_page.get("instagram_business_account") or {}
    credentials = {
        **(integration.credentials or {}),
        "app_secret": settings.META_APP_SECRET,
        "verify_token": (integration.credentials or {}).get("verify_token")
        or secrets.token_urlsafe(24),
        "page_access_token": page_access_token,
        "page_id": page_id,
        "page_name": selected_page.get("name"),
        "meta_oauth": True,
        "linked_at": datetime.now(timezone.utc).isoformat(),
        "webhook_subscription": subscription_result,
    }
    if platform == "instagram":
        credentials.update(
            {
                "instagram_business_account_id": instagram_account.get("id"),
                "instagram_username": instagram_account.get("username"),
            }
        )

    integration.credentials = credentials
    integration.is_active = True
    await db.commit()

    redirect_status = "connected" if subscription_result.get("ok") else "needs_review"
    message = ""
    if redirect_status == "needs_review":
        message = "Meta connected, but webhook subscription still needs Meta permissions or manual setup."
    return RedirectResponse(
        _oauth_success_url(platform, redirect_status, message),
        status_code=status.HTTP_302_FOUND,
    )


async def _owned(
    channel_id: uuid.UUID, user: User, db: AsyncSession
) -> ChannelIntegration:
    result = await db.execute(
        select(ChannelIntegration).where(
            ChannelIntegration.id == channel_id,
            ChannelIntegration.user_id == user.id,
        )
    )
    ci = result.scalar_one_or_none()
    if ci is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found"
        )
    return ci


@router.patch("/{channel_id}/toggle", response_model=ChannelOut)
async def toggle_channel(
    channel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ci = await _owned(channel_id, current_user, db)
    ci.is_active = not ci.is_active
    await db.commit()
    await db.refresh(ci)
    return _to_out(ci)


@router.delete("/{channel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_channel(
    channel_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ci = await _owned(channel_id, current_user, db)
    await db.delete(ci)
    await db.commit()
