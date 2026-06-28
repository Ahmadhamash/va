import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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
    BusinessPolicy,
    BusinessWorkflow,
    AIVerificationLog,
    ClientPromptVersion,
)
from seed_test_store import seed_store
from schemas.chat import MessageOut, SessionOut
from schemas.item import ItemOut
from schemas.onboarding import ManyChatStatusUpdate
from schemas.prompt_settings import ClientPromptSettingsOut, ClientPromptSettingsUpdate
from schemas.settings import SettingsOut, SettingsUpdate, StatsOut, UsageSummaryOut
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
from services.business_templates import get_template
from services.prompt_settings import (
    PROMPT_FIELDS,
    activate_prompt_draft,
    ensure_initial_active_prompt_version,
    get_active_prompt_version,
    get_draft_prompt_version,
    get_or_create_prompt_settings,
    list_prompt_versions,
    prompt_settings_payload,
    rollback_to_prompt_version,
    save_prompt_draft,
    evaluate_prompt_draft,
)
from services.ai_usage import normalise_model, usage_summary_from_trace
from services.ai_persona_settings import sync_persona_settings_from_text

router = APIRouter(prefix="/admin", tags=["admin"])


class AIAutoReplyUpdate(BaseModel):
    enabled: bool


class OpenWASetupRequest(BaseModel):
    openwa_api_url: str | None = None
    openwa_api_key: str | None = None
    openwa_session_id: str | None = None
    allow_groups: bool = False


def _mask_key(key: str | None) -> str:
    if not key:
        return ""
    key = key.strip()
    if len(key) <= 8:
        return "•" * len(key)
    return f"{key[:3]}…{key[-4:]}"


def _public_base_url() -> str:
    domain = (env_settings.DOMAIN or "").strip().rstrip("/")
    if not domain:
        return "http://localhost:8000"
    if domain.startswith(("http://", "https://")):
        return domain
    local_hosts = ("localhost", "127.0.0.1", "0.0.0.0")
    scheme = "http" if domain.startswith(local_hosts) else "https"
    return f"{scheme}://{domain}"


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
    await sync_persona_settings_from_text(client, db)
    if payload.business_name is not None:
        client.business_name = payload.business_name
    await db.commit()
    await db.refresh(client)
    return client


async def _client_prompt_settings_response(
    *,
    client: User,
    db: AsyncSession,
) -> dict:
    row = await get_or_create_prompt_settings(client.id, db)
    active_version = await ensure_initial_active_prompt_version(
        user_id=client.id,
        row=row,
        db=db,
    )
    draft_version = await get_draft_prompt_version(client.id, db)
    versions = await list_prompt_versions(client.id, db)
    app_settings = await get_settings_row(db)
    return prompt_settings_payload(
        user=client,
        row=row,
        human_handoff_enabled=app_settings.human_handoff_enabled,
        active_version=active_version,
        draft_version=draft_version,
        versions=versions,
    )


def _prompt_update_payload(payload: ClientPromptSettingsUpdate) -> dict[str, str]:
    updates = payload.model_dump(exclude_unset=True)
    return {
        field: str(updates.get(field) or "").strip()
        for field in PROMPT_FIELDS
        if field in updates
    }


@router.get(
    "/clients/{client_id}/prompt-settings",
    response_model=ClientPromptSettingsOut,
)
async def get_client_prompt_settings(
    client_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    response = await _client_prompt_settings_response(client=client, db=db)
    await db.commit()
    return response


@router.put(
    "/clients/{client_id}/prompt-settings",
    response_model=ClientPromptSettingsOut,
)
async def update_client_prompt_settings(
    client_id: uuid.UUID,
    payload: ClientPromptSettingsUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    row = await get_or_create_prompt_settings(client.id, db)
    await ensure_initial_active_prompt_version(user_id=client.id, row=row, db=db)

    current = {
        field: getattr(row, field, None) or ""
        for field in PROMPT_FIELDS
    }
    current.update(_prompt_update_payload(payload))
    await save_prompt_draft(
        user_id=client.id,
        payload=current,
        db=db,
        admin_id=admin.id,
        title=payload.title,
        notes=payload.notes,
    )

    await db.commit()
    await db.refresh(client)
    return await _client_prompt_settings_response(client=client, db=db)


@router.post(
    "/clients/{client_id}/prompt-settings/test",
    response_model=ClientPromptSettingsOut,
)
async def test_client_prompt_settings(
    client_id: uuid.UUID,
    payload: ClientPromptSettingsUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    row = await get_or_create_prompt_settings(client.id, db)
    await ensure_initial_active_prompt_version(user_id=client.id, row=row, db=db)

    current = {
        field: getattr(row, field, None) or ""
        for field in PROMPT_FIELDS
    }
    current.update(_prompt_update_payload(payload))
    draft = await save_prompt_draft(
        user_id=client.id,
        payload=current,
        db=db,
        admin_id=admin.id,
        title=payload.title,
        notes=payload.notes,
    )
    await evaluate_prompt_draft(draft=draft, db=db)
    await db.commit()
    await db.refresh(client)
    return await _client_prompt_settings_response(client=client, db=db)


@router.post(
    "/clients/{client_id}/prompt-settings/activate",
    response_model=ClientPromptSettingsOut,
)
async def activate_client_prompt_settings(
    client_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    row = await get_or_create_prompt_settings(client.id, db)
    await ensure_initial_active_prompt_version(user_id=client.id, row=row, db=db)
    draft = await get_draft_prompt_version(client.id, db)
    if draft is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No draft prompt version to activate.",
        )
    try:
        await activate_prompt_draft(
            user_id=client.id,
            row=row,
            draft=draft,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    await db.commit()
    await db.refresh(client)
    return await _client_prompt_settings_response(client=client, db=db)


@router.post(
    "/clients/{client_id}/prompt-settings/versions/{version_id}/rollback",
    response_model=ClientPromptSettingsOut,
)
async def rollback_client_prompt_settings(
    client_id: uuid.UUID,
    version_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    row = await get_or_create_prompt_settings(client.id, db)
    await ensure_initial_active_prompt_version(user_id=client.id, row=row, db=db)
    target = await db.get(ClientPromptVersion, version_id)
    if target is None or target.user_id != client.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Prompt version not found.",
        )
    try:
        await rollback_to_prompt_version(
            user_id=client.id,
            row=row,
            target=target,
            db=db,
            admin_id=admin.id,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    await db.commit()
    await db.refresh(client)
    return await _client_prompt_settings_response(client=client, db=db)


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


@router.patch("/clients/{client_id}/ai-auto-reply", response_model=ClientSummary)
async def set_client_ai_auto_reply(
    client_id: uuid.UUID,
    payload: AIAutoReplyUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    client.ai_auto_reply_enabled = payload.enabled
    await db.commit()
    await db.refresh(client)
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
        select(func.count()).select_from(StyleSample).where(StyleSample.user_id == client.id)
    )
    return summary


@router.patch("/clients/{client_id}/manychat-status", response_model=ClientSummary)
async def set_client_manychat_status(
    client_id: uuid.UUID,
    payload: ManyChatStatusUpdate,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    client = await _get_client(client_id, db)
    client.manychat_setup_status = payload.manychat_setup_status
    if payload.manychat_setup_status == "completed":
        client.manychat_setup_completed_at = datetime.utcnow()
    else:
        client.manychat_setup_completed_at = None
    await db.commit()
    await db.refresh(client)
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
        select(func.count()).select_from(StyleSample).where(StyleSample.user_id == client.id)
    )
    return summary


@router.get("/clients/{client_id}/items", response_model=list[ItemOut])
async def client_items(
    client_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    await _get_client(client_id, db)
    rows = await db.execute(
        select(Item)
        .options(selectinload(Item.variants))
        .where(Item.user_id == client_id)
        .order_by(Item.created_at.desc())
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


@router.get("/usage", response_model=UsageSummaryOut)
async def usage(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    settings_row = await get_settings_row(db)
    active_model = settings_row.ai_model
    clients = list(
        (
            await db.execute(
                select(User)
                .where(User.role == "client")
                .order_by(User.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    aggregates: dict[uuid.UUID, dict] = {
        client.id: {
            "calls": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "cost_usd": 0.0,
            "cost_estimated": True,
            "last_used_at": None,
            "last_model": None,
            "models": {},
        }
        for client in clients
    }
    totals = {
        "calls": 0,
        "input_tokens": 0,
        "output_tokens": 0,
        "total_tokens": 0,
        "cost_usd": 0.0,
        "cost_estimated": True,
    }

    rows = (
        await db.execute(
            select(
                AIVerificationLog.user_id,
                AIVerificationLog.created_at,
                AIVerificationLog.ai_trace,
            ).order_by(AIVerificationLog.created_at.asc())
        )
    ).all()
    for user_id, created_at, ai_trace in rows:
        if user_id not in aggregates:
            continue
        summary = usage_summary_from_trace(ai_trace)
        if not summary["calls"]:
            continue

        aggregate = aggregates[user_id]
        for key in ("calls", "input_tokens", "output_tokens", "total_tokens"):
            aggregate[key] += summary[key]
            totals[key] += summary[key]
        aggregate["cost_usd"] = round(
            aggregate["cost_usd"] + summary["cost_usd"], 8
        )
        totals["cost_usd"] = round(totals["cost_usd"] + summary["cost_usd"], 8)
        aggregate["cost_estimated"] = (
            aggregate["cost_estimated"] and summary["cost_estimated"]
        )
        totals["cost_estimated"] = totals["cost_estimated"] and summary["cost_estimated"]

        trace_calls = ((ai_trace or {}).get("usage") or {}).get("calls") or []
        if trace_calls:
            aggregate["last_model"] = normalise_model(trace_calls[-1].get("model"))
        elif (ai_trace or {}).get("model"):
            aggregate["last_model"] = normalise_model((ai_trace or {}).get("model"))
        aggregate["last_used_at"] = created_at

        for model, model_summary in summary["models"].items():
            model_aggregate = aggregate["models"].setdefault(
                model,
                {
                    "calls": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "cost_usd": 0.0,
                    "cost_estimated": True,
                },
            )
            for key in ("calls", "input_tokens", "output_tokens", "total_tokens"):
                model_aggregate[key] += model_summary[key]
            model_aggregate["cost_usd"] = round(
                model_aggregate["cost_usd"] + model_summary["cost_usd"], 8
            )
            model_aggregate["cost_estimated"] = (
                model_aggregate["cost_estimated"]
                and model_summary["cost_estimated"]
            )

    client_rows = []
    for client in clients:
        aggregate = aggregates[client.id]
        last_used_at = aggregate["last_used_at"]
        client_rows.append(
            {
                "client_id": str(client.id),
                "username": client.username,
                "business_name": client.business_name,
                "email": client.email,
                "active_model": active_model,
                "last_model": aggregate["last_model"],
                "calls": aggregate["calls"],
                "input_tokens": aggregate["input_tokens"],
                "output_tokens": aggregate["output_tokens"],
                "total_tokens": aggregate["total_tokens"],
                "cost_usd": round(aggregate["cost_usd"], 8),
                "cost_estimated": aggregate["cost_estimated"],
                "last_used_at": last_used_at.isoformat() if last_used_at else None,
                "models": aggregate["models"],
            }
        )

    client_rows.sort(key=lambda row: row["cost_usd"], reverse=True)
    return UsageSummaryOut(
        generated_at=datetime.now(timezone.utc).isoformat(),
        active_model=active_model,
        totals=totals,
        clients=client_rows,
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

    persona = payload.ai_persona
    policies_to_add = []
    if payload.business_type:
        template = get_template(payload.business_type)
        if template:
            if not persona:
                persona = template["persona"]
            for pol in template["default_policies"]:
                policies_to_add.append(
                    BusinessPolicy(
                        policy_type=pol["type"],
                        title=pol["title"],
                        content=pol["content"],
                        is_active=True,
                    )
                )

    client = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        business_name=payload.business_name,
        business_type=payload.business_type,
        ai_persona=persona,
        role="client",
    )
    db.add(client)
    await db.flush()
    await sync_persona_settings_from_text(client, db)

    for p in policies_to_add:
        p.user_id = client.id
        db.add(p)

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
        master_system_prompt=row.master_system_prompt or "",
        human_handoff_enabled=row.human_handoff_enabled,
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
    if payload.master_system_prompt is not None:
        row.master_system_prompt = payload.master_system_prompt.strip()
    if payload.human_handoff_enabled is not None:
        row.human_handoff_enabled = payload.human_handoff_enabled
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
        master_system_prompt=row.master_system_prompt or "",
        human_handoff_enabled=row.human_handoff_enabled,
    )


# ─── Manychat Webhook Generation ───────────────────────────────────────────────
@router.post("/clients/{client_id}/manychat-webhook")
async def generate_manychat_webhook(
    client_id: uuid.UUID,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    import secrets

    client = await _get_client(client_id, db)

    # Find or create the shared ManyChat webhook for this client.
    result = await db.execute(
        select(ChannelIntegration).where(
            ChannelIntegration.user_id == client.id,
            ChannelIntegration.platform == "webhook"
        )
    )
    integration = result.scalar_one_or_none()

    credentials = dict((integration.credentials or {}) if integration else {})
    webhook_secret = credentials.get("webhook_secret") or secrets.token_urlsafe(24)
    credentials["webhook_secret"] = webhook_secret

    if not integration:
        integration = ChannelIntegration(
            user_id=client.id,
            platform="webhook",
            public_id=secrets.token_urlsafe(24),
            credentials=credentials,
            is_active=True
        )
        db.add(integration)
    else:
        integration.credentials = credentials

    await db.commit()
    await db.refresh(integration)

    webhook_url = f"{_public_base_url()}/api/webhooks/manychat/{integration.public_id}"
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Secret": webhook_secret,
    }
    request_bodies = {
        "facebook": {
            "platform": "facebook",
            "subscriber_id": "{{user_id}}",
            "text": "{{last_input_text}}",
        },
        "instagram": {
            "platform": "instagram",
            "subscriber_id": "{{user_id}}",
            "text": "{{last_input_text}}",
        },
    }

    return {
        "message": "ManyChat setup generated successfully",
        "method": "POST",
        "block_type": "dynamic_block",
        "response_format": "manychat_dynamic_block_v2",
        "webhook_url": webhook_url,
        "webhook_secret": webhook_secret,
        "headers": headers,
        "required_variables": [
            {
                "json_key": "subscriber_id",
                "manychat_label": "User ID",
                "template": "{{user_id}}",
            },
            {
                "json_key": "text",
                "manychat_label": "Last Input Text",
                "template": "{{last_input_text}}",
            },
        ],
        "flow_steps": [
            "User sends a message",
            "Dynamic Block (use the Auto URL)",
        ],
        "channels": {
            "facebook": {
                "label": "Facebook Messenger",
                "request_url": f"{webhook_url}?platform=facebook&response=dynamic&delivery=auto",
                "body": request_bodies["facebook"],
            },
            "instagram": {
                "label": "Instagram DM",
                "request_url": f"{webhook_url}?platform=instagram&response=dynamic&delivery=auto",
                "body": request_bodies["instagram"],
            },
        },
    }


@router.post("/clients/{client_id}/openwa-webhook")
async def generate_openwa_webhook(
    client_id: uuid.UUID,
    payload: OpenWASetupRequest | None = None,
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    import secrets

    client = await _get_client(client_id, db)
    result = await db.execute(
        select(ChannelIntegration).where(
            ChannelIntegration.user_id == client.id,
            ChannelIntegration.platform == "webhook",
        )
    )
    integration = result.scalar_one_or_none()

    credentials = dict((integration.credentials or {}) if integration else {})
    credentials.setdefault("webhook_secret", secrets.token_urlsafe(24))
    credentials["openwa_webhook_secret"] = credentials.get(
        "openwa_webhook_secret"
    ) or secrets.token_urlsafe(24)

    setup_payload = payload or OpenWASetupRequest()
    if setup_payload.openwa_api_url:
        credentials["openwa_api_url"] = setup_payload.openwa_api_url.rstrip("/")
    elif not credentials.get("openwa_api_url") and env_settings.OPENWA_API_URL:
        credentials["openwa_api_url"] = env_settings.OPENWA_API_URL.rstrip("/")

    if setup_payload.openwa_api_key:
        credentials["openwa_api_key"] = setup_payload.openwa_api_key
    elif not credentials.get("openwa_api_key") and env_settings.OPENWA_API_KEY:
        credentials["openwa_api_key"] = env_settings.OPENWA_API_KEY

    if setup_payload.openwa_session_id:
        credentials["openwa_session_id"] = setup_payload.openwa_session_id
    credentials["openwa_allow_groups"] = setup_payload.allow_groups

    if integration is None:
        integration = ChannelIntegration(
            user_id=client.id,
            platform="webhook",
            public_id=secrets.token_urlsafe(24),
            credentials=credentials,
            is_active=True,
        )
        db.add(integration)
    else:
        integration.credentials = credentials
        integration.is_active = True

    await db.commit()
    await db.refresh(integration)

    webhook_url = f"{_public_base_url()}/api/webhooks/openwa/{integration.public_id}"
    return {
        "message": "OpenWA webhook generated successfully",
        "webhook_url": webhook_url,
        "webhook_secret": credentials["openwa_webhook_secret"],
        "openwa_api_url": credentials.get("openwa_api_url", env_settings.OPENWA_API_URL),
        "openwa_session_id": credentials.get("openwa_session_id"),
        "allow_groups": credentials.get("openwa_allow_groups", False),
        "openwa_webhook_payload": {
            "url": webhook_url,
            "events": ["message.received"],
            "secret": credentials["openwa_webhook_secret"],
            "retryCount": 3,
        },
    }


@router.post("/seed-test-store")
async def reset_test_store(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # Find the user with username "test_store"
    result = await db.execute(select(User).where(User.username == "test_store"))
    user = result.scalar_one_or_none()

    if user is not None:
        # Delete existing products, policies, workflows of test_store user
        await db.execute(delete(Item).where(Item.user_id == user.id))
        await db.execute(delete(BusinessPolicy).where(BusinessPolicy.user_id == user.id))
        await db.execute(delete(BusinessWorkflow).where(BusinessWorkflow.user_id == user.id))
        await db.commit()

    # Run seed_store using the current db session
    await seed_store(db)

    return {"ok": True, "message": "Test store reset and seeded successfully!"}


@router.get("/pricing-breakdown")
async def get_pricing_breakdown(
    _: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    # 1. Total messages
    total_messages = await db.scalar(select(func.count()).select_from(Message))

    # 2. Total verification logs
    total_logs = await db.scalar(select(func.count()).select_from(AIVerificationLog))

    # 3. Retrieve verification logs for cost calculations
    result = await db.execute(
        select(
            AIVerificationLog.user_id,
            User.username,
            User.business_name,
            AIVerificationLog.customer_message,
            AIVerificationLog.draft_answer,
            AIVerificationLog.final_answer,
            AIVerificationLog.retrieved_data,
            AIVerificationLog.ai_trace
        ).join(User, User.id == AIVerificationLog.user_id)
    )
    logs = result.all()

    # Get default AI model from settings
    app_settings = await get_settings_row(db)
    default_model = app_settings.ai_model or "gpt-4o"

    total_cost = 0.0
    by_model = {}
    by_client = {}

    for user_id, username, b_name, cust_msg, draft, final, retrieved, ai_tr in logs:
        # Estimate input tokens: input message + retrieved context strings
        cust_msg_len = len(cust_msg or "")
        retrieved_len = len(str(retrieved or ""))
        input_chars = cust_msg_len + retrieved_len
        # Apply a base cost for prompt context
        input_tokens = max(500.0, input_chars / 3.0)

        # Estimate output tokens
        ans = final or draft or ""
        output_tokens = len(ans) / 3.0

        # Identify model
        model = default_model
        if ai_tr and isinstance(ai_tr, dict):
            model = ai_tr.get("model", default_model)

        # Rates
        if model.startswith("gpt-4o-mini"):
            input_rate = 0.00015
            output_rate = 0.0006
        else:
            input_rate = 0.005
            output_rate = 0.015

        cost = (input_tokens / 1000.0) * input_rate + (output_tokens / 1000.0) * output_rate
        total_cost += cost

        # Group by model
        if model not in by_model:
            by_model[model] = {"message_count": 0, "estimated_cost": 0.0}
        by_model[model]["message_count"] += 1
        by_model[model]["estimated_cost"] += cost

        # Group by client
        client_key = str(user_id)
        if client_key not in by_client:
            by_client[client_key] = {
                "client_id": client_key,
                "username": username,
                "business_name": b_name or username,
                "message_count": 0,
                "estimated_cost": 0.0
            }
        by_client[client_key]["message_count"] += 1
        by_client[client_key]["estimated_cost"] += cost

    return {
        "total_messages": total_messages or 0,
        "total_verification_logs": total_logs or 0,
        "total_estimated_cost": round(total_cost, 6),
        "by_model": {
            m: {"message_count": v["message_count"], "estimated_cost": round(v["estimated_cost"], 6)}
            for m, v in by_model.items()
        },
        "by_client": [
            {
                "client_id": c["client_id"],
                "username": c["username"],
                "business_name": c["business_name"],
                "message_count": c["message_count"],
                "estimated_cost": round(c["estimated_cost"], 6)
            }
            for c in by_client.values()
        ]
    }
