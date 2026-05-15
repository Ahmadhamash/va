import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_admin
from models import ChatSession, Item, Message, StyleSample, User
from schemas.chat import MessageOut, SessionOut
from schemas.item import ItemOut
from schemas.user import ActiveUpdate, ClientSummary, PersonaUpdate, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])


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
