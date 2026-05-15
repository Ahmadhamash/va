import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import ChatSession, Message, User
from schemas.chat import ChatSendResponse, MessageOut, SessionOut
from services.ai_service import TranscriptionError, process_message, save_message
from services.file_service import save_upload

router = APIRouter(prefix="/chat", tags=["chat"])

_AUDIO_FALLBACK = "Couldn't process audio, please type your message"


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


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def session_messages(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_session(session_id, current_user, db)
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    return list(result.scalars().all())


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_owned_session(session_id, current_user, db)
    await db.delete(session)
    await db.commit()
