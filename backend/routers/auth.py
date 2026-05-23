import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
import jwt
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from middleware.auth_middleware import get_current_user
from models import User
from schemas.user import Token, UserLogin, UserOut, UserRegister, PasswordReset, UserUpdate
from services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)
from services.business_templates import get_template
from models import BusinessPolicy
from services.ratelimit import limiter

logger = logging.getLogger(__name__)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

def create_refresh_token(subject: str, token_version: int = 1) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": "refresh",
        "exp": now + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
        "v": token_version,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_reset_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "type": "reset",
        "exp": now + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def register(
    request: Request, response: Response, payload: UserRegister, db: AsyncSession = Depends(get_db)
):
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

    # Acquire advisory lock to prevent race conditions on initial admin creation
    import sqlalchemy as sa
    await db.execute(sa.text("SELECT pg_advisory_xact_lock(123456789)"))
    
    # First account on a fresh deployment becomes the platform admin.
    user_count = await db.scalar(select(func.count()).select_from(User))
    role = "admin" if not user_count else "client"

    # Apply template if business_type is provided
    persona = None
    policies_to_add = []
    if payload.business_type:
        template = get_template(payload.business_type)
        if template:
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

    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        business_name=payload.business_name,
        business_type=payload.business_type,
        ai_persona=persona,
        role=role,
    )
    db.add(user)
    await db.flush()  # To get user.id for policies

    for p in policies_to_add:
        p.user_id = user.id
        db.add(p)

    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), {"v": user.token_version})
    refresh_token = create_refresh_token(str(user.id), token_version=user.token_version)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )
    return Token(access_token=token)


@router.post("/login", response_model=Token)
@limiter.limit("20/minute")
async def login(
    request: Request, response: Response, payload: UserLogin, db: AsyncSession = Depends(get_db)
):
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

    token = create_access_token(str(user.id), {"v": user.token_version})
    refresh_token = create_refresh_token(str(user.id), token_version=user.token_version)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserOut)
async def update_me(payload: UserUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.business_name is not None:
        current_user.business_name = payload.business_name
    if payload.ai_persona is not None:
        current_user.ai_persona = payload.ai_persona
    if payload.business_type is not None:
        current_user.business_type = payload.business_type
        
        # Optionally populate template if they set type and don't have persona
        if not current_user.ai_persona:
            template = get_template(payload.business_type)
            if template:
                current_user.ai_persona = template["persona"]
                for pol in template["default_policies"]:
                    db.add(BusinessPolicy(
                        user_id=current_user.id,
                        policy_type=pol["type"],
                        title=pol["title"],
                        content=pol["content"],
                        is_active=True,
                    ))

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )
    try:
        payload = jwt.decode(refresh_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        subject = payload.get("sub")
        if subject is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = uuid.UUID(subject)
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    # verify user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    if payload.get("v") != user.token_version:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    new_access_token = create_access_token(str(user.id), {"v": user.token_version})
    new_refresh_token = create_refresh_token(str(user.id), token_version=user.token_version)
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )
    return Token(access_token=new_access_token)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user:
        reset_token = create_reset_token(str(user.id))
        reset_link = f"{settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else 'http://localhost:3000'}/reset-password?token={reset_token}"
        logger.info("Password reset link: %s", reset_link)
    # Always return success to prevent email enumeration
    return {"message": "If that email is registered, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(token: str, payload: PasswordReset, db: AsyncSession = Depends(get_db)):
    try:
        jwt_payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if jwt_payload.get("type") != "reset":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token type")
        subject = jwt_payload.get("sub")
        if subject is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token")
        user_id = uuid.UUID(subject)
    except (jwt.PyJWTError, ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    user.hashed_password = hash_password(payload.new_password)
    user.token_version += 1
    await db.commit()
    return {"message": "Password updated successfully"}
