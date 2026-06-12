import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as env_settings
from database import get_db
from middleware.auth_middleware import get_current_user
from models import User
from schemas.vapi_voice import (
    VapiCallSettingsOut,
    VapiCallSettingsUpdate,
    VoiceCallOut,
)
from services.vapi_voice import (
    get_or_create_call_settings,
    get_voice_call_for_user,
    handle_vapi_webhook,
    list_voice_calls,
)

router = APIRouter(tags=["vapi-voice"])


def _external_base_url() -> str:
    domain = (env_settings.DOMAIN or "").strip().rstrip("/")
    if not domain:
        return ""
    if domain.startswith(("http://", "https://")):
        return domain
    return f"https://{domain}"


def _webhook_url(public_id: str) -> str:
    base = _external_base_url()
    path = f"/api/vapi/webhook/{public_id}"
    return f"{base}{path}" if base else path


def _client_only(user: User) -> None:
    if user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Voice-call settings belong to client accounts",
        )


def _settings_out(row) -> VapiCallSettingsOut:
    data = VapiCallSettingsOut.model_validate(
        {
            **row.__dict__,
            "webhook_url": _webhook_url(row.public_id),
        }
    )
    return data


def _authenticate_vapi_request(request: Request) -> None:
    expected = (env_settings.VAPI_WEBHOOK_BEARER_TOKEN or "").strip()
    if not expected:
        return
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or token.strip() != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Vapi webhook credentials",
        )


@router.get("/calls/settings", response_model=VapiCallSettingsOut)
async def get_call_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _client_only(current_user)
    row = await get_or_create_call_settings(current_user.id, db)
    return _settings_out(row)


@router.put("/calls/settings", response_model=VapiCallSettingsOut)
async def update_call_settings(
    payload: VapiCallSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _client_only(current_user)
    row = await get_or_create_call_settings(current_user.id, db)
    updates = payload.model_dump(exclude_unset=True)

    valid_strategies = {"shared", "per_tenant"}
    if updates.get("assistant_strategy") and updates["assistant_strategy"] not in valid_strategies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"assistant_strategy must be one of {sorted(valid_strategies)}",
        )

    for key, value in updates.items():
        setattr(row, key, value)
    await db.commit()
    await db.refresh(row)
    return _settings_out(row)


@router.get("/calls", response_model=list[VoiceCallOut])
async def get_calls(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id
    rows = await list_voice_calls(user_id, db, skip=skip, limit=limit)
    return rows


@router.get("/calls/{call_id}", response_model=VoiceCallOut)
async def get_call(
    call_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await get_voice_call_for_user(call_id, current_user, db)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return row


@router.post("/vapi/webhook/{public_id}")
async def vapi_webhook(
    public_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    _authenticate_vapi_request(request)
    try:
        payload = await request.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        ) from exc

    try:
        return await handle_vapi_webhook(public_id, payload, db)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
