from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import User
from schemas.onboarding import (
    ManyChatOnboardingRequest,
    ManyChatOnboardingStatus,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _client_only(user: User) -> None:
    if user.role != "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Onboarding belongs to client accounts",
        )


def _manychat_status(user: User) -> ManyChatOnboardingStatus:
    return ManyChatOnboardingStatus(
        manychat_setup_status=user.manychat_setup_status,
        fb_page_link=user.fb_page_link,
        ig_username=user.ig_username,
        wa_number=user.wa_number,
        manychat_admin_confirmed=user.manychat_admin_confirmed,
        manychat_setup_submitted_at=user.manychat_setup_submitted_at,
        manychat_setup_completed_at=user.manychat_setup_completed_at,
    )


@router.post("/manychat", response_model=ManyChatOnboardingStatus)
async def submit_manychat_onboarding(
    payload: ManyChatOnboardingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _client_only(current_user)
    if not payload.admin_added_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin access confirmation is required",
        )

    current_user.fb_page_link = payload.fb_page_link
    current_user.ig_username = payload.ig_username
    current_user.wa_number = payload.wa_number
    current_user.manychat_admin_confirmed = True
    current_user.manychat_setup_status = "pending_setup"
    current_user.manychat_setup_submitted_at = datetime.utcnow()
    current_user.manychat_setup_completed_at = None

    await db.commit()
    await db.refresh(current_user)
    return _manychat_status(current_user)


@router.get("/manychat/status", response_model=ManyChatOnboardingStatus)
async def get_manychat_onboarding_status(
    current_user: User = Depends(get_current_user),
):
    _client_only(current_user)
    return _manychat_status(current_user)
