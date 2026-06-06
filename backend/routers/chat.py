import uuid

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
from models import ChatSession, Message, User
from schemas.chat import ChatSendResponse, MessageOut, SessionOut
from services.ai_media import TranscriptionError
from services.ai_chat import process_message, save_message, generate_preview_reply
from services.file_service import save_upload

router = APIRouter(prefix="/chat", tags=["chat"])

_AUDIO_FALLBACK = "Couldn't process audio, please type your message"


class PreviewRequest(BaseModel):
    message: str
    persona: str


class SessionNotesUpdate(BaseModel):
    note: str = ""


class AutoReplyUpdate(BaseModel):
    enabled: bool


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
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
        .offset(skip).limit(limit)
    )
    sessions = result.scalars().all()
    session_ids = [s.id for s in sessions]

    last_messages = {}
    last_handoffs = {}
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
    
    out = []
    for s in sessions:
        msg = last_messages.get(s.id)
        handoff = last_handoffs.get(s.id)
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
    await _get_owned_session(session_id, current_user, db)
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
        .offset(skip).limit(limit)
    )
    return list(result.scalars().all())


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
    session = await _get_session_for_actor(session_id, current_user, db)
    return await _set_session_status(session, db, raw_status="assigned")


@router.post("/sessions/{session_id}/return-to-ai")
async def return_session_to_ai(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session_for_actor(session_id, current_user, db)
    return await _set_session_status(session, db, raw_status="returned_to_ai")


@router.post("/sessions/{session_id}/close")
async def close_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session_for_actor(session_id, current_user, db)
    return await _set_session_status(session, db, raw_status="resolved")


@router.post("/sessions/{session_id}/agent-message", response_model=MessageOut)
async def agent_send_message(
    session_id: uuid.UUID,
    message: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Agents/admins can reply. Also, business owner (client) can reply to their own sessions.
    session = await db.get(ChatSession, session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    if current_user.role == "client" and session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized"
        )
    message = (message or "").strip()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message is required",
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
            delivery = await adapter.send_text_message(
                session.external_user_id,
                message,
                credentials,
            )
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
        content=message,
        media_type="text",
        media_url=None,
        db=db,
    )

    return msg


@router.delete("/sessions")
async def delete_all_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    session = await _get_owned_session(session_id, current_user, db)
    await db.delete(session)
    await db.commit()
