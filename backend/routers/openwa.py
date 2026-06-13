from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import User
from services.openwa_service import openwa_link_state

router = APIRouter(prefix="/openwa", tags=["openwa"])


@router.get("/session")
async def get_openwa_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await openwa_link_state(current_user, db, ensure_started=False)


@router.post("/session/start")
async def start_openwa_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await openwa_link_state(current_user, db, ensure_started=True)


@router.post("/session/refresh")
async def refresh_openwa_qr(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await openwa_link_state(current_user, db, ensure_started=True, force_refresh=True)
