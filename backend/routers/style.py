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
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import StyleSample, User
from schemas.style import StyleSampleOut, StyleUploadResult
from services.style_service import build_samples, parse_conversation

router = APIRouter(prefix="/style", tags=["style"])

MAX_UPLOAD = 8 * 1024 * 1024  # 8 MB
ALLOWED_EXT = {"txt", "json", "csv"}
HARD_CAP = 200  # max stored samples per client


@router.post("/upload", response_model=StyleUploadResult)
async def upload_conversation(
    file: UploadFile = File(...),
    my_name: str | None = Form(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Style training is for client accounts",
        )

    filename = file.filename or "conversation.txt"
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a .txt, .json, or .csv conversation export",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file"
        )
    if len(raw) > MAX_UPLOAD:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 8MB limit",
        )

    try:
        turns = parse_conversation(filename, raw)
    except Exception:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not parse this file. Use a WhatsApp/Messenger export "
            "(.txt/.json) or a CSV with sender/text columns.",
        )

    new_samples = build_samples(turns, my_name)
    if not new_samples:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No usable messages found in the file",
        )

    existing = await db.scalar(
        select(func.count())
        .select_from(StyleSample)
        .where(StyleSample.user_id == current_user.id)
    )
    room = max(0, HARD_CAP - existing)
    to_add = new_samples[:room]
    for s in to_add:
        db.add(
            StyleSample(user_id=current_user.id, source=f"upload:{ext}", sample=s)
        )
    await db.commit()

    total = await db.scalar(
        select(func.count())
        .select_from(StyleSample)
        .where(StyleSample.user_id == current_user.id)
    )
    return StyleUploadResult(added=len(to_add), total=total)


@router.get("/samples", response_model=list[StyleSampleOut])
async def list_samples(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(StyleSample)
        .where(StyleSample.user_id == current_user.id)
        .order_by(StyleSample.created_at.desc())
    )
    return list(rows.scalars().all())


@router.delete("/samples/{sample_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sample(
    sample_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StyleSample).where(
            StyleSample.id == sample_id,
            StyleSample.user_id == current_user.id,
        )
    )
    sample = result.scalar_one_or_none()
    if sample is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sample not found"
        )
    await db.delete(sample)
    await db.commit()


@router.delete("/samples", status_code=status.HTTP_204_NO_CONTENT)
async def clear_samples(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(StyleSample).where(StyleSample.user_id == current_user.id)
    )
    await db.commit()
