import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings as env_settings
from database import get_db
from middleware.auth_middleware import get_current_admin
from models import (
    ChannelIntegration,
    ChatSession,
    Item,
    Message,
    StyleSample,
    User,
)
from schemas.chat import MessageOut, SessionOut
from schemas.item import ItemOut
from schemas.settings import SettingsOut, SettingsUpdate, StatsOut
from schemas.user import (
    ActiveUpdate,
    ClientCreate,
    ClientSummary,
    PasswordReset,
    PersonaUpdate,
    UserOut,
)
from services.auth_service import hash_password
from services.settings_service import get_settings_row, invalidate_cache

router = APIRouter(prefix="/admin", tags=["admin"])


def _mask_key(key: str | None) -> str:
    if not key:
        return ""
    key = key.strip()
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:3]}…{key[-4:]}"


async def _get_client(client_id: uuid.UUID, db: AsyncSession) -> User:
    result = await db.execute(
        select(User).where(User.id == client_id, User.role == "client")
    )
    client = result.scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return client


@router.get("/clients", response_model=list[ClientSummary])
async def list_clients(
    q: str | None = Query(default=None, description="Search name/email/username"),
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    items_sq = (
        select(Item.user_id, func.count().label("c")).group_by(Item.user_id).subquery()
    )
    sessions_sq = (
        select(ChatSession.user_id, func.count().label("c"))
        .group_by(ChatSession.user_id)
        .subquery()
    )
    style_sq = (
        select(StyleSample.user_id, func.count().label("c"))
        .group_by(StyleSample.user_id)
        .subquery()
    )

    stmt = (
        select(
            User,
            func.coalesce(items_sq.c.c, 0),
            func.coalesce(sessions_sq.c.c, 0),
            func.coalesce(style_sq.c.c, 0),
        )
        .outerjoin(items_sq, items_sq.c.user_id == User.id)
        .outerjoin(sessions_sq, sessions_sq.c.user_id == User.id)
        .outerjoin(style_sq, style_sq.c.user_id == User.id)
        .where(User.role == "client")
        .order_by(User.created_at.desc())
    )
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                User.username.ilike(pattern),
                User.email.ilike(pattern),
                User.business_name.ilike(pattern),
            )
        )

    rows = (await db.execute(stmt)).all()
    out: list[ClientSummary] = []
    for user, item_c, sess_c, style_c in rows:
        summary = ClientSummary.model_validate(user)
        summary.item_count = item_c
        summary.session_count = sess_c
        summary.style_sample_count = style_c
        out.append(summary)
    return out


@router.get("/clients/{client_id}", response_model=ClientSummary)
async def get_client(
    client_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    summary = ClientSummary.model_validate(client)
    summary.item_count = await db.scalar(
        select(func.count()).select_from(Item).where(Item.user_id == client.id)
    )
    summary.session_count = await db.scalar(
        select(func.count())
        .select_from(ChatSession)
        .where(ChatSession.user_id == client.id)
    )
    summary.style_sample_count = await db.scalar(
        select(func.count())
        .select_from(StyleSample)
        .where(StyleSample.user_id == client.id)
    )
    return summary


@router.put("/clients/{client_id}/persona", response_model=UserOut)
async def set_client_persona(
    client_id: uuid.UUID,
    payload: PersonaUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    client.ai_persona = payload.ai_persona
    if payload.business_name is not None:
        client.business_name = payload.business_name
    await db.commit()
    await db.refresh(client)
    return client


@router.patch("/clients/{client_id}/active", response_model=UserOut)
async def set_client_active(
    client_id: uuid.UUID,
    payload: ActiveUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    client.is_active = payload.is_active
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/clients/{client_id}/items", response_model=list[ItemOut])
async def client_items(
    client_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_client(client_id, db)
    rows = await db.execute(
        select(Item).where(Item.user_id == client_id).order_by(Item.created_at.desc())
    )
    return list(rows.scalars().all())


@router.get("/clients/{client_id}/sessions", response_model=list[SessionOut])
async def client_sessions(
    client_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_client(client_id, db)
    rows = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == client_id)
        .order_by(ChatSession.created_at.desc())
    )
    return list(rows.scalars().all())


@router.get(
    "/clients/{client_id}/sessions/{session_id}/messages",
    response_model=list[MessageOut],
)
async def client_session_messages(
    client_id: uuid.UUID,
    session_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_client(client_id, db)
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == client_id
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    rows = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    return list(rows.scalars().all())


# ─── Platform stats ──────────────────────────────────────────────────────────
@router.get("/stats", response_model=StatsOut)
async def stats(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    clients = await db.scalar(
        select(func.count()).select_from(User).where(User.role == "client")
    )
    active = await db.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == "client", User.is_active.is_(True))
    )
    items = await db.scalar(select(func.count()).select_from(Item))
    sessions = await db.scalar(select(func.count()).select_from(ChatSession))
    messages = await db.scalar(select(func.count()).select_from(Message))
    style = await db.scalar(select(func.count()).select_from(StyleSample))
    channels = await db.scalar(
        select(func.count()).select_from(ChannelIntegration)
    )
    by_channel_rows = await db.execute(
        select(ChatSession.channel, func.count()).group_by(ChatSession.channel)
    )
    return StatsOut(
        clients=clients or 0,
        active_clients=active or 0,
        items=items or 0,
        sessions=sessions or 0,
        messages=messages or 0,
        style_samples=style or 0,
        channels=channels or 0,
        sessions_by_channel={c: n for c, n in by_channel_rows.all()},
    )


# ─── Client provisioning ─────────────────────────────────────────────────────
@router.post("/clients", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    exists = await db.execute(
        select(User).where(
            or_(User.username == payload.username, User.email == payload.email)
        )
    )
    if exists.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered",
        )
    client = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        business_name=payload.business_name,
        ai_persona=payload.ai_persona,
        role="client",
    )
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.post("/clients/{client_id}/reset-password", response_model=UserOut)
async def reset_client_password(
    client_id: uuid.UUID,
    payload: PasswordReset,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    client.hashed_password = hash_password(payload.new_password)
    await db.commit()
    await db.refresh(client)
    return client


# ─── Platform settings (API key / model / debounce) ──────────────────────────
@router.get("/settings", response_model=SettingsOut)
async def get_platform_settings(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await get_settings_row(db)
    db_key = (row.openai_api_key or "").strip()
    if db_key:
        source, masked = "database", _mask_key(db_key)
    elif env_settings.OPENAI_API_KEY:
        source, masked = "env", _mask_key(env_settings.OPENAI_API_KEY)
    else:
        source, masked = "none", ""
    return SettingsOut(
        openai_api_key_masked=masked,
        key_source=source,
        ai_model=row.ai_model,
        debounce_seconds=row.debounce_seconds,
    )


@router.put("/settings", response_model=SettingsOut)
async def update_platform_settings(
    payload: SettingsUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    row = await get_settings_row(db)
    if payload.openai_api_key is not None:
        row.openai_api_key = payload.openai_api_key.strip() or None
    if payload.ai_model is not None:
        row.ai_model = payload.ai_model.strip() or "gpt-4o"
    if payload.debounce_seconds is not None:
        row.debounce_seconds = payload.debounce_seconds
    await db.commit()
    await db.refresh(row)
    invalidate_cache()

    db_key = (row.openai_api_key or "").strip()
    if db_key:
        source, masked = "database", _mask_key(db_key)
    elif env_settings.OPENAI_API_KEY:
        source, masked = "env", _mask_key(env_settings.OPENAI_API_KEY)
    else:
        source, masked = "none", ""
    return SettingsOut(
        openai_api_key_masked=masked,
        key_source=source,
        ai_model=row.ai_model,
        debounce_seconds=row.debounce_seconds,
    )
