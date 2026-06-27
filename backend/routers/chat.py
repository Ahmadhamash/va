import uuid
from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, select
from sse_starlette.sse import EventSourceResponse
import json

from database import get_db
from middleware.auth_middleware import get_current_user
from models import (
    BusinessPolicy,
    ChannelIntegration,
    ChatSession,
    Item,
    Message,
    MessageDeliveryLog,
    User,
    AIVerificationLog,
)
from schemas.chat import ChatSendResponse, MessageOut, SessionOut
from services.ai_media import TranscriptionError
from services.ai_chat import process_message, save_message, generate_preview_reply
from services.file_service import save_upload

router = APIRouter(prefix="/chat", tags=["chat"])

_AUDIO_FALLBACK = "Couldn't process audio, please type your message"
_CONVERSATION_STAFF_ROLES = {"admin", "support_agent"}


class PreviewRequest(BaseModel):
    message: str
    persona: str


class SessionNotesUpdate(BaseModel):
    note: str = ""


class AutoReplyUpdate(BaseModel):
    enabled: bool


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _parse_metadata_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


async def _get_owned_session(
    session_id: uuid.UUID, user: User, db: AsyncSession
) -> ChatSession:
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == session_id, ChatSession.user_id == user.id
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return session


async def _get_session_for_actor(
    session_id: uuid.UUID, user: User, db: AsyncSession
) -> ChatSession:
    session = await db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    if user.role == "client" and session.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )
    if user.role not in ("client", "admin", "support_agent"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )
    return session


def _require_conversation_staff(user: User) -> None:
    if user.role not in _CONVERSATION_STAFF_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conversation actions are available to employees and admins only",
        )


async def _set_session_status(
    session: ChatSession,
    db: AsyncSession,
    *,
    raw_status: str,
) -> dict:
    metadata = dict(session.metadata_ or {})
    if raw_status == "assigned":
        session.is_escalated = True
        metadata["status"] = "human_active"
    elif raw_status == "returned_to_ai":
        session.is_escalated = False
        metadata["status"] = "ai_handling"
    elif raw_status == "resolved":
        session.is_escalated = True
        metadata["status"] = "closed"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status"
        )
    session.metadata_ = metadata
    await db.commit()
    await db.refresh(session)
    return {"session_id": str(session.id), "raw_status": raw_status}


@router.post("/send", response_model=ChatSendResponse)
async def send_message(
    message: str | None = Form(default=None),
    session_id: uuid.UUID | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    media_type = "text"
    media_url: str | None = None

    if file is not None and file.filename:
        media_url, media_type = await save_upload(file, current_user.id)

    if media_type == "text" and not (message and message.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a message or a file",
        )

    # Resolve or create the session
    if session_id is not None:
        session = await _get_owned_session(session_id, current_user, db)
    else:
        title = (message or "New conversation").strip()[:60] or "New conversation"
        session = ChatSession(user_id=current_user.id, title=title)
        db.add(session)
        await db.commit()
        await db.refresh(session)

    try:
        result = await process_message(
            user_message=message or "",
            user=current_user,
            session_id=session.id,
            db=db,
            media_type=media_type,
            media_url=media_url,
        )
    except TranscriptionError:
        await save_message(
            session.id, "user", None, "audio", media_url, db
        )
        await save_message(
            session.id, "assistant", _AUDIO_FALLBACK, "text", None, db
        )
        return ChatSendResponse(
            session_id=session.id, reply=_AUDIO_FALLBACK, transcription=None
        )

    return ChatSendResponse(
        session_id=session.id,
        reply=result["reply"],
        transcription=result.get("transcription"),
        image_url=result.get("image_url"),
    )

@router.post("/preview")
async def preview_message(
    payload: PreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.message or not payload.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a message",
        )
    
    reply = await generate_preview_reply(payload.persona, payload.message, db)
    return {"reply": reply}

@router.post("/stream")
async def send_message_stream(
    message: str | None = Form(default=None),
    session_id: uuid.UUID | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not message or not message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a message",
        )

    if session_id is not None:
        session = await _get_owned_session(session_id, current_user, db)
    else:
        title = message.strip()[:60]
        session = ChatSession(user_id=current_user.id, title=title)
        db.add(session)
        await db.commit()
        await db.refresh(session)

    async def event_generator():
        yield {"event": "start", "data": json.dumps({"session_id": str(session.id)})}
        try:
            result = await process_message(
                user_message=message,
                user=current_user,
                session_id=session.id,
                db=db,
                media_type="text",
                media_url=None,
            )
            reply = result["reply"]
            audio_url = result.get("audio_url")
            import asyncio
            
            # Stream chunk by chunk for typing effect
            chunk_size = 5
            for i in range(0, len(reply), chunk_size):
                chunk = reply[i:i+chunk_size]
                yield {"event": "chunk", "data": json.dumps({"text": chunk})}
                await asyncio.sleep(0.01)
                
            if audio_url:
                yield {"event": "audio", "data": json.dumps({"url": audio_url})}
                
        except Exception as e:
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}
        finally:
            yield {"event": "done", "data": ""}

    return EventSourceResponse(event_generator())

@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .offset(skip).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/auto-reply")
async def get_auto_reply_status(
    current_user: User = Depends(get_current_user),
):
    return {"enabled": getattr(current_user, "ai_auto_reply_enabled", True)}


@router.put("/auto-reply")
async def update_auto_reply_status(
    payload: AutoReplyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.ai_auto_reply_enabled = payload.enabled
    await db.commit()
    return {"enabled": current_user.ai_auto_reply_enabled}


@router.get("/inbox-conversations")
async def inbox_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from models import HandoffSession
    stmt = select(ChatSession)
    if current_user.role not in _CONVERSATION_STAFF_ROLES:
        stmt = stmt.where(ChatSession.user_id == current_user.id)
    result = await db.execute(
        stmt
        .order_by(ChatSession.created_at.desc())
        .offset(skip).limit(limit)
    )
    sessions = result.scalars().all()
    session_ids = [s.id for s in sessions]

    last_messages = {}
    last_handoffs = {}
    unread_counts: dict[uuid.UUID, int] = {}
    last_delivery_status: dict[uuid.UUID, str] = {}
    if session_ids:
        msg_rank = (
            select(
                Message.session_id,
                Message.content,
                Message.created_at,
                func.row_number()
                .over(
                    partition_by=Message.session_id,
                    order_by=Message.created_at.desc(),
                )
                .label("rn"),
            )
            .where(
                Message.session_id.in_(session_ids),
                Message.content.isnot(None),
            )
            .subquery()
        )
        msg_rows = await db.execute(
            select(msg_rank.c.session_id, msg_rank.c.content, msg_rank.c.created_at)
            .where(msg_rank.c.rn == 1)
        )
        last_messages = {row.session_id: row for row in msg_rows}

        handoff_rank = (
            select(
                HandoffSession.session_id,
                HandoffSession.status,
                HandoffSession.ai_suggested_reply,
                func.row_number()
                .over(
                    partition_by=HandoffSession.session_id,
                    order_by=HandoffSession.created_at.desc(),
                )
                .label("rn"),
            )
            .where(HandoffSession.session_id.in_(session_ids))
            .subquery()
        )
        handoff_rows = await db.execute(
            select(
                handoff_rank.c.session_id,
                handoff_rank.c.status,
                handoff_rank.c.ai_suggested_reply,
            ).where(handoff_rank.c.rn == 1)
        )
        last_handoffs = {row.session_id: row for row in handoff_rows}

        user_msg_rows = await db.execute(
            select(Message.session_id, Message.created_at)
            .where(
                Message.session_id.in_(session_ids),
                Message.role == "user",
            )
        )
        last_viewed = {
            s.id: _parse_metadata_time((s.metadata_ or {}).get("last_viewed_at"))
            for s in sessions
        }
        for row in user_msg_rows:
            viewed_at = last_viewed.get(row.session_id)
            created_at = row.created_at
            if created_at and created_at.tzinfo is not None:
                created_at = created_at.astimezone(timezone.utc).replace(tzinfo=None)
            if viewed_at is None or (created_at and created_at > viewed_at):
                unread_counts[row.session_id] = unread_counts.get(row.session_id, 0) + 1

        delivery_rank = (
            select(
                MessageDeliveryLog.session_id,
                MessageDeliveryLog.status,
                func.row_number()
                .over(
                    partition_by=MessageDeliveryLog.session_id,
                    order_by=MessageDeliveryLog.created_at.desc(),
                )
                .label("rn"),
            )
            .where(MessageDeliveryLog.session_id.in_(session_ids))
            .subquery()
        )
        delivery_rows = await db.execute(
            select(delivery_rank.c.session_id, delivery_rank.c.status)
            .where(delivery_rank.c.rn == 1)
        )
        last_delivery_status = {row.session_id: row.status for row in delivery_rows}

    owner_ids = sorted({s.user_id for s in sessions}, key=str)
    owners: dict[uuid.UUID, User] = {}
    catalog_context: dict[uuid.UUID, dict] = {}
    knowledge_context: dict[uuid.UUID, dict] = {}
    channel_context: dict[tuple[uuid.UUID, str], dict] = {}
    message_counts: dict[uuid.UUID, int] = {}

    if owner_ids:
        owner_rows = await db.execute(select(User).where(User.id.in_(owner_ids)))
        owners = {owner.id: owner for owner in owner_rows.scalars().all()}

        item_rows = await db.execute(
            select(Item.user_id, Item.category, func.count())
            .where(Item.user_id.in_(owner_ids))
            .group_by(Item.user_id, Item.category)
        )
        for user_id, category, count in item_rows:
            ctx = catalog_context.setdefault(
                user_id,
                {"product_count": 0, "categories": []},
            )
            ctx["product_count"] += int(count or 0)
            if category and category not in ctx["categories"]:
                ctx["categories"].append(category)

        policy_rows = await db.execute(
            select(BusinessPolicy.user_id, BusinessPolicy.policy_type, func.count())
            .where(
                BusinessPolicy.user_id.in_(owner_ids),
                BusinessPolicy.is_active.is_(True),
            )
            .group_by(BusinessPolicy.user_id, BusinessPolicy.policy_type)
        )
        for user_id, policy_type, count in policy_rows:
            ctx = knowledge_context.setdefault(
                user_id,
                {"item_count": 0, "categories": []},
            )
            ctx["item_count"] += int(count or 0)
            if policy_type and policy_type not in ctx["categories"]:
                ctx["categories"].append(policy_type)

        integration_rows = await db.execute(
            select(ChannelIntegration).where(
                ChannelIntegration.user_id.in_(owner_ids),
                ChannelIntegration.is_active.is_(True),
            )
        )
        for integration in integration_rows.scalars().all():
            credentials = integration.credentials or {}
            channel_context[(integration.user_id, integration.platform)] = {
                "platform": integration.platform,
                "public_id": integration.public_id,
                "page_id": credentials.get("page_id")
                or credentials.get("phone_number_id")
                or credentials.get("ig_user_id"),
                "page_name": credentials.get("page_name")
                or credentials.get("display_phone_number")
                or credentials.get("account_name"),
            }

    if session_ids:
        count_rows = await db.execute(
            select(Message.session_id, func.count())
            .where(Message.session_id.in_(session_ids))
            .group_by(Message.session_id)
        )
        message_counts = {
            session_id: int(count or 0)
            for session_id, count in count_rows
        }
    
    out = []
    for s in sessions:
        msg = last_messages.get(s.id)
        handoff = last_handoffs.get(s.id)
        owner = owners.get(s.user_id)
        metadata = s.metadata_ or {}
        metadata_status = (s.metadata_ or {}).get("status")
        if metadata_status == "closed":
            raw_status = "resolved"
        elif s.is_escalated:
            raw_status = "assigned"
        else:
            raw_status = handoff.status if handoff else "returned_to_ai"
        
        out.append({
            "id": str(s.id),
            "customerName": s.title or "عميل",
            "customerPhone": s.external_user_id or "",
            "channel": s.channel.upper(),
            "raw_status": raw_status,
            "lastMessage": msg.content if msg else "",
            "lastMessageAt": msg.created_at.isoformat() if msg else s.created_at.isoformat(),
            "aiSuggestedReply": handoff.ai_suggested_reply if handoff else None,
            "unreadCount": unread_counts.get(s.id, 0),
            "deliveryStatus": last_delivery_status.get(s.id),
            "context": {
                "connectedAccount": channel_context.get((s.user_id, s.channel), {
                    "platform": s.channel,
                    "public_id": None,
                    "page_id": None,
                    "page_name": None,
                }),
                "business": {
                    "id": str(s.user_id),
                    "name": owner.business_name if owner else None,
                    "type": owner.business_type if owner else None,
                    "aiAutoReplyEnabled": bool(
                        getattr(owner, "ai_auto_reply_enabled", True)
                    ) if owner else True,
                },
                "customer": {
                    "externalUserId": s.external_user_id,
                    "displayName": s.title,
                    "tags": list(metadata.get("tags", [])),
                },
                "productCatalog": catalog_context.get(
                    s.user_id,
                    {"product_count": 0, "categories": []},
                ),
                "knowledgeBase": knowledge_context.get(
                    s.user_id,
                    {"item_count": 0, "categories": []},
                ),
                "previousInteractions": {
                    "message_count": message_counts.get(s.id, 0),
                    "last_viewed_at": metadata.get("last_viewed_at"),
                },
            },
        })
    return out



@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def session_messages(
    session_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session_for_actor(session_id, current_user, db)
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .offset(skip).limit(limit)
    )
    rows = list(result.scalars().all())

    # Fetch verification logs for these messages
    message_ids = [m.id for m in rows if m.role == "assistant"]
    verification_logs = {}
    if message_ids:
        vl_result = await db.execute(
            select(AIVerificationLog)
            .where(AIVerificationLog.message_id.in_(message_ids))
        )
        for vl in vl_result.scalars().all():
            verification_logs[vl.message_id] = (vl.risk_score, vl.verifier_status)

    for m in rows:
        if m.role == "assistant" and m.id in verification_logs:
            m.risk_score, m.verifier_status = verification_logs[m.id]
        else:
            m.risk_score = None
            m.verifier_status = None

    response_rows = [MessageOut.model_validate(m) for m in rows]
    metadata = dict(session.metadata_ or {})
    metadata["last_viewed_at"] = _utcnow_iso()
    session.metadata_ = metadata
    await db.commit()
    return response_rows


@router.get("/sessions/{session_id}/notes")
async def session_notes(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session_for_actor(session_id, current_user, db)
    return {"note": (session.metadata_ or {}).get("note", "")}


@router.put("/sessions/{session_id}/notes")
async def update_session_notes(
    session_id: uuid.UUID,
    payload: SessionNotesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client role is read-only for this action",
        )
    _require_conversation_staff(current_user)
    session = await _get_session_for_actor(session_id, current_user, db)
    metadata = dict(session.metadata_ or {})
    metadata["note"] = (payload.note or "").strip()[:5000]
    session.metadata_ = metadata
    await db.commit()
    return {"note": metadata["note"]}


@router.post("/sessions/{session_id}/takeover")
async def takeover_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client role is read-only for this action",
        )
    _require_conversation_staff(current_user)
    session = await _get_session_for_actor(session_id, current_user, db)
    return await _set_session_status(session, db, raw_status="assigned")


@router.post("/sessions/{session_id}/return-to-ai")
async def return_session_to_ai(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client role is read-only for this action",
        )
    _require_conversation_staff(current_user)
    session = await _get_session_for_actor(session_id, current_user, db)
    return await _set_session_status(session, db, raw_status="returned_to_ai")


@router.post("/sessions/{session_id}/close")
async def close_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client role is read-only for this action",
        )
    _require_conversation_staff(current_user)
    session = await _get_session_for_actor(session_id, current_user, db)
    return await _set_session_status(session, db, raw_status="resolved")


@router.post("/sessions/{session_id}/agent-message", response_model=MessageOut)
async def agent_send_message(
    session_id: uuid.UUID,
    message: str = Form(default=""),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role == "client":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client role is read-only for this action",
        )
    _require_conversation_staff(current_user)
    # Employees/admins can reply to customer conversations.
    session = await db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    message = (message or "").strip()
    media_type = "text"
    media_url: str | None = None
    if file is not None and file.filename:
        media_url, media_type = await save_upload(file, session.user_id)

    if not message and media_type == "text":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message or file is required",
        )
    if not session.is_escalated or (session.metadata_ or {}).get("status") != "human_active":
        await _set_session_status(session, db, raw_status="assigned")

    # Dispatch to the external channel
    if session.channel in ("messenger", "instagram", "whatsapp") and session.external_user_id:
        from models import ChannelIntegration
        from services.channels import get_adapter
        res = await db.execute(
            select(ChannelIntegration).where(
                ChannelIntegration.user_id == session.user_id,
                ChannelIntegration.platform == session.channel,
                ChannelIntegration.is_active.is_(True),
            )
        )
        integration = res.scalar_one_or_none()
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No active {session.channel} integration",
            )
        adapter = get_adapter(session.channel)
        credentials = integration.credentials or {}
        try:
            if media_type == "image" and media_url:
                delivery = await adapter.send_image_message(
                    session.external_user_id,
                    media_url,
                    credentials,
                )
                if delivery.success and message:
                    delivery = await adapter.send_text_message(
                        session.external_user_id,
                        message,
                        credentials,
                    )
            elif media_type == "audio" and media_url:
                delivery = await adapter.send_audio_message(
                    session.external_user_id,
                    media_url,
                    credentials,
                )
                if delivery.success and message:
                    delivery = await adapter.send_text_message(
                        session.external_user_id,
                        message,
                        credentials,
                    )
            elif media_type != "text":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{media_type} sending is not supported for {session.channel}",
                )
            else:
                delivery = await adapter.send_text_message(
                    session.external_user_id,
                    message,
                    credentials,
                )
        except HTTPException:
            raise
        except Exception as e:
            import logging

            logging.getLogger("agent-send").exception(
                "Failed to send message to %s", session.channel,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to send message to {session.channel}",
            ) from e
        if not delivery.success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=delivery.error_message or f"Failed to send message to {session.channel}",
            )

    msg = await save_message(
        session_id=session.id,
        role="agent",
        content=message or (file.filename if file else ""),
        media_type=media_type,
        media_url=media_url,
        db=db,
    )

    return msg


@router.delete("/sessions")
async def delete_all_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_conversation_staff(current_user)
    result = await db.execute(
        delete(ChatSession).where(ChatSession.user_id == current_user.id)
    )
    await db.commit()
    return {"deleted": result.rowcount or 0}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_conversation_staff(current_user)
    session = await _get_session_for_actor(session_id, current_user, db)
    await db.delete(session)
    await db.commit()
