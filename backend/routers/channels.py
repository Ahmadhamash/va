import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import ChannelIntegration, User
from schemas.channel import PLATFORMS, ChannelCreate, ChannelOut

router = APIRouter(prefix="/channels", tags=["channels"])


def _endpoints(platform: str, public_id: str) -> dict:
    if platform in ("messenger", "instagram"):
        return {
            "callback_url": f"/webhooks/meta/{public_id}",
            "note": "Use this as the Meta webhook Callback URL (GET verify + "
            "POST events). Set the same verify_token in Meta and here.",
        }
    if platform == "webhook":
        return {
            "inbound_url": f"/webhooks/generic/{public_id}",
            "note": "POST {\"sender_id\": \"...\", \"message\": \"...\"} → "
            "{\"reply\": \"...\"}. Send X-Webhook-Secret if you set one.",
        }
    if platform == "widget":
        return {
            "script_url": f"/widget/{public_id}.js",
            "message_url": f"/webhooks/widget/{public_id}/message",
            "note": "Embed the script tag on any site to add a chat bubble.",
        }
    return {}


def _to_out(ci: ChannelIntegration) -> ChannelOut:
    out = ChannelOut.model_validate(ci)
    out.configured_keys = sorted(
        k for k, v in (ci.credentials or {}).items() if v
    )
    out.endpoints = _endpoints(ci.platform, ci.public_id)
    return out


@router.post("", response_model=ChannelOut, status_code=status.HTTP_201_CREATED)
async def create_channel(
    payload: ChannelCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Channels belong to client accounts",
        )
    if payload.platform not in PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"platform must be one of {sorted(PLATFORMS)}",
        )

    integration = ChannelIntegration(
        user_id=current_user.id,
        platform=payload.platform,
        public_id=secrets.token_urlsafe(24),
        credentials=payload.credentials or {},
    )
    db.add(integration)
    await db.commit()
    await db.refresh(integration)
    return _to_out(integration)


@router.get("", response_model=list[ChannelOut])
async def list_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(ChannelIntegration)
        .where(ChannelIntegration.user_id == current_user.id)
        .order_by(ChannelIntegration.created_at.desc())
    )
    return [_to_out(c) for c in rows.scalars().all()]


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
