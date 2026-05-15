from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from middleware.auth_middleware import get_current_user
from models import User
from schemas.user import Token, UserLogin, UserOut, UserRegister
from services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where(
            or_(User.username == payload.username, User.email == payload.email)
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered",
        )

    # First account on a fresh deployment becomes the platform admin.
    user_count = await db.scalar(select(func.count()).select_from(User))
    role = "admin" if not user_count else "client"

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        business_name=payload.business_name,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled"
        )

    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
