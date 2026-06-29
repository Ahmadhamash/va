import asyncio
import logging
import secrets
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models import ChannelIntegration, User

logger = logging.getLogger("openwa_service")

READY_STATUSES = {"ready", "authenticated"}


class OpenWAStartError(RuntimeError):
    pass


def _client_only(user: User) -> None:
    if user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="WhatsApp Web linking is available for client accounts only.",
        )


def _openwa_api_url() -> str:
    return (settings.OPENWA_API_URL or "http://openwa:2785").rstrip("/")


def _openwa_headers() -> dict[str, str]:
    api_key = (settings.OPENWA_API_KEY or "").strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenWA is not configured.",
        )
    return {"X-API-Key": api_key}


def _public_base_url() -> str:
    domain = (settings.DOMAIN or "").strip().rstrip("/")
    if not domain:
        return ""
    if domain.startswith(("http://", "https://")):
        return domain
    return f"https://{domain}"


def _session_name(user: User, credentials: dict[str, Any]) -> str:
    existing = str(credentials.get("openwa_session_name") or "").strip()
    if existing:
        return existing[:50]
    return f"wa-{user.id.hex}"[:50]


def _replacement_session_name(user: User) -> str:
    return f"wa-{user.id.hex[:26]}-{secrets.token_hex(4)}"[:50]


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


async def _get_or_create_integration(
    user: User, db: AsyncSession
) -> ChannelIntegration:
    result = await db.execute(
        select(ChannelIntegration)
        .where(
            ChannelIntegration.user_id == user.id,
            ChannelIntegration.platform == "webhook",
        )
        .order_by(ChannelIntegration.created_at.asc())
        .limit(1)
    )
    integration = result.scalar_one_or_none()
    if integration is not None:
        return integration

    integration = ChannelIntegration(
        user_id=user.id,
        platform="webhook",
        public_id=secrets.token_urlsafe(24),
        credentials={"webhook_secret": secrets.token_urlsafe(24)},
        is_active=True,
    )
    db.add(integration)
    await db.flush()
    return integration


async def _openwa_json(
    client: httpx.AsyncClient,
    method: str,
    path: str,
    *,
    json: dict[str, Any] | None = None,
    ok_statuses: set[int] | None = None,
) -> tuple[int, Any]:
    response = await client.request(method, path, json=json)
    if ok_statuses and response.status_code in ok_statuses:
        try:
            return response.status_code, response.json()
        except ValueError:
            return response.status_code, {}
    if response.is_error:
        logger.warning(
            "OpenWA request failed: %s %s -> %s %s",
            method,
            path,
            response.status_code,
            response.text[:300],
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="OpenWA did not accept the request.",
        )
    try:
        return response.status_code, response.json()
    except ValueError:
        return response.status_code, {}


async def _find_session(
    client: httpx.AsyncClient, session_id: str | None, name: str
) -> dict[str, Any] | None:
    if session_id:
        response = await client.get(f"/api/sessions/{session_id}")
        if response.status_code == 200:
            return response.json()
        if response.status_code not in (404, 400):
            response.raise_for_status()

    _, sessions = await _openwa_json(client, "GET", "/api/sessions")
    if isinstance(sessions, list):
        for session in sessions:
            if session.get("name") == name:
                return session
    return None


async def _get_or_create_session(
    client: httpx.AsyncClient, session_id: str | None, name: str
) -> dict[str, Any]:
    session = await _find_session(client, session_id, name)
    if session is not None:
        return session

    _, session = await _openwa_json(
        client,
        "POST",
        "/api/sessions",
        json={"name": name, "config": {"autoReconnect": True}},
        ok_statuses={200, 201, 409},
    )
    if isinstance(session, dict) and session.get("id"):
        return session

    found = await _find_session(client, None, name)
    if found is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not create an OpenWA session.",
        )
    return found


async def _persist_openwa_credentials(
    db: AsyncSession,
    integration: ChannelIntegration,
    credentials: dict[str, Any],
    *,
    webhook_secret: str,
    session_id: str,
    session_name: str,
) -> None:
    if not str(credentials.get("webhook_secret") or "").strip():
        credentials["webhook_secret"] = secrets.token_urlsafe(24)
    credentials["openwa_webhook_secret"] = webhook_secret
    credentials["openwa_api_url"] = _openwa_api_url()
    credentials["openwa_api_key"] = settings.OPENWA_API_KEY
    credentials["openwa_session_id"] = session_id
    credentials["openwa_session_name"] = session_name
    credentials["openwa_allow_groups"] = _as_bool(credentials.get("openwa_allow_groups", False))
    integration.credentials = credentials
    integration.is_active = True
    await db.commit()
    await db.refresh(integration)


async def _ensure_openwa_webhook(
    client: httpx.AsyncClient,
    session_id: str,
    public_id: str,
    webhook_secret: str,
) -> None:
    base = _public_base_url()
    if not base:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Public domain is not configured.",
        )
    target_url = f"{base}/api/webhooks/openwa/{public_id}"
    body = {
        "url": target_url,
        "events": ["message.received"],
        "secret": webhook_secret,
        "retryCount": 3,
    }

    _, hooks = await _openwa_json(client, "GET", f"/api/sessions/{session_id}/webhooks")
    existing = None
    if isinstance(hooks, list):
        existing = next((hook for hook in hooks if hook.get("url") == target_url), None)

    if existing and existing.get("id"):
        await _openwa_json(
            client,
            "PUT",
            f"/api/sessions/{session_id}/webhooks/{existing['id']}",
            json=body,
        )
        return

    await _openwa_json(
        client,
        "POST",
        f"/api/sessions/{session_id}/webhooks",
        json=body,
        ok_statuses={200, 201},
    )


async def _start_session(client: httpx.AsyncClient, session_id: str) -> None:
    response = await client.post(f"/api/sessions/{session_id}/start")
    if response.status_code in (200, 201, 400):
        return
    logger.warning(
        "OpenWA session start failed: %s -> %s %s",
        session_id,
        response.status_code,
        response.text[:300],
    )
    raise OpenWAStartError(f"OpenWA start failed with HTTP {response.status_code}")


async def _stop_session(client: httpx.AsyncClient, session_id: str) -> None:
    response = await client.post(f"/api/sessions/{session_id}/stop")
    if response.status_code in (200, 201, 400, 404):
        return
    response.raise_for_status()


async def _read_qr(client: httpx.AsyncClient, session_id: str) -> str | None:
    response = await client.get(f"/api/sessions/{session_id}/qr")
    if response.status_code == 200:
        data = response.json()
        qr_code = data.get("qrCode")
        return qr_code if isinstance(qr_code, str) else None
    if response.status_code in (400, 404):
        return None
    response.raise_for_status()
    return None


async def openwa_link_state(
    user: User,
    db: AsyncSession,
    *,
    ensure_started: bool = False,
    force_refresh: bool = False,
) -> dict[str, Any]:
    _client_only(user)
    integration = await _get_or_create_integration(user, db)
    credentials = dict(integration.credentials or {})

    webhook_secret = str(
        credentials.get("openwa_webhook_secret")
        or secrets.token_urlsafe(32)
    )
    session_name = _session_name(user, credentials)
    session_id = str(credentials.get("openwa_session_id") or "").strip() or None

    async with httpx.AsyncClient(
        base_url=_openwa_api_url(),
        headers=_openwa_headers(),
        timeout=30,
    ) as client:
        session = await _get_or_create_session(client, session_id, session_name)
        session_id = str(session["id"])
        status_value = str(session.get("status") or "created")

        await _persist_openwa_credentials(
            db,
            integration,
            credentials,
            webhook_secret=webhook_secret,
            session_id=session_id,
            session_name=session_name,
        )

        await _ensure_openwa_webhook(client, session_id, integration.public_id, webhook_secret)

        async def start_with_replacement() -> None:
            nonlocal session, session_id, session_name, status_value, credentials

            try:
                await _start_session(client, session_id)
                return
            except OpenWAStartError as first_error:
                logger.warning(
                    "Replacing failed OpenWA session %s for user %s",
                    session_id,
                    user.id,
                )

            session_name = _replacement_session_name(user)
            session = await _get_or_create_session(client, None, session_name)
            session_id = str(session["id"])
            status_value = str(session.get("status") or "created")
            credentials = dict(integration.credentials or {})

            await _persist_openwa_credentials(
                db,
                integration,
                credentials,
                webhook_secret=webhook_secret,
                session_id=session_id,
                session_name=session_name,
            )
            await _ensure_openwa_webhook(client, session_id, integration.public_id, webhook_secret)

            try:
                await _start_session(client, session_id)
            except OpenWAStartError as retry_error:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="OpenWA could not start a fresh WhatsApp session.",
                ) from retry_error

        if force_refresh and status_value not in READY_STATUSES:
            await _stop_session(client, session_id)
            await asyncio.sleep(0.8)
            await start_with_replacement()
            await asyncio.sleep(2.0)
        elif ensure_started and status_value not in READY_STATUSES:
            await start_with_replacement()
            await asyncio.sleep(1.5)

        fresh = await _find_session(client, session_id, session_name) or session
        status_value = str(fresh.get("status") or status_value)
        qr_code = None if status_value in READY_STATUSES else await _read_qr(client, session_id)

    return {
        "configured": True,
        "connected": status_value in READY_STATUSES,
        "status": status_value,
        "qr_code": qr_code,
        "session_id": session_id,
        "session_name": session_name,
        "public_id": integration.public_id,
        "refresh_after_seconds": 18 if qr_code else 8,
    }
